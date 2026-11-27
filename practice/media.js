'use strict';

function mediaTime(seconds) {
  const t = Math.floor(Number.isFinite(seconds) ? seconds : 0);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function audioControls(audio) {
  const box = document.createElement('div');
  box.className = 'audio-player';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', audio.getAttribute('aria-label') || 'Recorded response');
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'play-toggle';
  play.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path class="play-icon" d="M7 4v16l13-8z"/><path class="pause-icon" d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';
  const seek = document.createElement('input');
  seek.type = 'range';
  seek.min = 0;
  seek.step = 0.1;
  seek.value = 0;
  seek.setAttribute('aria-label', 'Playback position');
  const time = document.createElement('span');
  time.className = 'play-time';
  box.append(play, seek, time);
  audio.before(box);
  audio.hidden = true;
  function sync() {
    const length = Number.isFinite(audio.duration) ? audio.duration : Number(audio.dataset.seconds) || 0;
    const action = audio.paused ? 'Play' : 'Pause';
    play.setAttribute('aria-label', action);
    play.title = action;
    play.dataset.playing = String(!audio.paused);
    play.disabled = audio.readyState < 2 || Boolean(audio.error);
    seek.disabled = !length || play.disabled;
    seek.max = length;
    seek.value = audio.currentTime;
    time.textContent = mediaTime(audio.currentTime) + ' / ' + mediaTime(length);
    seek.setAttribute('aria-valuetext', time.textContent);
  }
  play.onclick = async () => {
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); }
    catch { if (audio.error) audio.dispatchEvent(new Event('error')); }
  };
  seek.oninput = () => { audio.currentTime = Number(seek.value); };
  for (const event of ['loadeddata','canplay','durationchange','timeupdate','play','pause','ended','error','emptied']) {
    audio.addEventListener(event, sync);
  }
  sync();
  return box;
}

function loadMedia(asset) {
  if (asset.dataset.started) return;
  asset.dataset.started = 'true';
  const isAudio = asset instanceof HTMLAudioElement;
  const control = isAudio ? audioControls(asset) : asset;
  const status = document.createElement('div');
  status.className = 'media-transfer';
  const description = document.createElement('span');
  const progress = document.createElement('progress');
  progress.setAttribute('aria-label', isAudio ? 'Audio download' : 'Image download');
  const retry = document.createElement('button');
  retry.textContent = 'Retry';
  status.append(description, progress, retry);
  if (isAudio) control.append(status);
  else control.before(status);
  const source = new URL(asset.dataset.src, document.baseURI);
  let downloadedURL;
  function failed() {
    status.hidden = false;
    progress.hidden = true;
    retry.hidden = false;
    description.textContent = isAudio ? 'Audio could not load.' : 'Full-size image could not load.';
  }
  asset.addEventListener('error', failed);
  asset.addEventListener(isAudio ? 'loadeddata' : 'load', () => {
    if (isAudio || asset.src === downloadedURL || asset.src === source.href) status.hidden = true;
  });
  function start() {
    status.hidden = progress.hidden = false;
    retry.hidden = true;
    progress.removeAttribute('value');
    if (downloadedURL) URL.revokeObjectURL(downloadedURL);
    if (source.protocol !== 'http:' && source.protocol !== 'https:') {
      description.textContent = isAudio ? 'Loading audio…' : 'Loading image…';
      asset.src = source.href;
      if (isAudio) asset.load();
      return;
    }
    const request = new XMLHttpRequest();
    request.open('GET', source);
    request.responseType = 'blob';
    description.textContent = isAudio ? 'Downloading audio…' : 'Downloading image…';
    request.onprogress = event => {
      if (event.lengthComputable && event.total > 0) {
        progress.max = event.total;
        progress.value = event.loaded;
        description.textContent = 'Downloading · ' + Math.round(100 * event.loaded / event.total) + '%';
      }
    };
    request.onerror = request.ontimeout = failed;
    request.onload = () => {
      if (request.status < 200 || request.status >= 300 || !request.response.size) { failed(); return; }
      downloadedURL = URL.createObjectURL(request.response);
      asset.src = downloadedURL;
      if (isAudio) asset.load();
    };
    request.send();
  }
  retry.onclick = start;
  start();
}
