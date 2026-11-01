(() => {
  const config = window.OVERLAY_CONFIG?.alerts || {};
  const panel = document.getElementById('tss-alert');
  const queue = [];
  const labels = { follow: 'New follower', sub: 'Subscription', cheer: 'New cheer', donation: 'New donation', paint: 'Paint the Stream' };
  let playing = false;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function play() {
    if (playing || !queue.length) return;
    playing = true;
    const alert = queue.shift();
    document.getElementById('tss-alert-type').textContent = labels[alert.kind];
    document.getElementById('tss-alert-name').textContent = alert.name;
    document.getElementById('tss-alert-detail').textContent = alert.detail || 'Thank you for the support!';
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('dropping');
    await wait(460);
    panel.classList.add('open');
    await wait(450 + Math.max(1, Math.min(30, Number(config.holdSeconds) || 5)) * 1000);
    panel.classList.remove('open');
    await wait(460);
    panel.classList.remove('dropping');
    await wait(460);
    panel.setAttribute('aria-hidden', 'true');
    await wait(250);
    playing = false;
    play();
  }
  window.TSSAlerts = {
    enqueue(alert) {
      if (config.enabled === false || !alert || !labels[alert.kind] || typeof alert.name !== 'string') return;
      queue.push({ kind: alert.kind, name: alert.name.slice(0, 150), detail: String(alert.detail || '').slice(0, 150) });
      play();
    }
  };
  // Explicit local preview only: never writes names or sends events to the helper.
  if (new URLSearchParams(location.search).get('previewAlerts') === '1') {
    for (const [kind, detail] of [['follow', 'Welcome to the community'], ['sub', 'Gifted subscription'],
      ['cheer', '199 Bits'], ['donation', '£5.00']]) {
      window.TSSAlerts.enqueue({ kind, name: 'TinySprite Preview', detail });
    }
  }
})();
