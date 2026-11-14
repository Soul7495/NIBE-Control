import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {ncSnapshotState,ncDeadline} from '../src/sync.js';
import {PROFILE,DEVICE_PROFILES,resolveDiscovery} from '../src/profile.js';
const state=(value,second=0)=>({entity_id:'sensor.hz',state:String(value),attributes:{unit_of_measurement:'Hz'},last_updated:new Date(1800000000000+second*1000).toISOString()});
function fixture(){
 const classes=new Map(),listeners=new Map(),timers=new Map();let timerId=0;
 const doc={visibilityState:'visible',addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}};
 vm.runInNewContext(readFileSync(new URL('../dist/nibe-control.js',import.meta.url),'utf8'),{HTMLElement:class{},window:{},document:doc,Intl,setTimeout,clearTimeout,setInterval:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearInterval:id=>timers.delete(id),customElements:{get:k=>classes.get(k),define:(k,v)=>classes.set(k,v)}});
 const card=new(classes.get('nibe-control-card'))(),feedback={textContent:''},button={disabled:false,setAttribute(k,v){this[k]=v;}};
 card._hass={connected:true,states:{'sensor.hz':state(40)},config:{time_zone:'Europe/Berlin'}};card.mapping={compressorHz:'sensor.hz'};card.config={profile:'vvms320'};card.registry=[{entity_id:'sensor.hz',platform:'nibe_heatpump',config_entry_id:'a',unique_id:'a-31804'}];card.discovery={selected:'a'};
 card.shadowRoot={querySelector:s=>s==='[data-refresh]'?button:s==='[data-sync-feedback]'?feedback:null,querySelectorAll:()=>[],getElementById:()=>null};card.paintValues=()=>{card.paints=(card.paints||0)+1;};card.refreshRegistry=async()=>true;
 return {card,doc,listeners,timers,feedback,button};
}
test('HA snapshot advances a continuously open dashboard without another hass setter',async()=>{
 const {card,feedback}=fixture();card._hass.callWS=async msg=>{assert.equal(msg.type,'get_states');return [state(0,2),{entity_id:'sensor.unrelated',state:'12'}];};
 assert.equal(await card.refreshData(),true);assert.equal(card.val('compressorHz'),'0');assert.equal(card._hass.states['sensor.hz'].state,'40');assert.deepEqual(Object.keys(card.stateSnapshot),['sensor.hz']);assert.match(feedback.textContent,/HA-Stand/);
});
test('newer pushed states win over slow snapshot responses and older subsequent setters',async()=>{
 const {card}=fixture();let resolve;card._hass.callWS=()=>new Promise(r=>resolve=r);const pending=card.refreshData();card._hass.states['sensor.hz']=state(70,5);resolve([state(0,2)]);await pending;assert.equal(card.val('compressorHz'),'70');
 card._hass.states['sensor.hz']=state(40,0);assert.equal(card.val('compressorHz'),'0');card._hass.states['sensor.hz']=state(50,8);assert.equal(card.val('compressorHz'),'50');
});
test('manual refresh dispatches one read request for the shared NIBE coordinator',async()=>{
 const {card,feedback}=fixture(),sent=[];card.mapping.priority='sensor.priority';card.registry.push({entity_id:'sensor.priority',platform:'nibe_heatpump',config_entry_id:'a'});card._hass.callService=async(...args)=>sent.push(args);card._hass.callWS=async()=>[state(0,2)];
 assert.equal(await card.refreshData({requestDevice:true}),true);assert.equal(sent.length,1);assert.equal(sent[0][0],'homeassistant');assert.equal(sent[0][1],'update_entity');assert.equal(sent[0][2].entity_id,'sensor.hz');assert.match(feedback.textContent,/Geräteabfrage angefordert/);
 assert.equal(await card.refreshData({requestDevice:true}),false);assert.equal(sent.length,1);assert.match(feedback.textContent,/15 Sekunden/);
});
test('automatic sync never requests a physical poll and ignores unrelated installations',async()=>{
 const {card,feedback}=fixture();card.registry[0].config_entry_id='b';card._hass.callService=()=>assert.fail('must not dispatch to another NIBE');card._hass.callWS=async()=>[state(0,2)];
 await card.refreshData();await card.refreshData({requestDevice:true});assert.match(feedback.textContent,/Keine passende NIBE-Entity/);
});
test('duplicate refreshes share the busy window and release it after failure',async()=>{
 const {card,button,feedback}=fixture();let reject,calls=0;card._hass.callWS=()=>{calls++;return new Promise((_,r)=>reject=r);};const first=card.refreshData();assert.equal(button.disabled,true);assert.equal(await card.refreshData(),false);assert.equal(calls,1);reject(Error('offline'));assert.equal(await first,false);assert.equal(button.disabled,false);assert.match(feedback.textContent,/letzter bekannter Stand/);assert.equal(card.val('compressorHz'),'40');
});
test('failed device request still reads HA, without claiming the request was confirmed',async()=>{
 const {card,feedback}=fixture();card._hass.callService=async()=>{throw Error('forbidden');};card._hass.callWS=async()=>[state(0,2)];await card.refreshData({requestDevice:true});assert.equal(card.val('compressorHz'),'0');assert.match(feedback.textContent,/Geräteabfrage nicht bestätigt/);
});
test('mapping change and detach invalidate a pending snapshot',async()=>{
 for(const detach of [false,true]){const {card}=fixture();let resolve;card._hass.callWS=()=>new Promise(r=>resolve=r);const pending=card.refreshData();if(detach)card.disconnectedCallback();else card.mapping.compressorHz='sensor.other';resolve([state(0,2)]);assert.equal(await pending,false);assert.equal(card.stateSnapshot,undefined);}
});
test('visible periodic sync works for both plants; returning from background refreshes immediately',()=>{
 const {card,doc,listeners,timers}=fixture(),calls=[];card.refreshData=opts=>calls.push(opts||{});card.connectedCallback();assert.equal(calls.length,1);assert.equal(timers.size,1);const timer=[...timers.values()][0];assert.equal(timer.ms,60000);card.selectedPlant='ventilation';timer.fn();assert.equal(calls.length,2);doc.visibilityState='hidden';timer.fn();listeners.get('visibilitychange')();assert.equal(calls.length,2);doc.visibilityState='visible';listeners.get('visibilitychange')();assert.equal(calls.length,3);card.disconnectedCallback();assert.equal(timers.size,0);assert.equal(listeners.size,0);
});
test('visible history refresh preserves navigation, DOM and pending setup draft',async()=>{
 const {card}=fixture();const root=card.shadowRoot;card.setupPending=true;card.setupFeedback='Entwurf';card.selectedPlant='heatpump';card.shadowRoot.getElementById=()=>({classList:{contains:()=>true}});let history=0;card.loadHistory=async()=>history++;card._hass.callWS=async()=>[state(0,2)];await card.refreshData();assert.equal(card.shadowRoot,root);assert.equal(card.setupFeedback,'Entwurf');assert.equal(card.setupPending,true);assert.equal(history,1);
});
test('offline refresh sends no requests and does not invent synchronized values',async()=>{
 const {card,feedback}=fixture();card._hass.connected=false;card._hass.callWS=()=>assert.fail('offline');card._hass.callService=()=>assert.fail('offline');assert.equal(await card.refreshData({requestDevice:true}),false);assert.match(feedback.textContent,/getrennt/);assert.equal(card.lastSync,undefined);
});
test('snapshot missing entity does not keep its old value or erase a new pushed state',()=>{
 const old=state(40);assert.equal(ncSnapshotState(old,{state:null,baseline:old}),undefined);const newer=state(50,3);assert.equal(ncSnapshotState(newer,{state:null,baseline:old}),newer);
});
test('timestamps missing from a snapshot never override a changed live object',()=>{
 const old={state:'1'},fresh={state:'2'},incoming={state:'3'};assert.equal(ncSnapshotState(fresh,{baseline:old,state:incoming}),fresh);assert.equal(ncSnapshotState(old,{baseline:old,state:incoming}),incoming);
});
test('request deadlines release hanging work without unhandled late failures',async()=>{
 await assert.rejects(ncDeadline(new Promise(()=>{}),5),/Zeitüberschreitung/);assert.equal(await ncDeadline(Promise.resolve(1),20),1);await assert.rejects(ncDeadline(Promise.reject(Error('denied')),20),/denied/);
});
test('32196 alarm role stays scoped, supports explicit exclusion and disabled activation guidance',()=>{
 const a={platform:'nibe_heatpump',entity_id:'sensor.class_1_a',unique_id:'a-32196',config_entry_id:'a',disabled_by:'integration'},b={...a,entity_id:'sensor.class_1_b',unique_id:'b-32196',config_entry_id:'b'};
 assert.equal(resolveDiscovery([a,b],{},'a',PROFILE).mapping.alarmActive,a.entity_id);assert.equal(resolveDiscovery([a,b],{alarmActive:null},'a',PROFILE).mapping.alarmActive,null);assert.equal(resolveDiscovery([a,b],{},'a',DEVICE_PROFILES.generic).mapping.alarmActive,null);
});
test('registry refresh discovers an enabled alarm entity and updates device metadata',async()=>{
 const {card}=fixture();card.config={profile:'vvms320',config_entry_id:'a'};card._hass.callWS=async msg=>msg.type==='config/entity_registry/list'?[{entity_id:'sensor.renamed_alarm',platform:'nibe_heatpump',config_entry_id:'a',unique_id:'a-32196'}]:[{model:'VVM S320',config_entries:['a']}];
 assert.equal(await card.readRegistry(),true);assert.equal(card.mapping.alarmActive,'sensor.renamed_alarm');assert.equal(card.devices[0].model,'VVM S320');assert.equal(card.meta.alarmActive.disabled_by,undefined);
});
test('disconnect and reconnect invalidate the old snapshot even with a reused hass object',async()=>{
 const {card}=fixture();card.haConnected=true;const requests=[];card._hass.callWS=()=>new Promise(r=>requests.push(r));const old=card.refreshData();
 card._hass.connected=false;card.hass=card._hass;card._hass.connected=true;card.hass=card._hass;await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,2);
 requests[1]([state(65,5)]);await new Promise(resolve=>setImmediate(resolve));requests[0]([state(0,2)]);assert.equal(await old,false);assert.equal(card.val('compressorHz'),'65');assert.equal(card.syncPending,false);
});
