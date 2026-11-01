const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const power = (id, input = '') => ({ id, user_name: 'Viewer', user_input: input,
  custom_power_up: { title: 'Paint the stream! PRO', bits: 100 } });
test('Bits colours last an hour, queue, survive restart, deduplicate and expire', async () => {
  const { createPaintQueue, POWER_UP_DURATION } = await import('../../scripts/tss-paint.mjs');
  let time = 1000, saved;
  const options = { now: () => time, persist: value => { saved = structuredClone(value); } };
  let paint = createPaintQueue({}, options);
  assert.equal(paint.add(power('a', 'blue')), true);
  assert.equal(paint.snapshot().active.hex, '#479cff');
  assert.equal(paint.snapshot().active.endsAt, time + POWER_UP_DURATION);
  assert.equal(paint.add(power('a')), false);
  paint.add(power('b', 'cyan'));
  assert.equal(paint.snapshot().waiting, 1);
  paint = createPaintQueue(saved, options);
  assert.equal(paint.add(power('a')), false);
  time += POWER_UP_DURATION;
  assert.equal(paint.tick().active.colour, 'cyan');
  time += POWER_UP_DURATION;
  assert.equal(paint.tick().active, null);
});
test('filters unrelated/canceled rewards, accepts rainbow, retains points duration', async () => {
  const { createPaintQueue, PAINT_DURATION } = await import('../../scripts/tss-paint.mjs');
  const activeFor = (event, colour) => { const p = createPaintQueue({}, { now: () => 0 }); p.add(event, colour); return p.snapshot().active; };
  assert.equal(activeFor({ ...power('a'), status: 'canceled' }), null);
  assert.equal(activeFor({ ...power('a'), custom_power_up: { title: 'Other' } }), null);
  assert.equal(activeFor(power('a', '#abcdef')).colour, 'purple');
  assert.equal(activeFor(power('a', 'rainbow')).colour, 'rgb');
  assert.equal(activeFor(power('a', '<script>')).colour, 'purple');
  assert.equal(activeFor({ id: 'points', reward: { title: 'Paint the Stream' }, user_input: 'red' }).endsAt, PAINT_DURATION);
});
test('browser restores original styling at expiry', () => {
  const styles = new Map([['--accent', '#112233']]);
  let handler, expiry;
  const context = { window: {}, document: { documentElement: { style: {
    getPropertyValue: key => styles.get(key) || '', setProperty: (key, value) => styles.set(key, value),
    removeProperty: key => styles.delete(key)
  } } }, location: { search: '' }, URLSearchParams, Date,
    setTimeout: callback => { expiry = callback; return 1; }, clearTimeout: () => {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../scripts/tss-paint.js'), 'utf8'), context);
  context.window.TSSPaint.connect({ addEventListener: (_, callback) => { handler = callback; } });
  handler({ data: JSON.stringify({ active: { id: 'a', hex: '#abcdef', endsAt: Date.now() + 3600000 } }) });
  assert.equal(styles.get('--accent'), '#abcdef');
  expiry();
  assert.equal(styles.get('--accent'), '#112233');
  assert.equal(styles.size,1);
});
test('manual override applies immediately, preserves paid time and replaces prior override', async () => {
  const { createPaintQueue } = await import('../../scripts/tss-paint.mjs');
  let time = 0, saved;
  const options = { now: () => time, persist: value => { saved = structuredClone(value); } };
  let p = createPaintQueue({}, options);
  p.add(power('paid', 'red'));
  time = 60000;
  p.force('blue', 10);
  assert.equal(p.snapshot().active.colour, 'blue');
  time += 60000;
  p.force('rainbow', 2);
  assert.equal(p.snapshot().active.colour, 'rgb');
  assert.equal(p.snapshot().waiting, 1);
  p = createPaintQueue(saved, options);
  time += 120000;
  const resumed = p.tick().active;
  assert.equal(resumed.id, 'paid');
  assert.equal(resumed.endsAt - time, 59 * 60000);
  assert.throws(() => p.force('blue', 0));
  assert.throws(() => p.force('blue', Infinity));
  assert.throws(() => p.force('invalid', 60));
  assert.equal(p.snapshot().active.id, 'paid');
});
