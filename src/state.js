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
// Calendar dates are owned by HA's timezone, independent of the display device.
export function ncToday(timeZone='Europe/Berlin', now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=k=>parts.find(p=>p.type===k).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function ncFilterDate(date, months, today) {
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
export function ncHistoryPoints(rows,start,end,{sample=true}={}){
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
export function ncHistoryPath(points,start,end,min,span){
 if(end<=start||span<=0)return '';
 let pen=false,path='';for(const p of points){const x=((p.time-start)/(end-start)*100).toFixed(2);if(p.value==null){if(pen)path+=`H${x} `;pen=false;continue;}const y=(44-(p.value-min)/span*38).toFixed(2);path+=pen?`H${x} V${y} `:`M${x},${y} `;pen=true;}return path.trim();
}
export function ncHistoryValue(points,time){
 let low=0,high=points.length;while(low<high){const mid=(low+high)>>1;if(points[mid].time<=time)low=mid+1;else high=mid;}return low?points[low-1].value:null;
}
export function ncHistoryScale(values){
 const nums=values.filter(v=>Number.isFinite(v));if(!nums.length)return null;
 let min=Math.min(...nums),max=Math.max(...nums);if(min===max){const pad=Math.max(.5,Math.abs(min)*.05);min-=pad;max+=pad;}
 return {min,max,span:max-min};
}
