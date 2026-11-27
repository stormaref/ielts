'use strict';

const skill = document.body.dataset.skill;
const storageKey = 'cambridge-academic-18-test-1-v1-' + skill;
const sections = [...document.querySelectorAll('.section')];
const fields = [...document.querySelectorAll('[name]')].filter(el => el.matches('input,textarea,select'));
const names = [...new Set(fields.map(el => el.name))];
const statusText = document.getElementById('save-state');
const clock = document.getElementById('clock');
const timer = document.getElementById('timer');
const duration = Number(document.body.dataset.minutes) * 60;
let state = { answers: {}, tab: 1, remaining: duration, deadline: 0 };
let storageAvailable = true;
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored && stored.answers && typeof stored.answers === 'object') Object.assign(state, stored);
} catch { storageAvailable = false; }

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  updateStatus();
  window.dispatchEvent(new Event('ielts-draft'));
}

function updateStatus() {
  let message = storageAvailable ? 'Saved in this browser' : 'Browser storage unavailable · download your answers';
  if (skill === 'Reading' || skill === 'Listening') {
    const count = Object.values(state.answers).reduce((sum, val) => sum + (Array.isArray(val) ? val.length : Number(Boolean(val.trim()))), 0);
    message += ' · ' + count + ' / 40 answered';
  }
  statusText.textContent = message;
}

function updateCounts() {
  if (skill === 'Reading' || skill === 'Listening') {
    document.querySelectorAll('[data-tab]').forEach((button,index) => {
      const controls = [...sections[index].querySelectorAll('input,select')];
      const grouped = new Set(controls.map(el => el.name));
      let total = 0, answered = 0;
      for (const name of grouped) {
        const pair = name.includes('-');
        total += pair ? 2 : 1;
        const value = state.answers[name];
        answered += pair ? (Array.isArray(value) ? value.length : 0) : Number(Boolean(value?.trim()));
      }
      let count = button.querySelector('small');
      if (!count) { count = document.createElement('small'); button.append(' ',count); }
      count.textContent = answered + '/' + total;
      count.setAttribute('aria-label',answered+' of '+total+' answered');
    });
  }
  document.querySelectorAll('.count').forEach(el => {
    const words = document.getElementById(el.dataset.for).value.trim();
    const count = words ? words.split(/\s+/u).length : 0;
    el.textContent = count + (count === 1 ? ' word' : ' words');
  });
  document.querySelectorAll('[data-pair]').forEach(group => {
    const full = group.querySelectorAll(':checked').length >= 2;
    group.querySelectorAll('input').forEach(el => { el.disabled = full && !el.checked; });
  });
}

function restoreFields() {
  for (const el of fields) {
    const value = state.answers[el.name];
    if (el.type === 'checkbox') el.checked = Array.isArray(value) && value.includes(el.value);
    else if (el.type === 'radio') el.checked = value === el.value;
    else el.value = value || '';
  }
}
restoreFields();
for (const el of fields) {
  el.addEventListener('input', () => {
    if (el.type === 'checkbox') {
      state.answers[el.name] = fields.filter(item => item.name === el.name && item.checked).map(item => item.value);
    } else {
      state.answers[el.name] = el.value;
    }
    state.editedAt = Date.now();
    updateCounts();
    persist();
  });
}

let activeRecorder = null;
function showPart(n) {
  if (!sections[n-1]) n = 1;
  sections.forEach((section, i) => {
    section.hidden = i !== n-1;
    if (section.hidden) section.querySelectorAll('audio').forEach(player => player.pause());
  });
  document.querySelectorAll('[data-tab]').forEach(btn => btn.setAttribute('aria-pressed', String(Number(btn.dataset.tab) === n)));
  state.tab = n;
  if (document.body.dataset.ready) sections[n-1].querySelectorAll('[data-src]').forEach(loadMedia);
}
document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
  if (activeRecorder?.state === 'recording') activeRecorder.stop();
  showPart(Number(btn.dataset.tab));
  persist();
}));

function secondsLeft() {
  return state.deadline ? Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) : state.remaining;
}
function tick() {
  const seconds = secondsLeft();
  clock.textContent = String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
  if (!seconds && state.deadline) {
    state.deadline = 0;
    state.remaining = 0;
    persist();
  }
  timer.textContent = state.deadline ? 'Pause timer' : seconds === 0 ? 'Restart timer' : seconds === duration ? 'Start timer' : 'Resume timer';
}
timer.addEventListener('click', () => {
  if (state.deadline) {
    state.remaining = secondsLeft();
    state.deadline = 0;
  } else {
    state.deadline = Date.now() + (state.remaining || duration) * 1000;
  }
  persist();
  tick();
});
setInterval(tick, 500);

document.getElementById('download').addEventListener('click', () => {
  const lines = ['Cambridge IELTS 18 Academic · Test 1 · ' + skill, ''];
  for (const name of names) {
    const answer = state.answers[name];
    const title = name.replace(/^q/, 'Question ').replace(/^task/, 'Writing task ').replace(/^notes/, 'Speaking notes, part ');
    lines.push(title, (Array.isArray(answer) ? answer.join(', ') : answer) || '(blank)', '');
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Cambridge 18 - Test 1 - ' + skill + '.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});

for (const box of document.querySelectorAll('.recorder')) {
  const btn = box.querySelector('button');
  const note = box.querySelector('.rec-status');
  btn.addEventListener('click', async () => {
    if (activeRecorder?.state === 'recording') { activeRecorder.stop(); return; }
    btn.disabled = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio:true});
      if (box.closest('.section').hidden) return;
      const recorder = new MediaRecorder(stream);
      activeRecorder = recorder;
      const buffers = [];
      const started = performance.now();
      recorder.ondataavailable = event => { if (event.data.size) buffers.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const url = URL.createObjectURL(new Blob(buffers, {type:recorder.mimeType}));
        const player = document.createElement('audio');
        player.dataset.src = url;
        player.dataset.seconds = (performance.now() - started) / 1000;
        player.setAttribute('aria-label','Speaking part '+box.dataset.part+' recording');

        const link = document.createElement('a');
        link.textContent = 'Download recording';
        link.href = url;
        link.download = 'Cambridge 18 - Test 1 - Speaking Part ' + box.dataset.part + (recorder.mimeType.includes('mp4') ? '.mp4' : '.webm');
        box.querySelector('.clips').append(player,link);
        loadMedia(player);
        btn.textContent = 'Record again';
        note.textContent = 'Download to keep this recording.';
        activeRecorder = null;
      };
      recorder.start();
      btn.textContent = 'Stop recording';
      note.textContent = 'Recording…';
    } catch {
      note.textContent = 'Microphone unavailable. Check browser permission or record on your phone.';
    } finally {
      if (stream && !activeRecorder) stream.getTracks().forEach(track => track.stop());
      btn.disabled = false;
    }
  });
}

showPart(state.tab);
updateCounts();
tick();
persist();
