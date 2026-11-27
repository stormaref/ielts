'use strict';

const localTracker = location.protocol === 'file:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
if (localTracker) {
  const personal = document.createElement('script');
  personal.src = 'personal.js';
  document.head.append(personal);
}
const params = new URLSearchParams(location.search);
const book = Number(params.get('book')), test = Number(params.get('test'));
const inTest = Number.isInteger(book) && book>=18 && book<=21 && Number.isInteger(test) && test>=1 && test<=4;
const skill = params.get('skill');
const interactive = book===18 && test===1;
const practice = inTest && interactive && skills.includes(skill);
const prefix = 'ielts.practice.v1/';
const memory = new Map();
const content = document.getElementById('content');
const frame = document.getElementById('practice');
const testId = book+'-'+test;
const testFolder = './Cambridge Practice Tests/Cambridge IELTS '+book+' Academic/Test '+test+'/';
const objective = s => s==='Reading' || s==='Listening';
const states = ['Not started','In progress','Completed','Needs review','Reviewed','Skipped'];
function node(tag,text,cls) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function link(text,url,cls) {
  const a=node('a',text,cls);
  a.href=url;
  return a;
}
function url(b,t,s,part) {
  const p=new URLSearchParams({book:b,test:t});
  if(s) p.set('skill',s);
  if(part) p.set('part',part);
  return 'index.html?'+p;
}
function message(text) { document.getElementById('notice').textContent=text; }
function read(key) {
  try {
    if(!memory.has(key)) return JSON.parse(localStorage.getItem(prefix+key));
  } catch {}
  return memory.get(key) || null;
}
function write(key,value) {
  try {
    localStorage.setItem(prefix+key,JSON.stringify(value));
    memory.delete(key);
    return true;
  } catch {
    memory.set(key,value);
    message('Browser storage is unavailable. Export results before closing this page.');
    return false;
  }
}
function id(b,t,s,kind,n) { return [b+'-'+t,s,kind,n].filter(v=>v!==undefined).join('/'); }
function report(b,t,s,n) {return read(id(b,t,s,'part',n));}
function draft(b,t,s) {return read(id(b,t,s,'draft')) || {answers:{}};}
function snapshot(s,n,answers) {
  if (!objective(s)) return {[s==='Writing'?'task'+n:'notes'+n]:answers[(s==='Writing'?'task':'notes')+n] || ''};
  const [from,to]=ranges[s][n-1];
  return Object.fromEntries(Object.entries(answers).filter(([key])=>{
    const q=Number(key.slice(1).split('-')[0]);
    return q>=from && q<=to;
  }).sort(([a],[b])=>a.localeCompare(b)));
}
function hasContent(answers) {
  return Object.values(answers).some(a=>Array.isArray(a)?a.length:String(a).trim().length);
}
function partState(b,t,s,n) {
  const r=report(b,t,s,n);
  const ans=b===18 && t===1 ? snapshot(s,n,draft(b,t,s).answers) : {};
  if(r?.snapshot && JSON.stringify(r.snapshot)!==JSON.stringify(ans)) return 'Revised draft';
  if(r) return r.status;
  return hasContent(ans)?'In progress':'Not started';
}
function field(label,el) {const wrap=node('label',label+' ');wrap.append(el);return wrap;}
function numeric(max,value,step=1) {
  const el=node('input');el.type='number';el.min='0';el.max=max;el.step=step;el.value=value??'';return el;
}
function rawTotal(b,t,s) {
  const records=Array.from({length:partCounts[s]},(_,i)=>report(b,t,s,i+1));
  const marked=records.filter(r=>r?.correct!=null && r?.total>0 && r.status!=='Skipped');
  if(!marked.length)return '';
  return marked.reduce((v,r)=>v+r.correct,0)+'/'+marked.reduce((v,r)=>v+r.total,0)+' across '+marked.length+'/'+records.length+' marked';
}
function skillSummary(b,t,s) {
  const band=read(id(b,t,s,'band'));
  const statesForSkill=Array.from({length:partCounts[s]},(_,i)=>partState(b,t,s,i+1));
  const done=statesForSkill.filter(v=>['Completed','Needs review','Reviewed'].includes(v)).length;
  let text=done+'/'+partCounts[s]+' completed';
  const skipped=statesForSkill.filter(v=>v==='Skipped').length;
  if(skipped)text+=' · '+skipped+' skipped';
  const raw=rawTotal(b,t,s);
  if(raw)text+=' · '+raw;
  if(band?.value!=null)text+=' · band '+band.value;
  return text;
}
function answerReview(questions) {
  const detail=node('details',undefined,'answer-review');
  const missed=questions.filter(q=>q.points<q.max).length;
  detail.append(node('summary','Review saved answers'));
  const heading=node('div',undefined,'review-head');
  const showMisses=node('input');
  showMisses.type='checkbox';
  showMisses.checked=missed>0;
  showMisses.disabled=missed===0;
  const filter=node('label');
  filter.append(showMisses,' Missed only');
  heading.append(node('strong',missed ? missed+' to review' : 'All answers correct'),filter);
  const table=node('table');
  const head=table.createTHead().insertRow();
  for(const col of ['Question','Your answer','Answer key','Marks']) {
    const th=node('th',col); th.scope='col'; head.append(th);
  }
  const body=table.createTBody();
  for(const q of questions) {
    const row=body.insertRow();
    row.dataset.correct=String(q.points===q.max);
    row.append(node('th',q.question),node('td',q.response||'Blank'),node('td',q.key),node('td',q.points+' / '+q.max));
    row.firstChild.scope='row';
  }
  const filterRows=()=>{
    for(const row of body.rows)row.hidden=showMisses.checked && row.dataset.correct==='true';
  };
  showMisses.onchange=filterRows;
  filterRows();
  const scroll=node('div',undefined,'review-table');
  scroll.append(table);
  detail.append(heading,scroll);
  return detail;
}
function resultLine(b,t,s,n,editable) {
  const row=node('div',undefined,'partline');
  const state=partState(b,t,s,n), r=report(b,t,s,n);
  row.append(node('span',partLabels[s]+' '+n),node('strong',state,'status state-'+state.toLowerCase().replace(/ /g,'-')));
  if(r?.correct!=null && r.total && state!=='Skipped')row.append(node('span',r.correct+' / '+r.total+' correct'));
  if(r?.words!=null)row.append(node('span',r.words+' words'));
  if(r?.feedback)row.append(node('small',r.feedback));
  if(editable && interactive)row.append(link(state==='Not started'?'Start':'Open',url(b,t,s,n),'button'));
  if(r?.review?.length)row.append(answerReview(r.review));
  if(editable && localTracker) {
    const d=node('details'); d.append(node('summary','Status & feedback'));
    d.append(editor(b,t,s,n,r,state));row.append(d);
  }
  return row;
}
function editor(b,t,s,n,r,current) {
  const f=node('form',undefined,'manual');
  const select=node('select');
  for(const a of states)select.add(new Option(a,a));
  select.value=states.includes(current)?current:'In progress';
  f.append(field('Status',select));
  let correct,total;
  if(objective(s) && !interactive) {
    correct=numeric(40,r?.correct);total=numeric(40,r?.total);total.min=1;
    f.append(field('Correct',correct),field('Out of',total));
  }
  const note=node('textarea'); note.value=r?.feedback || '';
  f.append(field('Feedback',note),node('button','Save'));
  f.onsubmit=e=>{
    e.preventDefault();
    if(correct && (Boolean(correct.value)!==Boolean(total.value) || Number(correct.value)>Number(total.value))) {
      message('Enter both scores, with the correct count no higher than the total.');return;
    }
    const values={...r,status:select.value,feedback:note.value,updated:new Date().toISOString()};
    if(correct){values.correct=correct.value===''?null:Number(correct.value);values.total=total.value===''?null:Number(total.value);}
    if(select.value==='Skipped' || select.value==='Not started') {
      for(const k of ['correct','total','review','answered','words','snapshot']) delete values[k];
    }
    write(id(b,t,s,'part',n),values);render();
  };
  return f;
}
function bandEditor(s) {
  const f=node('form',undefined,'bandform');
  const band=numeric(9,read(id(book,test,s,'band'))?.value,0.5);
  f.append(field('Assessed '+s+' band',band),node('button','Save band'));
  f.onsubmit=e=>{e.preventDefault();write(id(book,test,s,'band'),{value:band.value===''?null:Number(band.value)});render();};
  return f;
}
const finishedStates = new Set(['Completed','Reviewed','Needs review']);
const fullTestParts = Object.values(partCounts).reduce((sum,n) => sum+n,0);
const libraryBooks = [18,19,20,21];
let selectedBook = libraryBooks.includes(Number(params.get('library'))) ? Number(params.get('library')) : 18;

function partsFor(b,t,s) {
  return Array.from({length:partCounts[s]},(_,i)=>partState(b,t,s,i+1));
}
function completedCount(b,t) {
  return skills.flatMap(s=>partsFor(b,t,s)).filter(state=>finishedStates.has(state)).length;
}
function meter(value,max,label) {
  const progress=node('progress');
  progress.max=max;
  progress.value=value;
  progress.setAttribute('aria-label',label);
  return progress;
}
function overview() {
  const wrap=node('div',undefined,'overview');
  const feature=node('section',undefined,'practice-card');
  const candidates=['Writing','Speaking','Reading','Listening'].flatMap(s=>
    partsFor(18,1,s).map((status,i)=>({s,n:i+1,status})));
  const next=candidates.find(p=>['In progress','Revised draft'].includes(p.status))
    || candidates.find(p=>p.status==='Not started');
  feature.append(node('p','On computer','feature-label'),node('h2','Cambridge 18 · Test 1'));
  if(next) {
    feature.append(node('p',next.s+'  /  '+partLabels[next.s]+' '+next.n,'feature-part'));
    const action=next.status==='Not started'?'Start '+next.s.toLowerCase():'Resume '+next.s.toLowerCase();
    feature.append(link(action+'  →',url(18,1,next.s,next.n),'button primary'));
  } else {
    feature.append(link('Review test results  →',url(18,1),'button primary'));
  }
  const progress=node('section',undefined,'progress-card');
  progress.append(node('h2','Progress by skill'));
  for(const s of skills) {
    const all=libraryBooks.flatMap(b=>[1,2,3,4].flatMap(t=>partsFor(b,t,s)));
    const done=all.filter(x=>finishedStates.has(x)).length;
    const skipped=all.filter(x=>x==='Skipped').length;
    const available=all.length-skipped;
    const line=node('div',undefined,'skill-progress');
    line.append(node('span',s),meter(done,available||1,s+' parts completed'),node('small',done+' / '+available+(skipped?' · '+skipped+' skipped':'')));
    progress.append(line);
  }
  wrap.append(feature,progress);
  return wrap;
}
function renderTest() {
  document.getElementById('title').textContent='Cambridge '+book+' · Test '+test;
  const intro=node('div',undefined,'test-intro');
  intro.append(link('← Test library','index.html?library='+book),node('span',completedCount(book,test)+' of '+fullTestParts+' parts completed'));
  if(localTracker) {
    const sources=link('Extracted text ↗',testFolder+'Source text/');
    sources.target='_blank';
    intro.append(sources);
    if(!interactive) {
      const pdf='Cambridge Practice Tests/Cambridge IELTS '+book+' Academic/Cambridge IELTS '+book+' Academic.pdf';
      intro.append(link('Open book PDF ↗',pdf));
      intro.lastChild.target='_blank';
    }
  }
  content.append(intro);
  const grid=node('div',undefined,'test-grid');
  for(const s of skills) {
    const box=node('article',undefined,'skill-card'), head=node('div',undefined,'cardhead');
    const band=read(id(book,test,s,'band'))?.value;
    head.append(node('h2',s),node('span',band==null?'Band —':'Band '+band,'band'));
    box.append(head,node('p',skillSummary(book,test,s),'summaryline'));
    for(let n=1;n<=partCounts[s];n++)box.append(resultLine(book,test,s,n,true));
    if(localTracker) {
      const assessment=node('details',undefined,'assessment');
      assessment.append(node('summary',band==null?'Add assessed band':'Edit assessed band'),bandEditor(s));
      box.append(assessment);
    }
    grid.append(box);
  }
  content.append(grid);
}
function libraryTest(b,t) {
  const box=node('details',undefined,'booktest'), summary=node('summary');
  const done=completedCount(b,t);
  const label=node('span',undefined,'test-name');
  label.append(node('strong','Test '+t),node('small',b===18 && t===1?'Computer practice':localTracker?'Manual entry':'Offline practice'));
  const prog=node('span',undefined,'test-progress');
  prog.append(meter(done,fullTestParts,'Parts completed'),node('small',done+' / '+fullTestParts+' completed'));
  const score=node('span',undefined,'row-score');
  const marks=[];
  for(const s of skills) {
    const band=read(id(b,t,s,'band'))?.value;
    const raw=rawTotal(b,t,s);
    if(band!=null || raw)marks.push(s+' '+(band!=null?'band '+band:raw.split(' ')[0]));
  }
  const bands=skills.map(s=>read(id(b,t,s,'band'))?.value);
  if(bands.every(v=>typeof v==='number'))marks.unshift('Overall '+(Math.round(bands.reduce((a,x)=>a+x,0)/2)/2));
  score.textContent=marks.join(' · ') || '—';
  const destination=link(b===18 && t===1?'Open test →':localTracker?'Log results →':'View results →',url(b,t),'row-link');
  destination.setAttribute('aria-label',destination.textContent+' Cambridge '+b+', Test '+t);
  summary.append(label,prog,score,destination);
  const detail=node('div',undefined,'breakdown');
  for(const s of skills) {
    const group=node('div');
    group.append(node('h3',s),node('p',skillSummary(b,t,s),'summaryline'));
    for(let n=1;n<=partCounts[s];n++)group.append(resultLine(b,t,s,n,false));
    detail.append(group);
  }
  box.append(summary,detail);
  return box;
}
function renderLibrary() {
  content.append(overview());
  const heading=node('div',undefined,'library-heading');
  heading.append(node('h2','Test library'),node('span','4 books · 16 tests','quiet'));
  content.append(heading);
  const picker=node('div',undefined,'book-picker');
  picker.setAttribute('role','group');
  picker.setAttribute('aria-label','Choose a Cambridge book');
  const groups=new Map();
  for(const b of libraryBooks) {
    const btn=node('button',undefined,'book-option');
    btn.dataset.book=b;
    const spine=node('span',String(b),'spine');
    spine.setAttribute('aria-hidden','true');
    const text=node('span');
    text.append(node('strong','Cambridge '+b),node('small','Academic'));
    btn.append(spine,text);
    btn.setAttribute('aria-pressed',String(b===selectedBook));
    btn.onclick=()=>{
      selectedBook=b;
      for(const other of picker.children)other.setAttribute('aria-pressed',String(other===btn));
      for(const [number,group] of groups)group.hidden=number!==b;
      const tabURL=new URL(location.href);tabURL.searchParams.set('library',b);
      try { history.replaceState(null,'',tabURL); } catch {}
    };
    picker.append(btn);
  }
  content.append(picker);
  for(const b of libraryBooks) {
    const block=node('section',undefined,'book-list');
    block.setAttribute('aria-label','Cambridge '+b+' tests');
    const cols=node('div',undefined,'columns');
    for(const col of ['Test','Progress','Scores',''])cols.append(node('span',col));
    block.append(cols);
    for(let t=1;t<=4;t++)block.append(libraryTest(b,t));
    block.hidden=b!==selectedBook;
    groups.set(b,block);
    content.append(block);
  }
}
function render() {
  if(practice)return;
  content.replaceChildren();
  if(inTest)renderTest();
  else renderLibrary();
}
function allRecords() {
  const collected={};
  try {
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k?.startsWith(prefix))collected[k.slice(prefix.length)]=read(k.slice(prefix.length));
    }
  } catch {}
  for(const [k,v] of memory)collected[k]=v;
  return collected;
}
function exportResults(testOnly) {
  const records=allRecords();
  const selected=testOnly?Object.fromEntries(Object.entries(records).filter(([k])=>k.startsWith(testId+'/'))):records;
  const data={format:'ielts-practice-1',exported:new Date().toISOString(),records:selected};
  const blob=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=link('Download',blob);
  a.download=(testOnly?'IELTS-Cambridge-'+book+'-Test-'+test:'IELTS-results')+'-'+data.exported.slice(0,10)+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(blob),30000);
}
const backup=document.getElementById('backup');
backup.textContent=inTest?'Download test results':'Download results';
backup.onclick=()=>exportResults(inTest);
const restore=document.getElementById('restore');
restore.hidden=!localTracker;
if(localTracker)restore.onclick=()=>document.getElementById('file').click();
if(!localTracker && !practice)message('Read-only tracker. Online practice stays in this browser. Download your results to import them into your local tracker.');
const isObj=v=>v!==null && typeof v==='object' && !Array.isArray(v);
function validDraft(v) {
  return isObj(v) && isObj(v.answers) && Object.entries(v.answers).every(([k,a])=>
    /^(q\d+(?:-\d+)?|task[12]|notes[123])$/.test(k) &&
    (typeof a==='string' || Array.isArray(a) && a.every(x=>typeof x==='string')));
}
function validRecord(key,v) {
  const m=/^(18|19|20|21)-[1-4]\/(Reading|Writing|Listening|Speaking)\/(band|draft|part)(?:\/([1-4]))?$/.exec(key);
  if(!m || !isObj(v))return false;
  if(m[3]==='draft')return !m[4] && validDraft(v);
  if(m[3]==='band')return !m[4] && (v.value===null || Number.isInteger(v.value*2) && typeof v.value==='number' && v.value>=0 && v.value<=9);
  return Number(m[4])>=1 && Number(m[4])<=partCounts[m[2]] && states.includes(v.status) &&
    (v.correct==null || Number.isInteger(v.correct) && Number.isInteger(v.total) && v.correct>=0 && v.total>=1 && v.total<=40 && v.correct<=v.total) &&
    (!v.review || Array.isArray(v.review) && v.review.every(q=>isObj(q) && typeof q.key==='string')) &&
    (!v.snapshot || validDraft({answers:v.snapshot}));
}
document.getElementById('file').onchange=async e=>{
  if(!localTracker)return;
  const file=e.target.files[0]; if(!file)return;
  try {
    const data=JSON.parse(await file.text());
    if(data.format!=='ielts-practice-1' || !isObj(data.records) || !Object.entries(data.records).every(([k,v])=>validRecord(k,v))) throw Error();
    const entries=Object.entries(data.records);
    const conflicts=entries.filter(([k,v])=>read(k) && JSON.stringify(read(k))!==JSON.stringify(v));
    if(conflicts.length && !confirm('Replace '+conflicts.length+' existing entries with the imported versions?'))return;
    let saved=true;
    for(const [k,v] of entries) {
      if(k.endsWith('/draft'))v.editedAt=Date.now();
      if(!write(k,v))saved=false;
    }
    message('Imported '+entries.length+' entries.'+(saved?'':' Export before closing; browser storage is unavailable.'));
    render();
  } catch {message('This file is not a valid IELTS results backup.');}
  finally {e.target.value='';}
};
if (practice) {
  const back=document.getElementById('back');back.href=url(book,test);back.hidden=false;
  document.getElementById('dashboard').hidden=true;
  document.getElementById('location').textContent='Cambridge '+book+' · Test '+test+' · '+skill;
  document.title=skill+' · Cambridge '+book+' · Test '+test;
  document.body.classList.add('inpractice');
  const download=document.getElementById('practice-export');
  download.hidden=false;download.onclick=()=>exportResults(true);
  const key=id(book,test,skill,'draft');
  window.addEventListener('message',e=>{
    if(e.source!==frame.contentWindow || !isObj(e.data) || e.data.channel!=='ielts18-test1')return;
    const msg=e.data;
    function send(data){frame.contentWindow.postMessage({channel:'ielts18-test1',...data},'*');}
    if(msg.type==='ready') {
      send({type:'start',draft:read(key),part:Number(params.get('part'))});
    } else if(msg.type==='draft' && validDraft(msg.value)) {
      const ok=write(key,msg.value);
      if(!ok)send({type:'notice',text:'Browser storage unavailable. Export results before closing.'});
    } else if(msg.type==='submit' && Number.isInteger(msg.part) && msg.part>=1 && msg.part<=partCounts[skill] && validDraft(msg.value)) {
      const n=msg.part;
      write(key,msg.value);
      const answers=snapshot(skill,n,msg.value.answers);
      const result={status:objective(skill)?'Completed':'Needs review',snapshot:answers,updated:new Date().toISOString()};
      let text;
      if(objective(skill)){
        Object.assign(result,scorePart(skill,n,answers));
        text=result.correct+' / '+result.total+' correct · '+(result.total-result.answered)+' unanswered';
      } else {
        if(skill==='Writing')result.words=(answers['task'+n]||'').trim().split(/\s+/).filter(Boolean).length;
        text='Saved for review';
      }
      const prev=report(book,test,skill,n);
      if(prev?.feedback)result.feedback=prev.feedback;
      const saved=write(id(book,test,skill,'part',n),result);
      send({type:'notice',text:partLabels[skill]+' '+n+' · '+text+(saved?'':' · Export results before closing.')});
    }
  });
  frame.hidden=false;
  frame.src=testFolder+skill+'.html';
} else {
  window.addEventListener('storage',e=>{if(e.key===null || e.key.startsWith(prefix))render();});
  render();
}
