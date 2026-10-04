/* NIBE Control 0.4.0 — local Home Assistant dashboard */
const VERSION = "0.4.0";
const PROFILE = {
 outdoor:{r:"30002",e:"sensor.current_outdoor_temperature_bt1_30002",l:"Außen",t:"BT1",u:"°C"},
 room:{e:"climate.vvms320_climate_system_s1",a:"current_temperature",l:"Innen",u:"°C"},
 roomSetpoint:{r:"40207",e:"number.room_sensor_set_point_value_climate_system_1_40207",l:"Raum-Sollwert (Register)",u:"°C",diag:1},
 useRoomSensor:{r:"40203",e:"switch.use_room_sensor_climate_system_1_40203",l:"Raumfühlerregelung",diag:1},
 supply:{r:"30006",e:"sensor.supply_line_bt2_30006",l:"Vorlauf",t:"BT2",u:"°C"},
 return:{r:"30008",e:"sensor.return_line_bt3_30008",l:"Rücklauf",t:"BT3",u:"°C"},
 supplyTarget:{r:"31018",e:"sensor.calculated_supply_climate_system_1_31018",l:"Vorlauf Soll",u:"°C",req:1},
 degreeMinutes:{r:"40012",e:"number.degree_minutes_40012",l:"Gradminuten",u:"DM",req:1},
 flow:{r:"30041",e:"sensor.flow_sensor_bf1_30041",l:"Volumenstrom",t:"BF1",u:"L/min",req:1},
 hpSupply:{r:"31479",e:"sensor.condenser_sensor_supply_line_eb101_bt12_31479",l:"WP-Vorlauf",t:"BT12",u:"°C",req:1},
 hpReturn:{r:"31476",e:"sensor.return_line_eb101_bt3_31476",l:"WP-Rücklauf",t:"BT3",u:"°C",diag:1},
 compressorHz:{r:"31804",e:"sensor.current_compressor_frequency_eb101_31804",l:"Verdichter Ist",u:"Hz",req:1},
 requestedHz:{r:"31855",e:"sensor.requested_compressor_frequency_eb101_31855",l:"Verdichter Soll",u:"Hz",diag:1},
 compressorStatus:{r:"31485",e:"sensor.compressor_status_eb101_31485",l:"Verdichterstatus"},
 electrical:{r:"32306",e:"sensor.energy_log_current_power_consumption_32306",l:"Elektrische Leistung",u:"kW",req:1},
 outdoorPower:{r:"31807",e:"sensor.power_eb101_ep14_31807",l:"Außeneinheit",u:"kW",diag:1},
 thermal:{r:"30407",e:"sensor.generated_power_heating_eb101_30407",l:"Heizleistung",u:"kW",diag:1},
 additionalHeat:{r:"31028",e:"sensor.power_internal_additional_heat_31028",l:"Heizstab",u:"kW",req:1},
 hotWaterTop:{r:"30009",e:"sensor.hot_water_top_bt7_30009",l:"Warmwasser oben",t:"BT7",u:"°C"},
 hotWaterCharge:{r:"30010",e:"sensor.hot_water_charging_bt6_30010",l:"Warmwasser Laden",t:"BT6",u:"°C"},
 hotWaterMode:{r:"31039",e:"sensor.current_hot_water_mode_without_spa_sc_31039",l:"Warmwassermodus",req:1},
 moreHotWater:{r:"31079",e:"sensor.more_hot_water_status_31079",l:"Mehr Warmwasser",req:1},
 diverter:{r:"32197",e:"sensor.diverter_valve_hot_water_qn10_32197",l:"Umschaltventil",diag:1},
 sgMode:{r:"31912",e:"sensor.operating_mode_sg_ready_31912",l:"SG Ready",req:1},
 sgA:{r:"31913",e:"sensor.sg_ready_input_a_31913",l:"SG Eingang A",diag:1},
 sgB:{r:"31914",e:"sensor.sg_ready_input_b_31914",l:"SG Eingang B",diag:1},
 defrost:{r:"31806",e:"sensor.defrosting_eb101_31806",l:"Abtauung",req:1},
 alarm:{r:"31976",e:"sensor.alarm_number_31976",l:"Alarmnummer"},
 climate:{e:"climate.vvms320_climate_system_s1",l:"Heizkreis"},
 waterHeater:{e:"water_heater.vvms320_hot_water",l:"Warmwasser"},
 evccEnabled:{e:"binary_sensor.evcc_nibe_enabled",l:"EVCC NIBE",optional:1},
 evccCharging:{e:"binary_sensor.evcc_nibe_charging",l:"EVCC-Anforderung",optional:1},
 evccAction:{e:"sensor.evcc_nibe_pv_action",l:"PV-Aktion",optional:1},
 evccActionValue:{e:"sensor.evcc_nibe_pv_action_value",l:"Anhebung",optional:1},
 evccMode:{e:"select.evcc_nibe_mode",l:"EVCC-Modus",optional:1}
};
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
 if(role==="sgMode") return ({"0":"Normalbetrieb","1":"Sperre","2":"Normalbetrieb","3":"Überschuss","4":"Max. Überschuss"})[s] || `Modus ${raw}`;
 return String(raw ?? "—");
}

class NibeControlCard extends HTMLElement {
 setConfig(config){ this.config=config||{}; this.attachShadow({mode:"open"}); }
 set hass(hass){ const first=!this._hass; this._hass=hass; if(first) this.init(); else this.paintValues(); }
 async init(){
  try {
   const [entities,devices]=await Promise.all([
    this._hass.callWS({type:"config/entity_registry/list"}),
    this._hass.callWS({type:"config/device_registry/list"})
   ]);
   this.registry=entities; this.devices=devices;
   const byReg=new Map(entities.map(x=>[reg(x.unique_id),x]).filter(x=>x[0]));
   this.mapping={}; this.meta={};
   for(const [role,spec] of Object.entries(PROFILE)){
    const entityId=this.config?.mappings?.[role] || byReg.get(spec.r)?.entity_id || spec.e;
    this.mapping[role]=entityId; this.meta[role]=entities.find(x=>x.entity_id===entityId);
   }
  } catch(e){ this.mapping=Object.fromEntries(Object.entries(PROFILE).map(([k,v])=>[k,v.e])); this.meta={}; }
  this.render(); this.loadHistory();
 }
 st(role){return this._hass.states[this.mapping?.[role]];}
 val(role){const s=this.st(role), a=PROFILE[role]?.a; return a ? s?.attributes?.[a] : s?.state;}
 available(role){return valid(this.st(role));}
 unit(role){return this.st(role)?.attributes?.unit_of_measurement || PROFILE[role]?.u || "";}
 value(role,d=1){return this.available(role)?`${fmt(this.val(role),d)}${this.unit(role)?` ${esc(this.unit(role))}`:""}`:"—";}
 live(role,d=1){return `<span data-role="${role}" data-digits="${d}">${this.value(role,d)}</span>`;}
 operating(){
  if(this.available("alarm") && String(this.val("alarm"))!=="0") return ["alarm","Störung erkannt"];
  if(yes(this.val("defrost"))) return ["defrost","Abtauung"];
  if((Number(this.val("compressorHz"))||0)>0) return ["running","Verdichter läuft"];
  return ["idle","Bereit"];
 }
 render(){
  const [mode,label]=this.operating();
  this.shadowRoot.innerHTML=`<style>${this.styles()}</style><style>${this.responsiveStyles()}</style><main class="app ${mode}">
   <header><div><div class="eyebrow">NIBE CONTROL · V${VERSION}</div><h1>VVM S320</h1><p class="sub">Wärmepumpe · EB101</p></div><div class="status"><i></i><span>${label}</span></div></header>
   ${this.hero()}
   <nav aria-label="Dashboardbereiche"><button class="active" data-tab="overview">Übersicht</button><button data-tab="charts">Verläufe</button><button data-tab="setup">Datencheck</button><button data-tab="diag">Diagnose</button></nav>
   <section id="overview" class="tab active">${this.overview()}</section>
   <section id="charts" class="tab">${this.charts()}</section>
   <section id="setup" class="tab">${this.setup()}</section>
   <section id="diag" class="tab">${this.diagnostics()}</section>
  </main>`;
  this.bind();
 }
 hero(){
  const active=(Number(this.val("compressorHz"))||0)>0;
  return `<section class="plant">
   <div class="ambient">${this.live("outdoor")}<small>Außen · BT1</small></div>
   <div class="machine ${active?"active":""}"><div class="fan"><b></b></div><strong>${this.live("compressorHz",0)}</strong><small>Verdichter</small></div>
   <div class="pipe hot"><span></span></div><div class="pipe cold"><span></span></div>
   <div class="hub"><div class="nibe">NIBE</div><small>System</small></div>
   <div class="branch heat"><b>Heizkreis</b>${this.live("supply")}<small>Vorlauf · BT2</small></div>
   <div class="branch water"><b>Warmwasser</b>${this.live("hotWaterTop")}<small>Speicher oben · BT7</small></div>
  </section>`;
 }
 metric(role){const p=PROFILE[role]; return `<article class="metric"><div><small>${esc(p.l)}${p.t?` · ${p.t}`:""}</small><strong>${this.live(role)}</strong></div>${this.available(role)?"":`<em>${this.meta?.[role]?.disabled_by?"deaktiviert":"nicht verfügbar"}</em>`}</article>`;}
 overview(){
  const sg=this.available("sgMode")?statusLabel("sgMode",this.val("sgMode")):"Nicht verfügbar";
  const wh=this.st("waterHeater"), ops=wh?.attributes?.operation_list||[];
  const evccPresent=["evccEnabled","evccCharging","evccAction","evccMode"].some(r=>this.st(r));
  const evccEnabled=yes(this.val("evccEnabled")), evccRequest=yes(this.val("evccCharging"));
  return `<div class="overview-grid">
   <section class="panel climate-panel"><div class="title"><div><small>RAUMKLIMA</small><h2>${this.live("room")}</h2></div><ha-icon icon="mdi:home-thermometer-outline"></ha-icon></div><div class="quiet-row"><span>Außen</span><b>${this.live("outdoor")}</b></div><p class="hint">Gemessene Raumtemperatur. Der MyUplink-Sollwert wird lokal nicht bereitgestellt.</p></section>
   <section class="panel water-panel"><div class="title"><div><small>WARMWASSER</small><h2>${this.live("hotWaterTop")}</h2></div><ha-icon icon="mdi:water-boiler"></ha-icon></div><div class="pair"><span>Ladefühler · BT6 <b>${this.live("hotWaterCharge")}</b></span><span>Betrieb <b>${esc(wh?.state||"—")}</b></span></div>${ops.length?`<label class="mode-control" for="hw-mode">Warmwassermodus<select id="hw-mode">${ops.map(o=>`<option ${o===wh.state?"selected":""}>${esc(o)}</option>`).join("")}</select></label>`:`<p class="hint">Kein schaltbarer Warmwassermodus verfügbar.</p>`}</section>
   <section class="panel energy-board"><div class="energy-head"><div><small>ENERGIE · PV-OPTIMIERUNG</small><h2>${this.live("electrical")}</h2><p>Elektrische Leistung</p></div><ha-icon icon="mdi:solar-power-variant-outline"></ha-icon></div>
    <div class="energy-flow">
     <article class="energy-node ${evccEnabled?"is-active":""}"><ha-icon icon="mdi:solar-power"></ha-icon><span>PV-Optimierung</span><b data-state="evccEnabled">${evccEnabled?"Aktiv":"Inaktiv"}</b></article>
     <i aria-hidden="true"></i>
     <article class="energy-node ${evccRequest?"is-active":""}"><ha-icon icon="mdi:heat-pump-outline"></ha-icon><span>EVCC-Anforderung</span><b data-state="evccCharging">${evccRequest?"Aktiv":"Keine"}</b></article>
     <i aria-hidden="true"></i>
     <article class="energy-node sg"><ha-icon icon="mdi:transmission-tower-import"></ha-icon><span>SG Ready</span><b data-status="sgMode">${esc(sg)}</b></article>
    </div>
    <div class="energy-facts">${evccPresent?`<span>PV-Aktion<b data-raw="evccAction">${esc(this.val("evccAction")||"—")}</b></span><span>Anhebung<b>${this.live("evccActionValue")}</b></span><span>EVCC-Modus<b data-raw="evccMode">${esc(this.val("evccMode")||"—")}</b></span>`:`<span class="wide">EVCC<b>Nicht erkannt</b></span>`}<span>Heizstab<b>${this.live("additionalHeat")}</b></span></div>${this.evccControl()}
   </section>
  </div><div class="metric-row">${["supplyTarget","supply","return","hpSupply","degreeMinutes","flow"].map(r=>this.metric(r)).join("")}</div>`;
 }
 evccControl(){const s=this.st("evccMode"),options=s?.attributes?.options||[];if(!s||!options.length)return "";return `<label class="mode-control" for="evcc-mode">EVCC-Modus<select id="evcc-mode">${options.map(o=>`<option ${o===s.state?"selected":""}>${esc(o)}</option>`).join("")}</select></label>`;}
 charts(){return `<div class="chart-grid">${["heating","power","water"].map(k=>`<section class="panel chart"><div class="chart-head"><div><small>24 STUNDEN</small><h3>${k==="heating"?"Heizkreis":k==="power"?"Verdichter & Energie":"Warmwasser"}</h3></div><span class="legend"></span></div><div class="plot" id="plot-${k}"><div class="loader">Historie wird geladen …</div></div></section>`).join("")}</div>`;}
 setup(){
  const rows=Object.entries(PROFILE).filter(([,p])=>p.req).map(([r,p])=>{const m=this.meta?.[r], s=this.st(r), state=valid(s)?"ok":m?.disabled_by?"disabled":"missing"; return `<li><i class="${state}"></i><span><b>${esc(p.l)}</b><small>${esc(this.mapping[r]||"")}</small></span><em>${state==="ok"?"Verfügbar":state==="disabled"?"Deaktiviert":"Fehlt"}</em></li>`}).join("");
  return `<section class="panel setup"><div class="title"><div><small>ENTITY DISCOVERY</small><h2>Datencheck</h2></div><span class="score">${Object.keys(PROFILE).filter(r=>this.available(r)).length}/${Object.keys(PROFILE).length}</span></div><p>Für das vollständige Dashboard müssen nur die unten aufgeführten empfohlenen Entitäten aktiviert werden. NIBE Control aktiviert nichts selbst.</p><ul>${rows}</ul><aside><b>So aktivierst du einen Wert:</b> Einstellungen → Geräte & Dienste → NIBE Heat Pump → Gerät → Entitäten. Dort „deaktivierte Entitäten anzeigen“ und die gewünschte Entity öffnen.</aside></section>`;
 }
 diagnostics(){return `<section class="panel"><div class="title"><div><small>READ ONLY</small><h2>Technische Diagnose</h2></div><ha-icon icon="mdi:stethoscope"></ha-icon></div><div class="diag-grid">${Object.entries(PROFILE).filter(([,p])=>p.diag).map(([r])=>this.metric(r)).join("")}</div><p class="hint">Unbekannte Statuscodes werden bewusst nicht interpretiert. GP1 bleibt wegen der Register 31103/31637 bis zum Livevergleich ungemappt.</p></section>`;}
 bind(){
  this.shadowRoot.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{this.shadowRoot.querySelectorAll("nav button,.tab").forEach(x=>x.classList.remove("active")); b.classList.add("active"); this.shadowRoot.getElementById(b.dataset.tab).classList.add("active");});
  const select=this.shadowRoot.getElementById("hw-mode"); if(select) select.onchange=e=>this._hass.callService("water_heater","set_operation_mode",{entity_id:this.mapping.waterHeater,operation_mode:e.target.value});
  const evcc=this.shadowRoot.getElementById("evcc-mode"); if(evcc) evcc.onchange=e=>this._hass.callService("select","select_option",{entity_id:this.mapping.evccMode,option:e.target.value});
 }
 paintValues(){
  if(!this.shadowRoot?.querySelector("main"))return;
  this.shadowRoot.querySelectorAll("[data-role]").forEach(el=>el.textContent=this.value(el.dataset.role,Number(el.dataset.digits??1)));
  this.shadowRoot.querySelectorAll("[data-status]").forEach(el=>el.textContent=this.available(el.dataset.status)?statusLabel(el.dataset.status,this.val(el.dataset.status)):"Nicht verfügbar");
  this.shadowRoot.querySelectorAll("[data-state]").forEach(el=>{const role=el.dataset.state,on=yes(this.val(role));el.textContent=role==="evccCharging"?(on?"Aktiv":"Keine"):(on?"Aktiv":"Inaktiv");el.closest(".energy-node")?.classList.toggle("is-active",on);});
  this.shadowRoot.querySelectorAll("[data-raw]").forEach(el=>el.textContent=String(this.val(el.dataset.raw)||"—"));
 }
 async loadHistory(){
  const sets={heating:[["outdoor","#78aee8"],["supplyTarget","#e9b15b"],["supply","#ee765f"],["return","#8fc58a"]],power:[["compressorHz","#49b6a1"],["electrical","#e9b15b"]],water:[["hotWaterCharge","#55a8d8"],["hotWaterTop","#ee765f"]]};
  const roles=[...new Set(Object.values(sets).flat().map(x=>x[0]).filter(r=>this.mapping[r]&&this.st(r)))]; if(!roles.length)return;
  const end=new Date(), start=new Date(end-86400000);
  try {const result=await this._hass.callWS({type:"history/history_during_period",start_time:start.toISOString(),end_time:end.toISOString(),entity_ids:roles.map(r=>this.mapping[r]),minimal_response:true,no_attributes:true,significant_changes_only:false});
   const history=this.normalizeHistory(result);
   for(const [key,series] of Object.entries(sets)) this.draw(key,series,history);
  } catch(e){this.shadowRoot.querySelectorAll(".plot").forEach(p=>p.innerHTML='<div class="empty">Keine Historie verfügbar</div>');}
 }
 normalizeHistory(result){if(!Array.isArray(result))return result||{};const mapped={};for(const series of result){if(!Array.isArray(series)||!series.length)continue;const id=series[0]?.entity_id||series[0]?.e;if(id)mapped[id]=series;}return mapped;}
 draw(key,series,data){
  const found=series.map(([r,c])=>[r,c,data[this.mapping[r]]||[]]).filter(x=>x[2].length); const host=this.shadowRoot.getElementById(`plot-${key}`); if(!found.length){host.innerHTML='<div class="empty">Noch keine historischen Daten</div>';return;}
  const pointValue=p=>Number(p.s??p.state);const nums=found.flatMap(x=>x[2].map(pointValue).filter(Number.isFinite)), min=Math.min(...nums), max=Math.max(...nums), span=max-min||1;
  const lines=found.map(([r,c,pts])=>{const usable=pts.filter(p=>Number.isFinite(pointValue(p)));const sample=usable.filter((_,i)=>i%Math.max(1,Math.ceil(usable.length/120))===0); const d=sample.map((p,i)=>`${i?"L":"M"}${(i/(sample.length-1||1)*100).toFixed(2)},${(44-(pointValue(p)-min)/span*38).toFixed(2)}`).join(" ");return `<path d="${d}" stroke="${c}"/><span style="--c:${c}">${esc(PROFILE[r].l)}</span>`}).join("");
  host.innerHTML=`<svg viewBox="0 0 100 48" preserveAspectRatio="none"><g class="gridlines"><path d="M0 6H100M0 25H100M0 44H100"/></g>${lines}</svg><div class="axis"><span>vor 24 h</span><span>jetzt</span></div>`;
 }
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
 @media(max-width:760px){
  .app{padding:10px 10px 28px}header{margin-bottom:12px}.overview-grid{grid-template-columns:1fr}.energy-board{grid-column:auto}.climate-panel,.water-panel,.energy-board{min-height:auto}
  .plant{grid-template-columns:1fr 86px 86px;grid-template-rows:72px 72px;min-height:168px;padding:11px}.branch{display:none}.pipe{left:42%;right:23%}.ambient span{font-size:1.35rem}.nibe{width:62px;height:62px;border-radius:16px}.fan{width:36px;height:36px}.machine{border-radius:15px}
  nav{position:sticky;top:0;z-index:5;width:100%;margin:12px 0 10px;justify-content:space-between;box-shadow:0 6px 18px color-mix(in srgb,#000 10%,transparent)}nav button{flex:1;padding-inline:9px;font-size:.75rem}
  .metric-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.metric{padding:10px}.metric strong{font-size:.92rem}.energy-flow{grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr) 14px minmax(0,1fr)}.energy-node{padding:9px 7px}.energy-node span{font-size:.59rem}.energy-node b{font-size:.7rem}.energy-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.energy-facts .wide{grid-column:1/-1}
  .chart-grid{grid-template-columns:1fr}.chart:first-child{grid-row:auto}.diag-grid{grid-template-columns:repeat(2,1fr)}
 }
 @media(max-width:430px){
  h1{font-size:1.55rem}.eyebrow{font-size:.6rem}.status{padding:8px}.status span{display:none}.plant{grid-template-columns:1fr 80px 74px}.ambient small,.machine small,.hub small{font-size:.62rem}.machine strong{font-size:1rem}.energy-flow>i{display:none}.energy-flow{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.energy-node{border-radius:11px}.energy-node ha-icon{margin-bottom:6px}.pair{grid-template-columns:1fr 1fr}.mode-control{align-items:flex-start;flex-direction:column}.mode-control select{width:100%}.setup li{grid-template-columns:10px 1fr}.setup li em{display:none}
 }
 @media(min-width:700px) and (max-height:760px){
  .app{padding-top:10px}header{margin-bottom:9px}.plant{min-height:154px;grid-template-rows:62px 62px;padding:12px}.nibe{width:58px;height:58px;border-radius:15px}.fan{width:34px;height:34px}.machine strong{font-size:1.05rem}nav{margin:10px 0}.panel{padding:14px}.climate-panel,.water-panel,.energy-board{min-height:196px}.metric{padding:9px}.plot{min-height:145px}.plot svg{height:120px}
 }
 `;}
 styles(){return `:host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif);--nc-teal:#287f75;--nc-blue:#3c7d9d;--nc-warm:#dc704e;--nc-line:color-mix(in srgb,var(--primary-text-color) 12%,transparent);--nc-card:color-mix(in srgb,var(--card-background-color) 94%,var(--primary-color) 6%)}*{box-sizing:border-box}button,select,input{font:inherit}.app{max-width:1460px;margin:auto;padding:20px 24px 48px;scrollbar-color:var(--scrollbar-thumb-color,#7b858b) transparent;scrollbar-width:thin}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}h1,h2,h3,p{margin:0}h1{font-size:clamp(1.7rem,4vw,2.5rem);font-weight:730;letter-spacing:-.04em}.eyebrow,.title small,.chart-head small{font-size:.68rem;letter-spacing:.15em;font-weight:750;color:var(--secondary-text-color)}.sub{color:var(--secondary-text-color);margin-top:3px}.status{display:flex;gap:9px;align-items:center;border:1px solid var(--nc-line);border-radius:999px;padding:9px 13px;background:var(--card-background-color);font-weight:650;font-size:.85rem}.status i{width:9px;height:9px;border-radius:50%;background:#63b889;box-shadow:0 0 0 5px color-mix(in srgb,#63b889 18%,transparent)}.alarm .status i{background:var(--error-color,#db4437)}.plant{position:relative;display:grid;grid-template-columns:1fr 130px 150px 1fr;grid-template-rows:88px 88px;gap:10px;min-height:196px;border:1px solid var(--nc-line);border-radius:22px;padding:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--card-background-color) 96%,var(--nc-teal) 4%),var(--card-background-color));overflow:hidden}.ambient{grid-row:1/3;align-self:center}.ambient span,.branch span{display:block;font-size:1.65rem;font-weight:720;letter-spacing:-.04em}.ambient small,.branch small,.machine small,.hub small{color:var(--secondary-text-color);font-size:.72rem}.machine{grid-row:1/3;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid var(--nc-line);border-radius:18px;background:var(--card-background-color);z-index:2}.machine strong{font-size:1.25rem}.fan{width:45px;height:45px;border:2px solid var(--nc-line);border-radius:50%;display:grid;place-items:center;margin-bottom:6px}.fan b,.fan b:before,.fan b:after{content:"";display:block;width:5px;height:19px;border-radius:10px;background:var(--nc-teal);transform-origin:50% 100%}.fan b:before{transform:rotate(120deg);position:absolute}.fan b:after{transform:rotate(240deg);position:absolute}.machine.active .fan{animation:spin 5s linear infinite}.hub{grid-row:1/3;align-self:center;justify-self:center;text-align:center;z-index:2}.nibe{width:76px;height:76px;border-radius:20px;display:grid;place-items:center;background:var(--nc-teal);color:white;font-weight:800;letter-spacing:.08em;box-shadow:0 12px 28px color-mix(in srgb,var(--nc-teal) 28%,transparent)}.branch{align-self:center;border-left:3px solid;padding-left:14px}.branch.heat{border-color:var(--nc-warm)}.branch.water{border-color:var(--nc-blue)}.pipe{position:absolute;height:3px;left:calc(25% + 60px);right:calc(50% - 40px);top:43%;background:var(--nc-warm);opacity:.55}.pipe.cold{top:61%;background:var(--nc-blue)}.running .pipe span{display:block;width:16px;height:3px;background:white;animation:flow 2s linear infinite}nav{display:flex;gap:5px;margin:18px 0 14px;padding:4px;border-radius:13px;background:color-mix(in srgb,var(--card-background-color) 75%,var(--primary-text-color) 5%);width:max-content;max-width:100%;overflow:auto}nav button{border:0;background:transparent;color:var(--secondary-text-color);padding:9px 14px;border-radius:9px;cursor:pointer;font-weight:650;white-space:nowrap}nav button.active{background:var(--card-background-color);color:var(--primary-text-color);box-shadow:0 2px 8px rgba(0,0,0,.08)}nav button:focus-visible,.target button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid var(--primary-color);outline-offset:2px}.tab{display:none}.tab.active{display:block}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.panel{border:1px solid var(--nc-line);background:var(--card-background-color);border-radius:18px;padding:17px;min-width:0}.title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.title h2{font-size:1.85rem;letter-spacing:-.04em;margin-top:4px}.title ha-icon{color:var(--nc-teal);--mdc-icon-size:27px}.target{margin-top:15px}.target>span{font-size:.78rem;color:var(--secondary-text-color)}.target>div{display:flex;align-items:center;justify-content:space-between;margin:5px 0}.target button{width:40px;height:40px;border:1px solid var(--nc-line);border-radius:12px;background:var(--nc-card);color:var(--primary-text-color);font-size:1.3rem;cursor:pointer}.target output{font-size:1.12rem;font-weight:700}.target input{width:100%;accent-color:var(--nc-teal)}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px}.pair span{font-size:.72rem;color:var(--secondary-text-color)}.pair b{display:block;color:var(--primary-text-color);margin-top:4px;font-size:.85rem}.hint{font-size:.75rem;color:var(--secondary-text-color);margin-top:14px;line-height:1.45}.metric-row{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:10px}.metric{border:1px solid var(--nc-line);background:var(--card-background-color);border-radius:14px;padding:12px;min-width:0}.metric small{color:var(--secondary-text-color);font-size:.68rem}.metric strong{display:block;font-size:1rem;margin-top:5px;white-space:nowrap}.metric em{font-size:.6rem;color:var(--warning-color,#d89521);font-style:normal}.chart-grid{display:grid;grid-template-columns:2fr 1fr;gap:12px}.chart:first-child{grid-row:span 2}.chart-head{display:flex;justify-content:space-between}.chart h3{font-size:1.1rem;margin-top:4px}.plot{min-height:170px;margin-top:10px}.plot svg{width:100%;height:145px;overflow:visible}.plot path{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}.gridlines path{stroke:var(--nc-line);stroke-width:1}.plot span{display:inline-flex;align-items:center;margin-right:13px;font-size:.68rem;color:var(--secondary-text-color)}.plot span:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--c);margin-right:5px}.axis{display:flex;justify-content:space-between}.loader,.empty{min-height:150px;display:grid;place-items:center;color:var(--secondary-text-color);font-size:.8rem}.setup{max-width:900px}.score{font-size:1.45rem;font-weight:750;color:var(--nc-teal)}.setup>p{color:var(--secondary-text-color);margin:13px 0;line-height:1.5}.setup ul{list-style:none;margin:0;padding:0}.setup li{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:11px;padding:10px 0;border-top:1px solid var(--nc-line)}.setup li i{width:9px;height:9px;border-radius:50%}.setup li i.ok{background:#58a778}.setup li i.disabled{background:#d89521}.setup li i.missing{background:#9ba1a4}.setup li span small{display:block;color:var(--secondary-text-color);font-size:.66rem;margin-top:2px;overflow-wrap:anywhere}.setup li em{font-style:normal;font-size:.7rem;color:var(--secondary-text-color)}.setup aside{margin-top:14px;border-radius:12px;padding:13px;background:color-mix(in srgb,var(--primary-color) 9%,transparent);font-size:.78rem;line-height:1.5}.diag-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}@keyframes spin{to{transform:rotate(360deg)}}@keyframes flow{from{transform:translateX(0)}to{transform:translateX(120px)}}@media(prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}@media(max-width:800px){.app{padding:12px 10px 32px}.plant{grid-template-columns:1fr 92px 100px;grid-template-rows:80px 80px;padding:12px}.ambient{grid-column:1}.machine{grid-column:2}.hub{grid-column:3}.branch{display:none}.pipe{left:42%;right:24%}.grid{grid-template-columns:1fr}.metric-row{grid-template-columns:repeat(2,1fr)}.chart-grid{grid-template-columns:1fr}.chart:first-child{grid-row:auto}.diag-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:430px){header{align-items:flex-end}.status span{display:none}.plant{grid-template-columns:1fr 84px 84px}.ambient span{font-size:1.35rem}.nibe{width:62px;height:62px;border-radius:16px;font-size:.8rem}.machine{border-radius:15px}.fan{width:36px;height:36px}.metric-row{gap:6px}.metric{padding:10px}.metric strong{font-size:.9rem}.pair{grid-template-columns:1fr}.setup li{grid-template-columns:10px 1fr}.setup li em{display:none}}`}
}

class NibeControlStrategy extends HTMLElement {
 static getCreateSuggestions(){return {title:"NIBE Control",icon:"mdi:heat-pump-outline"};}
 static async generate(config){return {title:config.title||"NIBE Control",views:[{title:"Anlage",path:"anlage",icon:"mdi:heat-pump-outline",type:"panel",cards:[{type:"custom:nibe-control-card",mappings:config.mappings||{}}]}]};}
}

if(!customElements.get("nibe-control-card")) customElements.define("nibe-control-card",NibeControlCard);
if(!customElements.get("ll-strategy-dashboard-nibe-control")) customElements.define("ll-strategy-dashboard-nibe-control",NibeControlStrategy);
window.customStrategies=window.customStrategies||[];
if(!window.customStrategies.some(x=>x.type==="nibe-control")) window.customStrategies.push({type:"nibe-control",strategyType:"dashboard",name:"NIBE Control",description:"Dynamisches Technik-Dashboard für NIBE S-Serie",documentationURL:"https://github.com/Soul7495/NIBE-Control"});
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==="nibe-control-card")) window.customCards.push({type:"nibe-control-card",name:"NIBE Control",description:"NIBE S-Serie Anlagenübersicht"});
