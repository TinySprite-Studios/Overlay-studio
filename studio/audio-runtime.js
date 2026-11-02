// Served with the selected scene's audio settings by Studio.
(() => {
  // Portrait wrappers and custom overlays may contain other scene frames.
  try { if (parent !== window && parent.location.origin === location.origin) return; } catch {}
  const {scene, alerts, offline} = window.TSS_STUDIO_AUDIO;
  const studioPreview = offline || new URLSearchParams(location.search).has('studio');
  const players = new Set();
  const queue = [];
  let alertPlaying = false, active = false, visible = true, playingScene = false, generation = 0, musicTimer;

  function stop() {
    clearTimeout(musicTimer);
    generation++;
    queue.length = 0;
    alertPlaying = false;
    for (const player of players) { player.pause(); player.remove(); }
    players.clear();
  }

  function play(sound, done = () => {}) {
    if (!sound?.file || sound.volume === 0) { done(); return; }
    const player = document.createElement('audio');
    player.src = '/' + sound.file.split('/').map(encodeURIComponent).join('/');
    player.volume = sound.volume / 100;
    player.dataset.studioAudio = 'true';
    document.body.append(player);
    players.add(player);
    const started = generation;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      player.pause();
      player.remove();
      players.delete(player);
      if (started === generation) done();
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
    if (!studioPreview && !playingScene) return;
    const sound = alerts[data?.kind];
    if (!sound?.file || sound.volume === 0 || queue.length >= 100) return;
    queue.push(sound);
    nextAlert();
  }
  if (studioPreview) {
    addEventListener('message', event => {
      if (event.source !== parent) return;
      if (event.data?.type === 'audio-stop') stop();
      if (event.data?.type === 'alert') alert(event.data.data);
    });
  } else {
    const update = () => {
      const next = active && visible;
      if (next === playingScene) return;
      playingScene = next;
      stop();
      if (next) {
        if (scene.delay > 0) musicTimer = setTimeout(() => { if (playingScene) play(scene); }, scene.delay * 1000);
        else play(scene);
      }
    };
    // OBS keeps inactive browser sources loaded. Only an explicit activation
    // may start audio; page load and Studio Mode preview are not activation.
    addEventListener('obsSourceActiveChanged', event => {
      if (typeof event.detail?.active !== 'boolean') return;
      active = event.detail.active; update();
    });
    addEventListener('obsSourceVisibleChanged', event => {
      if (typeof event.detail?.visible !== 'boolean') return;
      visible = event.detail.visible; update();
    });
    if (Object.values(alerts).some(sound => sound.file)) {
      const events = new EventSource('/events');
      events.addEventListener('alert', event => { try { alert(JSON.parse(event.data)); } catch {} });
      addEventListener('pagehide', () => events.close());
    }
  }
  addEventListener('pagehide', () => { playingScene = false; stop(); });
})();
