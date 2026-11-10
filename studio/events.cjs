const fs = require('node:fs');
const crypto = require('node:crypto');
const {resolveFile} = require('./workspace.cjs');
const {alertSounds, checkFile} = require('./audio.cjs');
const {values} = require('./fields.cjs');
const filename = 'tss-events.json';
const revision = text => crypto.createHash('sha256').update(text).digest('hex');

function read(root) {
  const file = resolveFile(root, filename);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const settings = text.trim() ? JSON.parse(text) : {};
  settings.events ??= [];
  settings.colours ??= {};
  settings.sounds ??= text.trim() && !settings.version ? alertSounds() : {};
  if (!Array.isArray(settings.events)) throw Error('tss-events.json: events must be an array.');
  const ids = new Set();
  for (const event of settings.events) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(event.id) || ids.has(event.id)) throw Error('tss-events.json: each event needs a unique ID.');
    ids.add(event.id);
    event.values = values(event.fields, event.values);
  }
  return {settings, revision: revision(text)};
}

function update(root, input, expected, twitch = {}) {
  const current = read(root);
  if (current.revision !== expected) throw Error('Event settings changed on disk. Reload the Events tab before saving.');
  const names = new Set();
  const events = current.settings.events.map(event => {
    const change = input.events?.find(value => value.id === event.id);
    const name = String(change?.name ?? event.name).trim();
    const key = event.trigger + ':' + name.toLowerCase().replace(/\s+/g, ' ');
    if (!name || name.length > 80 || names.has(key)) throw Error('Give each event a unique name of 1–80 characters.');
    names.add(key);
    const linked = {...event, name, values:values(event.fields, change?.values ?? event.values)};
    if (change && Object.hasOwn(change, 'twitchId') && ['bits','points'].includes(event.trigger)) {
      const id = String(change.twitchId || '');
      if (id !== (event.twitchId || '') || (id && change.twitchBroadcasterId !== event.twitchBroadcasterId)) {
        if (id && (!twitch.connected || !twitch.rewards?.items.some(reward => reward.id === id && reward.trigger === event.trigger))) {
          throw Error('Refresh Twitch rewards and choose a reward from the connected channel.');
        }
        linked.twitchId = id;
        linked.twitchBroadcasterId = id ? twitch.userId : '';
      }
    }
    return linked;
  });
  const colours = {...current.settings.colours};
  for (const key of Object.keys(colours)) {
    if (!/^#[0-9a-f]{6}$/i.test(input.colours?.[key])) throw Error('Choose a valid colour for ' + key + '.');
    colours[key] = input.colours[key];
  }
  const normalizedSounds = alertSounds(input.sounds ?? current.settings.sounds);
  const sounds = Object.fromEntries(Object.keys(input.sounds ?? current.settings.sounds).map(key => [key, normalizedSounds[key]]).filter(([,value]) => value));
  for (const value of Object.values(sounds)) checkFile(root, value);
  const settings = {...current.settings, events, colours, sounds};
  fs.writeFileSync(resolveFile(root, filename), JSON.stringify(settings, null, 2) + '\n');
  return read(root);
}
module.exports = {read, update};
