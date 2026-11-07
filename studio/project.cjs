const fs = require('node:fs');
const path = require('node:path');
const {list, resolveFile} = require('./workspace.cjs');

function prepareProject(root, template) {
  if (!list(root).some(file => file.type === 'file' && file.name.endsWith('.html'))) {
    throw Error('Choose a folder containing your overlay HTML files and their assets.');
  }
  const support = list(template).filter(file => file.type === 'file' &&
    (file.name.startsWith('scripts/') || ['config.js', 'tss-events.json',
      'start-twitch.cmd', 'setup-overlay.cmd', 'start-offline-preview.cmd'].includes(file.name)));
  for (const file of support) {
    const target = resolveFile(root, file.name);
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.copyFileSync(resolveFile(template, file.name), target, fs.constants.COPYFILE_EXCL);
  }
}

module.exports = {prepareProject};
