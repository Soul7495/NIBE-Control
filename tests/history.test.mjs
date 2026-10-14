import test from 'node:test';
import assert from 'node:assert/strict';
import {ncHistoryPoints,ncHistoryPath,ncHistoryValue,ncHistoryScale,ncHistoryStats} from '../src/state.js';
const start=Date.parse('2026-10-07T10:00:00Z'),end=start+86400000;
test('history uses HA epoch seconds and ISO timestamps at their true position',()=>{
 const pts=ncHistoryPoints([{s:'10',lu:start/1000},{state:'20',last_updated:new Date(start+21600000).toISOString()}],start,end);
 assert.equal(pts.length,3);assert.equal(ncHistoryPath(pts,start,end,10,10),'M0.00,44.00 H25.00 V6.00 H100.00 V6.00');
});
test('unavailable history breaks paths and never becomes zero',()=>{
 const pts=ncHistoryPoints([{s:'10',lu:start/1000},{s:'unavailable',lu:(start+100000)/1000},{s:'20',lu:(start+200000)/1000}],start,end);
 assert.equal(pts[1].value,null);assert.equal(ncHistoryPath(pts,start,end,10,10).match(/M/g).length,2);
});
test('sampling bounds large histories and keeps extreme values',()=>{
 const rows=Array.from({length:10000},(_,i)=>({s:i===5555?'500':String(i%50),lu:(start+i*8000)/1000}));
 const pts=ncHistoryPoints(rows,start,end);assert.ok(pts.length<=600);assert.ok(pts.some(p=>p.value===500));
});
test('history preserves the state at start and ignores invalid timestamps',()=>{
 const pts=ncHistoryPoints([{s:'15',lu:(start-60000)/1000},{s:'0'},{s:'9',lu:(end+1)/1000}],start,end);
 assert.equal(pts.length,2);assert.equal(pts[1].time,end);assert.equal(pts[0].time,start);assert.equal(pts[0].value,15);
});

test('unchanged supply target 31 °C spans the entire recorder window',()=>{
 const pts=ncHistoryPoints([{s:'31',lu:start/1000}],start,end);
 assert.equal(ncHistoryPath(pts,start,end,30,2),'M0.00,25.00 H100.00 V25.00');
 assert.equal(ncHistoryValue(pts,end),31);
});
test('compressor zero holds overnight then jumps vertically to 50 Hz',()=>{
 const pts=ncHistoryPoints([{s:'0',lu:start/1000},{s:'50',lu:(start+43200000)/1000},{s:'0',lu:(start+44064000)/1000}],start,end);
 const path=ncHistoryPath(pts,start,end,0,50);
 assert.ok(path.includes('H50.00 V6.00'));assert.ok(path.includes('H51.00 V44.00'));assert.ok(!path.includes('L'));assert.equal(ncHistoryValue(pts,start+43199999),0);
});
test('unknown closes the previous plateau at its own time without crossing the gap',()=>{
 const pts=ncHistoryPoints([{s:'20',lu:start/1000},{s:'unknown',lu:(start+21600000)/1000},{s:'30',lu:(start+43200000)/1000}],start,end);
 assert.equal(ncHistoryPath(pts,start,end,20,10),'M0.00,44.00 H25.00 M50.00,6.00 H100.00 V6.00');assert.equal(ncHistoryValue(pts,start+30000000),null);
});
test('trailing unavailable stays unknown until end and never extends an old number',()=>{
 const pts=ncHistoryPoints([{s:'31',lu:start/1000},{s:'unavailable',lu:(start+1000)/1000}],start,end);
 assert.equal(ncHistoryValue(pts,end),null);assert.equal(ncHistoryPath(pts,start,end,30,2).match(/M/g).length,1);
});
test('no state is invented before the first recorder value',()=>{
 const pts=ncHistoryPoints([{s:'31',lu:(start+3600000)/1000}],start,end);assert.equal(ncHistoryValue(pts,start),null);assert.ok(ncHistoryPath(pts,start,end,30,2).startsWith('M4.17'));
});
test('all-constant and zero-only diagrams have a readable range',()=>{
 assert.deepEqual(ncHistoryScale([31,31]),{min:29.45,max:32.55,span:32.55-29.45});assert.deepEqual(ncHistoryScale([0]),{min:-.5,max:.5,span:1});assert.equal(ncHistoryScale([]),null);
});
test('same-time duplicate states use the last returned state',()=>{
 const pts=ncHistoryPoints([{s:'0',lu:start/1000},{s:'50',lu:start/1000}],start,end);assert.equal(ncHistoryValue(pts,start),50);
});
test('inspection reads raw events even when the drawn series is sampled',()=>{
 const rows=Array.from({length:10000},(_,i)=>({s:String(i%70),lu:(start+i*8000)/1000}));
 const raw=ncHistoryPoints(rows,start,end,{sample:false}),sampled=ncHistoryPoints(rows,start,end);
 assert.ok(sampled.length<=600);assert.ok(raw.length>600);assert.equal(ncHistoryValue(raw,start+4444*8000),4444%70);
});

test('time-weighted analysis excludes unknown segments and counts only observed starts',()=>{
 const points=[{time:0,value:0},{time:3600000,value:50},{time:7200000,value:null},{time:10800000,value:20},{time:14400000,value:0}];
 const stats=ncHistoryStats(points,0,14400000);assert.equal(stats.runningHours,2);assert.equal(stats.starts,1);assert.equal(stats.coverage,.75);assert.equal(stats.mean,70/3);assert.equal(stats.min,0);assert.equal(stats.max,50);
});
