// Read-only HA snapshots never overwrite a newer state received through hass.
export function ncSnapshotState(live, snapshot) {
 if (!snapshot) return live;
 if (snapshot.state == null) return live === snapshot.baseline ? undefined : live;
 const time=s=>Date.parse(s?.last_updated || '');
 const current=time(live), incoming=time(snapshot.state);
 if (Number.isFinite(current)&&Number.isFinite(incoming)) return incoming>current?snapshot.state:live;
 return live===snapshot.baseline?snapshot.state:live;
}
export async function ncDeadline(promise, milliseconds=30000) {
 let timer;
 try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Zeitüberschreitung bei der Home-Assistant-Abfrage.')),milliseconds);})]);}
 finally {clearTimeout(timer);}
}
