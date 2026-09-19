import { el, clear } from '../util.js';
import { store, set } from '../state/store.js';
import { setPercent, newTaskBelow } from '../state/actions.js';
import { fromDay, toDay, weekStart, today, formatDate, WEEKDAY_NAMES, weekday } from '../model/calendar.js';
import { calendarDays } from '../model/calendar-view.js';

export function calendarToday() { set({ calendarWeek: weekStart(toDay(today())) }); }
export function renderCalendar(root) {
  clear(root);
  const { project, schedule, ui } = store;
  const start = ui.calendarWeek ?? weekStart(schedule.start);
  const button = (text, onclick, title = text) => el('button', { class: 'sc-button sc-button--sm', text, title, onclick });
  const resource = el('select', { class: 'sc-select', 'aria-label': 'Filter calendar by resource', onchange: e => set({ calendarResource: e.target.value }) },
    el('option', { value: '', text: 'All resources' }),
    ...project.resources.map(r => el('option', { value: r.id, text: r.name })));
  resource.value = ui.calendarResource || '';
  const days = calendarDays(project, schedule, start, { resourceId: resource.value, hideCompleted: ui.calendarHideCompleted });
  const count = new Set(days.flatMap(d => d.tasks.map(t => t.id))).size;
  const week = el('div', { class: 'planner-week' });
  for (const { day, working, tasks } of days) {
    const column = el('section', { class: `planner-day${working ? '' : ' is-off'}${fromDay(day) === today() ? ' is-today' : ''}` },
      el('div', { class: 'planner-day-head' }, el('span', { class: 'sc-label', text: WEEKDAY_NAMES[weekday(day)].slice(0,3) }),
        el('strong', { text: formatDate(fromDay(day), 'day') }), el('span', { class: 'sc-muted', text: `${tasks.length} tasks` })));
    for (const task of tasks) {
      const info = schedule.tasks[task.id];
      const selected = ui.selection.includes(task.id);
      const names = task.assignments.map(a => project.resources.find(r => r.id === a.resourceId)?.name).filter(Boolean).join(', ');
      column.append(el('article', { class: `planner-task sc-card${selected ? ' is-selected' : ''}${info.percent === 100 ? ' is-done' : ''}` },
        el('button', { class: 'planner-task-title', text: `${info.duration === 0 ? '◆ ' : ''}${task.name}`, onclick: () => set({ selection: [task.id], rightOpen: true, rightTab: 'task' }) }),
        el('div', { class: 'planner-task-meta', text: `${info.duration}d · ${info.percent}% complete` }),
        names ? el('div', { class: 'planner-task-meta', text: names }) : null,
        info.critical ? el('span', { class: 'planner-critical', text: 'Critical path' }) : null,
        el('div', { class: 'planner-task-actions' }, button(info.percent === 100 ? 'Reopen' : 'Complete', () => setPercent(task.id, info.percent === 100 ? 0 : 100), `${info.percent === 100 ? 'Reopen' : 'Complete'} ${task.name}`),
          button('Gantt ↗', () => set({ view: 'gantt', selection: [task.id], rightTab: 'task' }), `Show ${task.name} in Gantt`))));
    }
    if (!tasks.length) column.append(el('p', { class: 'empty-note', text: working ? 'No scheduled tasks' : 'Non-working day' }));
    week.append(column);
  }
  root.append(el('div', { class: 'planner-calendar' },
    el('div', { class: 'planner-calendar-header' },
      el('div', {}, el('h2', { class: 'sc-display', text: formatDate(fromDay(start), 'month') }),
        el('p', { class: 'sc-muted', text: `${formatDate(fromDay(start), 'day')} – ${formatDate(fromDay(start + 6), 'day')} · ${count} scheduled tasks` })),
      el('div', { class: 'row' }, button('‹', () => set({ calendarWeek: start - 7 }), 'Previous week'), button('Today', calendarToday), button('›', () => set({ calendarWeek: start + 7 }), 'Next week'), button('Project start', () => set({ calendarWeek: weekStart(schedule.start) })))) ,
    el('div', { class: 'planner-calendar-filters' }, resource,
      el('label', { class: 'row' }, el('input', { type: 'checkbox', class: 'sc-check', checked: !!ui.calendarHideCompleted, onchange: e => set({ calendarHideCompleted: e.target.checked }) }), 'Hide completed'),
      el('span', { class: 'sc-spacer' }), button('+ Task', () => { newTaskBelow(); set({ rightOpen: true, rightTab: 'task' }); })),
    el('p', { class: 'planner-calendar-note sc-muted', text: 'Scheduled working days · Edits are shared with the Gantt, task sheet, and saved project. Select a task to edit its details.' }),
    el('div', { class: 'planner-week-scroll' }, week)));
}
