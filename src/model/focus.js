// A single-person focus plan layered over CPM. It never changes CPM dates.
import { makeCalendar, toDay, fromDay } from './calendar.js';
import { ancestors } from './model.js';

export function normalizeFocus(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const hour = (v, fallback) => Number.isFinite(+v) ? Math.max(0, Math.min(24, +v)) : fallback;
  const startHour = Math.min(23.5, hour(raw.startHour, 9));
  const endHour = Math.max(startHour + .5, Math.min(24, hour(raw.endHour, 17)));
  return {
    startHour: Math.min(startHour, 23.5), endHour,
    resourceId: typeof raw.resourceId === 'string' ? raw.resourceId : '',
    blockMinutes: [30,60,90,120].includes(+raw.blockMinutes) ? +raw.blockMinutes : 60,
    meetings: (Array.isArray(raw.meetings) ? raw.meetings : []).filter(m => m && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && fromDay(toDay(m.date)) === m.date && Number.isFinite(+m.start) && Number.isFinite(+m.end) && +m.start >= 0 && +m.end <= 24 && +m.end > +m.start).map(m => ({ id: String(m.id), title: String(m.title || 'Busy'), date: m.date, start: +m.start, end: +m.end })),
  };
}

export function buildFocusPlan(project, schedule, firstDay, horizon = 28) {
  const prefs = normalizeFocus(project.focus);
  const cal = makeCalendar(project.calendar);
  const blocks = [], warnings = [], ends = new Map(), eligible = new Map();
  const byId = new Map(project.tasks.map(t => [t.id,t]));
  const span = Math.max(1, Math.min(90, Math.floor(horizon)));
  const occupied = new Map();
  for (const m of prefs.meetings) {
    const day = toDay(m.date);
    if (!occupied.has(day)) occupied.set(day, []);
    occupied.get(day).push([m.start * 60,m.end * 60]);
  }
  for (const t of project.tasks) {
    const info = schedule.tasks[t.id];
    if (!info || info.summary || info.percent >= 100 || info.milestone) continue;
    if (prefs.resourceId && !t.assignments.some(a => a.resourceId === prefs.resourceId)) continue;
    eligible.set(t.id,t);
  }
  // Dependency order is primary; deadline and criticality break ties among ready tasks.
  const pending = new Map(eligible);
  const linksFor = t => [...t.predecessors, ...ancestors(project, project.tasks.indexOf(t)).flatMap(i => project.tasks[i].predecessors)];
  while (pending.size) {
    const ready = [...pending.values()].filter(t => !linksFor(t).some(l => pending.has(l.id)));
    if (!ready.length) { for (const t of pending.values()) warnings.push({taskId:t.id, message:'Dependency cycle: no focus time allocated.'}); break; }
    ready.sort((a,b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || Number(schedule.tasks[b.id].critical)-Number(schedule.tasks[a.id].critical));
    const t = ready[0], info = schedule.tasks[t.id]; pending.delete(t.id);
    if (info.cyclic) { warnings.push({taskId:t.id,message:'Cyclic task: no focus time allocated.'}); continue; }
    let earliest = Math.max(firstDay, info.start), earliestMinute = prefs.startHour * 60, blocked = false;
    for (const link of linksFor(t)) {
      if (schedule.tasks[link.id]?.percent >= 100) continue;
      if (link.type !== 'FS' || link.lag < 0 || schedule.tasks[link.id]?.summary) {
        warnings.push({taskId:t.id,message:'Focus planning supports leaf finish-to-start links with nonnegative lag; use Gantt for this dependency.'}); blocked = true; break;
      }
      if (eligible.has(link.id)) {
        const end = ends.get(link.id);
        if (!end) { blocked = true; warnings.push({taskId:t.id,message:'A predecessor could not be fully scheduled.'}); break; }
        const nextDay = cal.add(end.day, Math.ceil(link.lag || 0));
        if (nextDay > earliest) { earliest = nextDay; earliestMinute = link.lag ? prefs.startHour*60 : end.minute; }
        else if (nextDay === earliest && !link.lag) earliestMinute = Math.max(earliestMinute,end.minute);
      } else if (byId.has(link.id) && schedule.tasks[link.id].percent < 100) {
        // Work outside the selected person's plan remains governed by CPM.
        earliest = Math.max(earliest, cal.add(schedule.tasks[link.id].finish, Math.ceil(link.lag || 0)+1));
      }
    }
    if (blocked) continue;
    let remaining = Math.ceil(t.duration * cal.hoursPerDay * 60 * (1-info.percent/100) - 1e-8);
    for (let day = earliest; day < firstDay+span && remaining>0; day++) {
      if (!cal.isWorking(day)) continue;
      const busy = occupied.get(day) || []; occupied.set(day,busy);
      let minute = Math.max(prefs.startHour*60,day===earliest?earliestMinute:0);
      const dayEnd = prefs.endHour*60;
      while (minute<dayEnd && remaining>0) {
        const overlap = busy.find(([a,b]) => a<=minute && b>minute);
        if (overlap) { minute=overlap[1]; continue; }
        const next = Math.min(dayEnd,...busy.filter(([a])=>a>minute).map(([a])=>a));
        const length = Math.min(prefs.blockMinutes,remaining,next-minute);
        if (length<=0) break;
        blocks.push({taskId:t.id,day,date:fromDay(day),start:minute/60,end:(minute+length)/60,minutes:length});
        busy.push([minute,minute+length]); remaining-=length; minute+=length;
      }
    }
    const last = blocks.filter(b=>b.taskId===t.id).at(-1);
    if (remaining>0) warnings.push({taskId:t.id,message:`${Math.round(remaining/60*10)/10}h could not fit in the ${span}-day planning horizon.`});
    else if (last) ends.set(t.id,{day:last.day,minute:last.end*60});
    if (last && (last.day>info.finish || t.deadline && last.date>t.deadline)) warnings.push({taskId:t.id,message:'Focus work extends beyond the project finish date or task deadline.'});
  }
  return { blocks, warnings, preferences:prefs, start:firstDay, finish:firstDay+span-1 };
}
