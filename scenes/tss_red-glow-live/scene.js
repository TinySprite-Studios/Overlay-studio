(() => {
  const settings = window.TSS_SCENE || {};
  document.title = settings.name || 'Red Glow Live';
  document.documentElement.style.setProperty('--accent', settings.accent || '#ed353b');
  document.body.classList.toggle('no-motion', settings.animate === false);
  const fields = ['subscriber', 'follower', 'donator', 'cheerer'];
  const names = {};
  const details = {};
  function render(field) {
    document.getElementById(field).textContent = [names[field] || '\u2014', details[field]].filter(Boolean).join(' \u00b7 ');
  }
  const events = new EventSource('/events');
  events.onmessage = event => {
    try {
      const activity = JSON.parse(event.data);
      for (const field of fields) {
        if (typeof activity[field] !== 'string') continue;
        if (names[field] !== activity[field]) details[field] = '';
        names[field] = activity[field];
        render(field);
      }
    } catch {}
  };
  events.addEventListener('alert', event => {
    try {
      const alert = JSON.parse(event.data);
      const field = { sub: 'subscriber', follow: 'follower', donation: 'donator', cheer: 'cheerer' }[alert.kind];
      if (!field || typeof alert.name !== 'string') return;
      names[field] = alert.name;
      details[field] = ['donator', 'cheerer'].includes(field) && typeof alert.detail === 'string' ? alert.detail : '';
      render(field);
    } catch {}
  });
  window.addEventListener('pagehide', () => events.close());
})();
