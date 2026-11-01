export const SUMMON_REWARD = 'Summon TinySprite';
export const SUMMON_DURATION = 15000;
export const SUMMON_ANIMATIONS = ['wave', 'dance', 'jump', 'look'];
const rewardTitles = new Set(['summon tinysprite', 'summon sprite', 'throw a tomato', 'feed sprite', 'hydrate sprite']);

export function createSummonQueue(saved = {}, { now = Date.now, random = Math.random, persist = () => {}, publish = () => {} } = {}) {
  let queue = Array.isArray(saved.queue) ? saved.queue.filter(item => item && typeof item.id === 'string' &&
    Number.isFinite(item.startsAt) && Number.isFinite(item.endsAt)) : [];
  const seen = new Set(Array.isArray(saved.seen) ? saved.seen : []);
  let currentId;
  const snapshot = () => ({ active: queue.find(item => item.startsAt <= now() && item.endsAt > now()) || null });
  const save = () => persist({ queue, seen: [...seen] });
  const tick = () => {
    const remaining = queue.filter(item => item.endsAt > now());
    if (remaining.length !== queue.length) { queue = remaining; save(); }
    const state = snapshot();
    if (currentId !== state.active?.id) { currentId = state.active?.id; publish(state); }
    return state;
  };
  return { snapshot, tick, add(event) {
    const title = String(event?.reward?.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!rewardTitles.has(title) ||
        typeof event.id !== 'string' || !event.id || event.status === 'canceled' || seen.has(event.id)) return false;
    tick();
    const startsAt = Math.max(now(), queue.at(-1)?.endsAt || 0);
    queue.push({ id: event.id, name: String(event.user_name || 'Viewer').slice(0, 150),
      effect: ({'throw a tomato':'tomato','feed sprite':'feed','hydrate sprite':'hydrate'})[title] || 'summon',
      item: typeof event.careItem === 'string' ? event.careItem.slice(0,60) : '',
      ...(title === 'throw a tomato' ? { target: { x: random(), y: random() } } : {}),
      message: Array.from(String(event.user_input || '').trim()).slice(0, 100).join(''),
      motion: SUMMON_ANIMATIONS[Math.min(3, Math.max(0, Math.floor(random() * 4)))],
      startsAt, endsAt: startsAt + SUMMON_DURATION });
    seen.add(event.id);
    if (seen.size > 5000) seen.delete(seen.values().next().value);
    save(); tick(); return true;
  } };
}
