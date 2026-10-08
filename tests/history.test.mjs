import test from 'node:test';
import assert from 'node:assert/strict';
import {ncHistoryPoints,ncHistoryPath} from '../src/state.js';
const start=Date.parse('2026-10-07T10:00:00Z'),end=start+86400000;
test('history uses HA epoch seconds and ISO timestamps at their true position',()=>{
 const pts=ncHistoryPoints([{s:'10',lu:start/1000},{state:'20',last_updated:new Date(start+21600000).toISOString()}],start,end);
 assert.equal(pts.length,2);assert.equal(ncHistoryPath(pts,start,end,10,10),'M0.00,44.00 L25.00,6.00');
});
test('unavailable history breaks paths and never becomes zero',()=>{
 const pts=ncHistoryPoints([{s:'10',lu:start/1000},{s:'unavailable',lu:(start+100000)/1000},{s:'20',lu:(start+200000)/1000}],start,end);
 assert.equal(pts[1].value,null);assert.equal(ncHistoryPath(pts,start,end,10,10).match(/M/g).length,2);
});
test('sampling bounds large histories and keeps extreme values',()=>{
 const rows=Array.from({length:10000},(_,i)=>({s:i===5555?'500':'10',lu:(start+i*8000)/1000}));
 const pts=ncHistoryPoints(rows,start,end);assert.ok(pts.length<=600);assert.ok(pts.some(p=>p.value===500));
});
test('history preserves the state at start and ignores invalid timestamps',()=>{
 const pts=ncHistoryPoints([{s:'15',lu:(start-60000)/1000},{s:'0'},{s:'9',lu:(end+1)/1000}],start,end);
 assert.equal(pts.length,1);assert.equal(pts[0].time,start);assert.equal(pts[0].value,15);
});
