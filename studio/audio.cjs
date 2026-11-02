const fs = require('node:fs');
const {resolveFile} = require('./workspace.cjs');

function sound(value = {}) {
  const file = String(value.file || '');
  if (file && (!/^assets\/.+\.(mp3|mp4|wav|ogg|webm)$/i.test(file) || file.includes('\\') || file.split('/').some(part => !part || part.startsWith('.')))) {
    throw Error('Choose imported audio or video from assets.');
  }
  const volume = Number(value.volume ?? 100);
  if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw Error('Audio volume must be between 0 and 100.');
  return {file, volume};
}

function checkFile(root, value) {
  if (value.file && (!fs.existsSync(resolveFile(root, value.file)) || !fs.statSync(resolveFile(root, value.file)).isFile())) throw Error('Choose an existing audio file.');
  return value;
}

function alertSounds(values = {}) {
  return Object.fromEntries(['follow', 'sub', 'cheer', 'donation'].map(kind => [kind, sound(values[kind])]));
}

module.exports = {sound, checkFile, alertSounds};
