const fs = require('node:fs');
const crypto = require('node:crypto');
const {resolveFile} = require('./workspace.cjs');
const {alertSounds, checkFile} = require('./audio.cjs');
const filename = 'tss-events.json';
const revision = text => crypto.createHash('sha256').update(text).digest('hex');

function read(root) {
  const file = resolveFile(root, filename);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return {settings: text ? JSON.parse(text) : {events: [], colours: {}}, revision: revision(text)};
}

function update(root, input, expected) {
  const current = read(root);
  if (current.revision !== expected) throw Error('Event settings changed on disk. Reload the Events tab before saving.');
  const names = new Set();
  const events = current.settings.events.map(event => {
    const change = input.events?.find(value => value.id === event.id);
    const name = String(change?.name ?? event.name).trim();
    const key = event.trigger + ':' + name.toLowerCase().replace(/\s+/g, ' ');
    if (!name || name.length > 80 || names.has(key)) throw Error('Give each event a unique name of 1–80 characters.');
    names.add(key);
    return {...event, name};
  });
  const colours = {...current.settings.colours};
  for (const key of Object.keys(colours)) {
    if (!/^#[0-9a-f]{6}$/i.test(input.colours?.[key])) throw Error('Choose a valid colour for ' + key + '.');
    colours[key] = input.colours[key];
  }
  const sounds = alertSounds(input.sounds ?? current.settings.sounds);
  for (const value of Object.values(sounds)) checkFile(root, value);
  const settings = {...current.settings, events, colours, sounds};
  fs.writeFileSync(resolveFile(root, filename), JSON.stringify(settings, null, 2) + '\n');
  return read(root);
}
module.exports = {read, update};
