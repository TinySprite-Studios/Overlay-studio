const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createProject, prepareProject} = require('../project.cjs');
const events = require('../events.cjs'), scenes = require('../scenes.cjs');
const {serve} = require('../server.cjs');

test('custom projects keep definitions, validate values and deliver project-specific runtime settings', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-custom-'));
  let server;
  try {
    createProject(root);
    assert.deepEqual(events.read(root).settings.events, []);
    assert.deepEqual(scenes.scenes(root), []);
    const fields = [{key:'amount', type:'number', default:5, min:1, max:10}, {key:'enabled', type:'boolean', default:true}];
    const definition = {id:'confetti', name:'Celebrate', trigger:'points', fields};
    fs.writeFileSync(path.join(root, 'tss-events.json'), JSON.stringify({version:1, events:[definition]}));
    const initial = events.read(root);
    assert.deepEqual(initial.settings.events[0].values, {amount:5, enabled:true});
    assert.throws(() => events.update(root, {events:[{...definition, values:{amount:20}}]}, initial.revision), /range/);
    const saved = events.update(root, {events:[{...definition, values:{amount:8, enabled:false}}]}, initial.revision);
    const {projectEvents, routeEvent} = await import('../../scripts/tss-events.mjs');
    assert.equal(routeEvent({reward:{title:'Paint the Stream'}}, {events:[]}).reward.title, '');
    assert.equal(projectEvents('channel.channel_points_custom_reward_redemption.add', {reward:{title:'Celebrate'}}, saved.settings)[0].values.amount, 8);
    assert.deepEqual(projectEvents('channel.channel_points_custom_reward_redemption.add', {reward:{title:'Other'}}, saved.settings), []);
    const dir = path.join(root, 'scenes/tss_custom');fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><head></head><body>My scene</body></html>');
    fs.writeFileSync(path.join(dir, 'scene.json'), JSON.stringify({type:'custom', name:'Custom', fields, customMetadata:'preserve'}));
    prepareProject(root, path.join(__dirname, '../..'));
    assert.equal(events.read(root).settings.events[0].id, 'confetti');
    const scene = scenes.read(root, 'tss_custom');
    const updated = scenes.update(root, scene.id, {...scene.config, values:{amount:9, enabled:false}}, scene.revision);
    assert.equal(updated.config.customMetadata, 'preserve');
    assert.deepEqual(updated.config.fields, fields);
    assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /My scene/);
    assert.throws(() => scenes.update(root, scene.id, updated.config, scene.revision), /changed/);
    server = await serve(() => root);
    const script = await (await fetch(server.url + '/__studio-project.js?scene=scenes/tss_custom/index.html')).text();
    const context = {window:{}};require('node:vm').runInNewContext(script, context);
    assert.equal(context.window.TSS_SCENE.values.amount, 9);
    assert.equal(context.window.TSS_EVENTS.events[0].values.amount, 8);
  } finally {server?.close();fs.rmSync(root, {recursive:true, force:true});}
});
