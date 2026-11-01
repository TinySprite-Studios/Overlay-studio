const {app, BrowserWindow, ipcMain, dialog, clipboard, shell, Menu} = require('electron');
const {autoUpdater} = require('electron-updater');
const {createUpdates} = require('./updates.cjs');
const fs = require('node:fs');
const path = require('node:path');
const {serve} = require('./server.cjs');
const scenes = require('./scenes.cjs');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {resolveFile, list, editable, media} = require('./workspace.cjs');
let updates, updateTimer, win, root, server, published, previewURL, child, watcher, refreshTimer, closing = false;
const testRoot=process.env.TSS_STUDIO_TEST_ROOT;
if(testRoot)app.setPath('userData',path.join(testRoot,'.studio-data'));
if(!testRoot&&!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
const uiURL = pathToFileURL(path.join(__dirname, 'index.html')).href;
const send = message => { if (win && !win.isDestroyed()) win.webContents.send('studio:event', message); };
const log = (text, kind = 'info') => send({type:'log', text, kind});
const template = () => app.isPackaged ? path.join(process.resourcesPath, 'overlay-template') : path.dirname(__dirname);
function copyProject(source, dest) {
  const relative=path.relative(source,dest);
  if(!relative || (!relative.startsWith('..')&&!path.isAbsolute(relative)))throw Error('Choose a destination outside the source project folder.');
  fs.mkdirSync(dest, {recursive:true});
  for (const file of list(source)) {
    const target = path.join(dest, file.name);
    if(file.type==='directory'){fs.mkdirSync(target,{recursive:true});continue;}
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.copyFileSync(resolveFile(source, file.name), target);
  }
}
function watch() {
  watcher?.close();
  watcher = fs.watch(root, {recursive:true}, (_event, name) => {
    if (!name || name.split(/[\\/]/).some(p => p.startsWith('.') || ['node_modules','studio','dist'].includes(p))) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => send({type:'files-changed'}), 250);
  });
  watcher.on('error', error => log(error.message, 'error'));
}
const state = () => ({root, name:path.basename(root), files:list(root), previewURL, obsURL:published.url, scenes:scenes.scenes(root), presets:Object.entries(scenes.presets).map(([type])=>scenes.defaults(type)), running:!!child});
async function stop() {
  const active = child;
  if (!active) return;
  await new Promise((resolve, reject) => {
    const killer = spawn('taskkill', ['/pid', String(active.pid), '/T', '/F'], {windowsHide:true});
    killer.on('error', reject);
    killer.on('exit', code => code && child === active ? reject(Error('Unable to stop the runner.')) : resolve());
  });
  if (child === active) child = null;
  send({type:'running', running:false});
}
function run() {
  if (child) return;
  const script = resolveFile(root, 'start-twitch.cmd');
  if (!fs.existsSync(script)) throw Error('This project needs a start-twitch.cmd file.');
  const runtime = path.join(app.getPath('userData'), 'runtime');
  fs.mkdirSync(runtime, {recursive:true});
  fs.writeFileSync(path.join(runtime, 'node.cmd'), '@echo off\r\n"' + process.execPath + '" %*\r\n');
  const active = spawn(process.env.ComSpec || 'cmd.exe', ['/d','/c','start-twitch.cmd'], {
    cwd:root, windowsHide:true, env:{...process.env, ELECTRON_RUN_AS_NODE:'1', PATH:runtime + path.delimiter + process.env.PATH}
  });
  child = active;
  log('Starting start-twitch.cmd…\n');
  send({type:'running', running:true});
  active.stdout.on('data', data => log(data.toString(), 'stdout'));
  active.stderr.on('data', data => log(data.toString(), 'error'));
  active.stdin.on('error', error => log(error.message + '\n', 'error'));
  active.on('error', error => log(error.message + '\n', 'error'));
  active.on('close', code => {
    if (child === active) child = null;
    log(`\nRunner exited (${code ?? 'stopped'}).\n`);
    send({type:'running', running:!!child});
  });
}
ipcMain.handle('studio', async (event, method, ...args) => {
  if (event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== uiURL) throw Error('Untrusted request');
  switch (method) {
    case 'state': return state();
    case 'update-state': return updates.state();
    case 'update-check': return updates.check();
    case 'update-download': return updates.download();
    case 'update-install': {
      if (updates.state().status !== 'downloaded') throw Error('Download an update before installing.');
      if (!await win.webContents.executeJavaScript('window.canCloseStudio()')) return false;
      await stop();
      closing = true;
      try {updates.install();} catch (error) {closing = false; throw error;}
      return true;
    }
    case 'force-colour': {
      if (!child) throw Error('Start Run overlay first to change the live overlay colour.');
      let response;
      try {
        response = await fetch('http://127.0.0.1:8787/control/paint', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TSS-Control': 'studio' },
          body: JSON.stringify({ colour: args[0], minutes: args[1] }), signal: AbortSignal.timeout(5000)
        });
      } catch { throw Error('The overlay helper is not ready. Finish signing in and try again.'); }
      if (response.status === 403 || response.status === 404) throw Error('Restart the helper from the updated project to enable manual colours.');
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not apply colour.');
      return result;
    }
    case 'read': {
      const file = resolveFile(root,args[0]);
      if (!editable.has(path.extname(file)) || fs.statSync(file).size > 2e6) throw Error('Open a text file smaller than 2 MB.');
      return fs.readFileSync(file,'utf8');
    }
    case 'save': {
      const file = resolveFile(root,args[0]);
      if (!editable.has(path.extname(file)) || typeof args[1] !== 'string' || args[1].length > 2e6) throw Error('Unsupported text file.');
      if (fs.existsSync(file) && fs.readFileSync(file,'utf8') !== args[2]) throw Error('This file changed on disk. Reopen it before saving to avoid overwriting those changes.');
      fs.writeFileSync(file,args[1]); return true;
    }
    case 'create': {
      const file = resolveFile(root,args[0]);
      if (!editable.has(path.extname(file))) throw Error('Use an HTML, CSS, JavaScript or text extension.');
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,'',{flag:'wx'}); return state();
    }
    case 'new-folder': {fs.mkdirSync(resolveFile(root,args[0]),{recursive:true});return state();}
    case 'open': case 'copy': case 'new-project': case 'export': {
      if (child && method!=='export') throw Error('Stop the runner before switching projects.');
      const result = await dialog.showOpenDialog(win,{title:method !== 'open' ? 'Choose an empty folder for your project' : 'Open an overlay project',properties:['openDirectory','createDirectory']});
      if (result.canceled) return null;
      const selected = result.filePaths[0];
      if (method !== 'open') {
        if (fs.readdirSync(selected).length) throw Error('Choose an empty folder so existing files stay safe.');
        copyProject(method==='new-project'?template():root,selected);
        if(method==='new-project')scenes.starters(selected);
        if(method==='export')return {destination:selected};
      } else if (!fs.existsSync(path.join(selected,'start-twitch.cmd'))) throw Error('Choose an overlay folder containing start-twitch.cmd.');
      root = selected; fs.writeFileSync(path.join(app.getPath('userData'),'workspace.json'),JSON.stringify({root})); watch(); return state();
    }
    case 'run': run(); return true;
    case 'stop': await stop(); return true;
    case 'input': if (!child) throw Error('The runner is stopped.'); child.stdin.write(String(args[0]).slice(0,10000)+'\r\n'); return true;
    case 'copy-url': {
      const name=args[0],file=resolveFile(root,name);
      if(path.extname(file)!=='.html'||!fs.statSync(file).isFile())throw Error('Select an HTML scene first.');
      const url=published.url+'/'+name.split('/').map(encodeURIComponent).join('/');clipboard.writeText(url);return url;
    }
    case 'scene-create': {const scene=scenes.create(root,args[0]);return {scene,state:state()};}
    case 'scene-update': {const scene=scenes.update(root,args[0],args[1],args[2]);return {scene,state:state()};}
    case 'scene-duplicate': {const source=scenes.read(root,args[0]);const scene=scenes.create(root,{...source.config,name:source.config.name+' Copy'},source.id);return {scene,state:state()};}
    case 'scene-delete': {await shell.trashItem(scenes.sceneDir(root,args[0]));return state();}
    case 'scene-starters': {scenes.bundled(root,template());scenes.starters(root);return state();}
    case 'import-assets': {
      const result=await dialog.showOpenDialog(win,{title:'Import images, videos, audio or fonts',properties:['openFile','multiSelections'],filters:[{name:'Overlay assets',extensions:[...media].map(e=>e.slice(1)).concat('svg')}]});
      if(result.canceled)return null;
      const imported=[];fs.mkdirSync(resolveFile(root,'assets'),{recursive:true});
      for(const source of result.filePaths){const ext=path.extname(source).toLowerCase();if(!media.has(ext)&&ext!=='.svg')continue;
        const base=path.basename(source,ext).replace(/[^a-zA-Z0-9_-]/g,'_')||'asset';let name='assets/'+base+ext,index=2;
        while(fs.existsSync(resolveFile(root,name)))name='assets/'+base+'-'+(index++)+ext;
        fs.copyFileSync(source,resolveFile(root,name),fs.constants.COPYFILE_EXCL);imported.push(name);
      }return {imported,state:state()};
    }
    case 'resolve-close': {const result=await dialog.showMessageBox(win,{type:'question',message:'Save changes to '+String(args[0])+'?',buttons:['Save','Discard','Cancel'],defaultId:0,cancelId:2,noLink:true});return result.response;}
    case 'confirm': {const result=await dialog.showMessageBox(win,{type:'question',message:String(args[0]),buttons:['Continue','Cancel'],defaultId:1,cancelId:1,noLink:true});return result.response===0;}
    case 'tinysprite-website': await shell.openExternal('https://tinysprite.dev/'); return true;
    case 'folder': await shell.openPath(root); return true;
    case 'minimize': win.minimize(); return;
    case 'maximize': win.isMaximized() ? win.unmaximize() : win.maximize(); return;
    case 'close': win.close(); return;
    default: throw Error('Unknown command');
  }
});
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const enabled = app.isPackaged && !testRoot && !process.env.PORTABLE_EXECUTABLE_FILE && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  updates = createUpdates({updater:autoUpdater, version:app.getVersion(), enabled,
    disabledReason:'Automatic updates require the installed GitHub release. Portable and development copies are updated manually.', send,
    notify:version => {
      const {Notification} = require('electron');
      if (Notification.isSupported()) {
        const notification = new Notification({title:'TinySprite update available', body:'Version '+version+' is ready. Open Studio to download it.'});
        notification.on('click',()=>{if(win){win.restore();win.show();win.focus();}});
        notification.show();
      }
    }
  });
  root = template();
  if (app.isPackaged) {
    root = path.join(app.getPath('documents'),'TinySprite Overlay Studio','My Overlay');
    if (!fs.existsSync(root)) {copyProject(template(),root);scenes.starters(root);}
  }
  try {const saved=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'workspace.json'),'utf8'));if(fs.existsSync(path.join(saved.root,'start-twitch.cmd')))root=saved.root;}catch{}
  if(testRoot)root=testRoot;
  server=await serve(()=>root,0,true);previewURL=server.url;
  try{published=await serve(()=>root,testRoot?0:8791,false);}catch(error){throw Error('The OBS scene server could not start on port 8791. Close the other Studio instance and try again. '+error.message);}
  win = new BrowserWindow({show:!testRoot,width:1500,height:960,minWidth:1050,minHeight:700,frame:false,icon:path.join(__dirname,'../assets/branding/overlay-studio.ico'),backgroundColor:'#101113',title:'TinySprite Overlay Studio',webPreferences:{backgroundThrottling:!testRoot,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback) => callback(false));
  win.on('close', event => {
    if (closing) return;
    event.preventDefault();
    win.webContents.executeJavaScript('window.canCloseStudio()').then(async allowed => {
      if (!allowed) return;
      try {await stop(); closing = true; win.close();} catch (error) {log(error.message,'error');}
    }).catch(error => log('Could not close: '+error.message+'\n','error'));
  });
  await win.loadFile(path.join(__dirname,'index.html'));
  watch();
  updates.check();
  updateTimer = setInterval(() => updates.check(), 60 * 60 * 1000);
  updateTimer.unref();
}).catch(error => {dialog.showErrorBox('Studio could not start',error.message);app.quit();});
app.on('window-all-closed', () => {clearInterval(updateTimer);watcher?.close();server?.close();published?.close();app.quit();});
