// Studio sends the same project-event payload for previews and live redemptions.
const events = new EventSource('/events');
const container = document.getElementById('emojis');

function showEmojis(values = {}) {
  const choices = String(values.emojis || '🎉 💜 ✨').trim().split(/\s+/).filter(Boolean).slice(0, 20);
  if (!choices.length) return;
  const count = Math.min(80, Math.max(1, Number(values.count) || 24));
  const duration = Math.min(15, Math.max(1, Number(values.duration) || 5)) * 1000;
  // Bound simultaneous particles when several viewers redeem together.
  for (let index = 0; index < count && container.childElementCount < 160; index++) {
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = choices[Math.floor(Math.random() * choices.length)];
    emoji.style.left = `${Math.random() * 94}%`;
    container.append(emoji);
    const animation = emoji.animate([
      { transform: 'translateY(0) rotate(0deg)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translateY(${innerHeight + 200}px) rotate(${Math.random() * 360 - 180}deg)`, opacity: 0 }
    ], { duration, delay: Math.random() * 500, easing: 'ease-in', fill: 'both' });
    animation.onfinish = () => emoji.remove();
    animation.oncancel = () => emoji.remove();
  }
}

events.addEventListener('project-event', message => {
  let event;
  try { event = JSON.parse(message.data); } catch { return; }
  // This is the project's stable event ID, never the Twitch reward title.
  if (event?.id === 'send-emoji') showEmojis(event.values);
});
window.addEventListener('pagehide', () => events.close());
