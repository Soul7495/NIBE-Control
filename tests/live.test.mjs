import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){
 const classes=new Map();
 const source=readFileSync(new URL('../dist/nibe-control.js',import.meta.url),'utf8');
 vm.runInNewContext(source,{document:{createElement:()=>({style:{setProperty(){}},dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}})},HTMLElement:class{},window:{},customElements:{get:k=>classes.get(k),define:(k,v)=>classes.set(k,v)},Intl});
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
test('controls reject unknown options, offline writes and installer roles',async()=>{
 const {card}=fixture(),sent=[],feedback={textContent:''},element={value:'pv',disabled:false};card.shadowRoot.querySelector=()=>feedback;
 card.mapping.evccMode='select.evcc_nibe_mode';card._hass.states[card.mapping.evccMode]={state:'off',attributes:{options:['off','pv']}};card._hass.callService=async(...args)=>sent.push(args);
 await card.setUserControl('evccMode','now',element);assert.equal(sent.length,0);
 card._hass.connected=false;await card.setUserControl('evccMode','pv',element);assert.equal(sent.length,0);
 card._hass.connected=true;await card.setUserControl('degreeMinutes','10',element);assert.equal(sent.length,0);
 await card.setUserControl('evccMode','pv',element);assert.equal(sent.length,1);assert.equal(sent[0][0],'select');assert.equal(sent[0][1],'select_option');
});
test('control failure restores reported value and shows feedback',async()=>{
 const {card}=fixture(),feedback={textContent:''},element={value:'pv',disabled:false};card.shadowRoot.querySelector=()=>feedback;card.mapping.evccMode='select.test';card._hass.states['select.test']={state:'off',attributes:{options:['off','pv']}};card._hass.callService=async()=>{throw Error('offline');};
 await card.setUserControl('evccMode','pv',element);assert.equal(element.value,'off');assert.equal(element.disabled,false);assert.match(feedback.textContent,/fehlgeschlagen/);
});
test('control blocks duplicate dispatch while awaiting HA',async()=>{
 const {card}=fixture(),feedback={textContent:''},element={value:'pv',disabled:false};let resolve,requests=0;card.shadowRoot.querySelector=()=>feedback;card.mapping.evccMode='select.test';card._hass.states['select.test']={state:'off',attributes:{options:['off','pv']}};card._hass.callService=()=>{requests++;return new Promise(r=>resolve=r);};
 const first=card.setUserControl('evccMode','pv',element);await card.setUserControl('evccMode','pv',element);assert.equal(requests,1);assert.equal(element.disabled,true);resolve();await first;assert.equal(element.disabled,false);
});
test('water heater sends only an offered native operating mode',async()=>{
 const {card}=fixture(),sent=[],element={value:'eco',disabled:false};card.shadowRoot.querySelector=()=>({textContent:''});card.mapping.waterHeater='water_heater.test';card._hass.states['water_heater.test']={state:'normal',attributes:{operation_list:['normal','eco']}};card._hass.callService=async(...args)=>sent.push(args);
 await card.setUserControl('waterHeater','eco',element);assert.equal(sent[0][0],'water_heater');assert.equal(sent[0][1],'set_operation_mode');assert.equal(sent[0][2].operation_mode,'eco');
});
test('history normalizer accepts keyed compressed and legacy grouped responses',()=>{
 const {card}=fixture(),states={sensor:[{s:'31',lu:123}]};assert.equal(card.normalizeHistory(states),states);const grouped=[[{entity_id:'sensor.target',state:'31'}]];assert.equal(card.normalizeHistory(grouped)['sensor.target'],grouped[0]);assert.deepEqual(Object.keys(card.normalizeHistory([])),[]);
});
test('all chart groups request actual mappings including start states',async()=>{
 const {card}=fixture();let request;card.mapping={outdoor:'sensor.outdoor',supplyTarget:'sensor.target',supply:'sensor.supply',return:'sensor.return',compressorHz:'sensor.hz',electrical:'sensor.power',hotWaterCharge:'sensor.bt6',hotWaterTop:'sensor.bt7'};card._hass.states=Object.fromEntries(Object.values(card.mapping).map(id=>[id,{state:'31',attributes:{}}]));card._hass.callWS=async r=>{request=r;return {};};const drawn=[];card.draw=(...args)=>drawn.push(args);
 await card.loadHistory();assert.equal(request.include_start_time_state,true);assert.equal(request.minimal_response,true);assert.equal(request.significant_changes_only,false);assert.equal(request.entity_ids.length,8);assert.equal(drawn.length,4);assert.deepEqual(drawn.map(x=>x[0]),['heating','frequency','power','water']);
});

test('rendered chart keeps the minimum on the left axis and constant series visible',()=>{
 const {card}=fixture(),buttons=[],paths={};const output={},slider={value:'1440'},svg={};const host={innerHTML:'',querySelector(s){if(s==='.chart-values')return output;if(s==='.chart-probe')return {append(){}};if(s==='[data-cursor]')return {setAttribute(){}};if(s==='input')return slider;if(s==='svg')return svg;if(s==='.chart-legend')return {append:b=>buttons.push(b)};return paths[s]||(paths[s]={style:{}});}};
 const start=Date.parse('2026-10-13T07:00:00Z');card.historyWindow={start,end:start+86400000};card.mapping.supplyTarget='sensor.target';card._hass.states['sensor.target']={state:'31',attributes:{unit_of_measurement:'°C'}};card.shadowRoot.getElementById=()=>host;
 card.draw('heating',[['supplyTarget','#abc']],{'sensor.target':[{s:'31',lu:start/1000}]});
 assert.match(host.innerHTML,/class="chart-y"/);assert.match(host.innerHTML,/class="y-min"/);assert.ok(host.innerHTML.includes('H100.00'));assert.equal(buttons.length,1);assert.equal(buttons[0].disabled,false);assert.match(output.innerHTML,/31,0 °C/);
 buttons[0].onclick();assert.equal(paths['[data-series="supplyTarget"]'].style.display,'none');buttons[0].onclick();assert.equal(paths['[data-series="supplyTarget"]'].style.display,'');
});
test('rendered empty history clearly reports missing measurements',()=>{
 const {card}=fixture(),host={innerHTML:''};card.historyWindow={start:0,end:86400000};card.shadowRoot.getElementById=()=>host;card.mapping.supplyTarget='sensor.target';card.draw('heating',[['supplyTarget','#abc']],{});assert.match(host.innerHTML,/Keine Messwerte/);
});
test('registry failure preserves manual mappings in the delivered component',async()=>{
 const {card}=fixture();card.config={mappings:{outdoor:'sensor.custom'}};card._hass.callWS=async()=>{throw Error('no registry');};card.render=()=>{};card.loadHistory=()=>{};await card.init();assert.equal(card.mapping.outdoor,'sensor.custom');assert.equal(card.discoveryError,true);
});
test('room missing its numeric attribute is unavailable',()=>{
 const {card}=fixture();card.mapping.room='climate.room';card._hass.states['climate.room']={state:'auto',attributes:{current_temperature:null}};assert.equal(card.available('room'),false);assert.equal(card.dataState('room'),'Nicht verfügbar');
});
test('time inspection synchronizes every chart and preserves an explicit timestamp',()=>{
 const {card}=fixture(),times=[];card.chartInspectors={heating:t=>times.push(t),frequency:t=>times.push(t),power:t=>times.push(t)};card.inspectTime(123456);assert.equal(times.length,3);assert.ok(times.every(t=>t===123456));assert.equal(card.inspectionTime,123456);card.inspectTime(123457,true);assert.equal(card.inspectionTime,null);
});
test('history rejects old responses after an installation change',async()=>{
 const {card}=fixture();card.mapping.outdoor='sensor.outdoor';card._hass.states['sensor.outdoor']={state:'20',attributes:{}};let resolve,drawn=0;card._hass.callWS=()=>new Promise(r=>resolve=r);card.draw=()=>drawn++;const pending=card.loadHistory();card.historyGeneration++;resolve({});await pending;assert.equal(drawn,0);
});
test('a failed history refresh retains the last successful curves',async()=>{
 const {card}=fixture(),feedback={textContent:''};card.mapping.outdoor='sensor.outdoor';card._hass.states['sensor.outdoor']={state:'20',attributes:{}};card.historyWindow={start:1,end:2};card._hass.callWS=async()=>{throw Error('offline');};card.shadowRoot.querySelector=()=>feedback;let cleared=false;card.shadowRoot.querySelectorAll=()=>{cleared=true;return [];};await card.loadHistory();assert.equal(cleared,false);assert.match(feedback.textContent,/letzten erfolgreichen Stand/);assert.equal(card.historyPending,false);
});

test('video regression: diagnostic frequency labels do not repeat their tag',()=>{
 const {card}=fixture();card.mapping={};card._hass.states={};assert.ok(!card.diagnostics().includes('Verdichter Soll · Soll'));
});
