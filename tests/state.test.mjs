import test from 'node:test';
import assert from 'node:assert/strict';
import {ncNumber,ncBinary,ncOperating,ncPriority,ncSg,ncEvccMode,ncPvAction,ncAlarm} from '../src/state.js';
const values={compressorHz:40,priority:30,alarm:0,defrost:0};
test('missing and null values never become zero',()=>{
 for(const v of [null,undefined,'','unknown','unavailable'])assert.equal(ncNumber(v),null);
 assert.equal(ncNumber('0'),0);
});
test('binary missing is not off',()=>{assert.equal(ncBinary('unavailable'),null);assert.equal(ncBinary('0'),false);});
test('documented priorities map without guessing',()=>{
 for(const [v,k] of [[10,'idle'],[20,'water'],[30,'heat'],[40,'pool'],[60,'cooling']])assert.equal(ncPriority(v),k);
 assert.equal(ncPriority(99),'unknown');
});
test('heating and water change live from priority',()=>{
 assert.equal(ncOperating(values).label,'Heizbetrieb');
 assert.equal(ncOperating({...values,priority:20}).label,'Warmwasserbereitung');
});
test('priority alone does not imply active generation',()=>assert.equal(ncOperating({...values,compressorHz:0}).active,false));
test('additional heat counts as generation',()=>assert.equal(ncOperating({...values,compressorHz:0,additionalHeat:2}).active,true));
test('unknown priority does not activate either branch',()=>assert.equal(ncOperating({...values,priority:99}).kind,'unknown'));
test('alarm, defrost and disconnect take precedence',()=>{
 assert.equal(ncOperating({...values,alarm:308,alarmActive:true}).mode,'alarm');
 assert.equal(ncOperating({...values,defrost:1}).mode,'defrost');
 assert.equal(ncOperating(values,false).mode,'offline');
 assert.equal(ncOperating({...values,compressorHz:'unavailable'}).mode,'unknown');
});
test('all four documented SG contact combinations',()=>{
 assert.equal(ncSg({sgA:0,sgB:0}).label,'Normalbetrieb');
 assert.equal(ncSg({sgA:1,sgB:0}).label,'Sperre');
 assert.equal(ncSg({sgA:0,sgB:1}).tone,'boost');
 assert.equal(ncSg({sgA:1,sgB:1}).label,'Max. Anhebung');
});
test('missing SG contacts never invent a decoded numeric mode',()=>assert.equal(ncSg({sgMode:3}).label,'Statuscode 3'));
test('EVCC modes are translated for display',()=>{assert.equal(ncEvccMode('pv'),'PV-Überschuss');assert.equal(ncEvccMode(undefined),'Nicht verfügbar');});
test('additional heat remains detectable with unavailable compressor frequency',()=>{
 assert.equal(ncOperating({...values,compressorHz:'unavailable',additionalHeat:2}).label,'Heizbetrieb');assert.equal(ncOperating({...values,compressorHz:0,additionalHeat:'unavailable'}).mode,'unknown');
});

test('EVCC text labels retain raw values for unknown actions',()=>{
 assert.equal(ncEvccMode('smart'),'Smart-Modus');assert.equal(ncPvAction('inactive'),'Keine PV-Aktion');assert.equal(ncPvAction('unknown'),'Nicht verfügbar');assert.equal(ncPvAction('future-mode'),'Aktion: future-mode');
});

test('nonzero alarm number alone is not an active alarm (video regression 366)',()=>{
 const report=ncAlarm({alarm:366});assert.equal(report.active,null);assert.equal(report.uncertain,true);
 const idle=ncOperating({...values,compressorHz:0,additionalHeat:0,alarm:366});assert.equal(idle.mode,'idle');assert.match(idle.label,/Alarmstatus ungeklärt/);assert.ok(!idle.label.includes('Störung'));
 const running=ncOperating({...values,alarm:366});assert.equal(running.mode,'running');assert.equal(running.active,true);assert.equal(running.kind,'heat');assert.match(running.label,/ungeklärt/);
});
test('explicit active status preserves genuine alarm priority even without number',()=>{
 for(const alarm of [0,366,'unavailable']){const state=ncOperating({...values,alarm,alarmActive:'on'});assert.equal(state.mode,'alarm');assert.equal(state.active,false);}
 assert.equal(ncOperating({...values,alarmActive:'on'},false).mode,'offline');
});
test('inactive status does not let a residual code block operation; unavailable status does not claim all clear',()=>{
 assert.equal(ncAlarm({alarm:366,alarmActive:'off'}).active,false);assert.equal(ncAlarm({alarm:366,alarmActive:'off'}).uncertain,false);
 assert.equal(ncOperating({...values,alarm:366,alarmActive:'off'}).label,'Heizbetrieb');
 for(const active of [undefined,null,'unknown','unavailable','2']){const report=ncAlarm({alarm:366,alarmActive:active});assert.equal(report.active,null);assert.equal(report.uncertain,true);assert.notEqual(ncOperating({...values,alarm:366,alarmActive:active}).mode,'alarm');}
});
test('raw code without confirmation does not mask defrost or disconnected state',()=>{
 assert.equal(ncOperating({...values,alarm:366,defrost:1}).label,'Abtauung');assert.equal(ncOperating({...values,alarm:366},false).mode,'offline');
 assert.equal(ncAlarm({alarm:0}).uncertain,false);
});
