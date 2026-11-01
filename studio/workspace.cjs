const fs = require('node:fs');
const path = require('node:path');
const editable = new Set(['.html','.css','.js','.mjs','.cjs','.json','.svg','.txt','.md','.cmd']);
const media = new Set(['.png','.jpg','.jpeg','.webp','.gif','.woff','.woff2','.ttf','.otf','.mp3','.wav','.ogg','.mp4','.webm','.ico']);
const excluded = new Set(['node_modules','studio','dist','.git','.studio-runtime','package-lock.json']);
function resolveFile(root, name) {
  if (typeof name !== 'string' || !name || name.split(/[\\/]/).some(p => p.startsWith('.') || excluded.has(p))) throw Error('This file is outside the overlay workspace.');
  if (name.split(/[\\/]/).some(p => !p || /[<>:"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))) throw Error('Choose a valid Windows file or folder name.');
  const target = path.resolve(root, name);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Invalid file path.');
  const realRoot = fs.realpathSync(root);
  let ancestor = target;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const real = fs.realpathSync(ancestor);
  const inside = path.relative(realRoot, real);
  if (inside.startsWith('..') || path.isAbsolute(inside)) throw Error('Linked paths outside the project are not supported.');
  return target;
}
function list(root, dir = '', depth = 0) {
  if (depth > 8) return [];
  return fs.readdirSync(path.join(root, dir), {withFileTypes:true}).flatMap(entry => {
    if (entry.name.startsWith('.') || excluded.has(entry.name) || entry.isSymbolicLink()) return [];
    const name = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return [{name, type:'directory', editable:false}, ...list(root, name, depth + 1)];
    return editable.has(path.extname(name).toLowerCase()) || media.has(path.extname(name).toLowerCase()) ? [{name, type:'file', editable:editable.has(path.extname(name).toLowerCase())}] : [];
  });
}
module.exports = {resolveFile, list, editable, media};
