export const PAINT_REWARD = 'Paint the Stream';
export const PAINT_DURATION = 120000;
export const POWER_UP_REWARD = 'Paint the stream! PRO';
export const POWER_UP_DURATION = 3600000;
export const isColourPowerUp = event =>
  event?.custom_power_up?.title?.trim().toLowerCase() === POWER_UP_REWARD.toLowerCase();
const isHex = value => /^#[0-9a-f]{6}$/i.test(value || '');
export const PAINT_COLOURS = Object.freeze({ red: '#ff4545', orange: '#ff952e', yellow: '#ffe34d',
  green: '#37ff7d', blue: '#479cff', purple: '#b56cff', pink: '#ff71cb', cyan: '#42edff', white: '#ffffff', rgb: '#ff4545' });

// Keep the schedule on the helper so all browser sources share the same timer.
export function createPaintQueue(saved = {}, { now = Date.now, persist = () => {}, publish = () => {}, settings = () => ({}) } = {}) {
  let queue = Array.isArray(saved.queue) ? saved.queue.filter(item =>
    item && (Object.hasOwn(PAINT_COLOURS, item.colour) || isHex(item.colour)) && isHex(item.hex) && Number.isFinite(item.endsAt) && Number.isFinite(item.startsAt)) : [];
  const seen = new Set(Array.isArray(saved.seen) ? saved.seen : []);
  let currentId;
  const snapshot = () => ({ active: queue.find(item => item.startsAt <= now() && item.endsAt > now()) || null,
    waiting: queue.filter(item => item.startsAt > now()).length });
  const palette = () => Object.fromEntries(Object.entries({...PAINT_COLOURS, ...settings().colours}).filter(([key, value]) => Object.hasOwn(PAINT_COLOURS, key) && isHex(value)));
  const save = () => persist({ queue, seen: [...seen] });
  const tick = () => {
    const remaining = queue.filter(item => item.endsAt > now());
    if (remaining.length !== queue.length) { queue = remaining; save(); }
    const state = snapshot();
    if (state.active?.id !== currentId) { currentId = state.active?.id; publish(state); }
    return state;
  };
  return { snapshot, tick,
    force(colour, minutes) {
      colour = String(colour || '').trim().toLowerCase();
      if (colour === 'rainbow') colour = 'rgb';
      if (!Object.hasOwn(PAINT_COLOURS, colour) && !isHex(colour)) throw Error('Choose a valid colour.');
      if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) throw Error('Duration must be between 1 and 1440 minutes.');
      tick();
      const start = now(), duration = Math.round(minutes * 60000);
      const previous = queue.find(item => item.manual);
      const offset = previous ? Math.max(0, previous.endsAt - start) : 0;
      queue = queue.filter(item => !item.manual).map(item => ({ ...item,
        startsAt: Math.max(start, item.startsAt - offset) + duration,
        endsAt: item.endsAt - offset + duration }));
      queue.unshift({ id: `manual-${globalThis.crypto.randomUUID()}`, manual: true,
        name: 'Stream host', colour, hex: palette()[colour] || PAINT_COLOURS[colour] || colour,
        startsAt: start, endsAt: start + duration });
      save();
      return tick();
    },
    add(event) {
      const powerUp = isColourPowerUp(event);
      if ((!powerUp && event?.reward?.title?.trim().toLowerCase() !== PAINT_REWARD.toLowerCase()) ||
          !event.id || event.status === 'canceled' || seen.has(event.id)) return false;
      tick();
      const input = String(event.user_input || '').trim().toLowerCase();
      const choice = input === 'rainbow' ? 'rgb' : input;
      const colour = Object.hasOwn(PAINT_COLOURS, choice) ? choice : 'purple';
      const startsAt = Math.max(now(), queue.at(-1)?.endsAt || 0);
      queue.push({ id: event.id, name: String(event.user_name || 'Viewer').slice(0, 150), colour,
        hex: palette()[colour] || PAINT_COLOURS[colour] || colour, startsAt,
        endsAt: startsAt + (powerUp ? POWER_UP_DURATION : PAINT_DURATION) });
      seen.add(event.id);
      if (seen.size > 5000) seen.delete(seen.values().next().value);
      save();
      tick();
      return true;
    }
  };
}
