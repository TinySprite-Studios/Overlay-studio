// Shared colour clock for scenes and the live overlay.
(() => {
  window.TSSPaint = {connect(events) {
    const style = document.documentElement.style;
    const keys = ['--accent', '--frameLight', '--frameGlow', '--chaser1', '--chaser2', '--chaserGlow', '--boxBorder'];
    const setColour = colour => {
      style.setProperty('--accent', colour);
      style.setProperty('--frameLight', colour);
      style.setProperty('--frameGlow', `color-mix(in srgb, ${colour} 55%, transparent)`);
      style.setProperty('--chaser1', `color-mix(in srgb, ${colour} 23%, black)`);
      style.setProperty('--chaser2', `color-mix(in srgb, ${colour} 45%, black)`);
      style.setProperty('--chaserGlow', `color-mix(in srgb, ${colour} 55%, transparent)`);
      style.setProperty('--boxBorder', `color-mix(in srgb, ${colour} 45%, transparent)`);
    };
    const base = window.TSS_SCENE?.accent || window.TSS_THEME?.accent;
    if (/^#[0-9a-f]{6}$/i.test(base)) setColour(base);
    const original = Object.fromEntries(keys.map(key => [key, style.getPropertyValue(key)]));
    let expiry, cycle; const announced = new Set();
    const restore = () => {
      clearTimeout(expiry); clearTimeout(cycle);
      for (const key of keys) {
        if (original[key]) style.setProperty(key, original[key]);
        else style.removeProperty(key);
      }
    };
    const apply = state => {
      restore();
      const active = state?.active;
      if (!active || !/^#[0-9a-f]{6}$/i.test(active.hex) || !Number.isFinite(active.endsAt) || active.endsAt <= Date.now()) return;
      setColour(active.hex);
      if (active.colour === 'rgb') {
        const tick = () => {
          if (Date.now() >= active.endsAt) return restore();
          setColour(`hsl(${Date.now() % 8000 / 8000 * 360},90%,65%)`);
          cycle = setTimeout(tick, 80);
        };
        tick();
      }
      expiry = setTimeout(restore, Math.min(2147483647, active.endsAt - Date.now()));
      const alertId = active.alertId || active.id;
      if (!announced.has(alertId)) {
        announced.add(alertId);
        window.TSSAlerts?.enqueue({kind:'paint', name:active.name, detail:`Changed the stream to ${active.colour}`});
      }
    };
    const preview = new URLSearchParams(location.search).get('previewPaint') === '1';
    events.addEventListener('paint', event => {if (!preview) {try {apply(JSON.parse(event.data));} catch {}}});
    if (preview) apply({active:{id:'preview', name:'TinySprite Preview', colour:'purple', hex:'#b56cff', endsAt:Date.now()+10000}});
  }};
})();
