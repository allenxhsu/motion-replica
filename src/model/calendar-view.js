// Calendar projections use the same CPM dates as the Gantt; no duplicate tasks.
import { makeCalendar } from './calendar.js';
export function calendarDays(project, schedule, start, { resourceId = '', hideCompleted = false } = {}) {
  const cal = makeCalendar(project.calendar);
  return Array.from({ length: 7 }, (_, offset) => {
    const day = start + offset;
    const tasks = project.tasks.filter(task => {
      const info = schedule.tasks[task.id];
      return info && !info.summary && (!hideCompleted || info.percent < 100)
        && (!resourceId || task.assignments.some(a => a.resourceId === resourceId))
        && day >= info.start && day <= info.finish
        && (info.duration === 0 || cal.isWorking(day));
    });
    return { day, working: cal.isWorking(day), tasks };
  });
}
