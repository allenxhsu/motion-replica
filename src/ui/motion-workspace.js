import { el, clear } from '../util.js';
import { store, set } from '../state/store.js';
import { setAppearance } from '../appearance.js';
import { newTaskBelow, setPercent } from '../state/actions.js';
import { descendants } from '../model/model.js';
import { saveProject, openFile } from './toolbar.js';

function select(id) { set({ selection:[id],rightOpen:true,rightTab:'task' }); }
function addTask() { newTaskBelow(); set({rightOpen:true,rightTab:'task'}); }
const button=(text,onclick,cls='')=>el('button',{class:cls,text,onclick});
const leaves=()=>store.project.tasks.filter(t=>!store.schedule.tasks[t.id]?.summary);
function groups() {
 const p=store.project;
 const groups=p.tasks.map((t,i)=>({task:t,index:i})).filter(({task})=>task.level===1).map(({task,index})=>({id:task.id,name:task.name,tasks:store.schedule.tasks[task.id].summary?descendants(p,index).map(i=>p.tasks[i]).filter(t=>!store.schedule.tasks[t.id].summary):[task]}));
 return groups;
}
export function initMotionShell() {
 const app=document.getElementById('app');
 const nav=el('aside',{id:'motion-sidebar'}),head=el('div',{id:'motion-header'}),rail=el('aside',{id:'motion-rail'});
 app.prepend(head);app.prepend(nav);document.getElementById('body').append(rail);
 window.addEventListener('planner:appearance',()=>set({}));
}
export function renderMotionShell() {
 const {ui,project}=store;const active=leaves().filter(t=>t.percent<100);
 const nav=document.getElementById('motion-sidebar'),head=document.getElementById('motion-header'),rail=document.getElementById('motion-rail');
 if(!nav)return;
 clear(nav);clear(head);clear(rail);
 const go=(view,group=null)=>set({view,motionGroup:group,selection:[],rightOpen:false});
 nav.append(el('div',{class:'motion-brand',text:'ϟ motion'}),el('div',{class:'motion-workspace-name'},el('span',{class:'motion-avatar',text:'P'}),el('strong',{text:project.name})),
 button('⌕  Search tasks',()=>{go('tasks');queueMicrotask(()=>document.getElementById('motion-search')?.focus());},'motion-search-button'),
 el('nav',{},...[[ 'calendar','▦','Calendar'],['tasks','☑','My tasks'],['projects','▧','Projects'],['focus','◷','Focus planner']].map(([id,icon,label])=>button(`${icon}   ${label}`,()=>go(id),`motion-nav ${ui.view===id?'active':''}`))),
 el('p',{class:'motion-section-label',text:'WORKSPACE'}),...groups().slice(0,8).map((g,i)=>button(g.name,()=>go('tasks',g.id),`motion-project-link color-${i%3}`)),
 el('div',{class:'motion-sidebar-foot'},button('▤  Gantt & project tools',()=>go('gantt'),'motion-nav'),button('Open project…',openFile,'motion-nav'),button('Save project',saveProject,'motion-nav'),
 el('label',{},el('span',{class:'motion-section-label',text:'INTERFACE'}),el('select',{class:'sc-select','aria-label':'Workspace interface',onchange:e=>setAppearance(e.target.value)},el('option',{value:'motion',text:'Motion workspace',selected:true}),el('option',{value:'hud',text:'Shared HUD kit'})))));
 const labels={projects:'Projects',tasks:'My tasks',calendar:'Calendar',focus:'Focus planner',gantt:'Gantt chart',sheet:'Task sheet',resources:'Resources',usage:'Resource usage',network:'Network diagram'};
 head.append(el('div',{class:'motion-breadcrumb'},el('span',{text:'Workspace'}),el('span',{text:'/'}),el('strong',{text:labels[ui.view]||ui.view})),el('div',{class:'row'},ui.rightOpen&&ui.selection.length?button('Close details',()=>set({rightOpen:false}),'motion-outline'):null,button('+ New task',addTask,'motion-primary')));
 rail.append(el('div',{class:'motion-rail-heading'},el('h2',{text:'Your tasks'}),el('span',{class:'motion-count',text:active.length})),el('p',{class:'motion-muted',text:'A little focus goes a long way.'}),
 el('div',{class:'motion-focus-summary'},el('strong',{text:'✧ Your week, planned.'}),el('p',{text:`${active.length} tasks · ${Math.round(active.reduce((n,t)=>n+t.duration*(project.calendar.hoursPerDay||8)*(1-t.percent/100),0)*10)/10} hours remaining`})),
 el('div',{class:'motion-up-next'},el('span',{text:'UP NEXT'}),button('+',addTask)),
 ...active.slice(0,7).map(t=>el('div',{class:'motion-rail-task'},el('input',{type:'checkbox','aria-label':`Complete ${t.name}`,onchange:()=>setPercent(t.id,100)}),el('div',{},button(t.name,()=>select(t.id),'motion-task-title'),el('p',{class:'motion-muted',text:`${store.schedule.tasks[t.id].critical?'Critical · ':''}${Math.round(t.duration*(project.calendar.hoursPerDay||8)*60)} min`})))));
 if(!active.length)rail.append(el('p',{class:'motion-muted',text:'All tasks complete.'}));
 document.getElementById('app').classList.toggle('motion-editing',ui.rightOpen&&ui.selection.length>0);
 document.getElementById('app').classList.toggle('motion-simple',['projects','tasks','calendar','focus'].includes(ui.view));
}
export function renderProjects(root) {
 clear(root);const p=store.project;
 const wrap=el('section',{class:'motion-projects'},el('div',{class:'motion-page-heading'},el('h1',{text:'Projects'}),el('span',{class:'motion-badge',text:p.name})),el('p',{class:'motion-group-note',text:'Workstreams in the current project'}));
 for(const [i,g] of groups().entries()) {
  const done=g.tasks.filter(t=>t.percent===100).length;
  wrap.append(el('article',{class:'motion-project-card'},el('i',{class:`motion-dot color-${i%3}`}),el('h2',{text:g.name}),el('p',{class:'motion-muted',text:`${done} of ${g.tasks.length} tasks complete`}),el('progress',{max:g.tasks.length||1,value:done,'aria-label':`${g.name} completion`}),button('View tasks →',()=>set({view:'tasks',motionGroup:g.id,selection:[],rightOpen:false}),'motion-outline')));
 }
 if(!p.tasks.length)wrap.append(el('div',{class:'motion-project-card'},el('h2',{text:'Start your first workstream'}),el('p',{class:'motion-muted',text:'Add tasks, then use the Gantt outline to group them.'}),button('+ New task',addTask,'motion-primary')));
 root.append(wrap);
}
export function renderTasks(root) {
 clear(root);const group=groups().find(g=>g.id===store.ui.motionGroup);
 const input=el('input',{id:'motion-search',class:'sc-input',placeholder:'Search tasks…','aria-label':'Search task list'});
 const list=el('div',{});
 const rows=()=>{clear(list);const tasks=(group?.tasks||leaves()).filter(t=>t.name.toLowerCase().includes(input.value.toLowerCase()));
 for(const t of tasks)list.append(el('div',{class:'motion-task-row'},el('input',{type:'checkbox',checked:t.percent===100,'aria-label':`Complete ${t.name}`,onchange:()=>setPercent(t.id,t.percent===100?0:100)}),button(t.name,()=>select(t.id),'motion-task-title'),el('span',{class:'motion-muted',text:`${t.duration}d · ${t.percent}% complete`})));if(!tasks.length)list.append(el('p',{class:'motion-muted',text:'No matching tasks.'}));};
 input.oninput=rows;rows();
 root.append(el('section',{class:'motion-projects'},el('div',{class:'motion-page-heading'},el('h1',{text:group?.name||'My tasks'}),input),list));
}
