/* NIBE Control 0.10.2 — local Home Assistant dashboard */
import { ncNumber, ncBinary, ncOperating, ncSg, ncEvccMode, ncToday, ncFilterDate, ncHistoryPoints, ncHistoryPath, ncHistoryValue, ncHistoryScale, ncHistoryStats, ncPvAction, ncPriority } from './state.js';
import { PROFILE as DEVICE_PROFILE, resolveDiscovery, WRITE_ALLOWLIST, DEVICE_PROFILES, deviceProfile } from './profile.js';
import { FEATURE_ROLES, entityCompatible, capabilityState, mergeDashboardSettings, settingSnapshot } from './settings.js';
import { ncWorkbook, ncExportTables } from './history-export.js';
const VERSION = "0.10.2";
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
 setConfig(config){ this.config=config||{};this.settingsBaseline=settingSnapshot(this.config); if(!this.shadowRoot)this.attachShadow({mode:"open"}); }
 set hass(hass){ const first=!this._hass,reconnected=this._hass?.connected===false&&hass.connected!==false; this._hass=hass; if(first) this.init(); else{this.paintValues();if(reconnected)this.refreshRegistry().then(()=>this.loadHistory());} }
 async init(){
  try {
   const [entities,devices]=await Promise.all([
    this._hass.callWS({type:"config/entity_registry/list"}),
    this._hass.callWS({type:"config/device_registry/list"})
   ]);
   this.registry=entities; this.devices=devices;this.discoveryError=false;
   this.applyDiscovery();
  } catch(e){this.registry=[];this.discoveryError=true;this.applyDiscovery();}
  this.helperIds={}; this.findMaintenanceHelpers();
  this.render(); this.loadHistory();
 }
 async refreshRegistry(){
  if(this.registryPending)return;this.registryPending=true;
  try{const rows=await this._hass.callWS({type:'config/entity_registry/list'});this.registry=rows;this.discoveryError=false;this.applyDiscovery();this.paintValues();if(this.shadowRoot.getElementById('community-setup'))this.previewSetup();}
  catch(e){this.discoveryError=true;const message=this.shadowRoot?.querySelector('[data-discovery-error]');if(message)message.textContent='Registry nicht erreichbar. Vorhandene Zuordnung bleibt erhalten.';}
  finally{this.registryPending=false;}
 }
 applyDiscovery(){
  this.activeProfile=deviceProfile(this.config?.profile,this.devices||[],this.config?.config_entry_id);const result=resolveDiscovery(this.registry,this.config?.mappings||{},this.config?.config_entry_id,this.activeProfile);const changed=JSON.stringify(this.mapping||{})!==JSON.stringify(result.mapping);if(changed){this.historyGeneration=(this.historyGeneration||0)+1;this.historyPending=false;}this.discovery=result;this.mapping=result.mapping;this.meta=Object.fromEntries(Object.entries(this.mapping).map(([r,id])=>[r,this.registry.find(e=>e.entity_id===id)]));
 }
 connectedCallback(){clearInterval(this.historyTimer);this.historyTimer=setInterval(()=>{if(this._hass?.connected!==false&&this.selectedPlant==='heatpump'&&this.shadowRoot?.getElementById('charts')?.classList.contains('active')&&document.visibilityState!=='hidden')this.loadHistory();},60000);}
 disconnectedCallback(){this.historyPending=false;clearInterval(this.historyTimer);this.historyTimer=null;this.historyGeneration=(this.historyGeneration||0)+1;}
 st(role){return this._hass.states[this.mapping?.[role]];}
 val(role){const s=this.st(role), a=role==='room'?(this.mapping?.room?.startsWith('climate.')?'current_temperature':null):PROFILE[role]?.a; let v=a?s?.attributes?.[a]:s?.state;const n=ncNumber(v),u=s?.attributes?.unit_of_measurement||(role==='room'&&this.mapping?.room?.startsWith('climate.')?this._hass.config?.unit_system?.temperature:null);if(n!=null&&PROFILE[role]?.u==='kW'&&u==='W')v=n/1000;if(n!=null&&PROFILE[role]?.u==='°C'&&u==='°F')v=(n-32)*5/9;return v;}
 available(role){return valid(this.st(role))&&(!(PROFILE[role]?.a||PROFILE[role]?.u)||ncNumber(this.val(role))!=null);}
 unit(role){return PROFILE[role]?.u || this.st(role)?.attributes?.unit_of_measurement || "";}
 value(role,d=1){const value=this.val(role);return this.available(role)&&ncNumber(value)!=null?`${fmt(value,d)}${this.unit(role)?` ${esc(this.unit(role))}`:""}`:"—";}
 live(role,d=1){return `<span data-role="${role}" data-digits="${d}">${this.value(role,d)}</span>`;}
 stateValues(){return Object.fromEntries(['priority','compressorHz','additionalHeat','alarm','defrost','sgA','sgB','sgMode'].map(role=>[role,this.val(role)]));}
 operation(){const values=this.stateValues();if(this.activeProfile?.priorityCodes===false)values.priority=null;return ncOperating(values,this._hass.connected!==false);}
 operating(){const state=this.operation();return [state.mode,state.label];}
 render(){
  const [mode,label]=this.operating();
  this.shadowRoot.innerHTML=`<style>${this.styles()}</style><style>${this.responsiveStyles()}</style><style>${this.plantStyles()}</style><main class="app ${mode}">
   <header><div><div class="eyebrow">DEINE HAUSTECHNIK · V${VERSION}</div><h1>NIBE Control</h1><p class="sub">Wärmepumpe und Lüftung</p></div><button type="button" class="settings-gear" data-open-settings aria-label="Einstellungen öffnen" title="Einstellungen öffnen"><ha-icon icon="mdi:cog-outline" aria-hidden="true"></ha-icon></button></header>
   <div class="plant-choices" aria-label="Anlage auswählen"><button type="button" data-plant="heatpump" aria-pressed="false"><ha-icon icon="mdi:heat-pump-outline" aria-hidden="true"></ha-icon><b>Wärmepumpe</b><small>${esc(this.activeProfile?.model||'NIBE')}</small><span data-operation>${esc(label)}</span><strong>${this.live('room')} innen <span data-feature="water">· ${this.live('hotWaterTop')} Warmwasser</span></strong></button><button type="button" data-feature="ventilation" data-plant="ventilation" aria-pressed="false"><ha-icon icon="mdi:hvac" aria-hidden="true"></ha-icon><b>Lüftung</b><small>${esc(this.ventilationModel())}</small><span data-vent-operation></span><strong>${this.live('ventilationSupply',0)} Zuluft · ${this.live('ventilationExtract',0)} Abluft</strong><em data-filter-summary></em></button></div>
   <p class="choice-hint" data-choice-hint>Wähle eine Anlage für Details und Einstellungen.</p>
   <nav hidden aria-label="Wärmepumpenbereiche"><button class="active" data-tab="overview">Übersicht</button><button data-tab="charts">Verläufe</button><button data-tab="setup">Einstellungen</button><button data-tab="diag">Diagnose</button></nav>
   <section id="overview" class="tab active" hidden>${this.hero()}${this.overview()}</section>
   <section id="charts" class="tab" hidden>${this.charts()}</section>
   <section id="setup" class="tab" hidden>${this.setup()}</section>
   <section id="diag" class="tab" hidden>${this.diagnostics()}</section>
   <section id="ventilation" data-feature="ventilation" hidden>${this.ventilation()}</section>
   <style>[hidden]{display:none!important}/* Hidden views override active tab display. */.plant-choices{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.plant-choices button{display:grid;grid-template-columns:32px 1fr;gap:5px 12px;text-align:left;padding:18px;border:1px solid var(--nc-line);border-radius:18px;background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer;min-width:0}.plant-choices ha-icon{grid-row:span 2;color:var(--nc-teal)}.plant-choices b{font-size:1.1rem}.plant-choices small,.plant-choices span,.plant-choices strong,.plant-choices em{grid-column:2;font-size:.78rem;overflow-wrap:anywhere}.plant-choices small,.plant-choices span{color:var(--secondary-text-color)}.plant-choices strong{font-weight:600;margin-top:6px}.plant-choices em{font-style:normal;color:var(--secondary-text-color)}.plant-choices button:hover{background:var(--nc-card)}.plant-choices button[aria-pressed=true]{border-color:var(--nc-teal);box-shadow:inset 0 0 0 1px var(--nc-teal)}.choice-hint{font-size:.85rem;color:var(--secondary-text-color);margin:24px 0}.plant-choices [data-role]{display:inline;font-size:inherit;color:inherit;grid-column:auto}@media(max-width:520px){.plant-choices{gap:8px}.plant-choices button{grid-template-columns:1fr;padding:12px;gap:6px}.plant-choices ha-icon{grid-row:auto}.plant-choices small,.plant-choices span,.plant-choices strong,.plant-choices em{grid-column:1}.plant-choices strong{font-size:.72rem}nav{position:static}}</style>
  <style>${this.compactStyles()}</style></main>`;
  this.bind(); this.paintValues();this.applyVisibility();
 }
 hero(){
  return `<section class="plant" aria-label="Aktueller Anlagenbetrieb">
   <div class="plant-heading"><small>DEINE ANLAGE · LIVE</small><b data-operation>${esc(this.operation().label)}</b></div>
   <div class="plant-core">
    <article class="machine"><div class="outdoor-unit"><div class="fan" aria-hidden="true"><b></b></div><i></i><i></i><i></i></div><strong>${this.live('compressorHz',0)}</strong><small>${this.activeProfile?.id?.startsWith('vvms')?'Außeneinheit · EB101':'Verdichter · schematisch'}</small><span class="outside-value">${this.live('outdoor')} außen</span></article>
    <div class="plant-link" aria-hidden="true"><div class="pipe hot"><span></span></div><div class="pipe cold"><span></span></div></div>
    <article class="hub"><div class="indoor-unit"><span>NIBE</span><i></i><i></i></div><strong>${esc(this.activeProfile?.model||'NIBE')}</strong><small>Inneneinheit</small></article>
   </div>
   <div class="distribution" aria-hidden="true"><i data-destination="heat"></i><i data-destination="water"></i></div><div class="destinations">
    <article class="destination heat" data-destination="heat"><ha-icon icon="mdi:home-thermometer-outline" aria-hidden="true"></ha-icon><div><b>Vorlauf · Heizkreis</b><strong>${this.live('supply')}</strong><small>Vorlauftemperatur</small></div><span class="branch-state" data-branch="heat">Bereit</span></article>
    <article data-feature="water" class="destination water" data-destination="water"><ha-icon icon="mdi:water-boiler" aria-hidden="true"></ha-icon><div><b>Warmwasser</b><strong>${this.live('hotWaterTop')}</strong><small>Speichertemperatur oben</small></div><span class="branch-state" data-branch="water">Bereit</span></article>
   </div><details class="technical-details"><summary>Datenbasis</summary><p class="plant-note" data-operation-detail></p></details>
  </section>`;
 }
 metric(role){const p={...PROFILE[role],t:this.config?.mappings?.[role]||this.activeProfile?.id==='generic'?null:PROFILE[role].t}; return `<article class="metric"><div><small>${esc(p.l)}${p.t?` · ${p.t}`:""}</small><strong>${this.live(role)}</strong></div><em data-quality="${role}"></em></article>`;}
 overview(){
  const sg=ncSg(this.stateValues()).label;
  const wh=this.st("waterHeater"), ops=wh?.attributes?.operation_list||[];
  const evccPresent=["evccEnabled","evccCharging","evccAction","evccMode"].some(r=>this.st(r));
  const evccEnabled=yes(this.val("evccEnabled")), evccRequest=yes(this.val("evccCharging"));
  return `<div class="overview-grid">
   <section class="panel climate-panel"><div class="climate-values"><span>Raum<b>${this.live("room")}</b></span><span>Außen<b>${this.live("outdoor")}</b></span></div><details class="technical-details"><summary>Temperaturinformationen</summary><p class="hint">Gemessene Raumtemperatur. Der MyUplink-Sollwert wird lokal nicht bereitgestellt.</p></details></section>
   <details class="panel water-panel" data-feature="water"><summary>Warmwasser · Bedienung und Ladefühler</summary><div class="title"><div><small>WARMWASSER</small><h2>${this.live("hotWaterTop")}</h2></div><ha-icon icon="mdi:water-boiler"></ha-icon></div><div class="pair"><span>Ladefühler · BT6 <b>${this.live("hotWaterCharge")}</b></span><span>Warmwassermodus <b data-raw="hotWaterMode"></b></span><span>Mehr Warmwasser <b data-raw="moreHotWater"></b></span><span>Betrieb <b><span data-raw="waterHeater"></span></b></span></div><label class="mode-control" for="hw-mode">Warmwassermodus<select id="hw-mode" disabled>${ops.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></label><p class="hint" data-water-control-help></p></details>
   <section class="panel energy-board"><div class="energy-head"><div><small>ENERGIE · PV-OPTIMIERUNG</small><h2>${this.live("electrical")}</h2><p>Elektrische Leistung</p></div><ha-icon icon="mdi:solar-power-variant-outline"></ha-icon></div>
    <div class="energy-flow" data-feature="evcc">
     <article class="energy-node ${evccEnabled?"is-active":""}"><ha-icon icon="mdi:solar-power"></ha-icon><span>EVCC-Freigabe</span><b data-state="evccEnabled">${evccEnabled?"Aktiv":"Inaktiv"}</b></article>
     <i aria-hidden="true"></i>
     <article class="energy-node ${evccRequest?"is-active":""}"><ha-icon icon="mdi:heat-pump-outline"></ha-icon><span>EVCC-Anforderung</span><b data-state="evccCharging">${evccRequest?"Aktiv":"Keine"}</b></article>
     <i aria-hidden="true"></i>
     <article class="energy-node sg"><ha-icon icon="mdi:transmission-tower-import"></ha-icon><span>SG Ready</span><b data-sg>${esc(sg)}</b></article>
    </div>
    <div class="energy-facts"><span data-feature="evcc">PV-Aktion<b data-raw="evccAction"></b></span><span data-feature="evcc">Anhebung<b>${this.live("evccActionValue")}</b></span><span>Heizstab<b>${this.live("additionalHeat")}</b></span></div>${this.evccControl()}
    <div data-feature="sg"><b>SG Ready: <span data-sg></span></b></div><details class="technical-details"><summary>SG-Kontakte und Erklärung</summary><div class="sg-contacts"><span>SG A <b data-contact="sgA">—</b></span><span>SG B <b data-contact="sgB">—</b></span></div><p class="energy-explanation" data-energy-explanation></p><p class="hint" data-sg-detail></p></details>
   </section>
  </div><p role="status" aria-live="polite" class="hint" data-control-feedback></p><div class="metric-row">${["supplyTarget","supply","return","hpSupply","degreeMinutes","flow"].map(r=>this.metric(r)).join("")}</div>`;
 }
 evccControl(){return `<label data-feature="evcc" class="mode-control" for="evcc-mode">EVCC-Modus<select id="evcc-mode" disabled></select></label>`;}
 charts(){return `<div class="history-tools"><label class="mode-control" for="history-period"><span>Zeitraum</span><select id="history-period"><option value="6">6 Stunden</option><option value="12">12 Stunden</option><option value="24" selected>24 Stunden</option></select></label><button type="button" id="history-export" aria-label="Verlauf als Excel herunterladen" title="Verlauf als Excel herunterladen"><ha-icon icon="mdi:file-excel-outline" aria-hidden="true"></ha-icon><span>Excel</span></button></div><p role="status" aria-live="polite" class="hint" data-export-feedback></p><p class="hint" data-history-feedback role="status">Verläufe werden beim Öffnen und jede Minute aktualisiert. Tippe auf eine Kurve oder bewege den Zeitregler, um alle Messwerte desselben Moments zu vergleichen.</p><div class="chart-grid">${["heating","frequency","power","water"].map(k=>`<section class="panel chart" ${k==='water'?'data-feature="water"':''}><div class="chart-head"><div><small data-period-label>${this.historyHours||24} STUNDEN</small><h3>${k==="heating"?"Heizkreis":k==="frequency"?"Verdichterfrequenz":k==="power"?"Elektrische Leistung":"Warmwasser"}</h3></div><span class="legend"></span></div><div class="plot" id="plot-${k}"><div class="loader">Historie wird geladen …</div></div></section>`).join("")}</div>`;}
 dataState(role){if(Object.hasOwn(this.config?.mappings||{},role)&&this.config.mappings[role]===null)return 'Nicht verwendet';if(this.discovery?.ambiguous?.includes(role))return 'Mehrdeutig · manuelle Zuordnung nötig';if(this.meta?.[role]?.disabled_by)return 'Deaktiviert';return this.available(role)?'Verfügbar':this.meta?.[role]||this.st(role)?'Nicht verfügbar':'Nicht zugeordnet';}
 setup(){
  const groups=[['Temperaturen und Heizung',['room','outdoor','supply','return','supplyTarget','hpSupply','hpReturn','degreeMinutes','flow']],['Verdichter und Energie',['compressorHz','requestedHz','electrical','outdoorPower','thermal','additionalHeat','priority','compressorStatus','defrost','alarm']],['Warmwasser',['hotWaterTop','hotWaterCharge','hotWaterMode','moreHotWater','waterHeater','diverter']],['PV, EVCC und SG Ready',['evccEnabled','evccCharging','evccAction','evccActionValue','evccMode','sgMode','sgA','sgB']],['Lüftung und technische Werte',['ventilationSupply','ventilationExtract','ventilationMode','roomSetpoint','useRoomSensor','climate']]];

  return `<section class="panel setup"><div class="title"><div><small>COMMUNITY · EINRICHTUNG</small><h2>Deine Anlage, deine Werte</h2></div></div><p class="hint">Automatische Vorschläge prüfen oder später jederzeit korrigieren. Änderungen wirken erst nach „Einrichtung speichern“ und gelten für dieses Dashboard auf allen Displays.</p><form id="community-setup" novalidate><fieldset><legend>1 · Anlage auswählen</legend><label for="installation">NIBE-Installation</label><select id="installation"><option value="">Automatisch / andere Integration</option>${(this.discovery?.entries||[]).map(id=>`<option value="${esc(id)}" ${id===(this.config.config_entry_id||this.discovery.selected)?'selected':''}>${esc(this.devices?.find(d=>d.config_entries?.includes(id))?.name||'NIBE')} · ${esc(id.slice(-6))}</option>`).join('')}</select><label for="device-profile">Wärmepumpenprofil</label><select id="device-profile"><option value="auto">Automatisch erkennen</option>${Object.entries(DEVICE_PROFILES).map(([id,p])=>`<option value="${id}" ${id===this.config.profile?'selected':''}>${esc(p.model)}</option>`).join('')}</select><p class="hint" data-profile-evidence>${esc(this.activeProfile?.verified||'')}</p><p data-discovery-error>${this.discoveryError?'Registry nicht erreichbar. Manuelle Zuordnung bleibt möglich.':''}</p></fieldset>
   <fieldset><legend>2 · Messwerte zuordnen</legend><p class="hint">Wähle Automatisch, Manuell zuordnen oder Nicht verwenden. Bei Manuell wählst du eine aktivierte Entity aus der Liste. Raumtemperatur kann auch von einem anderen Temperatursensor kommen.</p>${groups.map(([title,roles],index)=>`<details class="mapping-group" ${index===0?'open':''}><summary>${title}</summary>${roles.map(role=>this.mappingField(role)).join('')}</details>`).join('')}</fieldset>
   <fieldset><legend>3 · Bereiche anzeigen</legend>${Object.keys(FEATURE_ROLES).map(feature=>`<label for="visibility-${feature}">${{water:'Warmwasser',ventilation:'Lüftung',evcc:'PV / EVCC'}[feature]}</label><select id="visibility-${feature}" data-visibility="${feature}"><option value="auto">Bei vorhandenen Daten anzeigen</option><option value="hide" ${this.config.visibility?.[feature]==='hide'?'selected':''}>Ausblenden</option></select><small data-feature-status="${feature}"></small>`).join('')}<p class="hint">Ausblenden betrifft nur dieses Dashboard. Die Anlage und Automationen laufen weiter. Inaktive Bereiche bleiben hier erkennbar.</p></fieldset><p class="hint" data-setup-feedback role="status" aria-live="polite">${esc(this.setupFeedback||'Noch keine Änderungen gespeichert.')}</p><button type="submit" id="setup-save">Einrichtung speichern</button></form><aside><b>Deaktivierte Entitäten:</b> Einstellungen → Geräte & Dienste → NIBE Heat Pump → Gerät → Entitäten. Deaktivierte Entitäten anzeigen und nur benötigte Werte aktivieren.</aside></section>`;
 }
 setupDraft(){
  const root=this.shadowRoot,mappings={...this.config.mappings};root.querySelectorAll('[data-mapping]').forEach(input=>{const role=input.dataset.mapping;const mode=root.querySelector(`[data-mapping-mode="${role}"]`)?.value||'auto';if(mode==='none')mappings[role]=null;else if(mode==='manual')mappings[role]=input.value;else delete mappings[role];});
  return {profile:root.getElementById('device-profile').value,config_entry_id:root.getElementById('installation').value||null,mappings,visibility:Object.fromEntries([...root.querySelectorAll('[data-visibility]')].map(input=>[input.dataset.visibility,input.value]))};
 }
 previewSetup(){
  const draft=this.setupDraft(),profile=deviceProfile(draft.profile,this.devices||[],draft.config_entry_id),result=resolveDiscovery(this.registry||[],draft.mappings,draft.config_entry_id,profile);
  const evidence=this.shadowRoot.querySelector('[data-profile-evidence]');if(evidence)evidence.textContent=profile.model+' · '+profile.verified;
  this.shadowRoot.querySelectorAll('[data-mapping-preview]').forEach(el=>{const role=el.dataset.mappingPreview,id=result.mapping[role],state=this._hass.states[id],meta=this.registry?.find(e=>e.entity_id===id);el.textContent=draft.mappings[role]===null?'Nicht verwendet':!id?(result.ambiguous.includes(role)?'Mehrdeutig · bitte manuell wählen':'Nicht zugeordnet'):id+' · '+(meta?.disabled_by?'Deaktiviert':valid(state)?'Verfügbar':'Nicht verfügbar');});
  this.shadowRoot.querySelectorAll('[data-feature-status]').forEach(el=>el.textContent=capabilityState(el.dataset.featureStatus,result.mapping,this.registry,this._hass.states,draft.visibility).label);
 }
 bindSetup(){
  const form=this.shadowRoot.getElementById('community-setup');if(!form)return;
  this.shadowRoot.getElementById('device-profile').value=this.config.profile||'auto';
  this.shadowRoot.querySelectorAll('[data-mapping-mode]').forEach(mode=>mode.onchange=()=>{const select=this.shadowRoot.getElementById('map-'+mode.dataset.mappingMode);select.disabled=mode.value!=='manual';if(mode.value==='manual')this.fillMappingSelect(mode.dataset.mappingMode);});this.shadowRoot.querySelectorAll('.mapping-group').forEach(group=>group.ontoggle=()=>{if(group.open)group.querySelectorAll('[data-mapping]').forEach(select=>this.fillMappingSelect(select.dataset.mapping));});this.shadowRoot.querySelectorAll('.mapping-group[open] [data-mapping]').forEach(select=>this.fillMappingSelect(select.dataset.mapping));form.onchange=()=>this.previewSetup();form.onsubmit=e=>{e.preventDefault();this.saveSetup(this.setupDraft());};this.previewSetup();
 }
 async saveSetup(settings){
  if(this.setupPending)return false;
  const feedback=this.shadowRoot.querySelector('[data-setup-feedback]'),message=text=>{this.setupFeedback=text;if(feedback)feedback.textContent=text;};
  if(this._hass.connected===false){message('Home Assistant getrennt. Eingaben bleiben erhalten; nach Wiederverbindung speichern.');return false;}
  for(const [role,id] of Object.entries(settings.mappings))if(PROFILE[role]&&id!==null){const exists=this.registry?.some(e=>e.entity_id===id)||this._hass.states[id];if(!exists||!entityCompatible(role,id,this._hass.states[id],DEVICE_PROFILE.roles[role])){const input=this.shadowRoot.getElementById('map-'+role);const group=input?.closest('details');if(group)group.open=true;input?.setAttribute('aria-invalid','true');input?.focus();message(`${PROFILE[role].l}: Entity fehlt oder Domain/Einheit passt nicht. Bitte eine passende Entity wählen.`);return false;}}
  this.shadowRoot.querySelectorAll('[data-mapping]').forEach(input=>input.removeAttribute('aria-invalid'));
  const route=this.config.dashboard_url_path??window.location?.pathname?.split('/').filter(Boolean)[0];
  if(!route){message('Dashboard-Adresse nicht erkennbar. Im NIBE-Control-Dashboard öffnen und erneut speichern.');return false;}
  const url_path=route==='lovelace'?null:route,fields=[...this.shadowRoot.querySelectorAll('#community-setup fieldset')],button=this.shadowRoot.getElementById('setup-save');this.setupPending=true;fields.forEach(f=>f.disabled=true);if(button){button.disabled=true;button.textContent='Wird gespeichert …';}message('Einrichtung wird in Home Assistant gespeichert …');let submitted=false;
  try{
   const raw=await this._hass.callWS({type:'lovelace/config',url_path,force:true});
   if(settingSnapshot(raw)!==(this.settingsBaseline||settingSnapshot(this.config))){message('Die Einrichtung wurde inzwischen geändert. Dashboard neu laden und deine Zuordnung prüfen; es wurde nichts überschrieben.');return false;}
   const updated=mergeDashboardSettings(raw,settings);
   await this._hass.callWS({type:'lovelace/config/save',url_path,config:updated});submitted=true;
   const confirmed=await this._hass.callWS({type:'lovelace/config',url_path,force:true});
   if(settingSnapshot(confirmed)!==settingSnapshot(updated))throw new Error('readback');
   this.config={...this.config,...settings,setup_complete:true};this.settingsBaseline=settingSnapshot(confirmed);this.applyDiscovery();this.helperIds={};this.findMaintenanceHelpers();this.chartInspectors={};this.setupFeedback='Einrichtung gespeichert. Gilt auf allen Displays dieses Dashboards.';this.render();this.selectPlant('heatpump');this.shadowRoot.querySelector('[data-tab="setup"]')?.click();this.loadHistory();return true;
  }catch(e){message(submitted?'Speicherung übermittelt, Rückprüfung nicht möglich. Dashboard neu laden und gespeicherte Werte prüfen.':'Nicht gespeichert. Administratorrechte, Verbindung und Dashboard im Speichermodus prüfen. Eingaben bleiben erhalten.');return false;}
  finally{this.setupPending=false;fields.forEach(f=>f.disabled=false);if(button){button.disabled=false;button.textContent='Einrichtung speichern';}}
 }
 ventilationModel(){const found=(this.devices||[]).filter(d=>/ERS/i.test(d.model||'')&&(!this.discovery?.selected||d.config_entries?.includes(this.discovery.selected)));return found.length===1?found[0].model:'Lüftung';}
 feature(feature){return capabilityState(feature,this.mapping,this.registry,this._hass.states,this.config?.visibility);}
 applyVisibility(){
  this.shadowRoot?.querySelectorAll('[data-feature]').forEach(el=>{const feature=el.dataset?.feature;if(!feature)return;if(feature==='sg'){el.hidden=this.feature('evcc').visible;return;}el.hidden=!this.feature(feature).visible||(el.id==='ventilation'&&this.selectedPlant!=='ventilation');});
  this.shadowRoot?.querySelectorAll('[data-feature-status]').forEach(el=>{if(!this.shadowRoot.getElementById('community-setup'))el.textContent=this.feature(el.dataset.featureStatus).label;});
 }
 convertHistory(role,rows){
  const unit=this.st(role)?.attributes?.unit_of_measurement,convert=PROFILE[role]?.u==='kW'&&unit==='W'?v=>v/1000:PROFILE[role]?.u==='°C'&&unit==='°F'?v=>(v-32)*5/9:null;
  return convert?rows.map(row=>{const key=Object.hasOwn(row,'s')?'s':'state',n=ncNumber(row[key]);return n==null?row:{...row,[key]:String(convert(n))};}):rows;
 }
 mappingField(role){
  const manual=Object.hasOwn(this.config.mappings||{},role),value=this.config.mappings?.[role],mode=manual?(value==null?'none':'manual'):'auto',label=role==='room'?'Raumtemperatur':PROFILE[role].l;
  return `<div class="mapping-field"><label for="mode-${role}">${esc(label)}</label><select id="mode-${role}" data-mapping-mode="${role}" aria-label="Zuordnung ${esc(label)}"><option value="auto" ${mode==='auto'?'selected':''}>Automatisch</option><option value="manual" ${mode==='manual'?'selected':''}>Manuell zuordnen</option><option value="none" ${mode==='none'?'selected':''}>Nicht verwenden</option></select><label class="entity-label" for="map-${role}">Entity für ${esc(label)}</label><select id="map-${role}" data-mapping="${role}" ${mode!=='manual'?'disabled':''} aria-describedby="map-info-${role}"><option value="">Aktivierte Entity auswählen</option>${value?`<option value="${esc(value)}" selected>${esc(value)}</option>`:''}</select><small id="map-info-${role}" data-mapping-preview="${role}"></small></div>`;
 }
 fillMappingSelect(role){
  const select=this.shadowRoot.getElementById('map-'+role);if(!select)return;const value=select.value,options=this.mappingCandidates(role);select.innerHTML='<option value="">Aktivierte Entity auswählen</option>'+options.map(id=>`<option value="${esc(id)}">${esc(this._hass.states[id]?.attributes?.friendly_name||id)} · ${esc(id)}</option>`).join('');
  if(value&&!options.includes(value))select.innerHTML+=`<option value="${esc(value)}">${esc(value)} · nicht aktiv / nicht passend</option>`;select.value=value;
 }
 mappingCandidates(role){
  const disabled=new Set((this.registry||[]).filter(e=>e.disabled_by).map(e=>e.entity_id));return Object.keys(this._hass.states).filter(id=>!disabled.has(id)&&entityCompatible(role,id,this._hass.states[id],DEVICE_PROFILE.roles[role])).sort((a,b)=>String(this._hass.states[a]?.attributes?.friendly_name||a).localeCompare(String(this._hass.states[b]?.attributes?.friendly_name||b),'de'));
 }
 diagnosticValue(role){
  if(!this.available(role))return '—';const raw=this.val(role);if(PROFILE[role]?.u)return this.value(role);
  if(['useRoomSensor','defrost','sgA','sgB'].includes(role)){const on=ncBinary(raw);if(on==null)return ncNumber(raw)!=null?'Statuscode '+raw:String(raw);return role==='defrost'?(on?'Abtauung aktiv':'Keine Abtauung'):role.startsWith('sg')?(on?'Geschlossen':'Offen'):(on?'Ein':'Aus');}
  if(role==='priority'&&this.activeProfile?.priorityCodes!==false){const label={idle:'Keine Wärmeanforderung',water:'Warmwasserpriorität',heat:'Heizpriorität',pool:'Poolpriorität',cooling:'Kühlpriorität'}[ncPriority(raw)];if(label)return label;}
  if(role==='alarm')return ncNumber(raw)===0?'Kein Alarm':'Alarm '+raw;
  return ncNumber(raw)!=null?'Statuscode '+raw:String(raw);
 }
 diagnosticDetail(role){
  const id=this.mapping?.[role];if(!id)return 'Nicht zugeordnet. Eine passende Entity in Einstellungen wählen.';
  if(this.meta?.[role]?.disabled_by)return `${id} · In Home Assistant deaktiviert. Einstellungen → Geräte & Dienste → NIBE Heat Pump → Gerät → Entitäten → aktivieren.`;
  if(!this.available(role))return `${id} · Liefert keinen nutzbaren Wert. Integration und Zuordnung prüfen.`;
  if(role==='roomSetpoint')return `${id} · Lokaler Registerwert, kein bestätigter MyUplink-Sollwert.`;
  if(role==='sgMode'&&ncNumber(this.val(role))!=null)return `${id} · Code für dieses Profil nicht sicher dokumentiert. SG-Eingänge A/B nutzen, sofern vorhanden.`;
  return id;
 }
 openSettings(role){
  this.selectPlant('heatpump');this.shadowRoot.querySelector('[data-tab="setup"]')?.click();if(role){const input=this.shadowRoot.getElementById('map-'+role),group=input?.closest('details');if(group){group.open=true;this.fillMappingSelect(role);}const mode=this.shadowRoot.getElementById('mode-'+role);mode?.focus();mode?.scrollIntoView({block:'center',behavior:'auto'});}
 }
 diagnostics(){
  const rows=Object.entries(PROFILE).filter(([r,p])=>p.diag&&!r.startsWith('ventilation')).map(([r,p])=>`<div class="diagnostic-row"><span>${esc(p.l)}${p.t?' · '+esc(p.t):''}</span><b data-diagnostic="${r}"></b><small data-quality="${r}"></small><details class="diagnostic-help"><summary>Quelle und Hilfe</summary><p data-diagnostic-detail="${r}"></p><button type="button" data-map-role="${r}">Zuordnung prüfen</button></details></div>`).join('');
  return `<section class="panel"><div class="title"><div><small>NUR ANZEIGE</small><h2>Technische Diagnose</h2></div></div><div class="diagnostic-list">${rows}</div><details class="technical-details"><summary>Ungeklärte Zuordnungen</summary><p class="hint">GP1: Register 31103/31637 benötigt einen Livevergleich. Der lokale Raum-Sollwert ist kein bestätigter MyUplink-Sollwert. Unbekannte Statuscodes bleiben Rohwerte.</p></details></section>`;
 }
 ventilation(){
  return `<style>.filter-settings{margin-top:14px;border-top:1px solid var(--nc-line);padding-top:12px}.filter-settings summary{cursor:pointer;min-height:44px;padding:10px 0;font-weight:600}.filter-settings summary:hover{color:var(--nc-teal)}.filter-settings form{display:grid;gap:8px;max-width:440px}.filter-settings label{font-size:.8rem;margin-top:8px}.filter-settings input{min-height:44px;width:100%;padding:9px;border:1px solid var(--nc-line);border-radius:10px;background:var(--card-background-color);color:var(--primary-text-color)}.filter-settings p{font-size:.75rem;line-height:1.5}.filter-settings input[aria-invalid=true]{border-color:var(--error-color)}#filter-settings-error{color:var(--error-color)}</style><section class="panel ventilation-panel" aria-label="Lüftung"><div class="vent-heading"><div><small>LÜFTUNG</small><h3>${esc(this.ventilationModel())}</h3></div><span data-vent-operation></span></div>
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
  this.shadowRoot.querySelectorAll('.tab').forEach(el=>el.hidden=plant!=='heatpump');this.applyVisibility();
 }
 bind(){
  this.bindMaintenance();
  this.bindSetup();
  const settingsButton=this.shadowRoot.querySelector('[data-open-settings]');if(settingsButton)settingsButton.onclick=()=>this.openSettings();
  this.shadowRoot.querySelectorAll('[data-map-role]').forEach(button=>button.onclick=()=>this.openSettings(button.dataset.mapRole));
  const exportButton=this.shadowRoot.getElementById('history-export');if(exportButton)exportButton.onclick=()=>this.exportHistory();
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
  this.paintVentilation();this.applyVisibility();
  this.shadowRoot.querySelectorAll('[data-entity]').forEach(el=>el.textContent=this.mapping[el.dataset.entity]||'Keine eindeutige Zuordnung');
  this.shadowRoot.querySelectorAll('[data-candidates]').forEach(el=>{const role=el.dataset.candidates;el.textContent=this.discovery?.ambiguous?.includes(role)?(this.registry||[]).filter(row=>row.config_entry_id===this.discovery.selected&&reg(row.unique_id)===this.activeProfile?.roles[role]?.register).map(row=>row.entity_id).join(' · '):'';});
  this.shadowRoot.querySelectorAll('[data-check]').forEach(el=>el.textContent=this.dataState(el.dataset.check));
  const recommended=Object.entries(PROFILE).filter(([,p])=>p.req),ready=recommended.filter(([r])=>this.available(r)).length;
  const score=this.shadowRoot.querySelector('.score');if(score)score.textContent=ready+'/'+recommended.length;
  const setupScore=this.shadowRoot.querySelector('[data-setup-score]');if(setupScore)setupScore.textContent=ready+' von '+recommended.length+' empfohlenen Datenpunkten verfügbar.';

  for(const [id,role,optionKey] of [['hw-mode','waterHeater','operation_list'],['evcc-mode','evccMode','options']]){const el=this.shadowRoot.getElementById?.(id);if(el&&!this.controlPending?.[role]){const options=this.st(role)?.attributes?.[optionKey]||[];const signature=JSON.stringify(options);if(el.dataset&&el.dataset.options!==signature){el.replaceChildren(...options.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=role==='evccMode'?ncEvccMode(value):String(value);return option;}));el.dataset.options=signature;}el.disabled=this._hass.connected===false||!this.available(role)||!options.length;if(this.available(role))el.value=this.val(role);}}
  const waterHelp=this.shadowRoot.querySelector('[data-water-control-help]');if(waterHelp)waterHelp.textContent=this.st('waterHeater')?.attributes?.operation_list?.length?'Nur die von Home Assistant angebotenen Modi sind bedienbar.':'Kein schaltbarer Warmwassermodus verfügbar.';
  this.shadowRoot.querySelectorAll('[data-diagnostic]').forEach(el=>el.textContent=this.diagnosticValue(el.dataset.diagnostic));this.shadowRoot.querySelectorAll('[data-diagnostic-detail]').forEach(el=>el.textContent=this.diagnosticDetail(el.dataset.diagnosticDetail));
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
  if(note)note.textContent=this.activeProfile?.priorityCodes===false?'Individuelles Profil: Betriebspriorität wird technisch angezeigt; Heiz-/Warmwasserzweige werden nicht aus ungeprüften Codes abgeleitet.':operation.kind==='unknown'?'Für die sichere Unterscheidung von Heizung und Warmwasser wird die Betriebspriorität 31029 benötigt.':'Betriebsart aus NIBE-Priorität 31029 · Aktivität aus Verdichter / Zusatzheizung.';
  const sg=ncSg(this.stateValues());
  this.shadowRoot.querySelectorAll('[data-sg]').forEach(el=>el.textContent=sg.label);
  this.shadowRoot.querySelectorAll('[data-sg-detail]').forEach(el=>el.textContent=sg.detail);
  this.shadowRoot.querySelector('.energy-node.sg')?.classList.toggle('is-active',sg.tone==='boost');
  this.shadowRoot.querySelectorAll('[data-contact]').forEach(el=>{const value=ncBinary(this.val(el.dataset.contact));el.textContent=value==null?'Nicht verfügbar':value?'Geschlossen':'Offen';});
  const request=ncBinary(this.val('evccCharging')), enabled=ncBinary(this.val('evccEnabled'));
  const explanation=this.shadowRoot.querySelector('[data-energy-explanation]');
  if(explanation)explanation.textContent=enabled==null?'EVCC ist nicht verfügbar. NIBE und SG Ready werden unabhängig davon angezeigt.':request===true?`EVCC fordert Wärme an. NIBE: ${operation.label}.`:request==null?'EVCC-Anforderung ist nicht verfügbar.':'Keine EVCC-Anforderung. NIBE regelt Heizung und Warmwasser selbstständig.';
 }
 async exportHistory(){
  if(this.exportPending)return false;const button=this.shadowRoot.getElementById('history-export'),feedback=this.shadowRoot.querySelector('[data-export-feedback]'),tell=text=>{if(feedback)feedback.textContent=text;};
  if(this._hass.connected===false){tell('Home Assistant getrennt. Nach Wiederverbindung erneut exportieren.');return false;}
  const mapping={...this.mapping},hours=this.historyHours||24,timeZone=this._hass.config?.time_zone||'Europe/Berlin',end=Date.now(),start=end-hours*3600000;
  const roles=Object.entries(PROFILE).filter(([role,spec])=>spec.u&&mapping[role]&&this.st(role)&&!this.meta?.[role]?.disabled_by).map(([role])=>role);
  if(!roles.length){tell('Keine zugeordneten numerischen Historien-Entitäten vorhanden.');return false;}
  this.exportPending=true;if(button){button.disabled=true;button.setAttribute?.('aria-busy','true');button.innerHTML='<ha-icon icon="mdi:file-excel-outline" aria-hidden="true"></ha-icon><span>Export…</span>';}tell(`${hours} Stunden werden aus dem Recorder gelesen …`);
  try{
   const result=await this._hass.callWS({type:'history/history_during_period',start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),entity_ids:[...new Set(roles.map(role=>mapping[role]))],include_start_time_state:true,minimal_response:false,no_attributes:false,significant_changes_only:false});
   if(JSON.stringify(mapping)!==JSON.stringify(this.mapping)||hours!==(this.historyHours||24)){tell('Zuordnung oder Zeitraum geändert. Bitte Export erneut starten.');return false;}
   const data=this.normalizeHistory(result),series=roles.map(role=>{let rows=data[mapping[role]]||[];if(role==='room'&&mapping[role].startsWith('climate.')){rows=rows.map(row=>({...row,state:row.attributes?.current_temperature??'unknown'}));if(this._hass.config?.unit_system?.temperature==='°F')rows=rows.map(row=>({...row,state:ncNumber(row.state)==null?'unknown':(Number(row.state)-32)*5/9}));}else rows=this.convertHistory(role,rows);
    const events=rows.map(row=>{const raw=row.lu??row.last_updated??row.lc??row.last_changed;return {time:typeof raw==='number'?(raw<1e12?raw*1000:raw):Date.parse(raw),value:ncNumber(row.s??row.state)};}).filter(p=>Number.isFinite(p.time)).sort((a,b)=>a.time-b.time);
    return {label:role==='room'?'Raumtemperatur':PROFILE[role].l,unit:this.unit(role),entity:mapping[role],events,points:ncHistoryPoints(rows,start,end,{sample:false})};});
   if(!series.some(s=>s.points.some(p=>p.value!=null))){tell('Keine numerischen Recorderwerte für diesen Zeitraum. Recorder und Entity-Zuordnung prüfen.');return false;}
   const sheets=ncExportTables(series,start,end,timeZone,[['NIBE Control',VERSION],['Geräteprofil',this.activeProfile?.model||'NIBE'],['Umfang','Zugeordnete numerische Temperaturen, Leistungen, Frequenzen, Volumenstrom, Gradminuten und Ventilatorprozente. Statuscodes sind keine Messgrößen.']]);
   const bytes=ncWorkbook(sheets);this.downloadHistoryFile(bytes,`nibe-control-${hours}h-${new Date(end).toISOString().replace(/[:.]/g,'-')}.xlsx`);tell(`Excel-Download gestartet · ${hours} Stunden · ${sheets[0].rows.length-1} Zeitpunkte. Leere Zellen bedeuten fehlende Werte, keine Nullwerte.`);return true;
  }catch(e){tell(`Export nicht erstellt. ${e?.message?.startsWith('Mehr als')||e?.message?.startsWith('Zu viele')?e.message:'Recorderzugriff und Verbindung prüfen; dann erneut versuchen.'}`);return false;}
  finally{this.exportPending=false;if(button){button.disabled=false;button.setAttribute?.('aria-busy','false');button.innerHTML='<ha-icon icon="mdi:file-excel-outline" aria-hidden="true"></ha-icon><span>Excel</span>';}}
 }
 downloadHistoryFile(bytes,filename){
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.style.display='none';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
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
  const host=this.shadowRoot.getElementById(`plot-${key}`),window=this.historyWindow;if(!host)return;
  const found=series.map(([r,c])=>({r,c,points:ncHistoryPoints(this.convertHistory(r,data[this.mapping[r]]||[]),window.start,window.end),raw:ncHistoryPoints(this.convertHistory(r,data[this.mapping[r]]||[]),window.start,window.end,{sample:false})}));
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
 compactStyles(){return `.settings-gear{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border:1px solid var(--nc-line);border-radius:12px;background:transparent;color:var(--secondary-text-color);cursor:pointer}.settings-gear:hover{background:var(--nc-card);color:var(--primary-text-color)}.settings-gear ha-icon{--mdc-icon-size:22px}.mapping-field select{width:100%;min-height:44px;margin-top:6px}.mapping-field select:disabled{opacity:.55;cursor:default}.mapping-field .entity-label{margin-top:10px;font-size:.75rem;font-weight:400}.diagnostic-help{grid-column:1/-1;font-size:.75rem;overflow-wrap:anywhere}.diagnostic-help p{line-height:1.5;margin:0 0 8px}.diagnostic-help button,#history-export{min-height:44px;border:1px solid var(--nc-line);border-radius:10px;padding:8px 12px;color:var(--primary-text-color);background:var(--card-background-color);cursor:pointer}.history-tools{display:grid;grid-template-columns:minmax(0,1fr) 94px;align-items:end;gap:10px}.history-tools .mode-control{display:grid;gap:6px;margin:0;min-width:0}.history-tools .mode-control select{width:100%;min-width:0;min-height:44px;height:44px;box-sizing:border-box;margin:0}#history-export{display:flex;align-items:center;gap:6px;width:94px;min-width:0;min-height:44px;height:44px;box-sizing:border-box;justify-content:center;align-self:end;padding:0 9px;background:transparent;color:var(--secondary-text-color);font-size:.75rem;white-space:nowrap}#history-export ha-icon{--mdc-icon-size:18px}#history-export:hover:enabled{color:var(--primary-text-color)}[data-export-feedback]:empty{display:none}#history-export:disabled{opacity:.55;cursor:wait}#history-export:hover:enabled,.diagnostic-help button:hover{background:var(--nc-card)}.diagnostic-help summary{min-height:44px}.settings-gear:focus-visible,#history-export:focus-visible,.diagnostic-help button:focus-visible{outline:3px solid var(--nc-focus);outline-offset:2px}
.setup fieldset{border:0;border-top:1px solid var(--nc-line);margin:16px 0;padding:16px 0;min-width:0}.setup legend{font-weight:650;padding-right:12px}.setup fieldset>label{display:block;margin-top:12px;font-size:.85rem}.setup select,.mapping-field input:not([type=checkbox]){display:block;width:100%;box-sizing:border-box;min-height:44px;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--nc-line);border-radius:10px;padding:10px;margin-top:6px}.setup small{display:block;overflow-wrap:anywhere;color:var(--secondary-text-color);font-size:.72rem;line-height:1.5}.mapping-field{padding:12px 0;border-top:1px solid var(--nc-line)}.mapping-field>label{display:block;font-size:.85rem;font-weight:600}.mapping-field .exclude{display:flex;align-items:center;gap:8px;min-height:44px;font-weight:400;font-size:.75rem}.mapping-field input[aria-invalid=true]{border-color:var(--error-color)}.setup button,[data-open-settings]{min-height:44px;border:1px solid var(--nc-line);border-radius:10px;padding:10px 14px;background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer}.setup button:disabled{cursor:wait;opacity:.65}.setup [data-setup-feedback]{min-height:44px}.plant-choices:has([data-plant=ventilation][hidden]){grid-template-columns:1fr}.setup input:focus-visible,.setup select:focus-visible,[data-open-settings]:focus-visible{outline:3px solid var(--nc-focus);outline-offset:2px}

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
 static async generate(config){return {title:config.title||"NIBE Control",views:[{title:"Anlage",path:"anlage",icon:"mdi:heat-pump-outline",type:"panel",cards:[{type:"custom:nibe-control-card",profile:config.profile||'auto',visibility:config.visibility||{},setup_complete:config.setup_complete||false,mappings:config.mappings||{},ventilation:config.ventilation||{},config_entry_id:config.config_entry_id||null}]}]};}
}

if(!customElements.get("nibe-control-card")) customElements.define("nibe-control-card",NibeControlCard);
if(!customElements.get("ll-strategy-dashboard-nibe-control")) customElements.define("ll-strategy-dashboard-nibe-control",NibeControlStrategy);
window.customStrategies=window.customStrategies||[];
if(!window.customStrategies.some(x=>x.type==="nibe-control")) window.customStrategies.push({type:"nibe-control",strategyType:"dashboard",name:"NIBE Control",description:"Dynamisches Technik-Dashboard für NIBE S-Serie",documentationURL:"https://github.com/Soul7495/NIBE-Control"});
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==="nibe-control-card")) window.customCards.push({type:"nibe-control-card",name:"NIBE Control",description:"NIBE S-Serie Anlagenübersicht"});
