import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require('playwright');} catch {playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
const {chromium}=playwright;
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const source=await readFile(new URL('../dist/nibe-control.js',import.meta.url),'utf8');
 await page.setContent('<body style="margin:0;--primary-text-color:#27343b;--secondary-text-color:#62717a;--card-background-color:#fff;--primary-color:#287f75;background:#f3f6f7"><nibe-control-card></nibe-control-card></body>');
 await page.addScriptTag({content:source});
 await page.evaluate(()=>{
  const card=document.querySelector('nibe-control-card');card.setConfig({});
  const states={
   'sensor.current_compressor_frequency_eb101_31804':{state:'40',attributes:{unit_of_measurement:'Hz'}},
   'sensor.priority_31029':{state:'30',attributes:{}},
   'sensor.alarm_number_31976':{state:'0',attributes:{}},
   'sensor.defrosting_eb101_31806':{state:'0',attributes:{}},
   'sensor.current_outdoor_temperature_bt1_30002':{state:'12',attributes:{unit_of_measurement:'°C'}},
   'sensor.supply_line_bt2_30006':{state:'31',attributes:{unit_of_measurement:'°C'}},
   'sensor.hot_water_top_bt7_30009':{state:'48',attributes:{unit_of_measurement:'°C'}},
   'sensor.sg_ready_input_a_31913':{state:'0',attributes:{}},
   'sensor.sg_ready_input_b_31914':{state:'1',attributes:{}},
   'binary_sensor.evcc_nibe_enabled':{state:'on',attributes:{}},
   'binary_sensor.evcc_nibe_charging':{state:'on',attributes:{}},
   'select.evcc_nibe_mode':{state:'pv',attributes:{options:['off','pv','now']}},
   'climate.vvms320_climate_system_s1':{state:'auto',attributes:{current_temperature:22.4}},
  };
  card.hass={states,connected:true,callService:()=>{throw Error('No services permitted in UI test');},callWS:async()=>[]};
 });
 await page.waitForFunction(()=>document.querySelector('nibe-control-card').shadowRoot?.querySelector('main'));
 for(const [width,height] of [[360,800],[430,900],[768,1024],[1280,800],[800,480]]){
  await page.setViewportSize({width,height});
  const result=await page.evaluate(()=>{
   const root=document.querySelector('nibe-control-card').shadowRoot;
   const r=s=>root.querySelector(s).getBoundingClientRect();
   const outdoor=r('.outdoor-unit'), indoor=r('.indoor-unit'), pipe=r('.pipe.hot');
   return {overflow:document.documentElement.scrollWidth>innerWidth,connection:Math.abs(outdoor.right-pipe.left)<1 && Math.abs(indoor.left-pipe.right)<1,
    vertical:Math.abs(pipe.top-(indoor.top+36))<1,heat:root.querySelector('[data-destination="heat"]').getBoundingClientRect().height>0,
    water:root.querySelector('[data-destination="water"]').getBoundingClientRect().height>0};
  });
  assert.equal(result.overflow,false,`overflow at ${width}`);assert.equal(result.connection,true,`pipe edges at ${width}`);assert.equal(result.vertical,true,`pipe height at ${width}`);assert.equal(result.heat&&result.water,true);
 }
 await page.evaluate(()=>{const card=document.querySelector('nibe-control-card');card._hass.states['sensor.priority_31029'].state='20';card.hass={...card._hass};});
 assert.equal(await page.evaluate(()=>document.querySelector('nibe-control-card').shadowRoot.querySelector('[data-operation]').textContent),'Warmwasserbereitung');
 assert.equal(await page.evaluate(()=>document.querySelector('nibe-control-card').shadowRoot.querySelector('[data-destination="water"]').classList.contains('is-active')),true);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('nibe-control-card').shadowRoot.querySelector('.fan b')).animationName),'none');
 await page.evaluate(()=>{const card=document.querySelector('nibe-control-card');card.hass={...card._hass,connected:false};});
 assert.equal(await page.evaluate(()=>document.querySelector('nibe-control-card').shadowRoot.querySelector('[data-operation]').textContent),'Home Assistant getrennt');
 await page.evaluate(()=>{const card=document.querySelector('nibe-control-card');card._hass.states['binary_sensor.evcc_nibe_enabled'].state='unavailable';card.hass={...card._hass,connected:true};document.body.style.setProperty('--primary-text-color','#e8eeee');document.body.style.setProperty('--secondary-text-color','#9eafb6');document.body.style.setProperty('--card-background-color','#202b31');document.body.style.background='#151d22';});
 assert.equal(await page.evaluate(()=>document.querySelector('nibe-control-card').shadowRoot.querySelector('[data-state="evccEnabled"]').textContent),'Nicht verfügbar');
 await page.setViewportSize({width:430,height:900});
 await page.screenshot({path:new URL('../ui-0.5-mobile.png',import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:1280,height:900});
 await page.screenshot({path:new URL('../ui-0.5-desktop.png',import.meta.url).pathname,fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('UI verified: 5 viewports, exact pipe endpoints, heat→water live transition, disconnected, EVCC unavailable, dark theme, reduced motion; no browser exceptions.');
} finally {await browser.close();}
