// Floating local times deliberately avoid claiming an account timezone.
const escape = s => String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function stamp(date, hour) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCMinutes(Math.round(hour*60));
  return d.toISOString().replace(/[-:]/g,'').slice(0,15);
}
function fold(line) {
  const chunks=[];let current='';let bytes=0;
  for(const char of line) {
    const size=new TextEncoder().encode(char).length;
    if(bytes+size>75){chunks.push(current);current=' ';bytes=1;}
    current+=char;bytes+=size;
  }
  chunks.push(current);return chunks.join('\r\n');
}
export function exportFocusIcs(plan, project) {
  const names=new Map(project.tasks.map(t=>[t.id,t.name]));
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Project Planner//Focus Calendar//EN','CALSCALE:GREGORIAN'];
  const now=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  for(const block of plan.blocks) lines.push('BEGIN:VEVENT',`UID:${escape(block.taskId)}-${block.date}-${Math.round(block.start*60)}@project-planner.local`,`DTSTAMP:${now}`,`DTSTART:${stamp(block.date,block.start)}`,`DTEND:${stamp(block.date,block.end)}`,`SUMMARY:${escape(names.get(block.taskId)||'Focus task')}`,'DESCRIPTION:Personal focus plan. Original project dates are unchanged.','END:VEVENT');
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
