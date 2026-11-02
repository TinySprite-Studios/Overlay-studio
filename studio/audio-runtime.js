// Served with the selected scene's audio settings by Studio.
(() => {
  // Portrait wrappers and custom overlays may contain other scene frames.
  try { if (parent !== window && parent.location.origin === location.origin) return; } catch {}
  const {scene, alerts, offline} = window.TSS_STUDIO_AUDIO;
  const players = new Set();
  const queue = [];
  let alertPlaying = false;

  function play(sound, done = () => {}) {
    if (!sound?.file || sound.volume === 0) { done(); return; }
    const player = document.createElement('audio');
    player.src = '/' + sound.file.split('/').map(encodeURIComponent).join('/');
    player.volume = sound.volume / 100;
    player.dataset.studioAudio = 'true';
    document.body.append(player);
    players.add(player);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      player.pause();
      player.remove();
      players.delete(player);
      done();
    };
    player.onended = player.onerror = finish;
    player.play().catch(error => { console.warn('Scene audio could not play:', error.message); finish(); });
  }

  function nextAlert() {
    if (alertPlaying || !queue.length) return;
    alertPlaying = true;
    play(queue.shift(), () => { alertPlaying = false; nextAlert(); });
  }
  function alert(data) {
    const sound = alerts[data?.kind];
    if (!sound?.file || sound.volume === 0 || queue.length >= 100) return;
    queue.push(sound);
    nextAlert();
  }
  if (offline) {
    addEventListener('message', event => {
      if (event.source === parent && event.data?.type === 'alert') alert(event.data.data);
    });
  } else if (Object.values(alerts).some(sound => sound.file)) {
    const events = new EventSource('/events');
    events.addEventListener('alert', event => { try { alert(JSON.parse(event.data)); } catch {} });
    addEventListener('pagehide', () => events.close());
  }
  addEventListener('pagehide', () => { queue.length = 0; for (const player of players) player.pause(); });
  play(scene);
})();
