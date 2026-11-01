const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const events = require('../events.cjs');
const scenes = require('../scenes.cjs');

test('event settings preserve handler IDs, reject conflicts and route renamed rewards', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-events-'));
  try {
    fs.copyFileSync(path.join(__dirname, '../../tss-events.json'), path.join(root, 'tss-events.json'));
    const initial = events.read(root);
    const settings = structuredClone(initial.settings);
    settings.events[0].name = 'Colour my room';
    settings.events[0].canonical = 'untrusted replacement';
    settings.colours.purple = '#123456';
    const saved = events.update(root, settings, initial.revision);
    assert.equal(saved.settings.events[0].canonical, 'Paint the Stream');
    assert.throws(() => events.update(root, settings, initial.revision), /changed on disk/);
    const {routeEvent} = await import('../../scripts/tss-events.mjs');
    const {createPaintQueue} = await import('../../scripts/tss-paint.mjs');
    const queue = createPaintQueue({}, {now:()=>0, settings:()=>saved.settings});
    assert.equal(queue.add(routeEvent({id:'old', reward:{title:'Paint the Stream'}}, saved.settings)), false);
    assert.equal(queue.add(routeEvent({id:'new', reward:{title:' Colour my room '}, user_input:'purple'}, saved.settings)), true);
    assert.equal(queue.snapshot().active.hex, '#123456');
    queue.force('purple', 1);
    assert.equal(queue.snapshot().active.hex, '#123456');
    settings.colours.purple = 'invalid';
    assert.throws(() => events.update(root, settings, saved.revision), /valid colour/);
  } finally {fs.rmSync(root, {recursive:true, force:true});}
});

test('existing live overlay is listed and its base colour persists without rewriting HTML', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-live-'));
  try {
    fs.writeFileSync(path.join(root, 'overlay-horizontal.html'), '<html>Custom live overlay</html>');
    const scene = scenes.scenes(root)[0];
    assert.equal(scene.external, true);
    assert.equal(scene.file, 'overlay-horizontal.html');
    scenes.update(root, scene.id, {...scene.config, accent:'#112233'}, scene.revision);
    assert.equal(scenes.scenes(root)[0].config.accent, '#112233');
    assert.match(fs.readFileSync(path.join(root, scene.file), 'utf8'), /Custom live overlay/);
    assert.throws(() => scenes.update(root, scene.id, scene.config, scene.revision), /changed on disk/);
  } finally {fs.rmSync(root, {recursive:true, force:true});}
});
