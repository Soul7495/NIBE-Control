import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){
 const classes=new Map();
 const stateSource=readFileSync(new URL('../src/state.js',import.meta.url),'utf8').replace(/export /g,'');
 const source=readFileSync(new URL('../src/nibe-control.js',import.meta.url),'utf8').replace(/^import .*state.js.*;\n/m,stateSource);
 vm.runInNewContext(source,{HTMLElement:class{},window:{},customElements:{get:k=>classes.get(k),define:(k,v)=>classes.set(k,v)},Intl});
 const card=new (classes.get('nibe-control-card'))();
 const make=dataset=>({dataset,textContent:'',classList:{values:new Set(),toggle(k,on){on?this.values.add(k):this.values.delete(k);}},closest(){return this;}});
 const main=make({}), machine=make({}), water=make({destination:'water'}), heat=make({destination:'heat'}), label=make({}), branch=make({branch:'water'}),sg=make({}),evcc=make({state:'evccEnabled'});
 const selectors={'main':main,'.machine':machine,'.energy-node.sg':sg};
 const lists={'[data-operation]':[label],'[data-destination]':[water,heat],'[data-branch]':[branch],'[data-state]':[evcc]};
 card.shadowRoot={querySelector:s=>selectors[s]||null,querySelectorAll:s=>lists[s]||[]};
 card.mapping=Object.fromEntries(['priority','compressorHz','alarm','defrost','sgA','sgB','evccEnabled'].map(x=>[x,x]));
 card._hass={connected:true,states:Object.fromEntries(Object.entries({priority:30,compressorHz:40,alarm:0,defrost:0,sgA:0,sgB:1,evccEnabled:'on'}).map(([k,v])=>[k,{state:String(v),attributes:{}}]))};
 return {card,main,machine,water,heat,label,branch,evcc};
}
test('component refresh changes heat→water without rebuilding DOM',()=>{
 const f=fixture();f.card.paintValues();assert.equal(f.label.textContent,'Heizbetrieb');assert.equal(f.heat.classList.values.has('is-active'),true);
 const root=f.card.shadowRoot;f.card._hass.states.priority.state='20';f.card.paintValues();
 assert.equal(f.card.shadowRoot,root);assert.equal(f.label.textContent,'Warmwasserbereitung');assert.equal(f.water.classList.values.has('is-active'),true);assert.equal(f.heat.classList.values.has('is-active'),false);
});
test('component refresh stops animation and branches on alarm',()=>{
 const f=fixture();f.card.paintValues();f.card._hass.states.alarm.state='308';f.card.paintValues();
 assert.equal(f.main.className,'app alarm');assert.equal(f.machine.classList.values.has('active'),false);assert.equal(f.water.classList.values.has('is-active'),false);
});
test('component refresh distinguishes EVCC missing from disabled',()=>{
 const f=fixture();f.card._hass.states.evccEnabled.state='unavailable';f.card.paintValues();assert.equal(f.evcc.textContent,'Nicht verfügbar');
 f.card._hass.states.evccEnabled.state='off';f.card.paintValues();assert.equal(f.evcc.textContent,'Aus');
});
test('filter reset sends nothing before confirmation and targets only configured date helper',async()=>{
 const {card}=fixture();const nodes={};const sent=[];
 for(const k of ['#maintenance-confirm','#filter-change','#maintenance-description','[data-maintenance-error]','#maintenance-cancel','#maintenance-save','[data-maintenance-feedback]'])nodes[k]={disabled:false,textContent:'',focus(){},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();}};
 card.shadowRoot.querySelector=s=>nodes[s];card.config={ventilation:{filter_date_entity:'input_datetime.filter_test'}};
 card._hass.states['input_datetime.filter_test']={state:'2026-08-01',attributes:{has_date:true}};
 card._hass.callService=async(...args)=>sent.push(args);
 card.bindMaintenance();nodes['#filter-change'].onclick();assert.equal(sent.length,0);
 nodes['#maintenance-cancel'].onclick();assert.equal(sent.length,0);
 nodes['#filter-change'].onclick();await nodes['#maintenance-save'].onclick();
 assert.equal(sent.length,1);assert.equal(sent[0][0],'input_datetime');assert.equal(sent[0][1],'set_datetime');assert.equal(sent[0][2].entity_id,'input_datetime.filter_test');
});
test('plant navigation separates heatpump and ventilation without rebuilding',()=>{
 const {card}=fixture();const wp={dataset:{plant:'heatpump'},setAttribute(k,v){this[k]=v;}},vent={dataset:{plant:'ventilation'},setAttribute(k,v){this[k]=v;}};
 const tabs=[{hidden:true},{hidden:true}],nav={hidden:true},hint={hidden:false},section={hidden:true};
 card.shadowRoot={querySelector:s=>s==='nav'?nav:hint,querySelectorAll:s=>s==='[data-plant]'?[wp,vent]:tabs,getElementById:()=>section};
 card.selectPlant('ventilation');assert.equal(nav.hidden,true);assert.equal(section.hidden,false);assert.ok(tabs.every(t=>t.hidden));assert.equal(vent['aria-pressed'],'true');
 card.selectPlant('heatpump');assert.equal(nav.hidden,false);assert.equal(section.hidden,true);assert.ok(tabs.every(t=>!t.hidden));assert.equal(wp['aria-pressed'],'true');
});
test('maintenance reuses an existing helper using registry identity',async()=>{
 const {card}=fixture();card.meta={ventilationSupply:{config_entry_id:'installation-a'}};card.helperIds={};const calls=[];
 card._hass.callWS=async msg=>{calls.push(msg);return msg.type==='input_number/list'?[{id:'existing',name:card.helperName('interval')}]:[{platform:'input_number',unique_id:'existing',entity_id:'input_number.renamed'}];};
 assert.equal(await card.ensureMaintenanceHelper('interval'),'input_number.renamed');assert.equal(calls.some(m=>m.type.endsWith('/create')),false);
});
test('maintenance helper creation is scoped and does not set a restart initial value',async()=>{
 const {card}=fixture();card.meta={ventilationSupply:{config_entry_id:'installation-b'}};card.helperIds={};const calls=[];
 card._hass.callWS=async msg=>{calls.push(msg);return msg.type.endsWith('/list')&&msg.type!=='config/entity_registry/list'?[]:msg.type.endsWith('/create')?{id:'created'}:[{platform:'input_number',unique_id:'created',entity_id:'input_number.created'}];};
 assert.equal(await card.ensureMaintenanceHelper('interval'),'input_number.created');const create=calls.find(m=>m.type==='input_number/create');assert.equal(create.min,1);assert.equal(create.max,24);assert.equal(create.initial,undefined);assert.ok(create.name.includes('installation-b'));
});
