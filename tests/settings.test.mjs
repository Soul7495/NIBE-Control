import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PROFILE,DEVICE_PROFILES,detectProfile,resolveDiscovery} from '../src/profile.js';
import {entityCompatible,capabilityState,mergeDashboardSettings,settingSnapshot} from '../src/settings.js';
const state=(value,unit)=>({state:String(value),attributes:{unit_of_measurement:unit}});
test('device detection selects controller over associated outdoor unit and scopes installations',()=>{
 const devices=[{model:'VVM S320',config_entries:['a']},{model:'S2125',config_entries:['a']},{model:'S1256',config_entries:['b']}];
 assert.equal(detectProfile(devices,'a'),'vvms320');assert.equal(detectProfile(devices,'b'),'s1256');assert.equal(detectProfile([{model:'Unknown'}]),'generic');
});
test('unverified profiles never borrow VVM fallback IDs or numeric priority semantics',()=>{
 for(const id of ['generic','s1155','s1255','s1156','s1256','s2125']){const p=DEVICE_PROFILES[id];assert.equal(p.priorityCodes,false);assert.equal(resolveDiscovery([],{},null,p).mapping.outdoor,null);}
});
test('generic discovery requires explicit temperature role but allows scoped climate',()=>{
 const rows=[{entity_id:'sensor.outside',unique_id:'a-30002',config_entry_id:'a',platform:'nibe_heatpump'},{entity_id:'climate.renamed',config_entry_id:'a',platform:'nibe_heatpump'}];
 const result=resolveDiscovery(rows,{room:'sensor.living_room'},'a',DEVICE_PROFILES.generic);
 assert.equal(result.mapping.outdoor,null);assert.equal(result.mapping.room,'sensor.living_room');assert.equal(result.mapping.climate,'climate.renamed');
});
test('explicit exclusion persists without falling back to climate',()=>{
 const result=resolveDiscovery([],{room:null,outdoor:null},null,PROFILE);assert.equal(result.mapping.room,null);assert.equal(result.mapping.outdoor,null);
});
test('mapping validates physical units and control domains',()=>{
 assert.equal(entityCompatible('room','sensor.temp',state(22,'°C'),PROFILE.roles.room),true);
 assert.equal(entityCompatible('room','sensor.power',state(22,'W'),PROFILE.roles.room),false);
 assert.equal(entityCompatible('electrical','sensor.watts',state(1500,'W'),PROFILE.roles.electrical),true);
 assert.equal(entityCompatible('electrical','sensor.energy',state(1500,'kWh'),PROFILE.roles.electrical),false);
 assert.equal(entityCompatible('waterHeater','number.register',state(1),PROFILE.roles.waterHeater),false);
 assert.equal(entityCompatible('evccMode','switch.any',state('on'),PROFILE.roles.evccMode),false);
});
test('missing optional features are inactive; disabled and unavailable entities still count as installed',()=>{
 assert.equal(capabilityState('ventilation',{},[],{}).visible,false);
 const map={ventilationSupply:'sensor.fan'};
 assert.equal(capabilityState('ventilation',map,[{entity_id:'sensor.fan',disabled_by:'user'}],{}).detected,true);
 assert.equal(capabilityState('ventilation',map,[],{'sensor.fan':state('unavailable')}).visible,true);
 const hidden=capabilityState('ventilation',map,[],{'sensor.fan':state(47,'%')},{ventilation:'hide'});assert.equal(hidden.visible,false);assert.equal(hidden.label,'Manuell ausgeblendet');
});
test('dashboard merge preserves maintenance, metadata and unrelated strategy settings',()=>{
 const raw={title:'Home',background:'blue',strategy:{type:'custom:nibe-control',ventilation:{filter_date_entity:'input_datetime.original'},other:'keep'}};
 const next=mergeDashboardSettings(raw,{profile:'generic',config_entry_id:null,mappings:{room:'sensor.other'},visibility:{water:'hide'}});
 assert.equal(next.title,raw.title);assert.equal(next.background,'blue');assert.equal(next.strategy.ventilation,raw.strategy.ventilation);assert.equal(next.strategy.other,'keep');assert.equal(next.strategy.setup_complete,true);assert.equal(raw.strategy.mappings,undefined);
 assert.throws(()=>mergeDashboardSettings({views:[]},{}));assert.throws(()=>mergeDashboardSettings({strategy:{type:'map'}},{}));
});
function cardFixture(){
 const classes=new Map();vm.runInNewContext(readFileSync(new URL('../dist/nibe-control.js',import.meta.url),'utf8'),{document:{},HTMLElement:class{},window:{},customElements:{get:k=>classes.get(k),define:(k,v)=>classes.set(k,v)},Intl});
 const card=new (classes.get('nibe-control-card'))(),feedback={textContent:''},button={disabled:false},field={disabled:false};
 card.config={profile:'auto',mappings:{},visibility:{},setup_complete:false,dashboard_url_path:'nibe-test',ventilation:{filter_date_entity:'input_datetime.keep'}};card.registry=[];card.devices=[];
 card.shadowRoot={querySelector:s=>s==='[data-setup-feedback]'?feedback:null,querySelectorAll:s=>s==='#community-setup fieldset'?[field]:[],getElementById:s=>s==='setup-save'?button:null};
 card._hass={connected:true,states:{'sensor.living':state(23,'°C')}};card.render=()=>{};card.selectPlant=()=>{};card.findMaintenanceHelpers=()=>{};card.loadHistory=()=>{};
 return {card,feedback,button,field};
}
const draft={profile:'generic',config_entry_id:null,mappings:{room:'sensor.living'},visibility:{water:'hide',ventilation:'hide',evcc:'auto'}};
test('actual bundle reads manually assigned room sensor instead of climate attribute',()=>{
 const {card}=cardFixture();card.mapping={room:'sensor.living'};assert.equal(Number(card.val('room')),23);assert.equal(card.available('room'),true);
 card.mapping.room='climate.room';card._hass.states['climate.room']={state:'auto',attributes:{current_temperature:21}};assert.equal(card.val('room'),21);
});
test('actual bundle normalizes W and Fahrenheit for live values and chart history',()=>{
 const {card}=cardFixture();card.mapping={electrical:'sensor.power',room:'sensor.room'};card._hass.states['sensor.power']=state(1500,'W');card._hass.states['sensor.room']=state(68,'°F');assert.equal(card.val('electrical'),1.5);assert.equal(card.val('room'),20);
 assert.equal(card.convertHistory('electrical',[{s:'1500'},{s:'unavailable'}])[0].s,'1.5');assert.equal(card.convertHistory('electrical',[{s:'unavailable'}])[0].s,'unavailable');
});
test('setup saves once, verifies readback, keeps existing filter settings and sends no device service',async()=>{
 const {card,feedback}=cardFixture(),calls=[];let raw={strategy:{type:'custom:nibe-control',ventilation:card.config.ventilation}};
 card.settingsBaseline=settingSnapshot(raw);card._hass.callService=()=>assert.fail('no device write');card._hass.callWS=async msg=>{calls.push(msg);if(msg.type==='lovelace/config/save'){raw=msg.config;return null;}return raw;};
 assert.equal(await card.saveSetup(draft),true);assert.equal(calls.filter(c=>c.type==='lovelace/config/save').length,1);assert.equal(calls[0].url_path,'nibe-test');assert.equal(raw.strategy.ventilation.filter_date_entity,'input_datetime.keep');assert.equal(card.config.mappings.room,'sensor.living');assert.equal(card.config.setup_complete,true);assert.ok(card.setupFeedback.includes('gespeichert'));
});
test('setup conflict does not overwrite another user and retains input',async()=>{
 const {card,feedback}=cardFixture(),calls=[];card._hass.callWS=async msg=>{calls.push(msg);return {strategy:{type:'custom:nibe-control',profile:'s1255'}};};
 assert.equal(await card.saveSetup(draft),false);assert.equal(calls.length,1);assert.ok(feedback.textContent.includes('inzwischen'));assert.equal(card.config.profile,'auto');
});
test('setup denied/offline/readback failure gives honest feedback and releases pending',async()=>{
 const {card,feedback,button,field}=cardFixture();card._hass.connected=false;assert.equal(await card.saveSetup(draft),false);assert.ok(feedback.textContent.includes('getrennt'));
 card._hass.connected=true;card._hass.callWS=async()=>{throw new Error('unauthorized');};assert.equal(await card.saveSetup(draft),false);assert.ok(feedback.textContent.includes('Administratorrechte'));assert.equal(button.disabled,false);assert.equal(field.disabled,false);
 let count=0;card._hass.callWS=async msg=>{count++;if(count===3)throw new Error('readback unavailable');return {strategy:{type:'custom:nibe-control'}};};assert.equal(await card.saveSetup(draft),false);assert.ok(feedback.textContent.includes('Rückprüfung'));assert.equal(card.config.setup_complete,false);
});
test('setup rejects wrong domain, missing entity and duplicate submissions without writes',async()=>{
 const {card}=cardFixture();card._hass.callWS=async()=>assert.fail('no writes');
 assert.equal(await card.saveSetup({...draft,mappings:{room:'sensor.missing'}}),false);assert.equal(await card.saveSetup({...draft,mappings:{waterHeater:'sensor.living'}}),false);card.setupPending=true;assert.equal(await card.saveSetup(draft),false);
});
test('generic component operating view does not guess heating from raw priority 30',()=>{
 const {card}=cardFixture();card.activeProfile=DEVICE_PROFILES.generic;card.mapping={priority:'sensor.priority',compressorHz:'sensor.hz'};card._hass.states['sensor.priority']=state(30);card._hass.states['sensor.hz']=state(40,'Hz');assert.equal(card.operation().kind,'unknown');assert.equal(card.operation().active,true);
});
test('native manual candidate list includes enabled temperature entities and excludes disabled and wrong units',()=>{
 const {card}=cardFixture();card.registry=[{entity_id:'sensor.disabled',disabled_by:'user'}];card._hass.states['sensor.disabled']=state(22,'°C');card._hass.states['sensor.wrong']=state(22,'W');card._hass.states['climate.room']={state:'auto',attributes:{current_temperature:21}};
 assert.ok(card.mappingCandidates('room').includes('sensor.living'));assert.ok(card.mappingCandidates('room').includes('climate.room'));assert.ok(!card.mappingCandidates('room').includes('sensor.disabled'));assert.ok(!card.mappingCandidates('room').includes('sensor.wrong'));
 assert.match(card.mappingField('room'),/data-mapping-mode="room"/);assert.match(card.mappingField('room'),/Manuell zuordnen/);assert.ok(!card.mappingField('room').includes('datalist'));
});
test('diagnostics explains disabled source without inventing thermal power',()=>{
 const {card}=cardFixture();card.mapping={thermal:'sensor.thermal',defrost:'sensor.defrost',priority:'sensor.priority'};card.meta={thermal:{disabled_by:'integration'}};card._hass.states['sensor.defrost']=state(0);card._hass.states['sensor.priority']=state('OFF');assert.equal(card.diagnosticValue('thermal'),'—');assert.match(card.diagnosticDetail('thermal'),/deaktiviert/);assert.match(card.diagnosticDetail('thermal'),/sensor.thermal/);assert.equal(card.diagnosticValue('defrost'),'Keine Abtauung');assert.equal(card.diagnosticValue('priority'),'Keine Wärmeanforderung');
});
test('mode switch produces manual override, auto reset and explicit exclusion without writing',()=>{
 const {card}=cardFixture(),mode={value:'manual'},input={dataset:{mapping:'room'},value:'sensor.living'};card.config.mappings={futureRole:'sensor.future'};
 card.shadowRoot.querySelectorAll=s=>s==='[data-mapping]'?[input]:[];card.shadowRoot.querySelector=s=>s==='[data-mapping-mode="room"]'?mode:null;card.shadowRoot.getElementById=id=>({value:id==='device-profile'?'generic':'a'});
 assert.equal(card.setupDraft().mappings.room,'sensor.living');mode.value='auto';assert.ok(!Object.hasOwn(card.setupDraft().mappings,'room'));mode.value='none';assert.equal(card.setupDraft().mappings.room,null);assert.equal(card.setupDraft().mappings.futureRole,'sensor.future');
});
test('full component markup uses one discreet gear and native mapping controls without automatic setup takeover',()=>{
 const {card}=cardFixture();card.mapping={};card.shadowRoot.innerHTML='';card.bind=()=>{};card.paintValues=()=>{};card.applyVisibility=()=>{};card.selectPlant=()=>assert.fail('no forced setup');card._hass.user={is_admin:true};Object.getPrototypeOf(card).render.call(card);const html=card.shadowRoot.innerHTML;
 assert.equal((html.match(/<button[^>]*data-open-settings/g)||[]).length,1);assert.match(html,/aria-label="Einstellungen öffnen"/);assert.ok(!html.includes('>Einrichtung / Einstellungen</button>'));assert.match(html,/<select id="map-room"/);assert.ok(!html.includes('datalist'));assert.match(html,/id="history-export"/);
});
test('lazy manual mode actually enables the entity select and keeps the selected entity across group reopening',()=>{
 const {card}=cardFixture(),mode={dataset:{mappingMode:'room'},value:'manual'},select={dataset:{mapping:'room'},value:'sensor.living',disabled:true,innerHTML:''},form={},profile={value:'auto'},group={open:true,querySelectorAll:()=>[select]};
 card.shadowRoot.getElementById=id=>id==='community-setup'?form:id==='device-profile'?profile:id==='map-room'?select:null;
 card.shadowRoot.querySelectorAll=q=>q==='[data-mapping-mode]'?[mode]:q==='.mapping-group'?[group]:q==='.mapping-group[open] [data-mapping]'?[select]:[];card.previewSetup=()=>{};card.bindSetup();mode.onchange();assert.equal(select.disabled,false);assert.ok(select.innerHTML.includes('sensor.living'));assert.equal(select.value,'sensor.living');mode.value='none';mode.onchange();assert.equal(select.disabled,true);group.ontoggle();assert.equal(select.value,'sensor.living');
});
