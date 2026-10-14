import { readFile, writeFile, mkdir } from "node:fs/promises";
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
const state=await readFile(new URL('../src/state.js',import.meta.url),'utf8');
const profile=(await readFile(new URL('../src/profile.js',import.meta.url),'utf8')).replace(/export /g,'').replace(/\bPROFILE\b/g,'DEVICE_PROFILE');
const settings=(await readFile(new URL('../src/settings.js',import.meta.url),'utf8')).replace(/export /g,'');
const exporter=(await readFile(new URL('../src/history-export.js',import.meta.url),'utf8')).replace(/export /g,'');
const card=await readFile(new URL('../src/nibe-control.js',import.meta.url),'utf8');
await writeFile(new URL('../dist/nibe-control.js',import.meta.url),card.replace(/^import .*state.js.*;\n/m,state.replace(/export /g,'')).replace(/^import .*profile.js.*;\n/m,profile).replace(/^import .*settings.js.*;\n/m,settings).replace(/^import .*history-export.js.*;\n/m,exporter));
console.log("Built dist/nibe-control.js");
