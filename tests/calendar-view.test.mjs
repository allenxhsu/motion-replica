import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, insertTask } from '../src/model/model.js';
import { computeSchedule } from '../src/model/schedule.js';
import { calendarDays } from '../src/model/calendar-view.js';
import { toDay } from '../src/model/calendar.js';

test('calendar shares CPM dates, omits summaries and skips holidays', () => {
  const p = createProject('Calendar', '2026-09-21');
  p.calendar.holidays = ['2026-09-22'];
  insertTask(p, 0, { name: 'Summary', level: 1 });
  const t = insertTask(p, 1, { name: 'Work', level: 2, duration: 3 });
  const days = calendarDays(p, computeSchedule(p), toDay(p.start));
  assert.deepEqual(days.map(d => d.tasks.map(t => t.name)), [['Work'], [], ['Work'], ['Work'], [], [], []]);
});
test('resource and completion filters preserve task identity', () => {
  const p = createProject('Calendar', '2026-09-21');
  insertTask(p, 0, { name: 'Complete', duration: 1, percent: 100, assignments: [{resourceId:'r1', units:1}] });
  insertTask(p, 1, { name: 'Open', duration: 1, assignments: [{resourceId:'r2', units:1}] });
  const s = computeSchedule(p), start = toDay(p.start);
  assert.equal(calendarDays(p,s,start,{hideCompleted:true})[0].tasks[0],p.tasks[1]);
  assert.equal(calendarDays(p,s,start,{resourceId:'r1'})[0].tasks[0],p.tasks[0]);
  assert.equal(calendarDays(p,s,start,{resourceId:'r1',hideCompleted:true})[0].tasks.length,0);
});
