const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {prepareProject} = require('../project.cjs');

test('imports overlay-only folders without replacing artwork or custom settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-import-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>My overlay</h1>');
  fs.writeFileSync(path.join(root, 'config.js'), '// custom settings');
  prepareProject(root, path.join(__dirname, '../..'));
  assert.ok(fs.existsSync(path.join(root, 'scripts/tss-twitch.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/tss-events.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'start-twitch.cmd')));
  assert.equal(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), '// custom settings');
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), '<h1>My overlay</h1>');
  assert.equal(fs.existsSync(path.join(root, 'scenes')), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'tss-events.json'))).events, []);
  prepareProject(root, path.join(__dirname, '../..'));
  assert.equal(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), '// custom settings');
});

test('rejects folders without an overlay before adding files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-empty-'));
  assert.throws(() => prepareProject(root, path.join(__dirname, '../..')), /HTML/);
  assert.deepEqual(fs.readdirSync(root), []);
});
