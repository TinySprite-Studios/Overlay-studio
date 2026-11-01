const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {resolveFile, list} = require('./workspace.cjs');
const presets = {
  starting:{name:'Starting Soon',title:'Starting soon',subtitle:'Get comfortable. Something good is loading.',countdown:300},
  brb:{name:'Be Right Back',title:'Be right back',subtitle:'Taking a tiny break. Stay a little longer.',countdown:0},
  ending:{name:'Stream Ending',title:'That’s a wrap',subtitle:'Thanks for being part of the story. See you next stream.',countdown:0},
  chatting:{name:'Just Chatting',title:'Let’s catch up',subtitle:'Good company. Great conversations.',countdown:0},
  live:{name:'Live Overlay',title:'Now playing',subtitle:'Welcome to the stream',countdown:0},
  blank:{name:'Blank Canvas',title:'',subtitle:'',countdown:0}
};
function normalize(value) {
  if (!value || !presets[value.type]) throw Error('Choose a scene template.');
  const text = (key, max=180) => String(value[key] ?? '').slice(0,max);
  const colour = (key, fallback) => /^#[0-9a-f]{6}$/i.test(value[key]) ? value[key] : fallback;
  const background = text('background',500);
  const logo = text('logo',500);
  if (logo && (!logo.startsWith('assets/') || logo.split('/').some(p=>p.startsWith('.')) || !/\.(png|jpe?g|webp|gif|svg)$/i.test(logo))) throw Error('Choose an imported logo from assets.');
  if (background && (!background.startsWith('assets/') || background.split('/').some(p=>p.startsWith('.')) || !/\.(png|jpe?g|webp|gif|svg|mp4|webm)$/i.test(background))) throw Error('Choose an imported image or video from assets.');
  return {version:1,type:value.type,name:text('name',80).trim()||presets[value.type].name,title:text('title'),subtitle:text('subtitle',300),channel:text('channel',80),social:text('social',160),accent:colour('accent','#e34855'),base:colour('base','#10121a'),layout:value.layout==='vertical'?'vertical':'horizontal',style:['aurora','grid','minimal'].includes(value.style)?value.style:'aurora',countdown:Math.max(0,Math.min(86400,Math.floor(Number(value.countdown)||0))),countdownEnd:text('countdownEnd',120)||'We’re getting ready…',background,overlay:Math.max(0,Math.min(100,Number(value.overlay) || 0)),logo:text('logo',500),animate:value.animate!==false};
}
function defaults(type) {return normalize({type,...presets[type],channel:'YOUR CHANNEL',social:'Follow along · @yourchannel',accent:'#e34855',base:'#10121a',style:'aurora',overlay:65,animate:true});}
function sceneDir(root,id) {
  if (typeof id !== 'string' || !/^tss_[a-z0-9_-]+$/.test(id)) throw Error('Invalid scene ID.');
  return resolveFile(root,'scenes/'+id);
}
function revision(dir) {return crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'scene.json'))).update(fs.readFileSync(path.join(dir,'config.js'))).digest('hex');}
function read(root,id) {
  const dir=sceneDir(root,id);
  resolveFile(root,`scenes/${id}/config.js`);
  return {id,file:`scenes/${id}/index.html`,portrait:fs.existsSync(path.join(dir,'portrait-source.html')),config:normalize(JSON.parse(fs.readFileSync(resolveFile(root,`scenes/${id}/scene.json`),'utf8'))),revision:revision(dir)};
}
function scenes(root) {
  return list(root).filter(f=>/^scenes\/tss_[a-z0-9_-]+\/scene.json$/.test(f.name)).flatMap(f=>{try{return [read(root,f.name.split('/')[1])];}catch{return [];}});
}
const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stream scene</title><link rel="stylesheet" href="style.css"></head><body><div id="background"></div><div class="shade"></div><div class="grid"></div><div class="orb one"></div><div class="orb two"></div><div class="frame"></div><header><div class="identity"><img id="logo" alt="Channel logo" hidden><span class="spark">✦</span><span id="channel"></span></div><span id="status"></span></header><main><div class="eyebrow" id="eyebrow"></div><h1 id="title"></h1><p id="subtitle"></p><div id="countdown" aria-live="off"></div><div class="camera"><span>CAMERA</span></div><div class="chat"><span>YOUR CHAT GOES HERE</span></div></main><footer><span id="social"></span><span class="signature" title="A tiny sprite lives here">✦</span><span id="clock"></span></footer><script src="config.js"></script><script src="scene.js"></script><script src="../../config.js"></script><script src="../../scripts/tss-paint.js"></script><script src="../../scripts/tss-alerts.js"></script></body></html>\n';
const css = `:root{--accent:#e34855;--base:#10121a}*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{color:#f5f6fa;background:var(--base);font-family:'Segoe UI',Arial,sans-serif}#background,.shade,.grid,.orb,.frame{position:absolute;pointer-events:none}#background{inset:0;background-size:cover;background-position:center}#background video{width:100%;height:100%;object-fit:cover}.shade{inset:0;background:#080a10;opacity:.65}.grid{inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:80px 80px;mask-image:linear-gradient(transparent,#000);opacity:.45}.orb{width:65vw;height:65vw;border-radius:50%;filter:blur(95px);opacity:.15;background:var(--accent);animation:drift 20s ease-in-out infinite alternate}.one{top:-65%;right:-15%}.two{bottom:-100%;left:-20%;animation-delay:-10s}.frame{inset:32px;border:1px solid #ffffff15}.frame:before,.frame:after{content:'';position:absolute;width:100px;height:3px;background:var(--accent);box-shadow:0 0 28px var(--accent)}.frame:before{top:-1px;left:36px}.frame:after{bottom:-1px;right:36px}header,footer{position:absolute;left:5%;right:5%;display:flex;justify-content:space-between;align-items:center;font-size:clamp(12px,1.2vw,28px);letter-spacing:.16em}header{top:7%}footer{bottom:7%;font-size:clamp(11px,1vw,22px);color:#bac0d0}.identity{display:flex;align-items:center;gap:18px;font-weight:700}.spark{color:var(--accent);font-size:2em}#logo{width:64px;height:64px;object-fit:contain}#status{font-size:.7em;border:1px solid #ffffff25;padding:12px 20px;border-radius:30px;color:#ccd0db}.signature{color:var(--accent);font-size:1.5em}main{position:absolute;inset:22% 8%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.eyebrow{text-transform:uppercase;letter-spacing:.45em;color:var(--accent);font-size:clamp(12px,1.3vw,28px);margin-bottom:24px}h1{font-size:clamp(44px,7vw,170px);line-height:1.05;letter-spacing:-.055em;margin:0;font-weight:700;max-width:100%;overflow-wrap:anywhere}p{font-size:clamp(18px,1.6vw,38px);color:#b4bbca;max-width:70%;line-height:1.6;margin:30px 0}#countdown{font-variant-numeric:tabular-nums;font-size:clamp(30px,4vw,100px);font-weight:300;letter-spacing:.12em;color:var(--accent);margin-top:12px}#countdown.finished{font-size:2vw;letter-spacing:.02em}.camera,.chat{display:none}.style-minimal .orb,.style-minimal .grid{display:none}.style-grid .orb{opacity:.07}.style-grid .grid{opacity:1}.no-motion .orb{animation:none}.type-chatting main{inset:17% 5% 16%;align-items:flex-start;justify-content:flex-start;text-align:left}.type-chatting h1{font-size:4vw}.type-chatting p{font-size:1.4vw;margin:15px 0}.type-chatting .camera{display:flex;position:absolute;left:0;top:28%;width:69%;bottom:0;border:2px solid var(--accent);border-radius:16px;background:#0006;align-items:center;justify-content:center}.type-chatting .chat{display:flex;position:absolute;right:0;top:0;width:27%;bottom:0;border:1px solid #ffffff25;border-radius:16px;background:#0003;align-items:center;justify-content:center}.camera span,.chat span{font-size:1vw;letter-spacing:.25em;color:#ffffff45}.type-live,.type-blank{background:transparent}.type-live .shade,.type-live .grid,.type-live .orb,.type-blank .shade,.type-blank .grid,.type-blank .orb,.type-blank .frame,.type-blank header,.type-blank footer{display:none}.type-live main{inset:auto 5% 5%;align-items:flex-start}.type-live h1{font-size:2.5vw}.type-live p{font-size:1.1vw;margin:8px 0}.type-live footer{display:none}.type-live .eyebrow{display:none}.type-live header{top:5%}.type-blank main{display:none}.vertical h1{font-size:12vw}.vertical p{font-size:3.3vw;max-width:95%}.vertical .eyebrow{font-size:2.5vw}.vertical header,.vertical footer{font-size:2vw}.vertical #countdown{font-size:9vw}.vertical .type-chatting{display:block}.vertical.type-chatting .camera{top:30%;width:100%;bottom:30%}.vertical.type-chatting .chat{top:74%;width:100%;bottom:0}.vertical.type-chatting h1{font-size:8vw}.vertical.type-chatting p{font-size:3vw}.vertical .camera span,.vertical .chat span{font-size:2vw}@keyframes drift{to{transform:translate(12%,18%) scale(1.2)}}@media(prefers-reduced-motion:reduce){.orb{animation:none}}`;
const runtime = `(() => {
const c=window.TSS_SCENE;const el=id=>document.getElementById(id);
document.title=c.name;document.body.className='type-'+c.type+' style-'+c.style+(c.layout==='vertical'||innerHeight>innerWidth?' vertical':'')+(c.animate?'':' no-motion');
document.documentElement.style.setProperty('--accent',c.accent);document.documentElement.style.setProperty('--base',c.base);
for(const key of ['title','subtitle','channel','social'])el(key).textContent=c[key];
el('status').textContent=({starting:'GOING LIVE',brb:'ON A BREAK',ending:'OFFLINE',chatting:'LIVE CONVERSATION',live:'LIVE',blank:''})[c.type];
el('eyebrow').textContent=({starting:'The next chapter',brb:'Back in a moment',ending:'Until next time',chatting:'Welcome in',live:'',blank:''})[c.type];
const asset=value=>'../../'+value.split('/').map(encodeURIComponent).join('/');
if(c.logo && /^assets\\//.test(c.logo)){el('logo').src=asset(c.logo);el('logo').hidden=false;el('logo').onerror=()=>el('logo').hidden=true;}
if(c.background){if(/\\.(mp4|webm)$/i.test(c.background)){const video=document.createElement('video');video.src=asset(c.background);video.muted=true;video.autoplay=true;video.loop=true;video.playsInline=true;el('background').append(video);}else{el('background').style.backgroundImage='url('+JSON.stringify(asset(c.background))+')';}}
document.querySelector('.shade').style.opacity=c.overlay/100;
const end=Date.now()+c.countdown*1000;function tick(){el('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(!c.countdown)return;const remaining=Math.max(0,Math.ceil((end-Date.now())/1000));el('countdown').textContent=remaining?String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'):c.countdownEnd;el('countdown').classList.toggle('finished',!remaining);}tick();setInterval(tick,250);
})();\n`;
function writeConfig(dir,config) {
  fs.writeFileSync(path.join(dir,'config.js'),'// Scene settings. The Studio visual editor updates this file.\nwindow.TSS_SCENE = '+JSON.stringify(config,null,2).replace(/</g,'\\u003c')+';\n');
  fs.writeFileSync(path.join(dir,'scene.json'),JSON.stringify(config,null,2)+'\n');
}
function create(root,input,sourceId) {
  const config=normalize(input);
  const slug=config.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'scene';
  let id='tss_'+slug, index=2;
  while(fs.existsSync(sceneDir(root,id)))id='tss_'+slug+'-'+index++;
  const dir=sceneDir(root,id);
  fs.mkdirSync(dir,{recursive:true});
  if(sourceId){
    const prefix='scenes/'+sourceId+'/';sceneDir(root,sourceId);
    for(const file of list(root).filter(f=>f.name.startsWith(prefix))){const target=resolveFile(root,'scenes/'+id+'/'+file.name.slice(prefix.length));if(file.type==='directory')fs.mkdirSync(target,{recursive:true});else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(resolveFile(root,file.name),target);}}
  }else{
    fs.writeFileSync(path.join(dir,'index.html'),html);fs.writeFileSync(path.join(dir,'style.css'),css);fs.writeFileSync(path.join(dir,'scene.js'),runtime);
  }
  writeConfig(dir,config);return read(root,id);
}
function update(root,id,input,expected){const current=read(root,id),dir=sceneDir(root,id);if(current.revision!==expected)throw Error('Scene settings changed on disk. Reload the scene before applying settings.');writeConfig(dir,normalize(input));return read(root,id);}
function bundled(root, source) {
  if(path.resolve(root)===path.resolve(source))return;
  const files=list(source);
  const missing=scenes(source).filter(scene=>!fs.existsSync(sceneDir(root,scene.id)));
  if(!missing.length)return;
  // Copy missing assets only: existing user artwork always wins.
  for(const file of files.filter(file=>file.type==='file'&&file.name.startsWith('assets/'))){
    const target=resolveFile(root,file.name);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    if(!fs.existsSync(target))fs.copyFileSync(resolveFile(source,file.name),target,fs.constants.COPYFILE_EXCL);
  }
  for(const scene of missing){
    const prefix='scenes/'+scene.id+'/';
    for(const file of files.filter(file=>file.type==='file'&&file.name.startsWith(prefix))){
      const target=resolveFile(root,file.name);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.copyFileSync(resolveFile(source,file.name),target,fs.constants.COPYFILE_EXCL);
    }
  }
}
function vertical(root,id,method='responsive'){
  if(!['responsive','fit','fill'].includes(method))throw Error('Choose a supported conversion method.');
  const source=read(root,id);
  if(fs.existsSync(path.join(sceneDir(root,id),'portrait-source.html')))throw Error('Select the original scene to create another vertical version.');
  const copy=create(root,{...source.config,name:source.config.name+' Vertical',layout:'vertical'},id);
  try{if(method!=='responsive')require('./portrait.cjs').wrap(root,copy,source,method);}
  catch(error){fs.rmSync(sceneDir(root,copy.id),{recursive:true,force:true});throw error;}
  return read(root,copy.id);
}
function starters(root){for(const type of ['starting','brb','ending','chatting','live'])if(!scenes(root).some(s=>s.config.type===type))create(root,defaults(type));return scenes(root);}
module.exports={vertical,bundled,presets,defaults,scenes,read,create,update,starters,sceneDir};
