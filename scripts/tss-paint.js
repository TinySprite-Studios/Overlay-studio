(() => {
  window.TSSPaint = {
    connect(events) {
      const root = document.documentElement;
      const keys = ['--frameLight', '--frameGlow', '--chaser1', '--chaser2', '--chaserGlow', '--boxBorder'];
      const original = Object.fromEntries(keys.map(key => [key, root.style.getPropertyValue(key)]));
      let timer, cycleTimer, lastId;
      const restore = () => {
        clearTimeout(timer);
        clearTimeout(cycleTimer);
        for (const key of keys) {
          if (original[key]) root.style.setProperty(key, original[key]);
          else root.style.removeProperty(key);
        }
      };
      const apply = state => {
        restore();
        const active = state?.active;
        if (!active || !/^#[0-9a-f]{6}$/i.test(active.hex) || !Number.isFinite(active.endsAt) || active.endsAt <= Date.now()) return;
        const rgb = active.hex.slice(1).match(/../g).map(part => parseInt(part, 16));
        const shade = amount => `rgb(${rgb.map(value => Math.round(value * amount)).join(',')})`;
        root.style.setProperty('--frameLight', active.hex);
        root.style.setProperty('--frameGlow', `rgba(${rgb.join(',')},0.55)`);
        root.style.setProperty('--chaser1', shade(.23));
        root.style.setProperty('--chaser2', shade(.45));
        root.style.setProperty('--chaserGlow', `rgba(${rgb.join(',')},0.55)`);
        root.style.setProperty('--boxBorder', `rgba(${rgb.join(',')},0.45)`);
        if (active.colour === 'rgb') {
          const cycle = () => {
            if (Date.now() >= active.endsAt) { restore(); return; }
            // Shared clock keeps separate OBS sources on the same rainbow phase.
            const hue = ((Date.now() % 8000) / 8000 * 360).toFixed(1);
            root.style.setProperty('--frameLight', `hsl(${hue},90%,65%)`);
            root.style.setProperty('--frameGlow', `hsla(${hue},90%,65%,0.55)`);
            root.style.setProperty('--chaser1', `hsl(${hue},75%,15%)`);
            root.style.setProperty('--chaser2', `hsl(${hue},85%,30%)`);
            root.style.setProperty('--chaserGlow', `hsla(${hue},90%,65%,0.55)`);
            root.style.setProperty('--boxBorder', `hsla(${hue},90%,65%,0.45)`);
            cycleTimer = setTimeout(cycle, 80);
          };
          cycle();
        }
        timer = setTimeout(restore, Math.min(2147483647, active.endsAt - Date.now()));
        if (lastId !== active.id) {
          lastId = active.id;
          window.TSSAlerts?.enqueue({ kind: 'paint', name: active.name,
            detail: active.colour === 'rgb' ? 'Rainbow mode activated!' : `Changed the stream to ${active.colour}` });
        }
      };
      const preview = new URLSearchParams(location.search).get('previewPaint');
      events.addEventListener('paint', message => {
        if (preview === '1') return;
        try { apply(JSON.parse(message.data)); } catch (_) { /* Keep last valid state. */ }
      });
      // Local visual preview only; does not spend points or affect other sources.
      if (preview === '1') apply({ active: { id: 'preview', name: 'TinySprite Preview',
        colour: 'purple', hex: '#b56cff', endsAt: Date.now() + 10000 } });
    }
  };
})();
