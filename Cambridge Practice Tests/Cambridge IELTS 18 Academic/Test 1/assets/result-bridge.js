'use strict';

// Run the four local practice pages inside the tracker so their result store is shared.
const trackerURL = new URL('../../../index.html',location.href);
trackerURL.search = new URLSearchParams({book:18,test:1,skill:document.body.dataset.skill});
if (window.parent === window) {
  location.replace(trackerURL);
} else {
  const tellTracker = data => parent.postMessage({channel:'ielts18-test1',...data},'*');
  const savePart = document.createElement('button');
  savePart.id='submit-part';
  const responseNotice=document.createElement('span');
  responseNotice.id='result-notice';
  responseNotice.setAttribute('role','status');
  document.querySelector('footer').insertBefore(responseNotice,document.getElementById('download'));
  document.querySelector('footer').insertBefore(savePart,responseNotice);
  savePart.disabled=true;
  const partType=skill==='Reading'?'passage':skill==='Writing'?'task':'part';
  savePart.textContent=(skill==='Reading' || skill==='Listening'?'Mark this ':'Save this ')+partType;
  document.querySelectorAll('header nav a').forEach(a=>{
    const dest=new URL(trackerURL);dest.searchParams.set('skill',a.textContent.trim());
    a.href=dest.href;a.target='_top';
  });
  const skillNav = document.querySelector('header nav');
  document.querySelector('.toolbar').insertBefore(skillNav,document.querySelector('.clock'));
  document.querySelector('header').hidden = true;

  const panePicker = document.createElement('div');
  panePicker.className = 'pane-picker';
  panePicker.setAttribute('role','group');
  panePicker.setAttribute('aria-label','Practice view');
  const paneLabels = {
    Reading: ['Passage','Questions'], Listening: ['Instructions','Questions'],
    Writing: ['Prompt','Response'], Speaking: ['Prompt','Response']
  };
  for (const [index,label] of paneLabels[skill].entries()) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.setAttribute('aria-pressed',String(index===0));
    btn.onclick = () => {
      document.body.dataset.pane = index===0?'prompt':'response';
      for (const item of panePicker.children) item.setAttribute('aria-pressed',String(item===btn));
    };
    panePicker.append(btn);
  }
  document.body.dataset.pane = 'prompt';
  document.querySelector('.parts').after(panePicker);
  let initialized=false;
  window.addEventListener('ielts-draft',()=>{if(initialized)tellTracker({type:'draft',value:state});});
  window.addEventListener('message',e=>{
    if(e.source!==parent || e.data?.channel!=='ielts18-test1')return;
    if(e.data.type==='notice'){responseNotice.textContent=e.data.text;return;}
    if(e.data.type!=='start' || initialized)return;
    if(e.data.draft?.answers && (e.data.draft.editedAt || 0) >= (state.editedAt || 0)){
      Object.assign(state,e.data.draft);
      restoreFields();
    }
    document.body.dataset.ready = "true";
    showPart(e.data.part || state.tab);
    initialized=true;
    updateCounts();tick();persist();
    savePart.disabled=false;
  });
  savePart.onclick=()=>{
    const panel=sections[state.tab-1];
    const answerFields=[...panel.querySelectorAll('input[name],select[name],textarea[name]')];
    const hasAnswer=answerFields.some(el=>['radio','checkbox'].includes(el.type)?el.checked:el.value.trim());
    if(!hasAnswer && skill!=='Speaking'){responseNotice.textContent='Enter an answer first.';return;}
    if(skill==='Speaking' && activeRecorder?.state==='recording'){responseNotice.textContent='Stop your recording before saving this part.';return;}
    if(skill==='Reading'||skill==='Listening'){
      const blanks=answerFields.some(el=>{
        if(el.type==='radio')return !answerFields.some(x=>x.name===el.name && x.checked);
        if(el.type==='checkbox')return answerFields.filter(x=>x.name===el.name && x.checked).length<2;
        return !el.value.trim();
      });
      if(blanks && !confirm('Mark this '+partType+' with unanswered questions? You can revise it and mark it again.'))return;
    }
    tellTracker({type:'submit',part:state.tab,value:state});
  };
  tellTracker({type:'ready'});
}
