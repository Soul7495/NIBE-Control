// Register 31029: yozik04/nibe, vvms320_vvms325.json / extensions.json.
// SG contacts: NIBE VVM S320 installer manual 531158-2, AUX / SG Ready.
export const NC_INVALID = new Set(['unknown','unavailable','none','null','']);
export function ncNumber(value) {
  if (value == null || NC_INVALID.has(String(value).toLowerCase())) return null;
  const number=Number(value);
  return Number.isFinite(number) ? number : null;
}
export function ncBinary(value) {
  const raw=String(value ?? '').toLowerCase();
  if (['1','on','true','active','closed'].includes(raw)) return true;
  if (['0','off','false','inactive','open'].includes(raw)) return false;
  return null;
}
export function ncPriority(value) {
  return ({'10':'idle','20':'water','30':'heat','40':'pool','60':'cooling',
    'off':'idle','hot water':'water','heat':'heat','pool':'pool','cooling':'cooling'})[String(value ?? '').toLowerCase()] || 'unknown';
}
export function ncOperating(values, connected=true) {
  const hz=ncNumber(values.compressorHz), alarm=ncNumber(values.alarm);
  const kind=ncPriority(values.priority);
  if (!connected) return {mode:'offline',label:'Home Assistant getrennt',kind:'unknown',active:false};
  if (alarm!=null && alarm!==0) return {mode:'alarm',label:`Störung · Alarm ${alarm}`,kind:'unknown',active:false};
  const defrost=ncBinary(values.defrost);
  if (defrost===true) return {mode:'defrost',label:'Abtauung',kind:'unknown',active:false};
  // Undocumented numeric defrost states must not be treated as "off".
  if (ncNumber(values.defrost)>1) return {mode:'unknown',label:`Abtaustatus ${values.defrost}`,kind:'unknown',active:false};
  if (hz==null) return {mode:'unknown',label:'Betrieb nicht verfügbar',kind:'unknown',active:false};
  const active=hz>0 || (ncNumber(values.additionalHeat)||0)>0;
  if (active && kind==='water') return {mode:'running',label:'Warmwasserbereitung',kind,active:true};
  if (active && kind==='heat') return {mode:'running',label:'Heizbetrieb',kind,active:true};
  if (active && kind==='cooling') return {mode:'running',label:'Kühlbetrieb',kind,active:true};
  if (active && kind==='pool') return {mode:'running',label:'Poolbetrieb',kind,active:true};
  if (active) return {mode:'running',label:'Verdichter läuft · Betriebsart unbekannt',kind:'unknown',active:true};
  return {mode:'idle',label:'Bereit · keine Wärmeerzeugung',kind,active:false};
}
export function ncSg(values) {
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
export function ncEvccMode(raw) {
  return ({off:'Aus',pv:'PV-Überschuss',minpv:'Min. + PV',now:'Sofort'})[String(raw ?? '').toLowerCase()] || (NC_INVALID.has(String(raw ?? '').toLowerCase())?'Nicht verfügbar':String(raw));
}
