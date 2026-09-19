import { el, clear, uid, downloadText } from '../util.js';
import { store, set, commit } from '../state/store.js';
import { formDialog, showText } from './dialog.js';
import { normalizeFocus, buildFocusPlan } from '../model/focus.js';
import { fromDay, toDay, weekStart, today, formatDate, WEEKDAY_NAMES, weekday } from '../model/calendar.js';
import { exportFocusIcs } from '../io/focus-ics.js';

const clock = hour => `${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.round((hour%1)*60)).padStart(2,'0')}`;
const b = (text, onclick, primary = false) => el('button', { class:`sc-button sc-button--sm${primary?' sc-button--primary':''}`,text,onclick });
function savePrefs(patch, label) { commit(label, p => { p.focus = {...normalizeFocus(p.focus),...patch}; }); }
async function settings() {
  const prefs = normalizeFocus(store.project.focus);
  const result = await formDialog('Focus planning settings',[
    {key:'resourceId',label:'Plan work for',type:'select',value:prefs.resourceId,options:[{value:'',label:'All tasks · one personal queue'},...store.project.resources.map(r=>({value:r.id,label:r.name}))]},
    {key:'startHour',label:'Work starts (hour, 0–23.5)',type:'number',step:.5,min:0,value:prefs.startHour},
    {key:'endHour',label:'Work ends (hour, up to 24)',type:'number',step:.5,min:.5,value:prefs.endHour},
    {key:'blockMinutes',label:'Maximum focus block',type:'select',value:String(prefs.blockMinutes),options:[30,60,90,120].map(n=>({value:String(n),label:`${n} minutes`}))}
  ],'Save settings','One person’s focus queue. Working weekdays and holidays come from Project information.');
  if (!result) return;
  if (!Number.isFinite(+result.startHour)||!Number.isFinite(+result.endHour)||+result.startHour<0||+result.endHour>24||+result.endHour<=+result.startHour) return showText('Invalid hours','Start must be before end, between 0 and 24.');
  savePrefs({...result,startHour:+result.startHour,endHour:+result.endHour,blockMinutes:+result.blockMinutes},'Focus settings');
}
async function busyPeriod(day, existing) {
  const r = await formDialog(existing?'Edit busy period':'Add busy period',[
    {key:'title',label:'Title',value:existing?.title || 'Meeting'},
    {key:'date',label:'Date',type:'date',value:existing?.date || fromDay(day)},
    {key:'start',label:'Starts (hour, e.g. 9.5)',type:'number',step:.25,min:0,value:existing?.start ?? 10},
    {key:'end',label:'Ends (hour, e.g. 10.5)',type:'number',step:.25,min:0,value:existing?.end ?? 11},
    ...(existing?[{key:'remove',label:'Remove this busy period',type:'check',value:false}]:[])
  ],'Save');
  if (!r) return;
  const prefs = normalizeFocus(store.project.focus);
  if(r.remove) return savePrefs({meetings:prefs.meetings.filter(m=>m.id!==existing.id)},'Remove busy period');
  const meeting = {id:existing?.id || uid('busy'),title:r.title.trim()||'Busy',date:r.date,start:+r.start,end:+r.end};
  if(!r.date||!Number.isFinite(meeting.start)||!Number.isFinite(meeting.end)||meeting.start<0||meeting.end>24||meeting.end<=meeting.start) return showText('Invalid busy period','Choose a date and an end time after the start, between 0 and 24.');
  savePrefs({meetings:[...prefs.meetings.filter(m=>m.id!==meeting.id),meeting]},'Save busy period');
}
export function renderFocus(root) {
  clear(root);
  const {project,schedule,ui}=store;
  const start=ui.focusStart ?? Math.max(toDay(today()),schedule.start);
  const week=ui.focusWeek ?? weekStart(start);
  const plan=buildFocusPlan(project,schedule,start);
  const prefs=plan.preferences;
  const titleById=new Map(project.tasks.map(t=>[t.id,t.name]));
  const hours=plan.blocks.reduce((n,b)=>n+b.minutes,0)/60;
  const board=el('div',{class:'focus-board'});
  for(let day=week;day<week+7;day++) {
    const items=[...plan.blocks.filter(b=>b.day===day).map(block=>({...block,title:titleById.get(block.taskId)})),...prefs.meetings.filter(m=>m.date===fromDay(day)).map(m=>({...m,busy:true}))].sort((a,b)=>a.start-b.start);
    const column=el('section',{class:'focus-day'},el('div',{class:'planner-day-head'},el('span',{class:'sc-label',text:WEEKDAY_NAMES[weekday(day)].slice(0,3)}),el('strong',{text:formatDate(fromDay(day),'day')})));
    for(const item of items) column.append(el('button',{class:`focus-block sc-card${item.busy?' is-busy':''}`,onclick:()=>item.busy?busyPeriod(day,item):set({selection:[item.taskId],rightOpen:true,rightTab:'task'})},
      el('span',{class:'focus-time',text:`${clock(item.start)} – ${clock(item.end)}`}),el('strong',{text:item.title}),el('span',{class:'sc-muted',text:item.busy?'Busy period':'Focus time'})));
    if(!items.length) column.append(el('p',{class:'empty-note',text:'No blocks planned'}));
    column.append(b('+ Busy',()=>busyPeriod(day)));
    board.append(column);
  }
  const startInput=el('input',{class:'sc-input',type:'date',value:fromDay(start),'aria-label':'Focus plan start',onchange:e=>{if(e.target.value)set({focusStart:toDay(e.target.value),focusWeek:weekStart(toDay(e.target.value))});}});
  root.append(el('section',{class:'focus-view'},
    el('div',{class:'planner-calendar-header'},el('div',{},el('h2',{class:'sc-display',text:'Focus planner'}),el('p',{class:'sc-muted',text:`${Math.round(hours*10)/10}h allocated · ${plan.blocks.length} blocks · 28-day horizon`})),el('div',{class:'row'},b('Settings',settings),b('Export calendar',()=>downloadText(exportFocusIcs(plan,project), 'focus-plan.ics','text/calendar'),true))),
    el('div',{class:'planner-calendar-filters'},el('label',{class:'row'},'Plan from',startInput),b('‹ Previous',()=>set({focusWeek:week-7})),b('This week',()=>set({focusWeek:weekStart(start)})),b('Next ›',()=>set({focusWeek:week+7}))),
    el('p',{class:'planner-calendar-note sc-muted',text:'Automatically recalculates as work and busy periods change. This personal plan does not alter Gantt dates. Calendar export uses local wall-clock times; review your calendar’s timezone on import.'}),
    plan.warnings.length?el('details',{class:'focus-warnings'},el('summary',{text:`${plan.warnings.length} scheduling notices`}),...plan.warnings.map(w=>el('button',{class:'focus-warning',text:`${titleById.get(w.taskId)}: ${w.message}`,onclick:()=>set({selection:[w.taskId],rightOpen:true,rightTab:'task'})}))):null,
    el('div',{class:'focus-scroll'},board)));
}
