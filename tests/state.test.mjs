import test from 'node:test';
import assert from 'node:assert/strict';
import {ncNumber,ncBinary,ncOperating,ncPriority,ncSg,ncEvccMode} from '../src/state.js';
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
 assert.equal(ncOperating({...values,alarm:308}).mode,'alarm');
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
