const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const events = require('../events.cjs');
const scenes = require('../scenes.cjs');

test('any project links points and bits by ID, preserving handlers and channel isolation', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-reward-links-'));
  try {
    const definitions=['points','bits'].map(trigger=>({id:'custom-'+trigger,name:'Action '+trigger,trigger,canonical:'Handler '+trigger}));
    fs.writeFileSync(path.join(root,'tss-events.json'),JSON.stringify({version:1,events:definitions}));
    const initial=events.read(root);
    const twitch={connected:true,userId:'channel-a',rewards:{items:definitions.map(event=>({id:'reward-'+event.trigger,trigger:event.trigger}))}};
    const input={events:definitions.map(event=>({...event,twitchId:'reward-'+event.trigger}))};
    const saved=events.update(root,input,initial.revision,twitch);
    const {projectEvents,routeEvent,withPowerUpBindings}=await import('../../scripts/tss-events.mjs');
    for(const definition of saved.settings.events){
      assert.equal(definition.twitchBroadcasterId,'channel-a');
      const field=definition.trigger==='bits'?'custom_power_up':'reward';
      const type=definition.trigger==='bits'?'channel.custom_power_up_redemption.add':'channel.channel_points_custom_reward_redemption.add';
      const redemption={broadcaster_user_id:'channel-a',[field]:{id:definition.twitchId,title:'Renamed on Twitch'}};
      assert.equal(projectEvents(type,redemption,saved.settings)[0].id,definition.id);
      assert.equal(routeEvent(redemption,saved.settings)[field].title,definition.canonical);
      assert.deepEqual(projectEvents(type,{...redemption,broadcaster_user_id:'channel-b'},saved.settings),[]);
      assert.deepEqual(projectEvents(type,{...redemption,[field]:{id:'replacement',title:definition.name}},saved.settings),[]);
    }
    assert.equal(withPowerUpBindings(saved.settings,{'custom-bits':'old-automatic-id'}).events[1].twitchId,'reward-bits');
    assert.throws(()=>events.update(root,{events:[{...input.events[0],twitchId:'reward-bits'}]},saved.revision,twitch),/choose a reward/);
    assert.throws(()=>events.update(root,{events:[{...input.events[0],twitchId:'unknown'}]},saved.revision,twitch),/choose a reward/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('Twitch IDs survive renames and reject replacement rewards with the old name', async () => {
  const {bindPowerUps, withPowerUpBindings, routeEvent, projectEvents} = await import('../../scripts/tss-events.mjs');
  const settings = {events:[{id:'paint-pro-24', trigger:'bits', name:'PRO+24 | Paint the stream!', canonical:'PRO+24 | Paint the stream!'}]};
  const bindings = bindPowerUps(settings, [{id:'twitch-day', title:settings.events[0].name}]);
  const linked = withPowerUpBindings(settings, JSON.parse(JSON.stringify(bindings)));
  const event = {id:'redemption', custom_power_up:{id:'twitch-day', title:'Renamed on Twitch'}};
  assert.equal(routeEvent(event, linked).custom_power_up.title, settings.events[0].canonical);
  assert.equal(projectEvents('channel.custom_power_up_redemption.add', event, linked)[0].id, 'paint-pro-24');
  const replacement = {...event, custom_power_up:{id:'different', title:settings.events[0].name}};
  assert.equal(routeEvent(replacement, linked).custom_power_up.title, '');
  assert.deepEqual(projectEvents('channel.custom_power_up_redemption.add', replacement, linked), []);
  assert.deepEqual(bindPowerUps(settings, [replacement.custom_power_up], bindings), bindings);
  assert.deepEqual(bindPowerUps(settings, [replacement.custom_power_up, {...replacement.custom_power_up,id:'duplicate'}]), {});
});

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
