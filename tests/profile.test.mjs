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
  assert.match(source,/data-status="sgMode"/);
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
