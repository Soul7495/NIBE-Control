/* NIBE Control 0.9.1 — local Home Assistant dashboard */
// Register 31029: yozik04/nibe, vvms320_vvms325.json / extensions.json.
// SG contacts: NIBE VVM S320 installer manual 531158-2, AUX / SG Ready.
const NC_INVALID = new Set(['unknown','unavailable','none','null','']);
function ncNumber(value) {
  if (value == null || NC_INVALID.has(String(value).toLowerCase())) return null;
  const number=Number(value);
  return Number.isFinite(number) ? number : null;
}
function ncBinary(value) {
  const raw=String(value ?? '').toLowerCase();
  if (['1','on','true','active','closed'].includes(raw)) return true;
  if (['0','off','false','inactive','open'].includes(raw)) return false;
  return null;
}
function ncPriority(value) {
  return ({'10':'idle','20':'water','30':'heat','40':'pool','60':'cooling',
    'off':'idle','hot water':'water','heat':'heat','pool':'pool','cooling':'cooling'})[String(value ?? '').toLowerCase()] || 'unknown';
}
function ncOperating(values, connected=true) {
  const hz=ncNumber(values.compressorHz), alarm=ncNumber(values.alarm);
  const kind=ncPriority(values.priority);
  if (!connected) return {mode:'offline',label:'Home Assistant getrennt',kind:'unknown',active:false};
  if (alarm!=null && alarm!==0) return {mode:'alarm',label:`Störung · Alarm ${alarm}`,kind:'unknown',active:false};
  const defrost=ncBinary(values.defrost);
  if (defrost===true) return {mode:'defrost',label:'Abtauung',kind:'unknown',active:false};
  // Undocumented numeric defrost states must not be treated as "off".
  if (ncNumber(values.defrost)>1) return {mode:'unknown',label:`Abtaustatus ${values.defrost}`,kind:'unknown',active:false};
  if (hz==null && !(ncNumber(values.additionalHeat)>0)) return {mode:'unknown',label:'Betrieb nicht verfügbar',kind:'unknown',active:false};
  const active=hz>0 || (ncNumber(values.additionalHeat)||0)>0;
  if (active && kind==='water') return {mode:'running',label:'Warmwasserbereitung',kind,active:true};
  if (active && kind==='heat') return {mode:'running',label:'Heizbetrieb',kind,active:true};
  if (active && kind==='cooling') return {mode:'running',label:'Kühlbetrieb',kind,active:true};
  if (active && kind==='pool') return {mode:'running',label:'Poolbetrieb',kind,active:true};
  if (active) return {mode:'running',label:'Wärmeerzeugung aktiv · Betriebsart unbekannt',kind:'unknown',active:true};
  if(hz===0&&ncNumber(values.additionalHeat)==null)return {mode:'unknown',label:'Verdichter steht · Heizstabstatus fehlt',kind:'unknown',active:false};
  return {mode:'idle',label:'Bereit · keine Wärmeerzeugung',kind,active:false};
}
function ncSg(values) {
  const a=ncBinary(values.sgA), b=ncBinary(values.sgB);
  if (a!=null && b!=null) {
    if(a && !b) return {label:'Sperre',detail:'SG Ready blockiert Verdichter und Zusatzheizung.',tone:'blocked'};
    if(!a && !b) return {label:'Normalbetrieb',detail:'Keine externe Anhebung durch SG Ready.',tone:'normal'};
    if(!a && b) return {label:'Überschuss / Niedrigpreis',detail:'SG Ready erlaubt die konfigurierte Anhebung. Das ist kein Nachweis für PV-Überschuss.',tone:'boost'};
    return {label:'Max. Anhebung',detail:'Überkapazitätsmodus. NIBE entscheidet über die Wärmeerzeugung.',tone:'boost'};
  }
  const text=String(values.sgMode ?? '').toLowerCase();
  const mapped={'normal price':'Normalbetrieb','high price':'Sperre','low price':'Überschuss / Niedrigpreis','free electricity':'Max. Anhebung'}[text];
  return {label:mapped || (ncNumber(values.sgMode)!=null?`Statuscode ${values.sgMode}`:'Nicht verfügbar'),detail:'SG-Eingänge A/B fehlen oder sind nicht verfügbar. Numerische Modi werden nicht geraten.',tone:'unknown'};
}
function ncEvccMode(raw) {
  return ({off:'Aus',pv:'PV-Überschuss',minpv:'Min. + PV',now:'Sofort',smart:'Smart-Modus'})[String(raw ?? '').toLowerCase()] || (NC_INVALID.has(String(raw ?? '').toLowerCase())?'Nicht verfügbar':String(raw));
}
// Calendar dates are owned by HA's timezone, independent of the display device.
function ncToday(timeZone='Europe/Berlin', now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=k=>parts.find(p=>p.type===k).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
function ncFilterDate(date, months, today) {
 const parse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s)))return null;const d=new Date(`${s}T12:00:00Z`);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s?d:null;};
 const last=parse(date), current=parse(today), n=ncNumber(months);
 if(!last||!current||last>current)return {label:'Wechseldatum fehlt oder ist ungültig',due:null,days:null};
 if(n==null||!Number.isInteger(n)||n<1||n>24)return {label:'Filterintervall nicht eingerichtet',due:null,days:null};
 const day=last.getUTCDate();last.setUTCDate(1);last.setUTCMonth(last.getUTCMonth()+n);
 const end=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth()+1,0)).getUTCDate();last.setUTCDate(Math.min(day,end));
 const days=Math.round((last-current)/86400000);
 return {due:last.toISOString().slice(0,10),days,label:days<0?`${-days} Tage überfällig`:days===0?'Heute fällig':`Noch ${days} Tage`};
}
// HA recorder returns change events, not uniformly spaced measurements.
function ncHistoryPoints(rows,start,end,{sample=true}={}){
 if(!Array.isArray(rows)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
 const parsed=rows.map(p=>{const raw=p.lu??p.last_updated??p.lc??p.last_changed;const time=typeof raw==='number'?(raw<1e12?raw*1000:raw):Date.parse(raw);return {time,value:ncNumber(p.s??p.state)};}).filter(p=>Number.isFinite(p.time)&&p.time<=end).sort((a,b)=>a.time-b.time);
 const unique=[];for(const p of parsed){if(unique.at(-1)?.time===p.time)unique[unique.length-1]=p;else unique.push(p);}
 const before=unique.filter(p=>p.time<start).at(-1),inside=unique.filter(p=>p.time>=start);
 if(before)inside.unshift({...before,time:start});
 // Same state persists until the next change, including explicit unknown.
 const points=[];for(const p of inside){if(!points.length||points.at(-1).value!==p.value)points.push(p);}
 if(points.length&&points.at(-1).time<end)points.push({...points.at(-1),time:end});
 if(!sample||points.length<=600)return points;
 const buckets=new Map();for(const p of points){const key=Math.min(119,Math.floor((p.time-start)/(end-start)*120));if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
 const result=[];for(const bucket of buckets.values()){const finite=bucket.filter(p=>p.value!=null),gap=bucket.find(p=>p.value==null);const selected=new Set(gap?[bucket[0],gap,bucket.at(-1)]:[bucket[0],bucket.at(-1),finite.reduce((a,b)=>!a||b.value<a.value?b:a,null),finite.reduce((a,b)=>!a||b.value>a.value?b:a,null)]);result.push(...bucket.filter(p=>selected.has(p)));}return result;
}
function ncHistoryPath(points,start,end,min,span){
 if(end<=start||span<=0)return '';
 let pen=false,path='';for(const p of points){const x=((p.time-start)/(end-start)*100).toFixed(2);if(p.value==null){if(pen)path+=`H${x} `;pen=false;continue;}const y=(44-(p.value-min)/span*38).toFixed(2);path+=pen?`H${x} V${y} `:`M${x},${y} `;pen=true;}return path.trim();
}
function ncHistoryValue(points,time){
 let low=0,high=points.length;while(low<high){const mid=(low+high)>>1;if(points[mid].time<=time)low=mid+1;else high=mid;}return low?points[low-1].value:null;
}
function ncHistoryScale(values){
 const nums=values.filter(v=>Number.isFinite(v));if(!nums.length)return null;
 let min=Math.min(...nums),max=Math.max(...nums);if(min===max){const pad=Math.max(.5,Math.abs(min)*.05);min-=pad;max+=pad;}
 return {min,max,span:max-min};
}
function ncHistoryStats(points,start,end){
 let total=0,duration=0,running=0,starts=0,min=Infinity,max=-Infinity,previous=null;
 for(let i=0;i<points.length;i++){const p=points[i],next=points[i+1]?.time??end,dt=Math.max(0,Math.min(end,next)-Math.max(start,p.time));
  if(p.value!=null&&dt>0){min=Math.min(min,p.value);max=Math.max(max,p.value);total+=p.value*dt;duration+=dt;if(p.value>0)running+=dt;if(previous===0&&p.value>0)starts++;}
  previous=p.value;
 }
 return {min:duration?min:null,max:duration?max:null,mean:duration?total/duration:null,coverage:(end>start?duration/(end-start):0),runningHours:running/3600000,starts};
}

function ncPvAction(raw){const s=String(raw??'').toLowerCase();return ({inactive:'Keine PV-Aktion',active:'PV-Aktion aktiv'})[s]||(NC_INVALID.has(s)?'Nicht verfügbar':`Aktion: ${raw}`);}
const DEVICE_PROFILE = {
  model: "VVM S320",
  roles: {
    outdoor: { register: "30002", entity: "sensor.current_outdoor_temperature_bt1_30002", label: "Außen", tag: "BT1", unit: "°C", group: "core" },
    room: { entity: "climate.vvms320_climate_system_s1", attribute: "current_temperature", label: "Innen", unit: "°C", group: "core" },
    roomSetpoint: { register: "40207", entity: "number.room_sensor_set_point_value_climate_system_1_40207", label: "Raum-Sollwert (Register)", unit: "°C", group: "diagnostic" },
    useRoomSensor: { register: "40203", entity: "switch.use_room_sensor_climate_system_1_40203", label: "Raumfühlerregelung", group: "diagnostic" },
    supply: { register: "30006", entity: "sensor.supply_line_bt2_30006", label: "Vorlauf", tag: "BT2", unit: "°C", group: "core" },
    return: { register: "30008", entity: "sensor.return_line_bt3_30008", label: "Rücklauf", tag: "BT3", unit: "°C", group: "core" },
    supplyTarget: { register: "31018", entity: "sensor.calculated_supply_climate_system_1_31018", label: "Vorlauf Soll", unit: "°C", group: "recommended" },
    degreeMinutes: { register: "40012", entity: "number.degree_minutes_40012", label: "Gradminuten", unit: "DM", group: "recommended" },
    flow: { register: "30041", entity: "sensor.flow_sensor_bf1_30041", label: "Volumenstrom", tag: "BF1", unit: "L/min", group: "recommended" },
    hpSupply: { register: "31479", entity: "sensor.condenser_sensor_supply_line_eb101_bt12_31479", label: "WP-Vorlauf", tag: "BT12", unit: "°C", group: "recommended" },
    hpReturn: { register: "31476", entity: "sensor.return_line_eb101_bt3_31476", label: "WP-Rücklauf", tag: "BT3", unit: "°C", group: "diagnostic" },
    compressorHz: { register: "31804", entity: "sensor.current_compressor_frequency_eb101_31804", label: "Verdichter", tag: "Ist", unit: "Hz", group: "recommended" },
    requestedHz: { register: "31855", entity: "sensor.requested_compressor_frequency_eb101_31855", label: "Verdichter", tag: "Soll", unit: "Hz", group: "diagnostic" },
    compressorStatus: { register: "31485", entity: "sensor.compressor_status_eb101_31485", label: "Verdichterstatus", group: "core" },
    priority: { register: "31029", entity: "sensor.priority_31029", label: "Betriebspriorität", group: "recommended" },
    electrical: { register: "32306", entity: "sensor.energy_log_current_power_consumption_32306", label: "Elektrische Leistung", unit: "kW", group: "recommended" },
    outdoorPower: { register: "31807", entity: "sensor.power_eb101_ep14_31807", label: "Außeneinheit", unit: "kW", group: "diagnostic" },
    thermal: { register: "30407", entity: "sensor.generated_power_heating_eb101_30407", label: "Heizleistung", unit: "kW", group: "diagnostic" },
    additionalHeat: { register: "31028", entity: "sensor.power_internal_additional_heat_31028", label: "Heizstab", unit: "kW", group: "recommended" },
    hotWaterTop: { register: "30009", entity: "sensor.hot_water_top_bt7_30009", label: "Warmwasser oben", tag: "BT7", unit: "°C", group: "core" },
    hotWaterCharge: { register: "30010", entity: "sensor.hot_water_charging_bt6_30010", label: "Warmwasser Laden", tag: "BT6", unit: "°C", group: "core" },
    hotWaterMode: { register: "31039", entity: "sensor.current_hot_water_mode_without_spa_sc_31039", label: "Warmwassermodus", group: "recommended" },
    moreHotWater: { register: "31079", entity: "sensor.more_hot_water_status_31079", label: "Mehr Warmwasser", group: "recommended" },
    diverter: { register: "32197", entity: "sensor.diverter_valve_hot_water_qn10_32197", label: "Umschaltventil", tag: "QN10", group: "diagnostic" },
    sgMode: { register: "31912", entity: "sensor.operating_mode_sg_ready_31912", label: "SG Ready", group: "recommended" },
    sgA: { register: "31913", entity: "sensor.sg_ready_input_a_31913", label: "SG Eingang A", group: "diagnostic" },
    sgB: { register: "31914", entity: "sensor.sg_ready_input_b_31914", label: "SG Eingang B", group: "diagnostic" },
    defrost: { register: "31806", entity: "sensor.defrosting_eb101_31806", label: "Abtauung", group: "recommended" },
    alarm: { register: "31976", entity: "sensor.alarm_number_31976", label: "Alarmnummer", group: "core" },
    climate: { entity: "climate.vvms320_climate_system_s1", label: "Heizkreis", group: "control" },
    waterHeater: { entity: "water_heater.vvms320_hot_water", label: "Warmwasser", group: "control" },
    evccEnabled: { entity: "binary_sensor.evcc_nibe_enabled", label: "EVCC NIBE", group: "optional" },
    evccCharging: { entity: "binary_sensor.evcc_nibe_charging", label: "EVCC-Anforderung", group: "optional" },
    evccAction: { entity: "sensor.evcc_nibe_pv_action", label: "PV-Aktion", group: "optional" },
    evccActionValue: { entity: "sensor.evcc_nibe_pv_action_value", label: "Anhebung", group: "optional" },
    evccMode: { entity: "select.evcc_nibe_mode", label: "EVCC-Modus", group: "optional" },
    ventilationExtract: { register: "30136", entity: "sensor.fan_speed_az30_gq2_30136", label: "Abluftventilator", tag: "GQ2", unit: "%", group: "recommended" },
    ventilationSupply: { register: "30137", entity: "sensor.fan_speed_az30_gq3_30137", label: "Zuluftventilator", tag: "GQ3", unit: "%", group: "recommended" },
    ventilationMode: { register: "31038", entity: "sensor.fan_mode_1_31038", label: "Lüftermodus (Rohwert)", group: "diagnostic" }
  }
};

const WRITE_ALLOWLIST = Object.freeze({
  waterHeater: ["water_heater.set_operation_mode"],
  evccMode: ["select.select_option"]
});

function registerFromUniqueId(uniqueId = "") {
  return String(uniqueId).match(/-(\d{5})$/)?.[1];
}

function resolveDiscovery(registry=[],overrides={},entryId=null){
 const rows=registry.filter(r=>r.platform==='nibe_heatpump'||(!r.platform&&registerFromUniqueId(r.unique_id)));
 const entries=[...new Set(rows.map(r=>r.config_entry_id).filter(Boolean))];
 const selected=entryId||(entries.length===1?entries[0]:null),ambiguous=[];
 const scope=rows.filter(r=>selected?r.config_entry_id===selected:entries.length===0);
 const mapping={};
 for(const [role,spec] of Object.entries(DEVICE_PROFILE.roles)){
  if(overrides[role]){mapping[role]=overrides[role];continue;}
  if(spec.register){const matches=scope.filter(r=>registerFromUniqueId(r.unique_id)===spec.register);let candidate=matches.length===1?matches[0]:null;
   // Sensor/number aliases are safe only with identical registry identity and device.
   if(matches.length>1&&matches[0].device_id&&matches.every(r=>r.unique_id===matches[0].unique_id&&r.device_id===matches[0].device_id)){
    const enabled=matches.filter(r=>!r.disabled_by),pool=enabled.length?enabled:matches,domain=spec.entity.split('.')[0],preferred=pool.filter(r=>r.entity_id.startsWith(domain+'.'));
    if(preferred.length===1)candidate=preferred[0];else if(pool.length===1)candidate=pool[0];
   }
   if(candidate)mapping[role]=candidate.entity_id;else if(matches.length>1){mapping[role]=null;ambiguous.push(role);}else mapping[role]=entries.length?null:spec.entity;continue;}
  if(spec.group==='optional'){mapping[role]=registry.find(r=>r.entity_id===spec.entity)?.entity_id||spec.entity;continue;}
  const domain=spec.entity.split('.')[0],matches=scope.filter(r=>r.entity_id.startsWith(domain+'.'));
  const exact=matches.find(r=>r.entity_id===spec.entity);
  if(exact)mapping[role]=exact.entity_id;else if(matches.length===1)mapping[role]=matches[0].entity_id;else{mapping[role]=entries.length?null:spec.entity;if(matches.length>1)ambiguous.push(role);}
 }
 if(!overrides.room)mapping.room=mapping.climate;
 return {mapping,entries,selected,ambiguous};
}
function resolveRoles(registry=[],overrides={},entryId=null){return resolveDiscovery(registry,overrides,entryId).mapping;}

function usableState(state) {
  return !!state && !["unknown", "unavailable", "none", "null", ""].includes(String(state.state).toLowerCase());
}
const VERSION = "0.9.1";
const PROFILE=Object.fromEntries(Object.entries(DEVICE_PROFILE.roles).map(([role,p])=>[role,{r:p.register,e:p.entity,a:p.attribute,l:p.label+(role==='compressorHz'?' Ist':role==='requestedHz'?' Soll':''),t:['compressorHz','requestedHz'].includes(role)?null:p.tag,u:p.unit,req:p.group==='recommended'||role==='sgA'||role==='sgB',diag:p.group==='diagnostic'||['electrical','compressorHz','compressorStatus','priority','sgMode','alarm','defrost'].includes(role),optional:p.group==='optional'}]));
const INVALID = new Set(["unknown","unavailable","none","null",""]);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const valid = s => !!s && !INVALID.has(String(s.state).toLowerCase());
const yes = v => ["1","on","true","yes","active"].includes(String(v).toLowerCase());
const reg = uid => String(uid || "").match(/-(\d{5})$/)?.[1];
const fmt = (v, digits=1) => Number.isFinite(Number(v)) ? new Intl.NumberFormat("de-DE",{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number(v)) : "—";

function statusLabel(role, raw) {
 const s=String(raw ?? "").toLowerCase();
 if(role==="alarm") return s==="0" ? "Kein Alarm" : `Alarm ${raw}`;
 if(role==="defrost") return yes(s) ? "Abtauung aktiv" : "Keine Abtauung";
 if(role==="compressorStatus") return s==="20" ? "Statuscode 20" : `Statuscode ${raw}`;
 if(role==="sgMode") return `Statuscode ${raw}`;
 return String(raw ?? "—");
}

class NibeControlCard extends HTMLElement {
 setConfig(config){ this.config=config||{}; if(!this.shadowRoot)this.attachShadow({mode:"open"}); }
 set hass(hass){ const first=!this._hass,reconnected=this._hass?.connected===false&&hass.connected!==false; this._hass=hass; if(first) this.init(); else{this.paintValues();if(reconnected)this.refreshRegistry().then(()=>this.loadHistory());} }
 async init(){
  try {
   const [entities,devices]=await Promise.all([
    this._hass.callWS({type:"config/entity_registry/list"}),
    this._hass.callWS({type:"config/device_registry/list"})
   ]);
   this.registry=entities; this.devices=devices;this.discoveryError=false;
   this.applyDiscovery();
  } catch(e){this.registry=[];this.discoveryError=true;this.mapping=Object.fromEntries(Object.entries(PROFILE).map(([k,v])=>[k,this.config?.mappings?.[k]||v.e]));this.meta={};if(!this.config?.mappings?.room)this.mapping.room=this.mapping.climate;}
  this.helperIds={}; this.findMaintenanceHelpers();
  this.render(); this.loadHistory();
 }
 async refreshRegistry(){
  if(this.registryPending)return;this.registryPending=true;
  try{const rows=await this._hass.callWS({type:'config/entity_registry/list'});this.registry=rows;this.discoveryError=false;this.applyDiscovery();this.paintValues();}
  catch(e){this.discoveryError=true;const message=this.shadowRoot?.querySelector('[data-discovery-error]');if(message)message.textContent='Registry nicht erreichbar. Vorhandene Zuordnung bleibt erhalten.';}
  finally{this.registryPending=false;}
 }
 applyDiscovery(){
  const result=resolveDiscovery(this.registry,this.config?.mappings||{},this.config?.config_entry_id);const changed=JSON.stringify(this.mapping||{})!==JSON.stringify(result.mapping);if(changed){this.historyGeneration=(this.historyGeneration||0)+1;this.historyPending=false;}this.discovery=result;this.mapping=result.mapping;this.meta=Object.fromEntries(Object.entries(this.mapping).map(([r,id])=>[r,this.registry.find(e=>e.entity_id===id)]));
 }
 connectedCallback(){clearInterval(this.historyTimer);this.historyTimer=setInterval(()=>{if(this._hass?.connected!==false&&this.selectedPlant==='heatpump'&&this.shadowRoot?.getElementById('charts')?.classList.contains('active')&&document.visibilityState!=='hidden')this.loadHistory();},60000);}
 disconnectedCallback(){this.historyPending=false;clearInterval(this.historyTimer);this.historyTimer=null;this.historyGeneration=(this.historyGeneration||0)+1;}
 st(role){return this._hass.states[this.mapping?.[role]];}
 val(role){const s=this.st(role), a=PROFILE[role]?.a; return a ? s?.attributes?.[a] : s?.state;}
 available(role){return valid(this.st(role))&&(!(PROFILE[role]?.a||PROFILE[role]?.u)||ncNumber(this.val(role))!=null);}
 unit(role){return this.st(role)?.attributes?.unit_of_measurement || PROFILE[role]?.u || "";}
 value(role,d=1){const value=this.val(role);return this.available(role)&&ncNumber(value)!=null?`${fmt(value,d)}${this.unit(role)?` ${esc(this.unit(role))}`:""}`:"—";}
 live(role,d=1){return `<span data-role="${role}" data-digits="${d}">${this.value(role,d)}</span>`;}
 stateValues(){return Object.fromEntries(['priority','compressorHz','additionalHeat','alarm','defrost','sgA','sgB','sgMode'].map(role=>[role,this.val(role)]));}
 operation(){return ncOperating(this.stateValues(),this._hass.connected!==false);}
 operating(){const state=this.operation();return [state.mode,state.label];}
 render(){
  const [mode,label]=this.operating();
  this.shadowRoot.innerHTML=`<style>${this.styles()}</style><style>${this.responsiveStyles()}</style><style>${this.plantStyles()}</style><main class="app ${mode}">
   <header><div><div class="eyebrow">DEINE HAUSTECHNIK · V${VERSION}</div><h1>NIBE Control</h1><p class="sub">Wärmepumpe und Lüftung</p></div></header>
   <div class="plant-choices" aria-label="Anlage auswählen"><button type="button" data-plant="heatpump" aria-pressed="false"><ha-icon icon="mdi:heat-pump-outline" aria-hidden="true"></ha-icon><b>Wärmepumpe</b><small>VVM S320 · EB101</small><span data-operation>${esc(label)}</span><strong>${this.live('room')} innen · ${this.live('hotWaterTop')} Warmwasser</strong></button><button type="button" data-plant="ventilation" aria-pressed="false"><ha-icon icon="mdi:hvac" aria-hidden="true"></ha-icon><b>Lüftung</b><small>ERS S40-400</small><span data-vent-operation></span><strong>${this.live('ventilationSupply',0)} Zuluft · ${this.live('ventilationExtract',0)} Abluft</strong><em data-filter-summary></em></button></div>
   <p class="choice-hint" data-choice-hint>Wähle eine Anlage für Details und Einstellungen.</p>
   <nav hidden aria-label="Wärmepumpenbereiche"><button class="active" data-tab="overview">Übersicht</button><button data-tab="charts">Verläufe</button><button data-tab="setup">Einstellungen</button><button data-tab="diag">Diagnose</button></nav>
   <section id="overview" class="tab active" hidden>${this.hero()}${this.overview()}</section>
   <section id="charts" class="tab" hidden>${this.charts()}</section>
   <section id="setup" class="tab" hidden>${this.setup()}</section>
   <section id="diag" class="tab" hidden>${this.diagnostics()}</section>
   <section id="ventilation" hidden>${this.ventilation()}</section>
   <style>[hidden]{display:none!important}/* Hidden views override active tab display. */.plant-choices{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.plant-choices button{display:grid;grid-template-columns:32px 1fr;gap:5px 12px;text-align:left;padding:18px;border:1px solid var(--nc-line);border-radius:18px;background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer;min-width:0}.plant-choices ha-icon{grid-row:span 2;color:var(--nc-teal)}.plant-choices b{font-size:1.1rem}.plant-choices small,.plant-choices span,.plant-choices strong,.plant-choices em{grid-column:2;font-size:.78rem;overflow-wrap:anywhere}.plant-choices small,.plant-choices span{color:var(--secondary-text-color)}.plant-choices strong{font-weight:600;margin-top:6px}.plant-choices em{font-style:normal;color:var(--secondary-text-color)}.plant-choices button:hover{background:var(--nc-card)}.plant-choices button[aria-pressed=true]{border-color:var(--nc-teal);box-shadow:inset 0 0 0 1px var(--nc-teal)}.choice-hint{font-size:.85rem;color:var(--secondary-text-color);margin:24px 0}.plant-choices [data-role]{display:inline;font-size:inherit;color:inherit;grid-column:auto}@media(max-width:520px){.plant-choices{gap:8px}.plant-choices button{grid-template-columns:1fr;padding:12px;gap:6px}.plant-choices ha-icon{grid-row:auto}.plant-choices small,.plant-choices span,.plant-choices strong,.plant-choices em{grid-column:1}.plant-choices strong{font-size:.72rem}nav{position:static}}</style>
  <style>${this.compactStyles()}</style></main>`;
  this.bind(); this.paintValues();
 }
 hero(){
  return `<section class="plant" aria-label="Aktueller Anlagenbetrieb">
   <div class="plant-heading"><small>DEINE ANLAGE · LIVE</small><b data-operation>${esc(this.operation().label)}</b></div>
   <div class="plant-core">
    <article class="machine"><div class="outdoor-unit"><div class="fan" aria-hidden="true"><b></b></div><i></i><i></i><i></i></div><strong>${this.live('compressorHz',0)}</strong><small>Außeneinheit · EB101</small><span class="outside-value">${this.live('outdoor')} außen</span></article>
    <div class="plant-link" aria-hidden="true"><div class="pipe hot"><span></span></div><div class="pipe cold"><span></span></div></div>
    <article class="hub"><div class="indoor-unit"><span>NIBE</span><i></i><i></i></div><strong>VVM S320</strong><small>Inneneinheit</small></article>
   </div>
   <div class="distribution" aria-hidden="true"><i data-destination="heat"></i><i data-destination="water"></i></div><div class="destinations">
    <article class="destination heat" data-destination="heat"><ha-icon icon="mdi:home-thermometer-outline" aria-hidden="true"></ha-icon><div><b>Vorlauf · Heizkreis</b><strong>${this.live('supply')}</strong><small>Vorlauf · BT2</small></div><span class="branch-state" data-branch="heat">Bereit</span></article>
    <article class="destination water" data-destination="water"><ha-icon icon="mdi:water-boiler" aria-hidden="true"></ha-icon><div><b>Warmwasser</b><strong>${this.live('hotWaterTop')}</strong><small>Speicher oben · BT7</small></div><span class="branch-state" data-branch="water">Bereit</span></article>
   </div><details class="technical-details"><summary>Datenbasis</summary><p class="plant-note" data-operation-detail></p></details>
  </section>`;
 }
 metric(role){const p=PROFILE[role]; return `<article class="metric"><div><small>${esc(p.l)}${p.t?` · ${p.t}`:""}</small><strong>${this.live(role)}</strong></div><em data-quality="${role}"></em></article>`;}
 overview(){
  const sg=ncSg(this.stateValues()).label;
  const wh=this.st("waterHeater"), ops=wh?.attributes?.operation_list||[];
  const evccPresent=["evccEnabled","evccCharging","evccAction","evccMode"].some(r=>this.st(r));
  const evccEnabled=yes(this.val("evccEnabled")), evccRequest=yes(this.val("evccCharging"));
  return `<div class="overview-grid">
   <section class="panel climate-panel"><div class="climate-values"><span>Raum<b>${this.live("room")}</b></span><span>Außen<b>${this.live("outdoor")}</b></span></div><details class="technical-details"><summary>Temperaturinformationen</summary><p class="hint">Gemessene Raumtemperatur. Der MyUplink-Sollwert wird lokal nicht bereitgestellt.</p></details></section>
   <details class="panel water-panel"><summary>Warmwasser · Bedienung und Ladefühler</summary><div class="title"><div><small>WARMWASSER</small><h2>${this.live("hotWaterTop")}</h2></div><ha-icon icon="mdi:water-boiler"></ha-icon></div><div class="pair"><span>Ladefühler · BT6 <b>${this.live("hotWaterCharge")}</b></span><span>Warmwassermodus <b data-raw="hotWaterMode"></b></span><span>Mehr Warmwasser <b data-raw="moreHotWater"></b></span><span>Betrieb <b><span data-raw="waterHeater"></span></b></span></div><label class="mode-control" for="hw-mode">Warmwassermodus<select id="hw-mode" disabled>${ops.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></label><p class="hint" data-water-control-help></p></details>
   <section class="panel energy-board"><div class="energy-head"><div><small>ENERGIE · PV-OPTIMIERUNG</small><h2>${this.live("electrical")}</h2><p>Elektrische Leistung</p></div><ha-icon icon="mdi:solar-power-variant-outline"></ha-icon></div>
    <div class="energy-flow">
     <article class="energy-node ${evccEnabled?"is-active":""}"><ha-icon icon="mdi:solar-power"></ha-icon><span>EVCC-Freigabe</span><b data-state="evccEnabled">${evccEnabled?"Aktiv":"Inaktiv"}</b></article>
     <i aria-hidden="true"></i>
     <article class="energy-node ${evccRequest?"is-active":""}"><ha-icon icon="mdi:heat-pump-outline"></ha-icon><span>EVCC-Anforderung</span><b data-state="evccCharging">${evccRequest?"Aktiv":"Keine"}</b></article>
     <i aria-hidden="true"></i>
     <article class="energy-node sg"><ha-icon icon="mdi:transmission-tower-import"></ha-icon><span>SG Ready</span><b data-sg>${esc(sg)}</b></article>
    </div>
    <div class="energy-facts"><span>PV-Aktion<b data-raw="evccAction"></b></span><span>Anhebung<b>${this.live("evccActionValue")}</b></span><span>Heizstab<b>${this.live("additionalHeat")}</b></span></div>${this.evccControl()}
    <details class="technical-details"><summary>SG-Kontakte und Erklärung</summary><div class="sg-contacts"><span>SG A <b data-contact="sgA">—</b></span><span>SG B <b data-contact="sgB">—</b></span></div><p class="energy-explanation" data-energy-explanation></p><p class="hint" data-sg-detail></p></details>
   </section>
  </div><p role="status" aria-live="polite" class="hint" data-control-feedback></p><div class="metric-row">${["supplyTarget","supply","return","hpSupply","degreeMinutes","flow"].map(r=>this.metric(r)).join("")}</div>`;
 }
 evccControl(){return `<label class="mode-control" for="evcc-mode">EVCC-Modus<select id="evcc-mode" disabled></select></label>`;}
 charts(){return `<label class="mode-control" for="history-period">Zeitraum<select id="history-period"><option value="6">6 Stunden</option><option value="12">12 Stunden</option><option value="24" selected>24 Stunden</option></select></label><p class="hint" data-history-feedback role="status">Verläufe werden beim Öffnen und jede Minute aktualisiert. Tippe auf eine Kurve oder bewege den Zeitregler, um alle Messwerte desselben Moments zu vergleichen.</p><div class="chart-grid">${["heating","frequency","power","water"].map(k=>`<section class="panel chart"><div class="chart-head"><div><small data-period-label>${this.historyHours||24} STUNDEN</small><h3>${k==="heating"?"Heizkreis":k==="frequency"?"Verdichterfrequenz":k==="power"?"Elektrische Leistung":"Warmwasser"}</h3></div><span class="legend"></span></div><div class="plot" id="plot-${k}"><div class="loader">Historie wird geladen …</div></div></section>`).join("")}</div>`;}
 dataState(role){if(this.discovery?.ambiguous?.includes(role))return 'Mehrdeutig · manuelle Zuordnung nötig';if(this.meta?.[role]?.disabled_by)return 'Deaktiviert';return this.available(role)?'Verfügbar':this.meta?.[role]||this.st(role)?'Nicht verfügbar':'Nicht zugeordnet';}
 setup(){
  const roles=Object.entries(PROFILE).filter(([,p])=>p.req),ready=roles.filter(([r])=>this.available(r)).length;
  const rows=roles.sort(([a],[b])=>Number(this.available(a))-Number(this.available(b))).map(([r,p])=>`<li><span><b>${esc(p.l)}</b><em data-check="${r}">${this.dataState(r)}</em><details class="technical-details"><summary>Entity anzeigen</summary><small data-entity="${r}">${esc(this.mapping[r])}</small><small data-candidates="${r}"></small></details></span></li>`).join('');
  return `<section class="panel setup"><div class="title"><div><small>EINRICHTUNG</small><h2>Zuordnung und Datencheck</h2></div><span class="score">${ready}/${roles.length}</span></div><label class="mode-control" for="installation">NIBE-Installation<select id="installation"><option value="">${this.discovery?.entries?.length>1?'Bitte auswählen':'Automatisch'}</option>${(this.discovery?.entries||[]).map(id=>`<option value="${esc(id)}" ${id===this.discovery.selected?'selected':''}>${esc(this.devices?.find(d=>d.config_entries?.includes(id))?.name||'NIBE')} · ${esc(id.slice(-6))}</option>`).join('')}</select></label><p class="hint">Auswahl gilt für diese Sitzung. Dauerhaft: config_entry_id in der Dashboard-Strategie speichern. Bestehende manuelle Zuordnungen haben Vorrang.</p><p data-discovery-error>${this.discoveryError?'Registry nicht erreichbar. Manuelle Zuordnungen bleiben erhalten.':''}</p><p data-setup-score>${ready} von ${roles.length} empfohlenen Datenpunkten verfügbar. Fehlende Werte stehen zuerst.</p><ul>${rows}</ul><aside><b>Deaktivierte Werte aktivieren:</b> Einstellungen → Geräte & Dienste → NIBE Heat Pump → Gerät → Entitäten. „Deaktivierte Entitäten anzeigen“, gewünschte Entity öffnen und aktivieren. Nicht verfügbare Werte benötigen eine Prüfung der Integration.</aside></section>`;
 }
 diagnostics(){
  const rows=Object.entries(PROFILE).filter(([r,p])=>p.diag&&!r.startsWith('ventilation')).map(([r,p])=>`<div class="diagnostic-row"><span>${esc(p.l)}${p.t?' · '+esc(p.t):''}</span><b data-diagnostic="${r}"></b><small data-quality="${r}"></small></div>`).join('');
  return `<section class="panel"><div class="title"><div><small>NUR ANZEIGE</small><h2>Technische Diagnose</h2></div></div><div class="diagnostic-list">${rows}</div><details class="technical-details"><summary>Ungeklärte Zuordnungen</summary><p class="hint">GP1: Register 31103/31637 benötigt einen Livevergleich. Der lokale Raum-Sollwert ist kein bestätigter MyUplink-Sollwert. Unbekannte Statuscodes bleiben Rohwerte.</p></details></section>`;
 }
 ventilation(){
  return `<style>.filter-settings{margin-top:14px;border-top:1px solid var(--nc-line);padding-top:12px}.filter-settings summary{cursor:pointer;min-height:44px;padding:10px 0;font-weight:600}.filter-settings summary:hover{color:var(--nc-teal)}.filter-settings form{display:grid;gap:8px;max-width:440px}.filter-settings label{font-size:.8rem;margin-top:8px}.filter-settings input{min-height:44px;width:100%;padding:9px;border:1px solid var(--nc-line);border-radius:10px;background:var(--card-background-color);color:var(--primary-text-color)}.filter-settings p{font-size:.75rem;line-height:1.5}.filter-settings input[aria-invalid=true]{border-color:var(--error-color)}#filter-settings-error{color:var(--error-color)}</style><section class="panel ventilation-panel" aria-label="Lüftung ERS S40-400"><div class="vent-heading"><div><small>LÜFTUNG</small><h3>ERS S40-400</h3></div><span data-vent-operation></span></div>
   <div class="vent-flow" aria-label="Luftwege, schematisch"><div class="vent-lane" data-vent-lane="ventilationSupply"><span>Außenluft → Zuluft ins Haus</span><i aria-hidden="true"></i><b>Zuluftventilator ${this.live('ventilationSupply',0)}</b></div><div class="vent-exchanger"><ha-icon icon="mdi:air-filter" aria-hidden="true"></ha-icon><b>Wärmetauscher</b><small>Rotorstatus unbekannt</small></div><div class="vent-lane" data-vent-lane="ventilationExtract"><span>Abluft aus dem Haus → Fortluft</span><i aria-hidden="true"></i><b>Abluftventilator ${this.live('ventilationExtract',0)}</b></div></div>
   <details class="technical-details"><summary>Lüftungsdaten</summary><p class="hint">Die Prozentwerte beschreiben die Ventilatoren, nicht gemessene Luftmengen. Bewegung zeigt Ventilatoraktivität. Rotorbetrieb und Lufttemperaturen sind nicht verfügbar.</p><p>Lüftermodus (Rohwert): <span data-diagnostic="ventilationMode"></span></p></details>
   <div class="vent-maintenance"><div><h3>Filterwartung</h3><p data-filter-last></p><p data-filter-due></p><b data-filter-status></b></div><button type="button" id="filter-change">Filterwechsel erfassen</button></div>
   <p class="hint" data-filter-help></p><details class="filter-settings"><summary>Filterwartung einrichten / ändern</summary><form novalidate id="filter-settings-form"><label for="filter-months">Wechselintervall in Monaten</label><input id="filter-months" type="number" min="1" max="24" step="1" inputmode="numeric" aria-describedby="filter-settings-help"><label for="filter-last-date">Letzter tatsächlicher Filterwechsel</label><input id="filter-last-date" type="date" max="${this.filterToday()}" aria-describedby="filter-settings-help"><p id="filter-settings-help">Intervall aus deiner NIBE-Einstellung übernehmen. Ist das Wechseldatum unbekannt, erst nach dem nächsten tatsächlichen Wechsel einrichten. Beim ersten Speichern werden zwei HA-Helfer angelegt; dafür sind Administratorrechte nötig.</p><p role="alert" id="filter-settings-error"></p><button type="submit">Einstellungen übernehmen</button></form></details><p class="hint" role="status" aria-live="polite" data-maintenance-feedback></p>
   <p class="hint">Lüftersteuerung noch nicht verfügbar: Der vorhandene Entity-Satz enthält keinen vollständigen belegten Steuerweg.</p>
   <dialog id="maintenance-confirm" aria-labelledby="maintenance-title" aria-describedby="maintenance-description"><h3 id="maintenance-title">Filterwechsel bestätigen?</h3><p id="maintenance-description"></p><p role="alert" data-maintenance-error></p><div class="vent-actions"><button type="button" id="maintenance-cancel" autofocus>Abbrechen</button><button type="button" id="maintenance-save">Ja, Filterwechsel speichern</button></div></dialog>
  </section><style>
   .ventilation-panel{margin-top:12px}.vent-heading,.vent-maintenance{display:flex;justify-content:space-between;align-items:center;gap:16px}.vent-heading small{color:var(--secondary-text-color);font-size:.68rem;letter-spacing:.15em}.vent-heading h3{margin-top:5px}.vent-heading>span{font-size:.78rem;color:var(--secondary-text-color)}
   .vent-flow{display:grid;grid-template-columns:1fr minmax(140px,1fr) 1fr;gap:14px;align-items:center;margin:20px 0}.vent-lane{min-width:0;font-size:.8rem}.vent-lane span,.vent-lane b{display:block}.vent-lane b{font-size:1.2rem;font-variant-numeric:tabular-nums}.vent-lane i{display:block;position:relative;height:3px;background:var(--nc-blue);margin:12px 0;overflow:hidden}.vent-lane:last-child i{background:var(--nc-warm)}.vent-lane.is-active i:after{content:'';position:absolute;width:20px;height:3px;background:var(--primary-text-color);animation:flow 4s linear infinite}.vent-exchanger{display:flex;align-items:center;flex-direction:column;text-align:center;border:1px solid var(--nc-line);border-radius:14px;padding:14px;gap:6px}.vent-exchanger ha-icon{color:var(--nc-teal);--mdc-icon-size:36px}.vent-exchanger b{font-size:.78rem}.vent-exchanger small{color:var(--secondary-text-color);font-size:.7rem}
   .vent-maintenance{border-top:1px solid var(--nc-line);padding-top:16px}.vent-maintenance p{margin:5px 0;font-size:.8rem;color:var(--secondary-text-color)}.vent-maintenance b{font-size:.85rem}
   .ventilation-panel button{min-height:44px;border:1px solid var(--nc-line);border-radius:10px;padding:10px 14px;background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer}.ventilation-panel button:hover:enabled{background:var(--nc-card)}.ventilation-panel button:active:enabled{transform:translateY(1px)}.ventilation-panel button:disabled{opacity:.5;cursor:default}.ventilation-panel dialog{max-width:440px;width:calc(100% - 32px);max-height:calc(100dvh - 32px);overflow:auto;border:1px solid var(--nc-line);border-radius:18px;padding:22px;background:var(--card-background-color);color:var(--primary-text-color)}.ventilation-panel dialog::backdrop{background:rgba(0,0,0,.5)}.ventilation-panel dialog p{margin-top:14px;line-height:1.5;font-size:.85rem}.vent-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}[data-maintenance-error]{color:var(--error-color)}
   @media(max-width:600px){.vent-flow{grid-template-columns:1fr;gap:10px}.vent-exchanger{flex-direction:row;flex-wrap:wrap;justify-content:center}.vent-maintenance{align-items:flex-start;flex-direction:column}.vent-heading{align-items:flex-start;flex-direction:column;gap:6px}}
  </style>`;
 }
 helperName(kind){const scope=this.meta?.ventilationSupply?.config_entry_id||this.meta?.compressorHz?.config_entry_id;return scope?`NIBE Control ${scope} ${kind==='date'?'Filterwechsel':'Filterintervall'}`:null;}
 findMaintenanceHelpers(){
  for(const kind of ['date','interval']){const domain=kind==='date'?'input_datetime':'input_number',name=this.helperName(kind);const rows=(this.registry||[]).filter(r=>r.entity_id.startsWith(domain+'.')&&name&&(r.original_name===name||this._hass.states[r.entity_id]?.attributes?.friendly_name===name));if(rows.length===1)this.helperIds[kind]=rows[0].entity_id;}
 }
 filterHelper(){const id=this.config?.ventilation?.filter_date_entity||this.helperIds?.date;return typeof id==='string'&&id.startsWith('input_datetime.')?id:null;}
 filterInterval(){const id=this.config?.ventilation?.filter_interval_entity||this.helperIds?.interval;return id?.startsWith('input_number.')?ncNumber(this._hass.states[id]?.state):ncNumber(this.config?.ventilation?.filter_interval_months);}
 async ensureMaintenanceHelper(kind){
  const explicit=kind==='date'?this.filterHelper():this.config?.ventilation?.filter_interval_entity||this.helperIds?.interval;
  const domain=kind==='date'?'input_datetime':'input_number';
  if(explicit){if(!explicit.startsWith(domain+'.'))throw Error('Falscher Helfertyp');return explicit;}
  const name=this.helperName(kind);if(!name)throw Error('NIBE-Zuordnung fehlt. Datencheck prüfen.');
  const items=await this._hass.callWS({type:domain+'/list'});const matches=items.filter(x=>x.name===name);if(matches.length>1)throw Error('Mehrere Wartungshelfer gefunden. Bitte explizit zuordnen.');let item=matches[0];
  if(!item)item=await this._hass.callWS(kind==='date'?{type:'input_datetime/create',name,has_date:true,has_time:false}:{type:'input_number/create',name,min:1,max:24,step:1,mode:'box',unit_of_measurement:'Monate'});
  this.registry=await this._hass.callWS({type:'config/entity_registry/list'});
  const entity=this.registry.find(r=>r.platform===domain&&r.unique_id===item.id);if(!entity)throw Error('Helfer angelegt; bitte erneut speichern, sobald Home Assistant ihn geladen hat.');
  this.helperIds=this.helperIds||{};this.helperIds[kind]=entity.entity_id;return entity.entity_id;
 }
 filterToday(){return ncToday(this._hass.config?.time_zone||'Europe/Berlin');}
 paintVentilation(){
  const q=s=>this.shadowRoot.querySelector(s), config=this.config?.ventilation||{}, helper=this.filterHelper(), entity=helper?this._hass.states[helper]:null;
  let active=false,known=false,knownCount=0;
  this.shadowRoot.querySelectorAll('[data-vent-lane]').forEach(el=>{const n=this._hass.connected===false?null:ncNumber(this.val(el.dataset.ventLane));known=known||n!=null;if(n!=null)knownCount++;active=active||n>0;el.classList.toggle('is-active',n!=null&&n>0);});
  this.shadowRoot.querySelectorAll('[data-vent-operation]').forEach(status=>status.textContent=!known?'Lüfterwerte nicht verfügbar':knownCount<2?'Lüfterdaten teilweise verfügbar':active?'Ventilatoren laufen':'Ventilatoren stehen');
  const writable=valid(entity)&&entity.attributes?.has_date===true&&this._hass.connected!==false;
  const date=entity?.state?.slice(0,10),interval=this.filterInterval(), maintenance=ncFilterDate(date,interval,this.filterToday());
  const format=d=>d?new Intl.DateTimeFormat('de-DE',{timeZone:'UTC'}).format(new Date(`${d}T12:00:00Z`)):'Nicht bekannt';
  if(q('[data-filter-last]'))q('[data-filter-last]').textContent=`Letzter Wechsel: ${date&&ncFilterDate(date,1,this.filterToday()).due?format(date):'Nicht bekannt'}`;
  if(q('[data-filter-due]'))q('[data-filter-due]').textContent=`Nächster Termin: ${format(maintenance.due)}`;
  if(q('[data-filter-status]'))q('[data-filter-status]').textContent=maintenance.label;
  if(q('[data-filter-summary]'))q('[data-filter-summary]').textContent=maintenance.due?`Filter: ${maintenance.label}`:'Filterwartung einrichten';
  if(q('#filter-change'))q('#filter-change').disabled=!writable;
  if(q('[data-filter-help]'))q('[data-filter-help]').textContent=!writable?'Filterwartung unten einrichten. Datum und Intervall werden dauerhaft in Home Assistant gespeichert.':`Intervall: ${ncNumber(interval)||'nicht eingerichtet'} Monate. Das Datum bleibt in Home Assistant gespeichert.`;
 }
 bindMaintenance(){
  const q=s=>this.shadowRoot.querySelector(s),dialog=q('#maintenance-confirm'),trigger=q('#filter-change');if(!dialog||!trigger)return;
  trigger.onclick=()=>{q('#maintenance-save').textContent='Ja, Filterwechsel speichern';this.pendingSettings=null;this.pendingFilterDate=this.filterToday();if(q('#maintenance-title'))q('#maintenance-title').textContent='Filterwechsel bestätigen?';q('#maintenance-description').textContent=`Das letzte Filterwechseldatum wird auf ${this.pendingFilterDate.split('-').reverse().join('.')} gesetzt. Nur bestätigen, wenn die Filter tatsächlich gewechselt wurden. Eine NIBE-Filtermeldung wird dadurch nicht quittiert.`;q('[data-maintenance-error]').textContent='';this.maintenanceFocus=trigger;dialog.showModal();q('#maintenance-cancel').focus();};
  q('#maintenance-cancel').onclick=()=>dialog.close();dialog.onclose=()=>{this.pendingFilterDate=null;this.pendingSettings=null;(this.maintenanceFocus||trigger).focus();};
  q('#maintenance-save').onclick=async()=>{
   const save=q('#maintenance-save');if(save.disabled||!this.pendingFilterDate||!dialog.open)return;
   const helper=this.filterHelper(),s=this._hass.states[helper];
   if(this._hass.connected===false||(!this.pendingSettings&&(!helper||!valid(s)||s.attributes?.has_date!==true))){q('[data-maintenance-error]').textContent='Datumshelfer ist nicht verfügbar. Es wurde nichts gespeichert.';return;}
   save.disabled=true;dialog.oncancel=e=>e.preventDefault();q('#maintenance-cancel').disabled=true;
   try{
    if(this.pendingSettings){const settings=this.pendingSettings;const dateId=await this.ensureMaintenanceHelper('date'),intervalId=await this.ensureMaintenanceHelper('interval');await this._hass.callService('input_datetime','set_datetime',{entity_id:dateId,date:settings.date});await this._hass.callService('input_number','set_value',{entity_id:intervalId,value:settings.months});}
    else await this._hass.callService('input_datetime','set_datetime',{entity_id:helper,date:this.pendingFilterDate});
    dialog.close();q('[data-maintenance-feedback]').textContent='Wartungsdaten an Home Assistant gesendet. Die Anzeige wartet auf die Rückmeldung.';
   }
   catch(e){q('[data-maintenance-error]').textContent='Speichern nicht vollständig abgeschlossen. Bereits angelegte Helfer bleiben erhalten. Eingaben prüfen und erneut versuchen; Administratorrechte und die HA-Helferintegrationen müssen verfügbar sein.';}
   finally{save.disabled=false;q('#maintenance-cancel').disabled=false;dialog.oncancel=null;}
  };
  const form=q('#filter-settings-form');if(form){
   const months=q('#filter-months'),date=q('#filter-last-date'),error=q('#filter-settings-error');
   const fill=()=>{months.value=this.filterInterval()??'';const last=this._hass.states[this.filterHelper()]?.state?.slice(0,10);date.value=ncFilterDate(last,1,this.filterToday()).due?last:'';date.max=this.filterToday();};
   fill();q('.filter-settings').ontoggle=e=>{if(e.target.open)fill();};
   form.onsubmit=e=>{e.preventDefault();const n=ncNumber(months.value),d=date.value;error.textContent='';months.setAttribute('aria-invalid','false');date.setAttribute('aria-invalid','false');
    if(n==null||!Number.isInteger(n)||n<1||n>24){error.textContent='Bitte 1 bis 24 ganze Monate eingeben.';months.setAttribute('aria-invalid','true');months.focus();return;}
    if(!ncFilterDate(d,n,this.filterToday()).due){error.textContent='Bitte das tatsächliche Wechseldatum eingeben, spätestens heute.';date.setAttribute('aria-invalid','true');date.focus();return;}
    q('#maintenance-save').textContent='Ja, Einstellungen speichern';this.pendingSettings={months:n,date:d};this.pendingFilterDate=d;this.maintenanceFocus=form.querySelector('button');q('#maintenance-title').textContent='Wartungseinstellungen bestätigen?';q('#maintenance-description').textContent=`Intervall: ${n} Monate. Letzter Wechsel: ${d.split('-').reverse().join('.')}. Datum und Intervall werden in HA-Helfern gespeichert. Fehlende Helfer werden angelegt. Keine NIBE-Einstellung wird geändert.`;q('[data-maintenance-error]').textContent='';dialog.showModal();q('#maintenance-cancel').focus();
   };
  }
 }
 selectPlant(plant){
  this.selectedPlant=plant;
  this.shadowRoot.querySelectorAll('[data-plant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.plant===plant)));
  this.shadowRoot.querySelector('nav').hidden=plant!=='heatpump';
  this.shadowRoot.querySelector('[data-choice-hint]').hidden=true;
  this.shadowRoot.getElementById('ventilation').hidden=plant!=='ventilation';
  this.shadowRoot.querySelectorAll('.tab').forEach(el=>el.hidden=plant!=='heatpump');
 }
 bind(){
  this.bindMaintenance();
  const installation=this.shadowRoot.getElementById('installation');if(installation)installation.onchange=()=>{const selectedPlant=this.selectedPlant,activeTab=this.shadowRoot.querySelector('nav button.active')?.dataset.tab||'overview';this.config={...this.config,config_entry_id:installation.value||null};this.historyGeneration=(this.historyGeneration||0)+1;this.historyPending=false;this.chartInspectors={};this.applyDiscovery();this.helperIds={};this.findMaintenanceHelpers();this.render();if(selectedPlant)this.selectPlant(selectedPlant);this.shadowRoot.querySelector(`[data-tab="${activeTab}"]`)?.click();this.loadHistory();};
  this.shadowRoot.querySelectorAll('[data-plant]').forEach(b=>b.onclick=()=>this.selectPlant(b.dataset.plant));
  this.shadowRoot.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{this.shadowRoot.querySelectorAll("nav button,.tab").forEach(x=>x.classList.remove("active")); b.classList.add("active"); this.shadowRoot.getElementById(b.dataset.tab).classList.add("active");if(b.dataset.tab==="charts")this.loadHistory();if(b.dataset.tab==="setup")this.refreshRegistry();});
  const period=this.shadowRoot.getElementById('history-period');if(period)period.value=String(this.historyHours||24);if(period)period.onchange=()=>{this.historyHours=Number(period.value);this.historyGeneration=(this.historyGeneration||0)+1;this.historyPending=false;this.inspectionTime=null;this.loadHistory();};
  const select=this.shadowRoot.getElementById("hw-mode"); if(select) select.onchange=e=>this.setUserControl("waterHeater",e.target.value,select);
  const evcc=this.shadowRoot.getElementById("evcc-mode"); if(evcc) evcc.onchange=e=>this.setUserControl("evccMode",e.target.value,evcc);
 }
 async setUserControl(role,value,element){
  const commands={waterHeater:{domain:'water_heater',service:'set_operation_mode',field:'operation_mode',options:'operation_list'},evccMode:{domain:'select',service:'select_option',field:'option',options:'options'}};
  const command=commands[role],state=this.st(role),feedback=this.shadowRoot.querySelector('[data-control-feedback]');
  if(this.controlPending?.[role])return;
  if(!command||!WRITE_ALLOWLIST[role]?.includes(command.domain+'.'+command.service)||!valid(state)||this._hass.connected===false||!this.mapping[role]?.startsWith(command.domain+'.')||!state.attributes?.[command.options]?.includes(value)){if(feedback)feedback.textContent='Bedienung nicht verfügbar. Es wurde kein Befehl gesendet.';if(element)element.value=state?.state||'';return;}
  this.controlPending=this.controlPending||{};this.controlPending[role]=true;element.disabled=true;if(feedback)feedback.textContent='Befehl wird gesendet …';
  try{await this._hass.callService(command.domain,command.service,{entity_id:this.mapping[role],[command.field]:value});if(feedback)feedback.textContent='Befehl gesendet. Den bestätigten Zustand liefert Home Assistant.';}
  catch(e){element.value=this.st(role)?.state||'';if(feedback)feedback.textContent='Befehl fehlgeschlagen. Angezeigten Zustand prüfen und erneut versuchen.';}
  finally{this.controlPending[role]=false;element.disabled=this._hass.connected===false||!valid(this.st(role));}
 }
 paintValues(){
  if(!this.shadowRoot?.querySelector("main"))return;
  this.paintVentilation();
  this.shadowRoot.querySelectorAll('[data-entity]').forEach(el=>el.textContent=this.mapping[el.dataset.entity]||'Keine eindeutige Zuordnung');
  this.shadowRoot.querySelectorAll('[data-candidates]').forEach(el=>{const role=el.dataset.candidates;el.textContent=this.discovery?.ambiguous?.includes(role)?(this.registry||[]).filter(row=>row.config_entry_id===this.discovery.selected&&reg(row.unique_id)===PROFILE[role].r).map(row=>row.entity_id).join(' · '):'';});
  this.shadowRoot.querySelectorAll('[data-check]').forEach(el=>el.textContent=this.dataState(el.dataset.check));
  const recommended=Object.entries(PROFILE).filter(([,p])=>p.req),ready=recommended.filter(([r])=>this.available(r)).length;
  const score=this.shadowRoot.querySelector('.score');if(score)score.textContent=ready+'/'+recommended.length;
  const setupScore=this.shadowRoot.querySelector('[data-setup-score]');if(setupScore)setupScore.textContent=ready+' von '+recommended.length+' empfohlenen Datenpunkten verfügbar.';

  for(const [id,role,optionKey] of [['hw-mode','waterHeater','operation_list'],['evcc-mode','evccMode','options']]){const el=this.shadowRoot.getElementById?.(id);if(el&&!this.controlPending?.[role]){const options=this.st(role)?.attributes?.[optionKey]||[];const signature=JSON.stringify(options);if(el.dataset&&el.dataset.options!==signature){el.replaceChildren(...options.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=role==='evccMode'?ncEvccMode(value):String(value);return option;}));el.dataset.options=signature;}el.disabled=this._hass.connected===false||!this.available(role)||!options.length;if(this.available(role))el.value=this.val(role);}}
  const waterHelp=this.shadowRoot.querySelector('[data-water-control-help]');if(waterHelp)waterHelp.textContent=this.st('waterHeater')?.attributes?.operation_list?.length?'Nur die von Home Assistant angebotenen Modi sind bedienbar.':'Kein schaltbarer Warmwassermodus verfügbar.';
  this.shadowRoot.querySelectorAll('[data-diagnostic]').forEach(el=>{const r=el.dataset.diagnostic;el.textContent=this.available(r)?r==='useRoomSensor'?(ncBinary(this.val(r))==null?'Nicht verfügbar':ncBinary(this.val(r))?'Ein':'Aus'):PROFILE[r].u?this.value(r):r==='alarm'?(ncNumber(this.val(r))===0?'Kein Alarm':'Alarm '+this.val(r)):ncNumber(this.val(r))!=null?'Statuscode '+this.val(r):String(this.val(r)):'—';});
  this.shadowRoot.querySelectorAll('[data-quality]').forEach(el=>el.textContent=el.tagName==='EM'&&this.available(el.dataset.quality)?'':this.dataState(el.dataset.quality));
  this.shadowRoot.querySelectorAll("[data-role]").forEach(el=>el.textContent=this.value(el.dataset.role,Number(el.dataset.digits??1)));
  this.shadowRoot.querySelectorAll("[data-status]").forEach(el=>el.textContent=this.available(el.dataset.status)?statusLabel(el.dataset.status,this.val(el.dataset.status)):"Nicht verfügbar");
  this.shadowRoot.querySelectorAll("[data-state]").forEach(el=>{const role=el.dataset.state,on=ncBinary(this.val(role));el.textContent=on==null?'Nicht verfügbar':role==="evccCharging"?(on?"Aktiv":"Keine"):(on?"Freigegeben":"Aus");el.closest(".energy-node")?.classList.toggle("is-active",on===true);});
  this.shadowRoot.querySelectorAll("[data-raw]").forEach(el=>el.textContent=el.dataset.raw==='evccMode'?ncEvccMode(this.val('evccMode')):el.dataset.raw==='evccAction'?ncPvAction(this.val('evccAction')):this.available(el.dataset.raw)?(['hotWaterMode','moreHotWater'].includes(el.dataset.raw)&&ncNumber(this.val(el.dataset.raw))!=null?'Statuscode '+this.val(el.dataset.raw):({off:'Aus',on:'Ein'})[this.val(el.dataset.raw)]||String(this.val(el.dataset.raw)??'—')):'Nicht verfügbar');
  const operation=this.operation(), main=this.shadowRoot.querySelector('main');
  main.className=`app ${operation.mode}`;
  this.shadowRoot.querySelectorAll('[data-operation]').forEach(el=>el.textContent=operation.label);
  this.shadowRoot.querySelector('.machine')?.classList.toggle('active',operation.active && ncNumber(this.val('compressorHz'))>0);
  this.shadowRoot.querySelectorAll('[data-destination]').forEach(el=>el.classList.toggle('is-active',operation.active && el.dataset.destination===operation.kind));
  this.shadowRoot.querySelectorAll('[data-branch]').forEach(el=>el.textContent=operation.active && el.dataset.branch===operation.kind?'Aktiv':operation.kind==='unknown' || ['alarm','defrost','offline','unknown'].includes(operation.mode)?'Nicht bestätigt':'Keine Wärmeerzeugung');
  const note=this.shadowRoot.querySelector('[data-operation-detail]');
  if(note)note.textContent=operation.kind==='unknown'?'Für die sichere Unterscheidung von Heizung und Warmwasser wird die Betriebspriorität 31029 benötigt.':'Betriebsart aus NIBE-Priorität 31029 · Aktivität aus Verdichter / Zusatzheizung.';
  const sg=ncSg(this.stateValues());
  this.shadowRoot.querySelectorAll('[data-sg]').forEach(el=>el.textContent=sg.label);
  this.shadowRoot.querySelectorAll('[data-sg-detail]').forEach(el=>el.textContent=sg.detail);
  this.shadowRoot.querySelector('.energy-node.sg')?.classList.toggle('is-active',sg.tone==='boost');
  this.shadowRoot.querySelectorAll('[data-contact]').forEach(el=>{const value=ncBinary(this.val(el.dataset.contact));el.textContent=value==null?'Nicht verfügbar':value?'Geschlossen':'Offen';});
  const request=ncBinary(this.val('evccCharging')), enabled=ncBinary(this.val('evccEnabled'));
  const explanation=this.shadowRoot.querySelector('[data-energy-explanation]');
  if(explanation)explanation.textContent=enabled==null?'EVCC ist nicht verfügbar. NIBE und SG Ready werden unabhängig davon angezeigt.':request===true?`EVCC fordert Wärme an. NIBE: ${operation.label}.`:request==null?'EVCC-Anforderung ist nicht verfügbar.':'Keine EVCC-Anforderung. NIBE regelt Heizung und Warmwasser selbstständig.';
 }
 async loadHistory(){
  if(this.historyPending||this._hass.connected===false||!this.mapping)return;
  const sets={heating:[["outdoor","#78aee8"],["supplyTarget","#e9b15b"],["supply","#ee765f"],["return","#8fc58a"]],frequency:[["compressorHz","#49b6a1"]],power:[["electrical","#e9b15b"]],water:[["hotWaterCharge","#55a8d8"],["hotWaterTop","#ee765f"]]};
  const roles=[...new Set(Object.values(sets).flat().map(x=>x[0]).filter(r=>this.mapping[r]&&this.st(r)))]; if(!roles.length){this.shadowRoot.querySelectorAll('.plot').forEach(p=>p.innerHTML='<div class="empty">Keine Historien-Entitäten verfügbar</div>');return;}
  const end=new Date(), start=new Date(end-(this.historyHours||24)*3600000);const historyWindow={start:+start,end:+end};const generation=(this.historyGeneration||0)+1;this.historyGeneration=generation;this.historyPending=true;
  try {const result=await this._hass.callWS({type:"history/history_during_period",start_time:start.toISOString(),end_time:end.toISOString(),entity_ids:[...new Set(roles.map(r=>this.mapping[r]))],include_start_time_state:true,minimal_response:true,no_attributes:true,significant_changes_only:false});
   if(generation!==this.historyGeneration)return;
   this.shadowRoot.querySelectorAll('[data-period-label]').forEach(el=>el.textContent=(this.historyHours||24)+' STUNDEN');this.historyWindow=historyWindow;if(this.inspectionTime!=null)this.inspectionTime=Math.max(historyWindow.start,Math.min(historyWindow.end,this.inspectionTime));const history=this.normalizeHistory(result);
   this.chartInspectors={};for(const [key,series] of Object.entries(sets)) this.draw(key,series,history);
   const feedback=this.shadowRoot.querySelector('[data-history-feedback]');if(feedback)feedback.textContent='Stand: '+new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:this._hass.config?.time_zone||'Europe/Berlin'}).format(end)+' · automatisch jede Minute · alle Diagramme teilen den ausgewählten Zeitpunkt.';
  } catch(e){if(generation===this.historyGeneration){const feedback=this.shadowRoot.querySelector('[data-history-feedback]');if(feedback)feedback.textContent='Historie konnte nicht aktualisiert werden. Vorhandene Verläufe zeigen den letzten erfolgreichen Stand. Erneuter Versuch beim Öffnen oder nach einer Minute.';if(!this.historyWindow)this.shadowRoot.querySelectorAll('.plot').forEach(p=>p.innerHTML='<div class="empty">Keine Historie verfügbar</div>');}}finally{if(generation===this.historyGeneration)this.historyPending=false;}
 }
 normalizeHistory(result){if(!Array.isArray(result))return result||{};const mapped={};for(const series of result){if(!Array.isArray(series)||!series.length)continue;const id=series[0]?.entity_id||series[0]?.e;if(id)mapped[id]=series;}return mapped;}
 draw(key,series,data){
  const host=this.shadowRoot.getElementById(`plot-${key}`),window=this.historyWindow;
  const found=series.map(([r,c])=>({r,c,points:ncHistoryPoints(data[this.mapping[r]]||[],window.start,window.end),raw:ncHistoryPoints(data[this.mapping[r]]||[],window.start,window.end,{sample:false})}));
  const nums=found.flatMap(x=>x.points.filter(p=>p.value!=null).map(p=>p.value));
  if(!nums.length){host.innerHTML='<div class="empty">Keine Messwerte im Zeitraum verfügbar</div>';return;}
  const scale=ncHistoryScale(nums);if(['frequency','power'].includes(key)&&scale.min<0&&nums.every(n=>n>=0)){scale.min=0;scale.span=scale.max-scale.min;}const {min,max,span}=scale,unit=this.unit(found.find(x=>x.points.some(p=>p.value!=null)).r);
  const statsOpen=host.querySelector('.history-stats')?.open||false;
  host.innerHTML=`<div class="chart-unit">${esc(unit)} · ${this.historyHours||24} Stunden</div><div class="chart-frame"><div class="chart-y" aria-label="Werteachse"><span class="y-max">${fmt(max)}</span><span class="y-mid">${fmt((max+min)/2)}</span><span class="y-min">${fmt(min)}</span></div><svg viewBox="0 0 100 48" preserveAspectRatio="none" aria-label="24-Stunden-Verlauf"><g class="gridlines"><path d="M0 6H100M0 25H100M0 44H100"/></g><line data-cursor x1="100" x2="100" y1="6" y2="44" stroke="var(--primary-text-color)" stroke-width=".3" stroke-dasharray="1 1"/>${found.map(x=>`<path data-series="${x.r}" d="${ncHistoryPath(x.points,window.start,window.end,min,span)}" stroke="${x.c}"/>`).join('')}</svg></div><div class="chart-time">${[0,.25,.5,.75,1].map(f=>`<small>${esc(new Intl.DateTimeFormat('de-DE',{timeZone:this._hass.config?.time_zone||'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(window.start+f*(window.end-window.start))))}</small>`).join('')}</div><details class="history-stats" ${statsOpen?'open':''}><summary>Auswertung des Zeitraums</summary><table><thead><tr><th>Messwert</th><th>Minimum</th><th>Maximum</th><th>Mittel</th></tr></thead><tbody>${found.map(x=>{const stat=ncHistoryStats(x.raw,window.start,window.end);return `<tr><th scope="row">${esc(PROFILE[x.r].l)}</th><td>${stat.min==null?'—':fmt(stat.min)}</td><td>${stat.max==null?'—':fmt(stat.max)}</td><td>${stat.mean==null?'—':fmt(stat.mean)}</td></tr><tr><td colspan="4">${esc(this.unit(x.r))} · Datenabdeckung ${fmt(stat.coverage*100,0)} %${key==='frequency'?' · Laufzeit '+fmt(stat.runningHours)+' h · '+stat.starts+' beobachtete Starts':''}</td></tr>`;}).join('')}</tbody></table><p class="hint">Mittelwerte sind zeitgewichtet; unbekannte Abschnitte werden ausgeschlossen. Starts zählen nur belegte Wechsel von 0 auf eine positive Frequenz.</p></details><div class="chart-legend"></div><label class="chart-probe">Zeitpunkt prüfen<input type="range" min="0" max="1440" value="1440" aria-label="Zeitpunkt im 24-Stunden-Verlauf"></label><div class="chart-values" role="status" aria-live="polite"></div><div class="axis"><small>vor ${this.historyHours||24} h</small><small>jetzt</small></div>`;
  const output=host.querySelector('.chart-values'),slider=host.querySelector('input'),cursor=host.querySelector('[data-cursor]');
  this.chartInspectors=this.chartInspectors||{};
  const inspect=time=>{const fraction=Math.max(0,Math.min(1,(time-window.start)/(window.end-window.start)));slider.value=String(Math.round(fraction*1440));const x=(fraction*100).toFixed(2);cursor?.setAttribute('x1',x);cursor?.setAttribute('x2',x);
   const stamp=new Intl.DateTimeFormat('de-DE',{timeZone:this._hass.config?.time_zone||'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(time));
   output.innerHTML=`<b>Messwerte am ${esc(stamp)}</b><table class="sample-table"><tbody>${found.map(x=>{const v=ncHistoryValue(x.raw,time);return `<tr><th scope="row"><i style="background:${x.c}" aria-hidden="true"></i>${esc(PROFILE[x.r].l)}</th><td>${v!=null?fmt(v)+' '+esc(this.unit(x.r)):'Keine Daten'}</td></tr>`;}).join('')}</tbody></table>${key==='heating'?(()=>{const supply=found.find(x=>x.r==='supply'),target=found.find(x=>x.r==='supplyTarget'),a=supply&&ncHistoryValue(supply.raw,time),b=target&&ncHistoryValue(target.raw,time);return a!=null&&b!=null?`<p class="hint">Vorlauf Ist − Soll: ${fmt(a-b)} ${esc(unit)}</p>`:'';})():key==='frequency'?`<p class="hint">${ncHistoryValue(found[0].raw,time)==null?'Betrieb nicht verfügbar':ncHistoryValue(found[0].raw,time)>0?'Verdichter läuft':'Verdichter steht'}</p>`:''}`;
  };
  this.chartInspectors[key]=inspect;inspect(this.inspectionTime??window.end);
  const selectTime=()=>this.inspectTime(window.start+Number(slider.value)/1440*(window.end-window.start));slider.oninput=selectTime;
  host.querySelector('svg').onclick=e=>{const rect=e.currentTarget.getBoundingClientRect();slider.value=String(Math.round(Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*1440));selectTime();};
  const latest=document.createElement('button');latest.type='button';latest.className='history-latest';latest.textContent='Jetzt anzeigen';latest.onclick=()=>{this.inspectionTime=null;this.inspectTime(window.end,true);};host.querySelector('.chart-probe').append(latest);
  const legend=host.querySelector('.chart-legend');for(const x of found){const button=document.createElement('button');button.type='button';button.dataset.toggle=x.r;const hidden=this.hiddenSeries?.[key]?.has(x.r)||false;button.setAttribute('aria-pressed',String(!hidden));if(hidden)host.querySelector(`[data-series="${x.r}"]`).style.display='none';button.style.setProperty('--c',x.c);button.textContent=PROFILE[x.r].l+(x.points.some(p=>p.value!=null)?'':' · Keine Historie');button.disabled=!x.points.some(p=>p.value!=null);button.onclick=()=>{const visible=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(visible));this.hiddenSeries=this.hiddenSeries||{};this.hiddenSeries[key]=this.hiddenSeries[key]||new Set();if(visible)this.hiddenSeries[key].delete(x.r);else this.hiddenSeries[key].add(x.r);host.querySelector(`[data-series="${x.r}"]`).style.display=visible?'':'none';};legend.append(button);}
 }
 inspectTime(time,live=false){this.inspectionTime=live?null:time;for(const inspect of Object.values(this.chartInspectors||{}))inspect(time);}
 compactStyles(){return `
 .sample-table,.history-stats table{width:100%;border-collapse:collapse;font-size:.8rem}.sample-table th,.history-stats th{font-weight:500;text-align:left}.sample-table td{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.sample-table th,.sample-table td,.history-stats td,.history-stats th{padding:8px 4px;border-bottom:1px solid var(--nc-line)}.sample-table i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}.history-stats{font-size:.75rem;overflow:auto}.history-stats td{text-align:right}.history-stats td[colspan]{text-align:left;color:var(--secondary-text-color);font-size:.7rem}.history-latest{min-height:44px;border:1px solid var(--nc-line);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer;padding:8px 12px}.history-latest:hover{background:var(--nc-card)}.chart-values{padding:10px;border:1px solid var(--nc-line);border-radius:10px;background:var(--nc-surface)}.chart-probe{display:block!important}.plot .chart-y span:before{display:none}.plot .chart-y span{margin:0}.plot svg{cursor:crosshair}
 .panel,.plant{padding:14px;border-radius:16px}.overview-grid{grid-template-columns:1fr 1fr;margin-top:10px;gap:10px}.climate-panel,.water-panel,.energy-board{min-height:0}.energy-board{grid-column:1/-1}.climate-values{display:flex;gap:24px;justify-content:space-between}.climate-values>span{font-size:.75rem;color:var(--secondary-text-color)}.climate-values b{display:block;font-size:1.3rem;color:var(--primary-text-color);font-variant-numeric:tabular-nums;margin-top:3px}.technical-details{margin-top:10px;font-size:.75rem;color:var(--secondary-text-color)}summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px}summary:hover{color:var(--primary-text-color)}summary:focus-visible{outline:3px solid var(--nc-focus);outline-offset:2px}.technical-details summary{min-height:36px}.technical-details summary:before,.water-panel>summary:before{content:'＋';font-size:1rem}details[open]>summary:before{content:'−'}.water-panel>summary{font-weight:650;font-size:.85rem}.water-panel .title{margin-top:8px}.energy-head h2{font-size:1.4rem}.energy-flow{margin-top:10px}.energy-node{padding:8px}.energy-node ha-icon{display:none}.energy-node span{white-space:normal}.energy-explanation{margin-top:8px}.plant-core{margin-bottom:0}.outside-value{display:none}.distribution{height:22px;display:grid;grid-template-columns:1fr 1fr;max-width:760px;margin:auto;border-top:2px solid var(--nc-line)}.distribution i{width:2px;background:var(--nc-line);justify-self:center}.distribution i.is-active{background:var(--nc-teal)}.destinations{margin-top:0}.plant-heading{margin-bottom:12px}.plant-note{text-align:left;min-height:0;margin-top:0}.metric-row{gap:6px}.metric{padding:9px}.chart-grid{grid-template-columns:1fr 1fr}.chart:first-child{grid-row:auto}.chart-head h3{font-size:1rem}.plot{position:relative;padding-top:8px;min-height:200px}.chart-unit{font-size:.72rem;color:var(--secondary-text-color);margin-bottom:4px}.chart-frame{display:grid;grid-template-columns:48px minmax(0,1fr);gap:6px}.chart-y{position:relative;height:145px;font-size:.7rem;color:var(--secondary-text-color);font-variant-numeric:tabular-nums}.chart-y span{position:absolute;right:0;transform:translateY(-50%)}.y-max{top:12.5%}.y-mid{top:52.0833%}.y-min{top:91.6667%}.chart-time{display:flex;justify-content:space-between;margin:4px 0 8px 54px;font-size:.65rem;color:var(--secondary-text-color)}.plot .chart-frame svg{display:block;height:145px}.chart-legend{margin-left:54px}.chart-legend{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.chart-legend button{min-height:44px;border:1px solid var(--nc-line);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);padding:6px 8px;cursor:pointer;font-size:.72rem}.chart-legend button:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--c);margin-right:6px}.chart-legend button[aria-pressed=false]{opacity:.55}.chart-legend button:disabled{cursor:default;opacity:.55}.chart-legend button:hover:enabled{background:var(--nc-card)}.chart-probe{display:block;font-size:.72rem;margin:8px 0}.chart-probe input{display:block;width:100%;min-height:32px;accent-color:var(--nc-teal)}.chart-values{display:block;font-size:.72rem;min-height:32px;line-height:1.5}.axis{font-size:.7rem;color:var(--secondary-text-color);margin-top:8px}.diagnostic-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:12px 0;border-bottom:1px solid var(--nc-line);font-size:.82rem}.diagnostic-row small{grid-column:1/-1;color:var(--secondary-text-color)}.diagnostic-row b{font-variant-numeric:tabular-nums}.setup li{display:block;padding:10px 0}.setup li em{display:block!important;font-style:normal;margin-top:4px;font-size:.75rem}.setup li .technical-details{margin-top:0}.vent-flow{grid-template-columns:1fr!important;gap:8px;margin:14px 0}.vent-exchanger{padding:10px;flex-direction:row;flex-wrap:wrap;justify-content:center}.vent-exchanger small{width:100%}.vent-exchanger ha-icon{--mdc-icon-size:24px}.vent-lane{display:grid;grid-template-columns:1fr auto;gap:8px;font-size:.75rem}.vent-lane i{grid-column:1/-1;grid-row:2;margin:0}.vent-lane b{font-size:.82rem}.vent-maintenance{margin-top:10px;padding-top:12px}.vent-maintenance b{display:block;margin:8px 0;font-size:1rem}.plant-choices button{padding:12px}.plant-choices strong{margin-top:2px}.app{padding-bottom:24px}nav{position:static!important}.energy-board:after{display:none}@media(max-width:600px){.overview-grid,.chart-grid{grid-template-columns:1fr}.climate-values{justify-content:flex-start;gap:36px}.vent-lane{grid-template-columns:1fr}.vent-lane b{grid-row:2}.vent-lane i{grid-row:3}.vent-heading{flex-direction:row;flex-wrap:wrap}.title h2{font-size:1.35rem}.plant-choices button{gap:4px}.plant-choices small{display:none}.plant-choices span{font-size:.7rem}.plant-heading small{display:none}.plant-heading b{text-align:left;max-width:none}.vent-maintenance{gap:8px}}
 `;}
 plantStyles(){return `
 .plant{display:block;padding:18px 20px;min-height:0;background:var(--card-background-color)}
 .plant-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
 .plant-heading small{font-size:.66rem;letter-spacing:.12em;font-weight:750;color:var(--secondary-text-color)}
 .plant-heading b{font-size:.83rem;font-weight:650;text-align:right}
 .plant-core{display:grid;grid-template-columns:104px minmax(48px,1fr) 72px;align-items:start;max-width:480px;margin:0 auto 22px;padding:0}
 .plant .machine{display:flex;width:104px;grid-column:auto;grid-row:auto;background:none;border:0;border-radius:0;gap:4px;text-align:center}
 .plant .machine strong{font-size:1.05rem;font-variant-numeric:tabular-nums}
 .plant .machine small,.plant .hub small{font-size:.66rem;white-space:nowrap}
 .outdoor-unit{height:88px;width:104px;border:1.5px solid var(--nc-line);border-radius:13px;background:var(--nc-surface);position:relative;display:flex;align-items:center;padding:10px;gap:4px}
 .outdoor-unit .fan{width:58px;height:58px;flex-shrink:0;margin:0;border-width:1.5px}
 .outdoor-unit>i{display:block;width:2px;height:42px;background:var(--nc-line);border-radius:2px}
 .outside-value{font-size:.68rem;color:var(--secondary-text-color);margin-top:3px}
 .plant .hub{display:flex;flex-direction:column;align-items:center;gap:4px;grid-column:auto;grid-row:auto;width:72px;justify-self:auto;align-self:auto;text-align:center}
 .plant .hub strong{font-size:.82rem;white-space:nowrap}
 .indoor-unit{height:88px;width:72px;border:1.5px solid var(--nc-teal);border-radius:12px;background:var(--nc-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
 .indoor-unit span{color:var(--nc-teal);font-size:.77rem;font-weight:800;letter-spacing:.09em}
 .indoor-unit i{display:block;width:32px;height:2px;background:var(--nc-line)}
 .plant-link{position:relative;height:88px;z-index:0}
 .plant .pipe{left:0;right:0;top:36px;height:3px;opacity:.65;border-radius:0}
 .plant .pipe.cold{top:52px}
 .destinations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-width:760px;margin:auto}
 .destination{display:flex;align-items:center;gap:12px;min-width:0;padding:12px 14px;border:1px solid var(--nc-line);border-radius:14px;background:var(--nc-surface);position:relative}
 .destination ha-icon{--mdc-icon-size:28px;color:var(--secondary-text-color);flex-shrink:0}
 .destination>div{min-width:0;flex:1}.destination b,.destination strong,.destination small{display:block}
 .destination b{font-size:.76rem}.destination strong{font-size:1.22rem;font-variant-numeric:tabular-nums;margin:3px 0}.destination small{font-size:.64rem;color:var(--secondary-text-color)}
 .branch-state{font-size:.65rem;font-weight:700;color:var(--secondary-text-color);max-width:80px}
 .destination.is-active{border-color:var(--nc-teal);background:color-mix(in srgb,var(--nc-teal) 8%,var(--card-background-color))}
 .destination.heat.is-active ha-icon,.destination.heat.is-active .branch-state{color:var(--nc-warm)}
 .destination.water.is-active ha-icon,.destination.water.is-active .branch-state{color:var(--nc-blue)}
 .plant-note{font-size:.64rem;color:var(--secondary-text-color);text-align:center;line-height:1.5;margin-top:12px;min-height:20px}
 .energy-node b,.energy-facts b{white-space:normal;overflow:visible;overflow-wrap:anywhere}
 .sg-contacts{display:flex;gap:16px;margin-top:14px;padding-top:10px;border-top:1px solid var(--nc-line);font-size:.65rem;color:var(--secondary-text-color)}
 .sg-contacts b{font-weight:600;color:var(--primary-text-color);margin-left:4px}
 .energy-explanation{font-size:.76rem;line-height:1.5;margin-top:12px;padding-left:10px;border-left:2px solid var(--nc-solar)}
 .status i{box-shadow:none}.idle .status i{background:var(--secondary-text-color)}.offline .status i,.unknown .status i{background:var(--warning-color,#d89521)}.defrost .status i{background:var(--nc-blue)}
 nav button:hover{background:var(--nc-surface-strong)}nav button:active{opacity:.75}
 *{scrollbar-color:var(--scrollbar-thumb-color,#7b858b) transparent;scrollbar-width:thin}
 @media(max-width:820px){.plant{padding:16px}.plant-heading{margin-bottom:16px}.plant-core{max-width:400px}.destination{padding:11px}}
 @media(max-width:430px){.plant{padding:13px 11px}.plant-heading{align-items:flex-start}.plant-heading small{max-width:110px;font-size:.58rem}.plant-heading b{font-size:.72rem;max-width:180px}.plant-core{margin-bottom:16px}.destinations{gap:6px}.destination{gap:6px;padding:10px 8px;flex-wrap:wrap}.destination ha-icon{--mdc-icon-size:22px}.destination strong{font-size:1.05rem}.branch-state{flex-basis:100%;max-width:none;padding-left:28px}.status span{display:block;font-size:.64rem;max-width:100px}.status{padding:7px;gap:6px}.plant-note{text-align:left;font-size:.6rem}}
 @media(prefers-reduced-motion:reduce){.plant *{animation:none!important}}
 @media(forced-colors:active){.destination.is-active{outline:2px solid Highlight}*{scrollbar-color:auto}}
 `;}
 responsiveStyles(){return `
 :host{--nc-solar:#c89538;--nc-success:#4fa57b;--nc-surface:color-mix(in srgb,var(--card-background-color) 96%,var(--primary-color) 4%);--nc-surface-strong:color-mix(in srgb,var(--card-background-color) 90%,var(--primary-color) 10%);--nc-focus:var(--primary-color,#03a9f4)}
 .app{padding-block-start:clamp(12px,2vw,22px)}
 .overview-grid{display:grid;grid-template-columns:minmax(220px,.82fr) minmax(240px,.95fr) minmax(420px,1.65fr);gap:12px;align-items:stretch}
 .panel{box-shadow:0 1px 0 color-mix(in srgb,var(--primary-text-color) 4%,transparent)}
 .climate-panel,.water-panel,.energy-board{min-height:222px}
 .title h2,.energy-head h2{font-variant-numeric:tabular-nums}
 .quiet-row{display:flex;align-items:center;justify-content:space-between;margin-top:18px;padding-top:13px;border-top:1px solid var(--nc-line);font-size:.76rem;color:var(--secondary-text-color)}
 .quiet-row b{font-size:.92rem;color:var(--primary-text-color);font-variant-numeric:tabular-nums}
 .mode-control{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;font-size:.72rem;color:var(--secondary-text-color)}
 .mode-control select{min-width:132px;min-height:40px;padding:7px 30px 7px 10px;border-radius:10px;border:1px solid var(--nc-line);background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer}
 .energy-board{position:relative;overflow:hidden;background:linear-gradient(135deg,var(--card-background-color),color-mix(in srgb,var(--card-background-color) 94%,var(--nc-solar) 6%))}
 .energy-board:after{content:"";position:absolute;right:-56px;top:-72px;width:190px;height:190px;border-radius:50%;background:color-mix(in srgb,var(--nc-solar) 7%,transparent);pointer-events:none}
 .energy-head{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}
 .energy-head small{font-size:.68rem;letter-spacing:.15em;font-weight:750;color:var(--secondary-text-color)}
 .energy-head h2{font-size:1.85rem;letter-spacing:-.04em;margin-top:4px}
 .energy-head p{font-size:.68rem;color:var(--secondary-text-color);margin-top:2px}
 .energy-head ha-icon{color:var(--nc-solar);--mdc-icon-size:28px}
 .energy-flow{display:grid;grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr);align-items:center;margin-top:16px}
 .energy-flow>i{display:block;height:1px;background:var(--nc-line);position:relative}
 .energy-flow>i:after{content:"";position:absolute;right:-1px;top:-2px;width:5px;height:5px;border-top:1px solid var(--secondary-text-color);border-right:1px solid var(--secondary-text-color);transform:rotate(45deg)}
 .energy-node{min-width:0;padding:10px;border:1px solid var(--nc-line);border-radius:13px;background:color-mix(in srgb,var(--card-background-color) 88%,transparent)}
 .energy-node ha-icon{display:block;color:var(--secondary-text-color);--mdc-icon-size:20px;margin-bottom:8px}
 .energy-node span{display:block;color:var(--secondary-text-color);font-size:.65rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .energy-node b{display:block;margin-top:3px;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .energy-node.is-active{border-color:color-mix(in srgb,var(--nc-success) 45%,var(--nc-line));background:color-mix(in srgb,var(--nc-success) 10%,var(--card-background-color))}
 .energy-node.is-active ha-icon{color:var(--nc-success)}
 .energy-node.sg ha-icon{color:var(--nc-teal)}
 .energy-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
 .energy-facts span{min-width:0;color:var(--secondary-text-color);font-size:.64rem}
 .energy-facts b{display:block;margin-top:3px;color:var(--primary-text-color);font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .energy-facts .wide{grid-column:span 3}
 nav{scrollbar-gutter:stable both-edges}
 nav button{min-height:42px}
 button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid var(--nc-focus);outline-offset:2px}
 @media(max-width:1100px){
  .app{padding:14px 16px 36px}.overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.energy-board{grid-column:1/-1;min-height:auto}.metric-row{grid-template-columns:repeat(3,1fr)}
  .plant{grid-template-columns:.8fr 116px 126px 1.05fr}.branch span{font-size:1.4rem}
 }
 @media(max-width:820px){
  .app{padding:10px 10px 28px}header{margin-bottom:12px}.overview-grid{grid-template-columns:1fr}.energy-board{grid-column:auto}.climate-panel,.water-panel,.energy-board{min-height:auto}
  .plant{--machine-col:104px;grid-template-columns:minmax(0,1fr) var(--machine-col) minmax(0,1fr);grid-template-rows:76px 76px;min-height:176px;padding:12px 14px;column-gap:0}.ambient{grid-column:1;grid-row:1/3;justify-self:start;min-width:0}.machine{grid-column:2;grid-row:1/3;width:100%;justify-self:center;border-radius:16px}.hub{grid-column:3;grid-row:1/3;justify-self:center}.branch{display:none}.pipe{left:calc(25% - 26px);right:calc(25% - 26px)}.ambient span{font-size:1.35rem}.nibe{width:62px;height:62px;border-radius:16px}.fan{width:36px;height:36px}
  nav{position:sticky;top:0;z-index:5;width:100%;margin:12px 0 10px;justify-content:space-between;box-shadow:0 6px 18px color-mix(in srgb,#000 10%,transparent)}nav button{flex:1;padding-inline:9px;font-size:.75rem}
  .metric-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.metric{padding:10px}.metric strong{font-size:.92rem}.energy-flow{grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr) 14px minmax(0,1fr)}.energy-node{padding:9px 7px}.energy-node span{font-size:.59rem}.energy-node b{font-size:.7rem}.energy-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.energy-facts .wide{grid-column:1/-1}
  .chart-grid{grid-template-columns:1fr}.chart:first-child{grid-row:auto}.diag-grid{grid-template-columns:repeat(2,1fr)}
 }
 @media(max-width:430px){
  h1{font-size:1.55rem}.eyebrow{font-size:.6rem}.status{padding:8px}.status span{display:none}.plant{--machine-col:92px;grid-template-columns:minmax(0,1fr) var(--machine-col) minmax(0,1fr);padding-inline:10px}.ambient small,.machine small,.hub small{font-size:.62rem}.machine strong{font-size:1rem}.energy-flow>i{display:none}.energy-flow{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.energy-node{border-radius:11px}.energy-node ha-icon{margin-bottom:6px}.pair{grid-template-columns:1fr 1fr}.mode-control{align-items:flex-start;flex-direction:column}.mode-control select{width:100%}.setup li{grid-template-columns:10px 1fr}.setup li em{display:none}
 }
 @media(min-width:700px) and (max-height:760px){
  .app{padding-top:10px}header{margin-bottom:9px}.plant{min-height:154px;grid-template-rows:62px 62px;padding:12px}.nibe{width:58px;height:58px;border-radius:15px}.fan{width:34px;height:34px}.machine strong{font-size:1.05rem}nav{margin:10px 0}.panel{padding:14px}.climate-panel,.water-panel,.energy-board{min-height:196px}.metric{padding:9px}.plot{min-height:145px}.plot svg{height:120px}
 }
 `;}
 styles(){return `:host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif);--nc-teal:#287f75;--nc-blue:#3c7d9d;--nc-warm:#dc704e;--nc-line:color-mix(in srgb,var(--primary-text-color) 12%,transparent);--nc-card:color-mix(in srgb,var(--card-background-color) 94%,var(--primary-color) 6%)}*{box-sizing:border-box}button,select,input{font:inherit}.app{max-width:1460px;margin:auto;padding:20px 24px 48px;scrollbar-color:var(--scrollbar-thumb-color,#7b858b) transparent;scrollbar-width:thin}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}h1,h2,h3,p{margin:0}h1{font-size:clamp(1.7rem,4vw,2.5rem);font-weight:730;letter-spacing:-.04em}.eyebrow,.title small,.chart-head small{font-size:.68rem;letter-spacing:.15em;font-weight:750;color:var(--secondary-text-color)}.sub{color:var(--secondary-text-color);margin-top:3px}.status{display:flex;gap:9px;align-items:center;border:1px solid var(--nc-line);border-radius:999px;padding:9px 13px;background:var(--card-background-color);font-weight:650;font-size:.85rem}.status i{width:9px;height:9px;border-radius:50%;background:#63b889;box-shadow:0 0 0 5px color-mix(in srgb,#63b889 18%,transparent)}.alarm .status i{background:var(--error-color,#db4437)}.plant{position:relative;display:grid;grid-template-columns:1fr 130px 150px 1fr;grid-template-rows:88px 88px;gap:10px;min-height:196px;border:1px solid var(--nc-line);border-radius:22px;padding:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--card-background-color) 96%,var(--nc-teal) 4%),var(--card-background-color));overflow:hidden}.ambient{grid-row:1/3;align-self:center}.ambient span,.branch span{display:block;font-size:1.65rem;font-weight:720;letter-spacing:-.04em}.ambient small,.branch small,.machine small,.hub small{color:var(--secondary-text-color);font-size:.72rem}.machine{grid-row:1/3;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid var(--nc-line);border-radius:18px;background:var(--card-background-color);z-index:2}.machine strong{font-size:1.25rem}.fan{width:45px;height:45px;border:2px solid var(--nc-line);border-radius:50%;position:relative;margin-bottom:7px}.fan b,.fan b:before,.fan b:after{content:"";position:absolute;left:50%;top:50%;width:5px;height:18px;margin-left:-2.5px;margin-top:-18px;border-radius:10px;background:var(--nc-teal);transform-origin:50% 100%}.fan b:before,.fan b:after{left:0;top:0;margin:0}.fan b:before{transform:rotate(120deg)}.fan b:after{transform:rotate(240deg)}.fan:after{content:"";position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;background:var(--nc-teal);transform:translate(-50%,-50%);z-index:1}.machine.active .fan b{animation:spin 3.6s linear infinite}.hub{grid-row:1/3;align-self:center;justify-self:center;text-align:center;z-index:2}.nibe{width:76px;height:76px;border-radius:20px;display:grid;place-items:center;background:var(--nc-teal);color:white;font-weight:800;letter-spacing:.08em;box-shadow:0 12px 28px color-mix(in srgb,var(--nc-teal) 28%,transparent)}.branch{align-self:center;border-left:3px solid;padding-left:14px}.branch.heat{border-color:var(--nc-warm)}.branch.water{border-color:var(--nc-blue)}.pipe{position:absolute;height:3px;left:calc(25% + 60px);right:calc(50% - 40px);top:43%;background:var(--nc-warm);opacity:.55;overflow:hidden;border-radius:999px}.pipe.cold{top:61%;background:var(--nc-blue)}.running .pipe span{position:absolute;left:-18px;top:0;display:block;width:18px;height:3px;border-radius:999px;background:color-mix(in srgb,#fff 84%,transparent);animation:flow 2.4s linear infinite}nav{display:flex;gap:5px;margin:18px 0 14px;padding:4px;border-radius:13px;background:color-mix(in srgb,var(--card-background-color) 75%,var(--primary-text-color) 5%);width:max-content;max-width:100%;overflow:auto}nav button{border:0;background:transparent;color:var(--secondary-text-color);padding:9px 14px;border-radius:9px;cursor:pointer;font-weight:650;white-space:nowrap}nav button.active{background:var(--card-background-color);color:var(--primary-text-color);box-shadow:0 2px 8px rgba(0,0,0,.08)}nav button:focus-visible,.target button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid var(--primary-color);outline-offset:2px}.tab{display:none}.tab.active{display:block}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.panel{border:1px solid var(--nc-line);background:var(--card-background-color);border-radius:18px;padding:17px;min-width:0}.title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.title h2{font-size:1.85rem;letter-spacing:-.04em;margin-top:4px}.title ha-icon{color:var(--nc-teal);--mdc-icon-size:27px}.target{margin-top:15px}.target>span{font-size:.78rem;color:var(--secondary-text-color)}.target>div{display:flex;align-items:center;justify-content:space-between;margin:5px 0}.target button{width:40px;height:40px;border:1px solid var(--nc-line);border-radius:12px;background:var(--nc-card);color:var(--primary-text-color);font-size:1.3rem;cursor:pointer}.target output{font-size:1.12rem;font-weight:700}.target input{width:100%;accent-color:var(--nc-teal)}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px}.pair span{font-size:.72rem;color:var(--secondary-text-color)}.pair b{display:block;color:var(--primary-text-color);margin-top:4px;font-size:.85rem}.hint{font-size:.75rem;color:var(--secondary-text-color);margin-top:14px;line-height:1.45}.metric-row{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:10px}.metric{border:1px solid var(--nc-line);background:var(--card-background-color);border-radius:14px;padding:12px;min-width:0}.metric small{color:var(--secondary-text-color);font-size:.68rem}.metric strong{display:block;font-size:1rem;margin-top:5px;white-space:nowrap}.metric em{font-size:.6rem;color:var(--warning-color,#d89521);font-style:normal}.chart-grid{display:grid;grid-template-columns:2fr 1fr;gap:12px}.chart:first-child{grid-row:span 2}.chart-head{display:flex;justify-content:space-between}.chart h3{font-size:1.1rem;margin-top:4px}.plot{min-height:170px;margin-top:10px}.plot svg{width:100%;height:145px;overflow:visible}.plot path{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}.gridlines path{stroke:var(--nc-line);stroke-width:1}.plot span{display:inline-flex;align-items:center;margin-right:13px;font-size:.68rem;color:var(--secondary-text-color)}.plot span:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--c);margin-right:5px}.axis{display:flex;justify-content:space-between}.loader,.empty{min-height:150px;display:grid;place-items:center;color:var(--secondary-text-color);font-size:.8rem}.setup{max-width:900px}.score{font-size:1.45rem;font-weight:750;color:var(--nc-teal)}.setup>p{color:var(--secondary-text-color);margin:13px 0;line-height:1.5}.setup ul{list-style:none;margin:0;padding:0}.setup li{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:11px;padding:10px 0;border-top:1px solid var(--nc-line)}.setup li i{width:9px;height:9px;border-radius:50%}.setup li i.ok{background:#58a778}.setup li i.disabled{background:#d89521}.setup li i.missing{background:#9ba1a4}.setup li span small{display:block;color:var(--secondary-text-color);font-size:.66rem;margin-top:2px;overflow-wrap:anywhere}.setup li em{font-style:normal;font-size:.7rem;color:var(--secondary-text-color)}.setup aside{margin-top:14px;border-radius:12px;padding:13px;background:color-mix(in srgb,var(--primary-color) 9%,transparent);font-size:.78rem;line-height:1.5}.diag-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}@keyframes spin{to{transform:rotate(360deg)}}@keyframes flow{from{left:-18px}to{left:100%}}@media(prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}@media(max-width:800px){.app{padding:12px 10px 32px}.plant{grid-template-columns:1fr 92px 100px;grid-template-rows:80px 80px;padding:12px}.ambient{grid-column:1}.machine{grid-column:2}.hub{grid-column:3}.branch{display:none}.pipe{left:42%;right:24%}.grid{grid-template-columns:1fr}.metric-row{grid-template-columns:repeat(2,1fr)}.chart-grid{grid-template-columns:1fr}.chart:first-child{grid-row:auto}.diag-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:430px){header{align-items:flex-end}.status span{display:none}.plant{grid-template-columns:1fr 84px 84px}.ambient span{font-size:1.35rem}.nibe{width:62px;height:62px;border-radius:16px;font-size:.8rem}.machine{border-radius:15px}.fan{width:36px;height:36px}.metric-row{gap:6px}.metric{padding:10px}.metric strong{font-size:.9rem}.pair{grid-template-columns:1fr}.setup li{grid-template-columns:10px 1fr}.setup li em{display:none}}`}
}

class NibeControlStrategy extends HTMLElement {
 static getCreateSuggestions(){return {title:"NIBE Control",icon:"mdi:heat-pump-outline"};}
 static async generate(config){return {title:config.title||"NIBE Control",views:[{title:"Anlage",path:"anlage",icon:"mdi:heat-pump-outline",type:"panel",cards:[{type:"custom:nibe-control-card",mappings:config.mappings||{},ventilation:config.ventilation||{},config_entry_id:config.config_entry_id||null}]}]};}
}

if(!customElements.get("nibe-control-card")) customElements.define("nibe-control-card",NibeControlCard);
if(!customElements.get("ll-strategy-dashboard-nibe-control")) customElements.define("ll-strategy-dashboard-nibe-control",NibeControlStrategy);
window.customStrategies=window.customStrategies||[];
if(!window.customStrategies.some(x=>x.type==="nibe-control")) window.customStrategies.push({type:"nibe-control",strategyType:"dashboard",name:"NIBE Control",description:"Dynamisches Technik-Dashboard für NIBE S-Serie",documentationURL:"https://github.com/Soul7495/NIBE-Control"});
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==="nibe-control-card")) window.customCards.push({type:"nibe-control-card",name:"NIBE Control",description:"NIBE S-Serie Anlagenübersicht"});
