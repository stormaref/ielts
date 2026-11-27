'use strict';

function showMicrophoneSignal(canvas, recorder) {
  const pen = canvas?.getContext('2d');
  if (!pen || !window.AudioContext) return;

  let context, interval;
  function close() {
    clearInterval(interval);
    canvas.hidden = true;
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }
  try {
    context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(recorder.stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const history = new Float32Array(64);
    const spacing = canvas.width / history.length;
    pen.fillStyle = getComputedStyle(canvas).color;

    function draw() {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      history.copyWithin(0, 1);
      history[history.length - 1] = Math.min(1, Math.sqrt(rms) * 2);
      pen.clearRect(0, 0, canvas.width, canvas.height);
      history.forEach((level, i) => {
        const height = Math.max(2, level * (canvas.height - 4));
        pen.fillRect(i * spacing, (canvas.height - height) / 2, spacing * 0.55, height);
      });
    }

    recorder.addEventListener('stop', close, {once:true});
    canvas.hidden = false;
    draw();
    interval = setInterval(draw, 50);
    context.resume().catch(close);
  } catch {
    close();
  }
}
