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
