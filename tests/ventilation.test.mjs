import test from 'node:test';
import assert from 'node:assert/strict';
import {ncFilterDate,ncToday} from '../src/state.js';
test('filter due date clamps to February without skipping a month',()=>{
 assert.equal(ncFilterDate('2026-01-31',1,'2026-02-01').due,'2026-02-28');
 assert.equal(ncFilterDate('2024-01-31',1,'2024-02-01').due,'2024-02-29');
});
test('unknown, impossible and future dates do not invent due dates',()=>{
 for(const d of ['unknown','2026-02-30','2027-01-01',undefined]) assert.equal(ncFilterDate(d,3,'2026-10-08').due,null);
 for(const m of [undefined,0,25,1.5]) assert.equal(ncFilterDate('2026-08-01',m,'2026-10-08').due,null);
});
test('filter countdown handles today and overdue',()=>{
 assert.equal(ncFilterDate('2026-07-08',3,'2026-10-08').label,'Heute fällig');
 assert.equal(ncFilterDate('2026-07-08',3,'2026-10-09').days,-1);
});
test('filter date follows HA timezone at midnight and DST',()=>{
 assert.equal(ncToday('Europe/Berlin',new Date('2026-10-07T22:30:00Z')),'2026-10-08');
 assert.equal(ncToday('Europe/Berlin',new Date('2026-12-07T23:30:00Z')),'2026-12-08');
});
