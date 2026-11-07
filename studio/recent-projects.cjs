const fs = require('node:fs');
const path = require('node:path');
const key = folder => path.resolve(folder).toLowerCase();

function recentProjects(file) {
  let saved = {};
  try {saved = JSON.parse(fs.readFileSync(file, 'utf8'));} catch {}
  let projects = [...new Map((Array.isArray(saved.projects) ? saved.projects : [saved.root])
    .filter(folder => typeof folder === 'string' && path.isAbsolute(folder))
    .map(folder => [key(folder), folder])).values()];
  const persist = root => {
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, JSON.stringify({root, projects}, null, 2));
  };
  return {
    root:saved.root,
    initialized:Array.isArray(saved.projects),
    list:() => projects.map(root => ({root, name:path.basename(root)})),
    has:root => typeof root === 'string' && projects.some(folder => key(folder) === key(root)),
    remember(root) {
      projects = [root, ...projects.filter(folder => key(folder) !== key(root))];
      persist(root);
    },
    remove(folder, root) {
      projects = projects.filter(project => key(project) !== key(folder));
      persist(root);
    }
  };
}
module.exports = {recentProjects};
