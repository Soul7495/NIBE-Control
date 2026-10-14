import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROFILE, WRITE_ALLOWLIST, registerFromUniqueId, resolveRoles, usableState } from "../src/profile.js";
test("register is extracted from nibe unique id",()=>assert.equal(registerFromUniqueId("entry-32306"),"32306"));
test("registry register beats exported entity fallback",()=>assert.equal(resolveRoles([{entity_id:"sensor.renamed",unique_id:"entry-30002"}]).outdoor,"sensor.renamed"));
test("manual override wins",()=>assert.equal(resolveRoles([],{outdoor:"sensor.manual"}).outdoor,"sensor.manual"));
test("unavailable state is rejected",()=>assert.equal(usableState({state:"unavailable"}),false));
test("safe write allowlist is limited to verified user controls",()=>assert.deepEqual(Object.keys(WRITE_ALLOWLIST).sort(),["evccMode","waterHeater"]));
test("current power 32177 is excluded",()=>assert.equal(Object.values(PROFILE.roles).some(x=>x.register==="32177"),false));
test("electrical consumption uses register 32306",()=>assert.equal(PROFILE.roles.electrical.register,"32306"));
test("room setpoint register remains diagnostic only",()=>assert.equal(PROFILE.roles.roomSetpoint.group,"diagnostic"));
test("room setpoint has no write control",()=>{
  const source=readFileSync(new URL("../src/nibe-control.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/id="temp-apply"/);
  assert.doesNotMatch(source,/callService\("number","set_value"/);
});
test("responsive energy board exposes EVCC and SG Ready without invented PV values",()=>{
  const source=readFileSync(new URL("../src/nibe-control.js",import.meta.url),"utf8");
  assert.match(source,/class="panel energy-board"/);
  assert.match(source,/data-state="evccEnabled"/);
  assert.match(source,/data-state="evccCharging"/);
  assert.match(source,/data-sg/);
  assert.match(source,/@media\(max-width:1100px\)/);
  assert.match(source,/@media\(min-width:700px\) and \(max-height:760px\)/);
});
test("compressor animation and mobile plant remain centered",()=>{
  const source=readFileSync(new URL("../src/nibe-control.js",import.meta.url),"utf8");
  assert.match(source,/class="fan" aria-hidden="true"><b><\/b><\/div>/);
  assert.match(source,/\.fan:after\{content:"";position:absolute;left:50%;top:50%/);
  assert.match(source,/\.machine\.active \.fan b\{animation:spin 3\.6s linear infinite\}/);
  assert.doesNotMatch(source,/\.machine\.active \.fan\{animation:/);
  assert.match(source,/@media\(max-width:820px\)/);
  assert.match(source,/--machine-col:104px/);
  assert.match(source,/@keyframes flow\{from\{left:-18px\}to\{left:100%\}\}/);
});
test('multiple NIBE installations require selection and never depend on registry order',()=>{
 const rows=[{platform:'nibe_heatpump',config_entry_id:'a',unique_id:'a-30002',entity_id:'sensor.a'},{platform:'nibe_heatpump',config_entry_id:'b',unique_id:'b-30002',entity_id:'sensor.b'}];
 assert.equal(resolveRoles(rows).outdoor,null);assert.equal(resolveRoles(rows,{},'a').outdoor,'sensor.a');assert.equal(resolveRoles(rows.reverse(),{},'a').outdoor,'sensor.a');
});
test('another integration cannot win a NIBE register mapping',()=>{
 const rows=[{platform:'other',config_entry_id:'other',unique_id:'other-30002',entity_id:'sensor.wrong'},{platform:'nibe_heatpump',config_entry_id:'nibe',unique_id:'nibe-30002',entity_id:'sensor.correct'}];assert.equal(resolveRoles(rows).outdoor,'sensor.correct');
});
test('renamed climate entity supplies room temperature within selected installation',()=>{
 const rows=[{platform:'nibe_heatpump',config_entry_id:'a',entity_id:'climate.renamed',unique_id:'a-climate'}];assert.equal(resolveRoles(rows,{},'a').room,'climate.renamed');assert.equal(resolveRoles(rows,{},'a').climate,'climate.renamed');
});
test('duplicate registers inside one installation are unresolved, not guessed',()=>{
 const rows=[{platform:'nibe_heatpump',config_entry_id:'a',unique_id:'x-30002',entity_id:'sensor.first'},{platform:'nibe_heatpump',config_entry_id:'a',unique_id:'y-30002',entity_id:'sensor.second'}];assert.equal(resolveRoles(rows).outdoor,null);assert.equal(resolveRoles(rows,{outdoor:'sensor.first'}).outdoor,'sensor.first');
});
test('sensor and number aliases of the same device/register use canonical domain',()=>{
 const rows=[{platform:'nibe_heatpump',config_entry_id:'a',device_id:'vvm',unique_id:'a-40012',entity_id:'sensor.degree_minutes'},{platform:'nibe_heatpump',config_entry_id:'a',device_id:'vvm',unique_id:'a-40012',entity_id:'number.degree_minutes'}];assert.equal(resolveRoles(rows).degreeMinutes,'number.degree_minutes');assert.equal(resolveRoles(rows.reverse()).degreeMinutes,'number.degree_minutes');
});
test('disabled canonical alias gives way to its enabled same-device sensor',()=>{
 const rows=[{platform:'nibe_heatpump',config_entry_id:'a',device_id:'vvm',unique_id:'a-40012',entity_id:'number.degree_minutes',disabled_by:'integration'},{platform:'nibe_heatpump',config_entry_id:'a',device_id:'vvm',unique_id:'a-40012',entity_id:'sensor.degree_minutes'}];assert.equal(resolveRoles(rows).degreeMinutes,'sensor.degree_minutes');
});
test('same register on different devices remains ambiguous',()=>{
 const rows=[{platform:'nibe_heatpump',config_entry_id:'a',device_id:'vvm1',unique_id:'a-40012',entity_id:'number.first'},{platform:'nibe_heatpump',config_entry_id:'a',device_id:'vvm2',unique_id:'a-40012',entity_id:'sensor.second'}];assert.equal(resolveRoles(rows).degreeMinutes,null);
});
