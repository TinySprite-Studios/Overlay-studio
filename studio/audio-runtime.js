// Served with the selected scene's audio settings by Studio.
(() => {
  // Portrait wrappers and custom overlays may contain other scene frames.
  try { if (parent !== window && parent.location.origin === location.origin) return; } catch {}
  const {scene, alerts, offline} = window.TSS_STUDIO_AUDIO;
  const studioPreview = offline || new URLSearchParams(location.search).has('studio');
  const players = new Set();
  const queue = [];
  let alertPlaying = false, active = false, visible = true, playingScene = false, generation = 0, musicTimer;

  // Reported to the Studio Console (OBS browser sources have no F12 console).
  const report = text => {
    if (studioPreview) return;
    const path = location.pathname || '', page = path.split('/').slice(-2, -1)[0] || path;
    try { fetch('/__studio-log?m=' + encodeURIComponent(page + ': ' + text), {cache:'no-store'}).catch(() => {}); } catch {}
  };

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
    (document.body || document.documentElement).append(player);
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
    player.onerror = () => { report('audio file failed to load: ' + sound.file); finish(); };
    player.play().then(() => report('audio is playing'), error => { console.warn('Scene audio could not play:', error.message); report('audio could not play: ' + error.message); finish(); });
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
        if (!scene.file) { report('scene is active, but no scene-start audio is selected'); return; }
        if (scene.delay > 0) {
          report('waiting ' + scene.delay + 's before starting audio (' + scene.file + ')');
          musicTimer = setTimeout(() => { if (playingScene) { report('audio starting'); play(scene); } }, scene.delay * 1000);
        } else { report('audio starting'); play(scene); }
      } else report('scene no longer active, audio stopped');
    };
    report('page loaded, waiting for OBS to report the scene as active');
    // OBS keeps inactive browser sources loaded. Only an explicit activation
    // may start audio; page load and Studio Mode preview are not activation.
    addEventListener('obsSourceActiveChanged', event => {
      report('OBS active event: ' + JSON.stringify(event.detail));
      if (typeof event.detail?.active !== 'boolean') return;
      active = event.detail.active; update();
    });
    addEventListener('obsSourceVisibleChanged', event => {
      report('OBS visible event: ' + JSON.stringify(event.detail));
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
