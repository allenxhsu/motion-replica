import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, insertTask } from '../src/model/model.js';
import { computeSchedule } from '../src/model/schedule.js';
import { toDay } from '../src/model/calendar.js';
import { buildFocusPlan, normalizeFocus } from '../src/model/focus.js';
import { serialize, parse } from '../src/io/json.js';
import { exportFocusIcs } from '../src/io/focus-ics.js';
const start='2026-09-21';
function fixture() { const p=createProject('Focus',start);p.focus={startHour:9,endHour:17,blockMinutes:60,meetings:[]};return p; }
const plan=p=>buildFocusPlan(p,computeSchedule(p),toDay(start));

test('remaining work fits around overlapping busy periods without collisions',()=>{
 const p=fixture();insertTask(p,0,{name:'Work',duration:1,percent:50});
 p.focus.meetings=[{id:'a',title:'Meeting',date:start,start:10,end:11},{id:'b',title:'Meeting',date:start,start:10.5,end:12}];
 const out=plan(p);assert.equal(out.blocks.reduce((s,b)=>s+b.minutes,0),240);
 assert.ok(out.blocks.every(b=>b.end<=10||b.start>=12));
 for(let i=1;i<out.blocks.length;i++) assert.ok(out.blocks[i].start>=out.blocks[i-1].end);
});
test('holidays and weekends excluded, busy work spills onto next working day',()=>{
 const p=fixture();p.calendar.holidays=['2026-09-22'];insertTask(p,0,{name:'Work',duration:2});
 p.focus.endHour=10;
 const out=plan(p);assert.ok(!out.blocks.some(b=>b.date==='2026-09-22'));
 assert.ok(out.blocks.every(b=>![0,6].includes(new Date(b.date+'T00:00Z').getUTCDay())));
 assert.equal(out.blocks.reduce((s,b)=>s+b.minutes,0),960);
});
test('finish-to-start dependent waits for focus predecessor; CPM remains unchanged',()=>{
 const p=fixture();insertTask(p,0,{name:'A',duration:1});insertTask(p,1,{name:'B',duration:1,predecessors:[{id:p.tasks[0].id,type:'FS',lag:0}]});
 p.focus.endHour=10;
 const before=serialize(p),out=plan(p),a=out.blocks.filter(b=>b.taskId===p.tasks[0].id),b=out.blocks.filter(b=>b.taskId===p.tasks[1].id);
 assert.ok(b[0].day>a.at(-1).day||b[0].day===a.at(-1).day&&b[0].start>=a.at(-1).end);assert.equal(serialize(p),before);
});
test('unsupported dependencies and insufficient capacity are explicit',()=>{
 const p=fixture();insertTask(p,0,{name:'A',duration:100});insertTask(p,1,{name:'B',duration:1,predecessors:[{id:p.tasks[0].id,type:'SS',lag:0}]});
 const out=plan(p);assert.ok(out.warnings.some(w=>w.message.includes('could not fit')));assert.ok(out.warnings.some(w=>w.message.includes('supports leaf')));assert.ok(!out.blocks.some(b=>b.taskId===p.tasks[1].id));
});
test('focus settings and meetings round-trip in native plan files',()=>{
 const p=fixture();p.focus.meetings=[{id:'one',date:start,start:9.5,end:10.5,title:'Review'}];
 assert.deepEqual(parse(serialize(p)).project.focus,normalizeFocus(p.focus));
 assert.ok(normalizeFocus({startHour:24,endHour:0}).endHour<=24);
});
test('ICS escapes task text, folds long UTF-8 lines and handles midnight',()=>{
 const p=fixture();insertTask(p,0,{name:'Review, notes; '+ '测试'.repeat(70)+'\nnew line',duration:1});
 const out={blocks:[{taskId:p.tasks[0].id,date:start,start:23,end:24}]};
 const text=exportFocusIcs(out,p);assert.ok(text.includes('DTEND:20260922T000000'));assert.ok(text.includes('Review\\, notes\\;'));assert.ok(text.includes('\\nnew line'));
 assert.ok(text.split('\r\n').every(l=>Buffer.byteLength(l)<=75));assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,1);
});
