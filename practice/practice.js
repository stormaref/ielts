'use strict';

const {book, test, skill} = document.body.dataset;
const testName = 'Cambridge ' + book + ' - Test ' + test;
const channel = 'ielts-' + book + '-' + test;
const storageKey = 'cambridge-academic-' + book + '-test-' + test + '-v1-' + skill;
const sections = [...document.querySelectorAll('.section')];
const fields = [...document.querySelectorAll('[name]')].filter(el => el.matches('input,textarea,select'));
const names = [...new Set(fields.map(el => el.name))];
const statusText = document.getElementById('save-state');
const clock = document.getElementById('clock');
const timer = document.getElementById('timer');
const timerStatus = document.getElementById('timer-status');
const resetTimer = document.getElementById('reset-timer');
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
  document.querySelectorAll('.listening-track').forEach(track => {
    track.hidden = Number(track.dataset.track) !== n;
    const audio = track.querySelector('audio');
    if (track.hidden) audio.pause();
    else if (document.body.dataset.ready) loadMedia(audio);
  });
  state.tab = n;
  if (document.body.dataset.ready) sections[n-1].querySelectorAll('[data-src]').forEach(loadMedia);
}
document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
  if (activeRecorder?.state === 'recording') activeRecorder.stop();
  showPart(Number(btn.dataset.tab));
  persist();
}));

function secondsLeft() {
  return state.deadline ? Math.max(0, (state.deadline - Date.now()) / 1000) : state.remaining;
}
function tick() {
  if (!clock) return;
  const seconds = Math.ceil(secondsLeft());
  clock.textContent = String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
  if (!seconds && state.deadline) {
    state.deadline = 0;
    state.remaining = 0;
    delete state.mediaTimer;
    persist();
  }
  if (timerStatus) {
    const label = state.deadline ? 'Running' : seconds === 0 ? 'Time up' : state.remaining === duration ? 'Starts with audio' : 'Paused';
    if (timerStatus.textContent !== label) timerStatus.textContent = label;
    resetTimer.hidden = seconds > 0;
    return;
  }
  timer.textContent = state.deadline ? 'Pause timer' : seconds === 0 ? 'Restart timer' : seconds === duration ? 'Start timer' : 'Resume timer';
}
const speakingMedia = new Set();
function startSpeakingTimer(source) {
  if (speakingMedia.has(source)) return;
  speakingMedia.add(source);
  if (secondsLeft() <= 0) return;
  state.mediaTimer = true;
  if (!state.deadline) state.deadline = Date.now() + state.remaining * 1000;
  saveTimer();
}
function stopSpeakingTimer(source) {
  if (speakingMedia.delete(source) && !speakingMedia.size && state.mediaTimer) {
    pauseTimer();
    saveTimer();
  }
}
function pauseTimer() {
  state.remaining = secondsLeft();
  state.deadline = 0;
  delete state.mediaTimer;
}
function saveTimer() {
  state.editedAt = Date.now();
  tick();
  persist();
}
timer?.addEventListener('click', () => {
  if (state.deadline) pauseTimer();
  else {
    state.deadline = Date.now() + (state.remaining || duration) * 1000;
    if (speakingMedia.size) state.mediaTimer = true;
  }
  saveTimer();
});
if (skill === 'Speaking') {
  resetTimer?.addEventListener('click', () => {
    state.remaining = duration;
    if (speakingMedia.size) {
      state.deadline = Date.now() + duration * 1000;
      state.mediaTimer = true;
    }
    saveTimer();
  });
  window.addEventListener('pagehide', () => {
    if (activeRecorder?.state === 'recording') activeRecorder.stop();
    if (state.mediaTimer) {
      pauseTimer();
      saveTimer();
    }
  });
}
if (clock) setInterval(tick, 500);

document.getElementById('download').addEventListener('click', () => {
  const lines = [testName + ' · ' + skill, ''];
  for (const name of names) {
    const answer = state.answers[name];
    const title = name.replace(/^q/, 'Question ').replace(/^task/, 'Writing task ').replace(/^notes/, 'Speaking notes, part ');
    lines.push(title, (Array.isArray(answer) ? answer.join(', ') : answer) || '(blank)', '');
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = testName + ' - ' + skill + '.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});

for (const box of document.querySelectorAll('.recorder')) {
  const btn = box.querySelector('button');
  const note = box.querySelector('.rec-status');
  const clips = box.querySelector('.clips');
  let takeNumber = 0;
  const elapsed = document.createElement('span');
  elapsed.className = 'rec-elapsed';
  elapsed.setAttribute('role', 'timer');
  elapsed.setAttribute('aria-label', 'Recording duration');
  elapsed.hidden = true;
  btn.after(elapsed);
  btn.addEventListener('click', async () => {
    if (activeRecorder?.state === 'recording') { activeRecorder.stop(); return; }
    btn.disabled = true;
    let stream, recorder;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio:true});
      if (box.closest('.section').hidden) return;
      recorder = new MediaRecorder(stream);
      const buffers = [];
      let started, refresh;
      function updateElapsed() {
        const seconds = (performance.now() - started) / 1000;
        elapsed.textContent = mediaTime(seconds);
        return seconds;
      }
      recorder.ondataavailable = event => { if (event.data.size) buffers.push(event.data); };
      recorder.onstop = () => {
        clearInterval(refresh);
        const recordedSeconds = updateElapsed();
        delete box.dataset.recording;
        stopSpeakingTimer(recorder);
        if (activeRecorder === recorder) activeRecorder = null;
        stream.getTracks().forEach(track => track.stop());
        const url = URL.createObjectURL(new Blob(buffers, {type:recorder.mimeType}));
        const player = document.createElement('audio');
        player.addEventListener('playing', () => startSpeakingTimer(player));
        for (const event of ['pause','ended','waiting','emptied','error']) {
          player.addEventListener(event, () => stopSpeakingTimer(player));
        }
        player.dataset.src = url;
        player.dataset.seconds = recordedSeconds;
        player.setAttribute('aria-label','Speaking part '+box.dataset.part+' recording');

        const link = document.createElement('a');
        link.textContent = 'Download recording';
        link.href = url;
        link.download = testName + ' - Speaking Part ' + box.dataset.part + (recorder.mimeType.includes('mp4') ? '.mp4' : '.webm');
        const clip = document.createElement('div');
        clip.className = 'recorded-clip';
        const title = document.createElement('strong');
        title.textContent = 'Take ' + (++takeNumber);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove recording';
        remove.setAttribute('aria-label', 'Remove ' + title.textContent);
        remove.onclick = () => {
          if (!confirm('Remove ' + title.textContent + ' from Speaking Part ' + box.dataset.part + '?')) return;
          player.pause();
          stopSpeakingTimer(player);
          player.removeAttribute('src');
          player.load();
          URL.revokeObjectURL(url);
          clip.remove();
          if (!box.dataset.recording) {
            const last = clips.querySelector('.recorded-clip:last-child audio');
            elapsed.hidden = !last;
            if (last) elapsed.textContent = mediaTime(Number(last.dataset.seconds));
            btn.textContent = last ? 'Record again' : 'Record response';
            note.textContent = 'Recording removed.';
          }
          btn.focus();
        };
        clip.append(title,player,link,remove);
        clips.append(clip);
        loadMedia(player);
        btn.textContent = 'Record again';
        note.textContent = 'Download to keep this recording.';
      };
      recorder.start();
      started = performance.now();
      updateElapsed();
      elapsed.hidden = false;
      refresh = setInterval(updateElapsed, 200);
      activeRecorder = recorder;
      startSpeakingTimer(recorder);
      btn.textContent = 'Stop recording';
      note.textContent = 'Recording…';
      box.dataset.recording = 'true';
      window.showMicrophoneSignal?.(box.querySelector('.mic-signal'), recorder);
    } catch {
      note.textContent = 'Microphone unavailable. Check browser permission or record on your phone.';
    } finally {
      if (stream && recorder?.state !== 'recording') stream.getTracks().forEach(track => track.stop());
      btn.disabled = false;
    }
  });
}

showPart(state.tab);
updateCounts();
tick();
persist();
