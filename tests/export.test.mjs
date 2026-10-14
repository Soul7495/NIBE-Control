import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {ncWorkbook,ncZipStore,ncExportTables,ncExcelLocalDate} from '../src/history-export.js';
function files(bytes){const result={};let offset=0;const v=new DataView(bytes.buffer);while(v.getUint32(offset,true)===0x04034b50){const length=v.getUint32(offset+18,true),names=v.getUint16(offset+26,true),extra=v.getUint16(offset+28,true),name=new TextDecoder().decode(bytes.slice(offset+30,offset+30+names)),start=offset+30+names+extra;result[name]=new TextDecoder().decode(bytes.slice(start,start+length));offset=start+length;}assert.equal(v.getUint32(offset,true),0x02014b50);return result;}
test('XLSX is a real ZIP/SpreadsheetML with numeric values, date style, frozen header and literal formula-like text',()=>{
 const bytes=ncWorkbook([{name:'Messwerte',rows:[['Zeit','Wert','Entity'],[ncExcelLocalDate(0,'UTC'),31,'=HYPERLINK("bad")'],[null,0,'<script>&\u0001']]}]),xml=files(bytes);
 assert.ok(xml['[Content_Types].xml']);assert.match(xml['xl/worksheets/sheet1.xml'],/<v>31<\/v>/);assert.match(xml['xl/worksheets/sheet1.xml'],/<v>0<\/v>/);assert.match(xml['xl/worksheets/sheet1.xml'],/t="inlineStr"/);assert.match(xml['xl/worksheets/sheet1.xml'],/ySplit="1"/);assert.match(xml['xl/worksheets/sheet1.xml'],/autoFilter/);assert.ok(!xml['xl/worksheets/sheet1.xml'].includes('<f>'));assert.ok(!xml['xl/worksheets/sheet1.xml'].includes('\u0001'));assert.match(xml['xl/worksheets/sheet1.xml'],/&lt;script&gt;&amp;/);
});
test('export aligns step-held values at real timestamps, preserves unknown and uses blank rather than zero',()=>{
 const s=[{label:'Vorlauf Soll',entity:'sensor.target',unit:'°C',points:[{time:0,value:31},{time:1000,value:31}]},{label:'Verdichter',entity:'sensor.hz',unit:'Hz',points:[{time:100,value:50},{time:400,value:0},{time:600,value:null},{time:800,value:20}],events:[{time:100,value:50},{time:400,value:0},{time:600,value:null},{time:800,value:20}]}];
 const sheets=ncExportTables(s,0,1000,'UTC'),rows=sheets[0].rows;
 assert.equal(rows[1][3],null);assert.equal(rows[2][2],31);assert.equal(rows[2][3],50);assert.equal(rows.find(r=>r[1]==='1970-01-01T00:00:00.400Z')[3],0);assert.equal(rows.find(r=>r[1]==='1970-01-01T00:00:00.600Z')[3],null);assert.equal(sheets[1].rows.length,7);assert.equal(rows.at(-1)[3],20);
});
test('local Excel dates follow HA timezone including daylight saving, UTC distinguishes repeated wall time',()=>{
 const a=Date.parse('2026-10-25T00:30:00Z'),b=Date.parse('2026-10-25T01:30:00Z');assert.equal(ncExcelLocalDate(a,'Europe/Berlin').date,ncExcelLocalDate(b,'Europe/Berlin').date);assert.notEqual(new Date(a).toISOString(),new Date(b).toISOString());
});
test('export rejects excessive datasets rather than silently downsampling',()=>{
 assert.throws(()=>ncExportTables([{points:Array.from({length:50001},()=>({time:0,value:1}))}],0,1000,'UTC'),/50.000/);
});
function fixture(){
 const classes=new Map();vm.runInNewContext(readFileSync(new URL('../dist/nibe-control.js',import.meta.url),'utf8'),{HTMLElement:class{},document:{},window:{},TextEncoder,Uint8Array,DataView,Intl,customElements:{get:k=>classes.get(k),define:(k,v)=>classes.set(k,v)}});
 const card=new (classes.get('nibe-control-card'))(),feedback={textContent:''},button={disabled:false,innerHTML:'',textContent:''};card.config={};card.registry=[];card.meta={};card.devices=[];card.mapping={supplyTarget:'sensor.target',electrical:'sensor.watts',room:'climate.room'};card.historyHours=6;card.shadowRoot={querySelector:s=>s==='[data-export-feedback]'?feedback:null,getElementById:s=>s==='history-export'?button:null};card._hass={connected:true,states:{'sensor.target':{state:'31',attributes:{unit_of_measurement:'°C'}},'sensor.watts':{state:'1500',attributes:{unit_of_measurement:'W'}},'climate.room':{state:'auto',attributes:{current_temperature:23}}},config:{time_zone:'Europe/Berlin',unit_system:{temperature:'°C'}}};return {card,feedback,button};
}
test('actual component export fetches selected time window, climate attributes and numeric data without a service write',async()=>{
 const {card,feedback,button}=fixture();let request,download;card._hass.callService=()=>assert.fail('read only');card._hass.callWS=async msg=>{request=msg;return {'sensor.target':[{state:'31',last_updated:msg.start_time}], 'sensor.watts':[{state:'1500',last_updated:msg.start_time}], 'climate.room':[{state:'auto',last_updated:msg.start_time,attributes:{current_temperature:23}}]};};card.downloadHistoryFile=(bytes,name)=>download={bytes,name};assert.equal(await card.exportHistory(),true);assert.equal(Date.parse(request.end_time)-Date.parse(request.start_time),6*3600000);assert.equal(request.no_attributes,false);assert.equal(request.minimal_response,false);assert.ok(download.name.endsWith('.xlsx'));const xml=files(download.bytes);assert.match(xml['xl/worksheets/sheet1.xml'],/<v>1.5<\/v>/);assert.match(xml['xl/worksheets/sheet1.xml'],/<v>23<\/v>/);assert.ok(feedback.textContent.includes('Download gestartet'));assert.equal(button.disabled,false);
});
test('export handles offline, empty recorder, error and double activation honestly',async()=>{
 const {card,feedback}=fixture();card._hass.connected=false;assert.equal(await card.exportHistory(),false);assert.ok(feedback.textContent.includes('getrennt'));card._hass.connected=true;card.downloadHistoryFile=()=>assert.fail('no download');card._hass.callWS=async()=>({});assert.equal(await card.exportHistory(),false);assert.ok(feedback.textContent.includes('Keine numerischen'));card._hass.callWS=async()=>{throw Error('unauthorized');};assert.equal(await card.exportHistory(),false);assert.ok(feedback.textContent.includes('Recorderzugriff'));card.exportPending=true;assert.equal(await card.exportHistory(),false);
});
test('export discards result after mapping or period changes',async()=>{
 const {card}=fixture();card.downloadHistoryFile=()=>assert.fail('wrong mapping');card._hass.callWS=async()=>{card.historyHours=12;return {};};assert.equal(await card.exportHistory(),false);
});
