import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require('playwright');} catch {playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
const browser=await playwright.chromium.launch({headless:true,...(process.env.NIBE_CHROMIUM?{executablePath:process.env.NIBE_CHROMIUM}:{})});
const output=process.env.NIBE_UI_OUTPUT||'/tmp/nibe-control-ui-0110';await mkdir(output,{recursive:true});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<html lang="de"><body style="margin:0;--primary-text-color:#27343b;--secondary-text-color:#62717a;--card-background-color:#fff;--primary-color:#287f75;--warning-color:#a97821;--error-color:#b3261e;background:#f3f6f7"><nibe-control-card></nibe-control-card></body></html>');
 await page.addScriptTag({content:await readFile(new URL('../dist/nibe-control.js',import.meta.url),'utf8')});
 await page.evaluate(()=>{
  const card=document.querySelector('nibe-control-card');card.setConfig({profile:'vvms320',config_entry_id:'a'});
  const rows=[['sensor.current_compressor_frequency_eb101_31804','0','Hz','31804'],['sensor.priority_31029','10',null,'31029'],['sensor.alarm_number_31976','216',null,'31976'],['sensor.class_1_alarm_32196','0',null,'32196'],['sensor.defrosting_eb101_31806','0',null,'31806'],['sensor.power_internal_additional_heat_31028','0','kW','31028'],['sensor.current_outdoor_temperature_bt1_30002','3.1','°C','30002'],['sensor.supply_line_bt2_30006','24.3','°C','30006'],['sensor.return_line_bt3_30008','24.2','°C','30008'],['sensor.calculated_supply_climate_system_1_31018','21.6','°C','31018'],['sensor.hot_water_top_bt7_30009','56.3','°C','30009'],['sensor.sg_ready_input_a_31913','0',null,'31913'],['sensor.sg_ready_input_b_31914','1',null,'31914'],['sensor.energy_log_current_power_consumption_32306','0.8','kW','32306']];
  const stamp=new Date().toISOString(),states=Object.fromEntries(rows.map(([entity_id,state,unit])=>[entity_id,{entity_id,state,last_updated:stamp,attributes:{unit_of_measurement:unit}}]));
  states['climate.vvms320_climate_system_s1']={entity_id:'climate.vvms320_climate_system_s1',state:'auto',last_updated:stamp,attributes:{current_temperature:21.9}};
  states['sensor.indoor']={entity_id:'sensor.indoor',state:'22.0',last_updated:stamp,attributes:{unit_of_measurement:'°C',friendly_name:'Wohnzimmer'}};
  const registry=rows.map(([entity_id,,,register])=>({entity_id,platform:'nibe_heatpump',config_entry_id:'a',unique_id:'a-'+register,device_id:'vvm'}));registry.push({entity_id:'climate.vvms320_climate_system_s1',platform:'nibe_heatpump',config_entry_id:'a',unique_id:'a-climate',device_id:'vvm'});
  window.uiFixture={states:structuredClone(states),registry,calls:[],fail:false};
  card.hass={states,connected:true,config:{time_zone:'Europe/Berlin'},callService:async(...args)=>{window.uiFixture.calls.push(args);},callWS:async msg=>{
   const f=window.uiFixture;if(msg.type==='config/entity_registry/list')return f.registry;if(msg.type==='config/device_registry/list')return [{model:'VVM S320',config_entries:['a']}];if(msg.type==='get_states'){if(f.fail)throw Error('offline');return Object.values(structuredClone(f.states));}
   if(msg.type==='history/history_during_period'){const t=Date.parse(msg.start_time)/1000;return Object.fromEntries(msg.entity_ids.map(id=>[id,[{s:f.states[id]?.state||'0',lu:t},{s:f.states[id]?.state||'0',lu:t+100}]]));}throw Error(msg.type);
  }};
 });
 const card=page.locator('nibe-control-card');await card.getByRole('button',{name:'Daten aktualisieren',exact:true}).waitFor();
 await page.evaluate(()=>document.querySelector('nibe-control-card').selectPlant('heatpump'));
 const read=fn=>page.evaluate(fn);
 assert.equal(await read(()=>document.querySelector('nibe-control-card').operation().mode),'idle');
 assert.match(await read(()=>document.querySelector('nibe-control-card').diagnosticValue('alarm')),/216.*nicht aktiv/);
 const viewports=[[320,740],[390,844],[768,1024],[1024,600],[1440,900]];
 for(const [width,height] of viewports){await page.setViewportSize({width,height});const layout=await read(()=>{
  const root=document.querySelector('nibe-control-card').shadowRoot,r=s=>root.querySelector(s).getBoundingClientRect(),a=r('[data-refresh]'),b=r('[data-open-settings]'),pipe=r('.pipe.hot'),outdoor=r('.outdoor-unit'),indoor=r('.indoor-unit');
  return {overflow:document.documentElement.scrollWidth>innerWidth,targets:a.width>=44&&a.height>=44&&b.width>=44&&b.height>=44,aligned:Math.abs(a.top-b.top)<1,connections:Math.abs(outdoor.right-pipe.left)<1&&Math.abs(indoor.left-pipe.right)<1};
 });assert.equal(layout.overflow,false,`overflow ${width}`);assert.ok(layout.targets&&layout.aligned,`header actions ${width}`);assert.ok(layout.connections,`pipe endpoints ${width}`);}
 await page.setViewportSize({width:390,height:844});
 // Change only server state: no hass setter, exercising the continuously-open case.
 await page.evaluate(()=>{const f=window.uiFixture,time=new Date(Date.now()+2000).toISOString();for(const [id,value] of [['sensor.current_compressor_frequency_eb101_31804','55'],['sensor.priority_31029','30']])f.states[id]={...f.states[id],state:value,last_updated:time};});
 await card.getByRole('button',{name:'Daten aktualisieren',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('nibe-control-card').syncPending);
 assert.equal(await read(()=>document.querySelector('nibe-control-card').operation().label),'Heizbetrieb');assert.equal(await read(()=>window.uiFixture.calls.length),1);assert.equal(await read(()=>window.uiFixture.calls[0][1]),'update_entity');
 await page.evaluate(()=>{const card=document.querySelector('nibe-control-card'),f=window.uiFixture;f.states['sensor.class_1_alarm_32196']={...f.states['sensor.class_1_alarm_32196'],state:'1',last_updated:new Date(Date.now()+3000).toISOString()};return card.refreshData();});
 assert.equal(await read(()=>document.querySelector('nibe-control-card').operation().mode),'alarm');
 await page.evaluate(()=>{const card=document.querySelector('nibe-control-card'),f=window.uiFixture;f.states['sensor.class_1_alarm_32196']={...f.states['sensor.class_1_alarm_32196'],state:'unavailable',last_updated:new Date(Date.now()+4000).toISOString()};return card.refreshData();});
 assert.equal(await read(()=>document.querySelector('nibe-control-card').operation().mode),'running');assert.match(await read(()=>document.querySelector('nibe-control-card').operation().label),/ungeklärt/);
 // Keyboard, real native entity select, draft preservation through refresh.
 await card.getByRole('button',{name:'Einstellungen öffnen',exact:true}).focus();await page.keyboard.press('Enter');
 if(await card.locator('.mapping-group').first().getAttribute('open')===null)await card.locator('.mapping-group').first().locator('summary').click();
 await card.locator('#mode-room').selectOption('manual');await card.locator('#map-room').selectOption('sensor.indoor');
 await page.evaluate(()=>document.querySelector('nibe-control-card').refreshData());assert.equal(await card.locator('#map-room').inputValue(),'sensor.indoor');assert.equal(await card.locator('#mode-room').inputValue(),'manual');
 await page.evaluate(()=>{window.uiFixture.fail=true;return document.querySelector('nibe-control-card').refreshData();});assert.match(await card.locator('[data-sync-feedback]').textContent(),/Abgleich fehlgeschlagen/);assert.equal(await card.locator('#map-room').inputValue(),'sensor.indoor');
 await page.evaluate(()=>{const card=document.querySelector('nibe-control-card');window.uiFixture.fail=false;card.hass={...card._hass,connected:false};});assert.equal(await card.getByRole('button',{name:'Daten aktualisieren',exact:true}).isDisabled(),true);assert.equal(await read(()=>document.querySelector('nibe-control-card').operation().mode),'offline');
 await page.evaluate(()=>{const card=document.querySelector('nibe-control-card');card.hass={...card._hass,connected:true};});await page.waitForFunction(()=>!document.querySelector('nibe-control-card').syncPending);
 await card.getByRole('button',{name:'Übersicht',exact:true}).click();
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await read(()=>getComputedStyle(document.querySelector('nibe-control-card').shadowRoot.querySelector('.fan b')).animationName),'none');
 await page.screenshot({path:output+'/mobile-light.png',fullPage:true});
 await page.evaluate(()=>{document.body.style.setProperty('--primary-text-color','#e8eeee');document.body.style.setProperty('--secondary-text-color','#9eafb6');document.body.style.setProperty('--card-background-color','#202b31');document.body.style.background='#151d22';});await page.screenshot({path:output+'/mobile-dark.png',fullPage:true});
 await page.setViewportSize({width:1024,height:600});await page.screenshot({path:output+'/wall-display-dark.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({viewports,checks:['alarm 216 inactive','confirmed alarm 216 active','unavailable activity','server-only live update','single coordinator request','keyboard settings','manual selection preserved','failed sync','disconnect/reconnect','reduced motion','theme'],pageErrors:errors},null,2));
 console.log('UI verified: 5 viewports, 44px aligned actions, pipe endpoints, numeric alarm 0/1/unknown, snapshot without hass setter, one coordinator request, keyboard/native select/draft preservation, failure, reconnect, themes and reduced motion.');
} finally {await browser.close();}
