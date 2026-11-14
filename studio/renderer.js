/* global require, monaco */
const $=id=>document.getElementById(id);
let developerMode=false;
let state,editor,active=null,running=false,switching=false,view='workspace',selectedScene=null,sceneDirty=false,unread=0,createKind='file',savingScene=false;
const documents=new Map(),expanded=new Set(['assets','scenes']);
const call=(method,...args)=>window.studio.call(method,...args);
function notice(message){$('notice').textContent=message;}
function report(error){notice(error.message);log(error.message+'\n','error');}
function log(text,kind='info'){
  const node=document.createElement('span');node.className=kind;node.textContent=text;const output=$('console');const bottom=output.scrollHeight-output.scrollTop-output.clientHeight<40;
  output.append(node);while(output.childNodes.length>1200)output.firstChild.remove();if(bottom)output.scrollTop=output.scrollHeight;
  if(view!=='console'){unread++;$('console-count').textContent=unread>99?'99+':unread;$('console-count').hidden=false;}
}
function action(id,fn){$(id).addEventListener('click',()=>Promise.resolve().then(fn).catch(report));}
const language=name=>({js:'javascript',mjs:'javascript',cjs:'javascript',html:'html',css:'css',json:'json',svg:'xml',md:'markdown',cmd:'bat'})[name.split('.').pop()]||'plaintext';
function isDirty(doc){return doc.model.getValue()!==doc.saved;}
function dirty(){return !!window.connectionSettingsDirty?.()||eventsDirty||sceneDirty||[...documents.values()].some(isDirty);}
function renderFiles(){
  $('files').replaceChildren();if(!state)return;
  const query=$('filter').value.toLowerCase();const tree={children:new Map()};
  for(const file of state.files){let node=tree;let full='';for(const part of file.name.split('/')){full=full?full+'/'+part:part;if(!node.children.has(part))node.children.set(part,{name:part,path:full,children:new Map(),type:'directory'});node=node.children.get(part);}Object.assign(node,file,{name:file.name.split('/').pop()});}
  function matches(node){return node.path.toLowerCase().includes(query)||[...node.children.values()].some(matches);}
  function draw(parent,target){for(const node of [...parent.children.values()].sort((a,b)=>(a.type==='directory'?0:1)-(b.type==='directory'?0:1)||a.name.localeCompare(b.name))){
    if(query&&!matches(node))continue;
    const folder=node.type==='directory',opened=expanded.has(node.path)||!!query;
    const button=document.createElement('button');button.title=node.path;button.dataset.path=node.path;button.classList.toggle('active',node.path===active);button.classList.toggle('folder-row',folder);
    if(folder)button.setAttribute('aria-expanded',String(opened));
    const arrow=document.createElement('span');arrow.className='tree-arrow';arrow.textContent=folder?(opened?'▾':'▸'):'';
    const icon=document.createElement('span');icon.className='file-icon';icon.textContent=folder?'▱':node.editable?'⌘':'◇';
    const name=document.createElement('span');name.className='file-label';name.textContent=node.name;button.append(arrow,icon,name);target.append(button);
    button.onclick=()=>{if(folder){opened?expanded.delete(node.path):expanded.add(node.path);renderFiles();}else if(node.editable){showView('workspace');openFile(node.path).catch(report);}else previewAsset(node.path).catch(report);};
    if(folder&&opened){const children=document.createElement('div');children.className='tree-children';target.append(children);draw(node,children);}
  }}draw(tree,$('files'));
}
function tabs(){
  $('tabs').replaceChildren();
  for(const [name,doc]of documents){
    const tab=document.createElement('div');tab.className='code-tab'+(name===active?' active':'');
    const button=document.createElement('button');button.className='tab-name';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(name===active));button.textContent=name.split('/').pop()+(isDirty(doc)?' •':'');button.title=name;button.onclick=()=>openFile(name).catch(report);
    const close=document.createElement('button');close.className='tab-close';close.textContent='×';close.title='Close '+name;close.setAttribute('aria-label','Close '+name);close.onclick=()=>closeTab(name).catch(report);tab.append(button,close);$('tabs').append(tab);
  }
  const doc=documents.get(active);$('file-status').textContent=doc?language(active)+' · '+(isDirty(doc)?'Unsaved changes':'Saved'):'Select a file to start editing';$('save').disabled=!doc;
}
async function openFile(name){
  if(!developerMode||!editor||!name)return;if(active&&documents.has(active))documents.get(active).view=editor.saveViewState();
  if(!documents.has(name)){const text=await call('read',name);const model=monaco.editor.createModel(text,language(name));documents.set(name,{model,saved:text});model.onDidChangeContent(tabs);}
  active=name;const doc=documents.get(name);editor.setModel(doc.model);if(doc.view)editor.restoreViewState(doc.view);editor.focus();
  const parts=name.split('/');parts.pop();while(parts.length){expanded.add(parts.join('/'));parts.pop();}tabs();renderFiles();
}
async function saveFile(name){const doc=documents.get(name);if(!doc)return;const value=doc.model.getValue();await call('save',name,value,doc.saved);doc.saved=value;tabs();}
async function save(){if(!active)return;await saveFile(active);refresh();notice('Saved '+active);}
async function saveAll(){for(const [name,doc]of documents)if(isDirty(doc))await saveFile(name);if(sceneDirty)await saveScene();if(eventsDirty)await saveEvents();if(window.connectionSettingsDirty?.())await window.saveConnectionSettings();refresh();notice('All changes saved');}
async function closeTab(name){
  const doc=documents.get(name);if(!doc)return;
  if(isDirty(doc)){const choice=await call('resolve-close',name);if(choice===2)return;if(choice===0)await saveFile(name);}
  if(active===name){editor.setModel(null);active=null;}documents.delete(name);doc.model.dispose();
  if(!active&&documents.size)await openFile([...documents.keys()].at(-1));tabs();renderFiles();
}
async function settleScene(){if(!sceneDirty)return true;const choice=await call('resolve-close','scene settings');if(choice===2)return false;if(choice===0)await saveScene();else{sceneDirty=false;fillScene();}return true;}
window.canCloseStudio=async()=>{
  if(window.connectionSettingsBusy?.()){notice('Wait for the connection request to finish before closing.');return false;}
  if(!dirty())return true;
  const choice=await call('resolve-close','your project');if(choice===2)return false;if(choice===0)await saveAll();return true;
};
let activityTimer,activityKind='',activitySignature='';
const activityIcons={follow:'♥',sub:'★',gift:'🎁',cheer:'◆',raid:'⚑',powerup:'⚡',reward:'✦',donation:'$'};
function ago(time){const s=Math.max(0,Math.round((Date.now()-time)/1000));if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';return Math.floor(s/86400)+' d ago';}
async function loadActivity(){
  const rows=(await call('feed')).filter(row=>!activityKind||row.kind===activityKind);
  const signature=activityKind+JSON.stringify(rows.map(row=>row.id))+Math.floor(Date.now()/60000);
  if(signature===activitySignature)return;activitySignature=signature;
  const list=$('activity-list');
  if(!rows.length){const empty=document.createElement('div');empty.className='activity-empty';empty.textContent='Nothing yet. Run the overlay and new follows, subs, bits, raids and donations will appear here.';list.replaceChildren(empty);return;}
  list.replaceChildren(...rows.map(row=>{
    const item=document.createElement('div');item.className='activity-row';item.dataset.kind=row.kind;
    const icon=document.createElement('div');icon.className='activity-icon-pill';icon.textContent=activityIcons[row.kind]||'•';
    const main=document.createElement('div');main.className='activity-main';
    const name=document.createElement('strong');name.textContent=row.name;const detail=document.createElement('span');detail.textContent=row.detail;
    main.append(name,detail);const time=document.createElement('div');time.className='activity-time';time.textContent=ago(row.time);
    item.append(icon,main,time);return item;
  }));
}
$('activity-filters').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;activityKind=button.dataset.kind;for(const other of $('activity-filters').children)other.classList.toggle('active',other===button);activitySignature='';loadActivity().catch(report);});
function showView(next){
  stopSoundPreview();view=next;document.querySelector('main').dataset.view=next;
  for(const value of ['workspace','scenes','events','activity','settings','console']){$('view-'+value).classList.toggle('active',value===next);$('view-'+value).setAttribute('aria-selected',String(value===next));}
  const titles={workspace:['Make it yours.',developerMode?'Edit your overlay, preview every detail, then go live.':'Preview your overlays, test alerts, then go live.'],scenes:['Set the scene.','Build a complete stream, from the first hello to the final goodbye.'],events:['Stream events.','Customise your channel rewards, colours and alert sounds.'],activity:['Activity feed.','Follows, subs, gifts, bits, raids and donations as they happen.'],settings:['Your connections.','Connect your streaming account and donation platforms for this project.'],console:['Behind the stream.','Live output and setup prompts from your Twitch runner.']};
  $('page-title').textContent=titles[next][0];$('page-description').textContent=titles[next][1];
  if(next==='settings')window.openConnectionSettings?.();
  if(next==='events')window.loadTwitchRewards?.();
  clearInterval(activityTimer);if(next==='activity'){loadActivity();activityTimer=setInterval(loadActivity,3000);}
  if(next==='console'){unread=0;$('console-count').hidden=true;$('console').scrollTop=$('console').scrollHeight;}
  if(next==='scenes'&&!selectedScene&&state?.scenes.length)selectScene(state.scenes[0].id).catch(report);
  requestAnimationFrame(()=>{scale();editor?.layout();});
}
function renderProjects() {
  const list = $('recent-projects');list.replaceChildren();
  for (const project of state.projects) {
    const row = document.createElement('div');row.className='recent-project';
    const selected = project.root.toLowerCase() === state.root.toLowerCase();
    row.classList.toggle('active',selected);
    const open = document.createElement('button');open.className='project-select';open.title=project.root;
    open.setAttribute('aria-current',String(selected));open.dataset.project=project.root;
    const name=document.createElement('strong');name.textContent=project.name;
    const folder=document.createElement('small');folder.textContent=project.root;
    open.append(name,folder);open.onclick=()=>{if(!selected)changeProject('select-project',project.root).catch(report);};
    const remove=document.createElement('button');remove.className='project-remove';
    remove.title='Remove from list (keep files)';remove.setAttribute('aria-label','Remove '+project.name+' from recent projects');
    remove.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
    remove.onclick=async()=>{try{applyState(await call('forget-project',project.root));notice('Removed from recent projects. Files kept on disk.');}catch(error){report(error);}};
    row.append(open,remove);list.append(row);
  }
  if (!state.projects.length) list.textContent='No recent projects.';
}
function applyState(next){
  state=next;renderProjects();window.connectionProjectChanged?.(state.root);
  $('server-status').textContent='OBS SERVER · '+state.obsURL.replace('http://','');renderFiles();renderPreviewFiles();renderScenes();if(!eventsDirty)renderEvents();setRunning(state.running);
}
function renderPreviewFiles(){const current=$('preview-file').value;$('preview-file').replaceChildren();for(const file of state.files.filter(f=>f.type!=='directory'&&f.name.endsWith('.html'))){const option=new Option(state.scenes.find(s=>s.file===file.name)?.config.name||file.name,file.name);$('preview-file').append(option);}const names=[...$('preview-file').options].map(option=>option.value);$('preview-file').value=names.includes(current)?current:['overlays/overlay-horizontal.html','overlay-horizontal.html',state.scenes[0]?.file,...names].find(name=>names.includes(name))||'';}
function dimensions(){return $('layout').value==='vertical'?[1080,1920]:[1920,1080];}
function scale(){const [w,h]=dimensions(),wrap=$('stage').parentElement;const factor=Math.max(.01,Math.min((wrap.clientWidth-32)/w,(wrap.clientHeight-32)/h));Object.assign($('stage').style,{width:w*factor+'px',height:h*factor+'px'});Object.assign($('preview').style,{width:w+'px',height:h+'px',transform:`scale(${factor})`});}
function refresh(){
  if(!state)return;stopSoundPreview();if(!$('preview-file').value){$('preview').removeAttribute('src');return;}const live=$('preview-mode').value==='live',name=$('preview-file').value||'overlays/overlay-horizontal.html';
  $('preview').src=(live?state.obsURL:state.previewURL)+'/'+name.split('/').map(encodeURIComponent).join('/')+'?studio='+Date.now();
  $('preview-label').textContent=live?'OBS OUTPUT':'LOCAL PREVIEW';$('live-hint').hidden=!live;document.querySelectorAll('[data-alert], [data-test-event]').forEach(b=>b.disabled=live);scale();
}
function setRunning(value){running=value;$('run').disabled=value;$('stop').disabled=!value;$('run-status').textContent=value?'● Runner active':'● Runner stopped';$('run-status').classList.toggle('running',value);$('console-input').disabled=!value;}
async function changeProject(method,...args){
  if(switching)return;if(window.connectionSettingsBusy?.())throw Error('Wait for the connection request to finish before switching projects.');if(dirty()){const choice=await call('resolve-close','your project before switching');if(choice===2)return;if(choice===0)await saveAll();}
  stopSoundPreview();switching=true;try{const next=await call(method,...args);if(!next)return;editor.setModel(null);active=null;for(const doc of documents.values())doc.model.dispose();documents.clear();selectedScene=null;sceneDirty=false;eventsDirty=false;expanded.clear();expanded.add('assets');expanded.add('scenes');applyState(next);fillScene();await openFile(next.files.find(f=>f.name==='config.js')?.name||next.files.find(f=>f.editable)?.name);refresh();showView('workspace');notice('Opened '+next.name);}finally{switching=false;}
}
function renderScenes(){
  $('scene-count').textContent=state.scenes.length;$('scene-cards').replaceChildren();
  if(!state.scenes.length){const empty=document.createElement('div');empty.className='scene-empty-card';empty.textContent='Start with a scene template, or add the complete five-scene starter pack.';$('scene-cards').append(empty);}
  for(const scene of state.scenes){const card=document.createElement('button');card.className='scene-card'+(selectedScene?.id===scene.id?' active':'');card.dataset.scene=scene.id;card.style.setProperty('--scene-glow',scene.config.accent+'44');
    const label=document.createElement('small');label.textContent=scene.config.type;const name=document.createElement('strong');name.textContent=scene.config.name;const size=document.createElement('span');size.textContent=scene.config.layout==='vertical'?'1080 × 1920':'1920 × 1080';card.append(label,name,size);card.onclick=()=>selectScene(scene.id).catch(report);$('scene-cards').append(card);}
}
function assetOptions(id,regex,value){const select=$(id);select.replaceChildren(new Option('None',''));for(const file of state.files.filter(f=>f.name.startsWith('assets/')&&f.type==='file'&&regex.test(f.name)))select.append(new Option(file.name.slice(7),file.name));if(value&&![...select.options].some(o=>o.value===value))select.append(new Option(value+' (missing)',value));select.value=value||'';}
function renderFields(container, fields = [], values = {}) {
  container.replaceChildren();
  for (const field of fields) {
    const label = document.createElement('label');
    label.textContent = field.label || field.key;
    const input = document.createElement(field.type === 'select' ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
    input.dataset.setting = field.key;
    if (field.type === 'select') {
      for (const option of field.options || []) input.append(new Option(typeof option === 'object' ? option.label : option, typeof option === 'object' ? option.value : option));
    } else if (field.type !== 'textarea') input.type = ({boolean:'checkbox', color:'color', number:'number'})[field.type] || 'text';
    for (const key of ['min', 'max', 'step', 'maxLength']) if (field[key] != null) input[key] = field[key];
    if (field.type === 'number' && field.step == null) input.step = 'any';
    input.required = !!field.required;
    const value = values[field.key] ?? field.default ?? '';
    if (input.type === 'checkbox') input.checked = !!value;
    else input.value = value;
    label.append(input);
    if (field.description) {const help=document.createElement('small');help.textContent=field.description;label.append(help);}
    container.append(label);
  }
}
function fieldValues(container) {
  return Object.fromEntries([...container.querySelectorAll('[data-setting]')].map(input => [input.dataset.setting, input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value]));
}
function fillScene(){
  $('scene-empty').hidden=!!selectedScene;$('scene-form').hidden=!selectedScene;$('scene-code').disabled=!selectedScene;$('scene-vertical').disabled=!selectedScene;
  if(!selectedScene)return;
  const custom = selectedScene.config.type === 'custom';
  $('scene-form').querySelector('.form-grid').hidden = custom;
  for(const input of $('scene-form').querySelector('.form-grid').querySelectorAll('input,select,textarea'))input.disabled=custom;
  renderFields($('scene-custom-settings'),selectedScene.config.fields,selectedScene.config.values);
  $('scene-form').classList.toggle('live-overlay',!!selectedScene.external);
  $('scene-form').classList.toggle('portrait-copy',!!selectedScene.portrait);$('portrait-help').hidden=!selectedScene.portrait;
  const c=selectedScene.config;assetOptions('scene-background',/\.(png|jpe?g|gif|svg|webp|mp4|webm)$/i,c.background);assetOptions('scene-logo',/\.(png|jpe?g|gif|svg|webp)$/i,c.logo);assetOptions('scene-audio',audioExtensions,c.audio);
  for(const [key,value]of Object.entries(c)){const field=$('scene-form').elements.namedItem(key);if(!field)continue;if(field.type==='checkbox')field.checked=value;else field.value=value;}
  window.sceneSettings?.update(selectedScene);
  $('scene-apply').textContent='Apply changes';
}
async function selectScene(id){
  if(!(await settleScene()))return;selectedScene=state.scenes.find(s=>s.id===id)||null;sceneDirty=false;fillScene();$('scene-form').scrollTop=0;renderScenes();
  if(selectedScene){$('preview-file').value=selectedScene.file;$('layout').value=selectedScene.config.layout;refresh();}
}
async function saveScene(){
  if(!selectedScene||savingScene)return;
  window.sceneSettings?.revealInvalid();
  if(!$('scene-form').reportValidity())throw Error('Complete the scene settings first.');
  const prefix='scenes/'+selectedScene.id+'/';for(const name of selectedScene.external?['tss-theme.js']:[prefix+'config.js',prefix+'scene.json'])if(documents.has(name)&&isDirty(documents.get(name)))throw Error('Save or close your edits to '+name+' before applying visual settings.');
  const values=Object.fromEntries(new FormData($('scene-form')).entries());
  const animate=$('scene-form').elements.namedItem('animate');if(!animate.disabled)values.animate=animate.checked;
  values.values=fieldValues($('scene-custom-settings'));
  savingScene=true;try{const result=await call('scene-update',selectedScene.id,{...selectedScene.config,...values},selectedScene.revision);sceneDirty=false;selectedScene=result.scene;applyState(result.state);fillScene();$('preview-file').value=selectedScene.file;$('layout').value=selectedScene.config.layout;refresh();notice('Scene saved · refresh its OBS browser source to see the update');}finally{savingScene=false;}
}
$('scene-form').oninput=()=>{sceneDirty=true;$('scene-apply').textContent='Apply changes •';};
$('scene-form').onsubmit=event=>{event.preventDefault();saveScene().catch(report);};
async function previewAsset(name){
  const ext=name.split('.').pop().toLowerCase();$('asset-name').textContent=name;$('asset-content').replaceChildren();let element;
  if(['png','jpg','jpeg','gif','webp'].includes(ext)){element=document.createElement('img');element.alt=name;}
  else if(['mp4','webm'].includes(ext)){element=document.createElement('video');element.controls=true;}
  else if(['mp3','wav','ogg'].includes(ext)){element=document.createElement('audio');element.controls=true;}
  else{const label=document.createElement('p');label.textContent='Imported asset: '+name;$('asset-content').append(label);}
  if(element){element.src=state.obsURL+'/'+name.split('/').map(encodeURIComponent).join('/');$('asset-content').append(element);}$('asset-dialog').showModal();
}
async function copyURL(){const url=await call('copy-url',$('preview-file').value);notice('OBS URL copied · '+dimensions().join(' × '));return url;}
async function toggleDeveloperMode(){
  if(developerMode){
    const changed=[...documents.entries()].filter(([,doc])=>isDirty(doc));
    if(changed.length){
      const choice=await call('resolve-close','your code before leaving Developer mode');
      if(choice===2)return;
      if(choice===0)for(const [name]of changed)await saveFile(name);
      else for(const [,doc]of changed)doc.model.setValue(doc.saved);
    }
  }
  developerMode=!developerMode;
  document.body.classList.toggle('streamer-mode',!developerMode);
  $('developer-mode').setAttribute('aria-pressed',String(developerMode));
  $('developer-mode').textContent='Developer mode: '+(developerMode?'On':'Off');
  if(developerMode&&!active&&state)await openFile(state.files.find(f=>f.name==='config.js')?.name||state.files.find(f=>f.editable)?.name);
  showView(view);refresh();
  notice(developerMode?'Developer mode enabled':'Streamer mode enabled');
}
action('developer-mode',toggleDeveloperMode);
action('save',save);action('save-all',saveAll);action('run',async()=>{await saveAll();await call('run');showView('console');});action('stop',()=>call('stop'));
for(const method of ['import-project','copy','create-project'])action(method,()=>changeProject(method));
action('export',async()=>{await saveAll();const result=await call('export');if(result)notice('Project exported to '+result.destination);});
action('import-assets',async()=>{const result=await call('import-assets');if(result){applyState(result.state);if(selectedScene){const form=$('scene-form');assetOptions('scene-background',/\.(png|jpe?g|gif|svg|webp|mp4|webm)$/i,form.elements.background.value);assetOptions('scene-logo',/\.(png|jpe?g|gif|svg|webp)$/i,form.elements.logo.value);assetOptions('scene-audio',audioExtensions,form.elements.audio.value);}refreshSoundOptions();expanded.add('assets');renderFiles();notice('Imported '+result.imported.length+' assets');}});
action('folder',()=>call('folder'));action('refresh',refresh);action('copy-url',copyURL);action('obs-copy',copyURL);
action('obs-help',()=>{$('obs-url').value=state.obsURL+'/'+$('preview-file').value.split('/').map(encodeURIComponent).join('/');$('obs-dimensions').textContent='Width '+dimensions()[0]+' · Height '+dimensions()[1];$('obs-dialog').showModal();});
for(const name of ['minimize','maximize','close'])action(name,()=>call(name));
for(const name of ['workspace','scenes','events','activity','settings','console'])action('view-'+name,()=>showView(name));
action('enlarge',()=>{const enlarged=document.querySelector('.preview-panel').classList.toggle('preview-enlarged');$('enlarge').textContent=enlarged?'⛶ Restore':'⛶ Enlarge';$('enlarge').setAttribute('aria-label',enlarged?'Restore preview':'Enlarge preview');scale();});
action('clear',()=>{$('console').replaceChildren();unread=0;$('console-count').hidden=true;});
for(const kind of ['file','folder'])action('new-'+kind,()=>{createKind=kind;$('file-dialog-title').textContent='Create a '+kind;$('filename').value='';$('filename').placeholder=kind==='file'?'scenes/custom.html':'assets/backgrounds';$('file-error').textContent='';$('file-dialog').showModal();});
$('create-file-form').onsubmit=async event=>{event.preventDefault();try{const name=$('filename').value.trim().replaceAll('\\','/');applyState(await call(createKind==='file'?'create':'new-folder',name));if(createKind==='file'){showView('workspace');await openFile(name);}else{expanded.add(name);renderFiles();}$('file-dialog').close();}catch(error){$('file-error').textContent=error.message;}};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
$('asset-dialog').onclose=()=>$('asset-content').replaceChildren();
action('new-scene',async()=>{if(!(await settleScene()))return;$('scene-template').replaceChildren(...state.presets.map(p=>new Option(p.name,p.type)));$('new-scene-name').value=state.presets[0].name;$('scene-error').textContent='';$('scene-dialog').showModal();});
$('scene-template').onchange=()=>$('new-scene-name').value=state.presets.find(p=>p.type===$('scene-template').value).name;
$('create-scene-form').onsubmit=async event=>{event.preventDefault();try{const preset=state.presets.find(p=>p.type===$('scene-template').value);const result=await call('scene-create',{...preset,name:$('new-scene-name').value,layout:$('new-scene-layout').value});applyState(result.state);await selectScene(result.scene.id);$('scene-dialog').close();showView('scenes');notice('Scene created · customise it on the right');}catch(error){$('scene-error').textContent=error.message;}};
action('starter-scenes',async()=>{if(!(await settleScene()))return;applyState(await call('scene-starters'));await selectScene(state.scenes[0].id);notice('Starter scenes added. Existing scenes were kept.');});
action('scene-code',async()=>{if(!selectedScene||!(await settleScene()))return;if(!developerMode)await toggleDeveloperMode();showView('workspace');await openFile(selectedScene.portrait?selectedScene.file.replace('index.html','portrait-source.html'):selectedScene.file);});
action('scene-vertical',async()=>{
  if(!selectedScene||!(await settleScene()))return;
  $('vertical-error').textContent='';$('vertical-method').value='fit';
  try{const css=await call('read','scenes/'+selectedScene.id+'/style.css');if(css.includes('.vertical.type-chatting'))$('vertical-method').value='responsive';}catch{}
  $('vertical-dialog').showModal();
});
$('vertical-form').onsubmit=async event=>{
  event.preventDefault();const button=$('vertical-form').querySelector('[type=submit]');button.disabled=true;
  try{await saveAll();const result=await call('scene-vertical',selectedScene.id,$('vertical-method').value);applyState(result.state);await selectScene(result.scene.id);$('vertical-dialog').close();showView('scenes');notice('Vertical copy ready: 1080 ? 1920. Copy its OBS URL to use it.');}
  catch(error){$('vertical-error').textContent=error.message;}finally{button.disabled=false;}
};
action('scene-duplicate',async()=>{if(!selectedScene||!(await settleScene()))return;await saveAll();const result=await call('scene-duplicate',selectedScene.id);applyState(result.state);await selectScene(result.scene.id);notice('Scene duplicated, including custom code');});
action('scene-delete',async()=>{if(!selectedScene)return;if(!(await call('confirm','Move '+selectedScene.config.name+' to the Recycle Bin? Unsaved edits in this scene will be discarded.')))return;const prefix='scenes/'+selectedScene.id+'/';for(const [name,doc]of documents)if(name.startsWith(prefix)){if(active===name){active=null;editor.setModel(null);}documents.delete(name);doc.model.dispose();}const next=await call('scene-delete',selectedScene.id);selectedScene=null;sceneDirty=false;applyState(next);fillScene();tabs();if(state.scenes.length)await selectScene(state.scenes[0].id);else refresh();notice('Scene moved to the Recycle Bin');});
$('filter').oninput=renderFiles;
$('layout').onchange=()=>{if(/^overlay-(horizontal|vertical)\.html$/.test($('preview-file').value))$('preview-file').value='overlay-'+$('layout').value+'.html';refresh();};
$('preview-mode').onchange=refresh;$('preview-file').onchange=async()=>{const scene=state.scenes.find(s=>s.file===$('preview-file').value);if(scene&&view==='scenes')await selectScene(scene.id);else{if(scene)$('layout').value=scene.config.layout;refresh();}};
action('playground',()=>{$('preview-mode').value='offline';$('preview-file').value='overlays/offline-preview.html';refresh();notice('Offline playground · test events inside the preview');});
document.querySelectorAll('[data-alert]').forEach(button=>button.onclick=()=>{$('preview').contentWindow.postMessage({type:'alert',data:{kind:button.dataset.alert,name:'TinySprite',detail:'A little magic for your stream ✦'}},state.previewURL);notice('Preview alert sent');});
$('console-form').onsubmit=async event=>{event.preventDefault();try{await call('input',$('console-input').value);$('console-input').value='';}catch(error){report(error);}};
window.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();(event.shiftKey?saveAll():view==='scenes'?saveScene():view==='events'?saveEvents():view==='settings'?window.saveConnectionSettings():save()).catch(report);}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='w'&&active){event.preventDefault();closeTab(active).catch(report);}
  if(event.key==='Escape'&&document.querySelector('.preview-enlarged')){$('enlarge').click();}
});
let dragging=false;$('resize').onpointerdown=event=>{dragging=true;$('resize').setPointerCapture(event.pointerId);};$('resize').onpointerup=()=>dragging=false;
function split(fraction){$('workarea').style.gridTemplateColumns=`minmax(260px,${fraction}fr) 12px minmax(300px,${1-fraction}fr)`;scale();}
$('resize').onpointermove=event=>{if(!dragging)return;const rect=$('workarea').getBoundingClientRect();split(Math.max(.3,Math.min(.7,(event.clientX-rect.left)/rect.width)));};$('resize').onkeydown=event=>{if(event.key==='ArrowLeft')split(.4);if(event.key==='ArrowRight')split(.6);};
new ResizeObserver(scale).observe($('stage').parentElement);
window.studio.on(async message=>{
  if(message.type==='log')log(message.text,message.kind);if(message.type==='running')setRunning(message.running);
  if(message.type==='files-changed')try{
    applyState(await call('state'));
    for(const [name,doc]of documents){if(isDirty(doc))continue;try{const fresh=await call('read',name);if(fresh!==doc.saved){doc.saved=fresh;doc.model.setValue(fresh);}}catch{}}
    if(selectedScene&&!sceneDirty&&!savingScene){selectedScene=state.scenes.find(s=>s.id===selectedScene.id)||null;fillScene();}
    refresh();tabs();
  }catch(error){report(error);}
});
require.config({paths:{vs:'../node_modules/monaco-editor/min/vs'}});
require(['vs/editor/editor.main'],async()=>{
  monaco.editor.defineTheme('tinysprite',{base:'vs-dark',inherit:true,rules:[{token:'comment',foreground:'687981'},{token:'string',foreground:'b9d59d'},{token:'keyword',foreground:'e78699'}],colors:{'editor.background':'#17191b','editorLineNumber.foreground':'#4e5762','editorCursor.foreground':'#e34855','editor.selectionBackground':'#57303a','editor.lineHighlightBackground':'#1e2024','editorWidget.background':'#202226'}});
  $('editor').replaceChildren();editor=monaco.editor.create($('editor'),{theme:'tinysprite',automaticLayout:true,fontSize:12,fontFamily:'Consolas, monospace',minimap:{enabled:false},padding:{top:16},scrollBeyondLastLine:false,tabSize:2,wordWrap:'on',smoothScrolling:true,model:null});
  editor.onDidChangeCursorPosition(event=>$('cursor').textContent=`Ln ${event.position.lineNumber}, Col ${event.position.column}`);
  try{applyState(await call('state'));fillScene();await openFile(state.files.find(f=>f.name==='config.js')?.name||state.files.find(f=>f.editable)?.name);refresh();log('TinySprite Overlay Studio ready.\nOBS scene server: '+state.obsURL+'\nScenes work without Twitch sign-in. Run overlay starts the Twitch helper.\n');}catch(error){report(error);}
},error=>notice('Editor failed to load: '+error.message));

action('force-apply',async()=>{
  const minutes=Number($('force-minutes').value);
  if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Error('Enter a duration from 1 to 1440 whole minutes.');
  $('force-apply').disabled=true;
  try{
    await call('force-colour',$('force-colour').value,minutes);
    $('preview-mode').value='live';refresh();
    notice('Live colour applied for '+minutes+' minutes. Queued colours resume afterwards.');
  }finally{$('force-apply').disabled=false;}
});

function renderUpdate(update){
  const descriptions={idle:'Check for a new Studio release.',checking:'Checking GitHub for updates...',current:'Studio is up to date.',available:'Studio '+update.version+' is available.',downloading:(update.downloadMode==='full'?'Downloading full update':update.downloadMode==='changes'?'Downloading changed data':'Preparing update')+': '+(update.percent||0)+'%'+(update.total?' \u00b7 '+(update.transferred/1048576).toFixed(1)+' / '+(update.total/1048576).toFixed(1)+' MB':''),downloaded:'Studio '+update.version+' is ready. Restarting stops the overlay while the update installs.',installing:'Installing update...',error:update.message,disabled:update.message};
  $('update-status').textContent='v'+update.currentVersion+' | '+descriptions[update.status];
  $('update-check').hidden=!(update.status==='error'&&update.version);
  $('update-check').textContent='Retry update';
  $('update-check').disabled=['disabled','checking','downloading','downloaded','installing','available'].includes(update.status);
  $('update-download').hidden=update.status!=='available';
  $('update-install').hidden=update.status!=='downloaded';
}
action('update-check',async()=>renderUpdate(await call('update-check')));
action('update-download',async()=>renderUpdate(await call('update-download')));
action('update-install',async()=>{await call('update-install');});
window.studio.on(message=>{if(message.type==='update')renderUpdate(message);});
call('update-state').then(renderUpdate).catch(report);

document.getElementById('tinysprite-link').addEventListener('click',event=>{event.preventDefault();call('tinysprite-website').catch(report);});

let eventsDirty=false,eventsRevision;
function renderEvents(){
  const settings=state.events.settings;eventsRevision=state.events.revision;renderEventTests(settings);
  $('event-settings').replaceChildren();$('event-colours').replaceChildren();
  const triggers={'channel.follow':'Follower','channel.subscribe':'Subscriber','channel.subscription.message':'Subscriber',tip:'Donation','channel.cheer':'Bits',points:'Channel points',bits:'Bits power-up'};
  const symbols={
    Follower:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    Subscriber:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
    Donation:'<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
    Bits:'<path d="m12 2 9 9-9 11L3 11Zm-9 9h18M12 2l-4 9 4 11 4-11Z"/>'
  };
  $('event-count').textContent=settings.events.length+' '+(settings.events.length===1?'event':'events');
  $('events-help').textContent=settings.events.some(event=>['points','bits'].includes(event.trigger))
    ? 'Choose a Twitch reward for each event. Linked rewards keep working when renamed on Twitch.'
    : 'Personalise each event with the options provided by your project.';
  for(const event of settings.events){
    const kind=triggers[event.trigger]||'Custom event';
    const card=document.createElement('section');card.className='event-card';
    const header=document.createElement('header');header.className='event-card-heading';
    const icon=document.createElement('span');icon.className='event-icon';icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(symbols[kind]||'<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>')+'</svg>';
    const heading=document.createElement('div'),title=document.createElement('h3'),badge=document.createElement('span');
    title.textContent=event.label||event.name;badge.className='event-kind';badge.textContent=kind;heading.append(title,badge);header.append(icon,heading);
    const body=document.createElement('div');body.className='event-card-body';
    const label=document.createElement('label');label.className='event-name';label.textContent='Event name';
    const input=document.createElement('input');input.value=event.name;input.dataset.eventName=event.id;input.required=true;input.maxLength=80;label.append(input);
    const fields=document.createElement('div');fields.className='form-grid';fields.dataset.eventFields=event.id;renderFields(fields,event.fields,event.values);
    for(const toggle of fields.querySelectorAll('input[type=checkbox]')){toggle.setAttribute('role','switch');toggle.closest('label').classList.add('event-toggle');}
    body.append(label);
    if(['points','bits'].includes(event.trigger)){
      const rewardLabel=document.createElement('label');rewardLabel.textContent='Twitch reward';rewardLabel.className='event-name';
      const select=document.createElement('select');select.dataset.rewardEvent=event.id;select.dataset.trigger=event.trigger;
      select.dataset.broadcaster=event.twitchBroadcasterId||'';
      select.append(new Option(event.twitchId?'Saved reward':'Match by name (legacy)',event.twitchId||''));
      select.value=event.twitchId||'';rewardLabel.append(select);body.append(rewardLabel);
    }
    body.append(fields);card.append(header,body);$('event-settings').append(card);
  }
  for(const [name,colour]of Object.entries(settings.colours||{})){
    const label=document.createElement('label');label.textContent=name;
    const input=document.createElement('input');input.type='color';input.value=colour;input.name='colour-'+name;label.append(input);$('event-colours').append(label);
  }
  const paint=settings.events.some(event=>['paint','paint-pro','paint-pro-24'].includes(event.id));
  document.querySelector('.manual-colour').hidden=!paint;$('palette-heading').hidden=!Object.keys(settings.colours).length;
  renderAlertSounds(settings.sounds || {});
  $('project-sounds').hidden=!Object.keys(settings.sounds || {}).length;
  document.querySelectorAll('[data-alert]').forEach(button=>button.hidden=!Object.hasOwn(settings.sounds || {},button.dataset.alert));
  $('playground').hidden=!state.files.some(file=>file.name==='overlays/offline-preview.html');
  document.querySelector('.test-controls').hidden=!Object.keys(settings.sounds || {}).length&&$('playground').hidden;
  $('events-save').hidden=!settings.events.length&&!Object.keys(settings.colours).length&&!Object.keys(settings.sounds||{}).length;
  if(!settings.events.length){
    const empty=document.createElement('div');empty.className='events-empty';
    const title=document.createElement('h3'),description=document.createElement('p');title.textContent='Your events start here';
    description.textContent=state.events.error||'Ask your developer to add events to this project. Their settings will appear here.';empty.append(title,description);$('event-settings').append(empty);
  }
  $('events-save').parentElement.hidden=$('events-save').hidden;
  $('events-save-status').textContent='Changes apply to this project.';
  $('events-save-status').classList.remove('unsaved');
  $('events-save').textContent='Apply changes';
  window.renderTwitchRewardPickers?.();
}
async function saveEvents(){
  if(!$('events-form').reportValidity())throw Error('Complete the event settings first.');
  const openSettings=documents.get('tss-events.json');
  if(openSettings&&isDirty(openSettings))throw Error('Save or close your code edits to tss-events.json first.');
  const settings=state.events.settings,form=$('events-form').elements;
  const events=settings.events.map(event=>({...event,name:[...$('event-settings').querySelectorAll('[data-event-name]')].find(input=>input.dataset.eventName===event.id).value,values:fieldValues([...$('event-settings').querySelectorAll('[data-event-fields]')].find(group=>group.dataset.eventFields===event.id))}));
  for(const select of $('event-settings').querySelectorAll('[data-reward-event]')){
    const event=events.find(event=>event.id===select.dataset.rewardEvent);
    if(!Object.hasOwn(event,'twitchId')&&!select.value)continue;
    event.twitchId=select.value;event.twitchBroadcasterId=select.dataset.broadcaster;
  }
  const colours=Object.fromEntries(Object.keys(settings.colours||{}).map(name=>[name,form.namedItem('colour-'+name).value]));
  const sounds=Object.fromEntries(Object.keys(settings.sounds||{}).filter(kind=>alertSoundLabels[kind]).map(kind=>[kind,{file:$('sound-'+kind).value,volume:Number($('sound-volume-'+kind).value)}]));
  const result=await call('events-update',{events,colours,sounds},eventsRevision);
  eventsDirty=false;applyState(result);refresh();notice('Event settings saved. Linked Twitch rewards use their IDs. Refresh OBS browser sources to apply sound changes.');
}
$('events-form').oninput=()=>{eventsDirty=true;$('events-save').textContent='Apply changes \u2022';$('events-save-status').textContent='Unsaved changes';$('events-save-status').classList.add('unsaved');};
$('events-form').onsubmit=event=>{event.preventDefault();saveEvents().catch(report);};

function renderEventTests(settings){
  const controls=$('event-tests');
  controls.replaceChildren();
  const events=settings.events;
  controls.hidden=!events.length;
  const label=document.createElement('span');label.textContent='TEST EVENT';controls.append(label);
  const colour=document.createElement('select');colour.setAttribute('aria-label','Test paint colour');
  for(const name of Object.keys(settings.colours))colour.append(new Option(name,name));
  colour.append(new Option('Rainbow','rgb'));colour.value=settings.colours.purple?'purple':colour.options[0].value;
  if(events.some(event=>event.id.startsWith('paint')))controls.append(colour);
  for(const event of events){
    const button=document.createElement('button');button.textContent=event.name;button.dataset.testEvent=event.id;
    button.disabled=$('preview-mode').value==='live';button.title='Test in local preview';
    button.onclick=()=>{
      if($('preview-mode').value==='live')return;
      const data={...event.testData,id:event.id,name:'TinySprite',values:event.values};
      $('preview').contentWindow.postMessage({type:'project-event',data},state.previewURL);
      if(!['paint','paint-pro','paint-pro-24','summon','feed','hydrate','tomato'].includes(event.id)){notice('Preview event sent: '+event.name);return;}
      const paint=event.id.startsWith('paint'),startsAt=Date.now();
      const active={id:crypto.randomUUID(),name:'TinySprite',startsAt,endsAt:startsAt+(paint?10000:15000)};
      if(paint)Object.assign(active,{colour:colour.value,hex:settings.colours[colour.value]||'#ff4545'});
      else Object.assign(active,{motion:'wave',effect:event.id,target:{x:Math.random(),y:Math.random()}});
      $('preview').contentWindow.postMessage({type:paint?'paint':'summon',data:{active}},state.previewURL);
      notice('Preview event sent: '+event.name);
    };
    controls.append(button);
  }
  requestAnimationFrame(scale);
}

const audioExtensions=/\.(mp3|mp4|wav|ogg|webm)$/i;
const alertSoundLabels={follow:'Follower',sub:'Subscriber',cheer:'Bits',donation:'Donation'};
let soundPreview,soundPreviewTimer;
function stopSoundPreview(){
  clearTimeout(soundPreviewTimer);soundPreviewTimer=null;
  soundPreview?.pause();soundPreview=null;
  const frame=$('preview');
  if(frame?.getAttribute('src'))frame.contentWindow.postMessage({type:'audio-stop'},new URL(frame.src).origin);
}
async function previewSound(file,volume,delay=0){
  stopSoundPreview();
  if(!file)throw Error('Choose a sound first.');
  delay=Number(delay);if(!Number.isFinite(delay)||delay<0||delay>3600)throw Error('Music delay must be between 0 and 3600 seconds.');
  const player=new Audio(state.previewURL+'/'+file.split('/').map(encodeURIComponent).join('/'));
  soundPreview=player;player.volume=Math.max(0,Math.min(1,Number(volume)/100));
  const start=async()=>{
    soundPreviewTimer=null;
    try{await player.play();if(soundPreview===player)notice('Playing sound preview');}
    catch(error){if(soundPreview!==player||error.name==='AbortError')return;stopSoundPreview();throw Error('Could not play this file. Check that it contains supported audio.');}
  };
  if(delay>0){notice('Sound preview starts in '+delay+' seconds');soundPreviewTimer=setTimeout(()=>start().catch(report),delay*1000);}
  else await start();
}
function renderAlertSounds(sounds){
  $('alert-sounds').replaceChildren();
  for(const [kind,title]of Object.entries(alertSoundLabels).filter(([kind])=>Object.hasOwn(sounds,kind))){
    const group=document.createElement('div');group.className='sound-setting';
    const label=document.createElement('label');label.textContent=title;
    const select=document.createElement('select');select.id='sound-'+kind;label.append(select);
    const volumeLabel=document.createElement('label');volumeLabel.textContent=title+' volume (%)';
    const volume=document.createElement('input');volume.id='sound-volume-'+kind;volume.type='number';volume.min=0;volume.max=100;volume.required=true;volume.value=sounds[kind]?.volume??100;volumeLabel.append(volume);
    const test=document.createElement('button');test.type='button';test.textContent='Play sound';test.setAttribute('aria-label','Preview '+title.toLowerCase()+' sound');
    test.onclick=()=>previewSound(select.value,volume.value).catch(report);
    group.append(label,volumeLabel,test);$('alert-sounds').append(group);
    assetOptions(select.id,audioExtensions,sounds[kind]?.file||'');
  }
}
function refreshSoundOptions(){
  for(const kind of Object.keys(alertSoundLabels)){const select=$('sound-'+kind);if(select)assetOptions(select.id,audioExtensions,select.value);}
}
action('scene-audio-test',()=>previewSound($('scene-audio').value,$('scene-audio-volume').value,$('scene-audio-delay').value));
for(const button of document.querySelectorAll('[data-stop-audio]'))button.onclick=stopSoundPreview;
window.addEventListener('pagehide',stopSoundPreview);
