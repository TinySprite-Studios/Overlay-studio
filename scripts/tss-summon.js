(() => {
  window.TSSSummon = { connect(events) {
    const panel = document.getElementById('tss-sprite');
    const caption = document.getElementById('tss-sprite-caption');
    const tomato = document.querySelector?.('.tss-tomato-scene');
    let timer, activeId;
    const hide = () => { panel.hidden = true; if (tomato) tomato.hidden = true; activeId = undefined; clearTimeout(timer); };
    const apply = state => {
      const active = state?.active;
      if (!active || !Number.isFinite(active.startsAt) || !Number.isFinite(active.endsAt) ||
          active.endsAt <= Date.now() || active.startsAt > Date.now()) { hide(); return; }
      if (active.id === activeId) return;
      hide();
      activeId = active.id;
      panel.setAttribute?.('data-effect', ['tomato','feed','hydrate'].includes(active.effect) ? active.effect : 'summon');
      if (tomato && active.effect === 'tomato') {
        const width = window.innerWidth || 1920, height = window.innerHeight || 1080;
        // Normalised saved positions keep the same landing point after reconnects.
        let hash = 0;
        for (const char of String(active.id)) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
        const unit = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
        const x = 125 + unit(active.target?.x, (hash % 1000) / 1000) * Math.max(0, width - 350);
        const y = 220 + unit(active.target?.y, ((hash >>> 10) % 1000) / 1000) * Math.max(0, height - 470);
        tomato.style.setProperty('left', `${x}px`);
        tomato.style.setProperty('top', `${y}px`);
        panel.style.setProperty('--tomato-home-x', `${Math.max(0, width - 240)}px`);
        panel.style.setProperty('--tomato-home-y', `${height - 180}px`);
        panel.style.setProperty('--tomato-off-y', `${height + 60}px`);
        panel.style.setProperty('--tomato-target-x', `${x - 40}px`);
        panel.style.setProperty('--tomato-target-y', `${y - 20}px`);

        tomato.style.setProperty('--tss-sprite-elapsed', `${-Math.max(0, Date.now() - active.startsAt)}ms`);
        void tomato.offsetWidth; tomato.hidden = false;
      }
      const message = Array.from(String(active.message || '').trim()).slice(0, 100).join('');
      panel.querySelector?.('.tss-alien-art')?.setAttribute('data-motion', ['wave','dance','jump','look'].includes(active.motion) ? active.motion : 'wave');
      const item = String(active.item || (active.effect === 'feed' ? 'Space taco' : 'Water')).slice(0,60);
      const icons = {'Space taco':'🌮','Moon cookie':'🍪','Cosmic pizza':'🍕','Star berry':'🍓','Galaxy noodles':'🍜','Water':'🥤','Moon milk':'🥛','Berry juice':'🧃','Cosmic smoothie':'🥤','Space tea':'🍵'};
      const snack = panel.querySelector?.('.tss-snack');
      if (snack) snack.textContent = icons[item] || (active.effect === 'feed' ? '🌮' : '🥤');
      const name = String(active.name || 'Viewer').slice(0, 150);
      caption.textContent = ['feed','hydrate'].includes(active.effect) ? `${name} gave me ${item}!\n${active.effect === 'feed' ? 'Nom nom nom!' : 'Sip sip… ahh!'} ` : active.effect === 'tomato' ? `${name} threw a tomato!\nOkay, okay... I'll clean it up!` : message ? `${name}\n${message}` : `${name} summoned TinySprite!`;
      panel.style.setProperty('--tss-sprite-elapsed', `${-Math.max(0, Date.now() - active.startsAt)}ms`);
      // Force a fresh animation for the next queued visitor.
      void panel.offsetWidth;
      panel.hidden = false;
      timer = setTimeout(hide, Math.min(2147483647, active.endsAt - Date.now()));
    };
    const preview = new URLSearchParams(location.search).get('previewSprite') === '1';
    events.addEventListener('summon', message => {
      if (preview) return;
      try { apply(JSON.parse(message.data)); } catch (_) { /* Ignore incomplete events. */ }
    });
    if (preview) apply({ active: { id: 'preview', name: 'TinySprite Preview', startsAt: Date.now(), endsAt: Date.now() + 15000 } });
  } };
})();
