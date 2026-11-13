const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const scenes = require('./scenes.cjs');
const {alertSounds} = require('./audio.cjs');
const events = require('./events.cjs');
const {resolveFile,media} = require('./workspace.cjs');
const bridge = `(() => {
  const sources = new Set();
  window.EventSource=class extends EventTarget {
    constructor(){super();sources.add(this);window.previewEvents=this;}
    close(){sources.delete(this);}
  };
  window.addEventListener('message', e => {
    if(e.source!==parent)return;
    for(let i=0;i<frames.length;i++)frames[i].postMessage(e.data,location.origin);
    const {type,data}=e.data||{};
    if(!['alert','paint','summon','message','project-event'].includes(type))return;
    for(const source of sources){
      const event=new MessageEvent(type,{data:JSON.stringify(data)});
      if(type==='message')source.onmessage?.(event);
      source.dispatchEvent(event);
    }
  });
})();`;

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.ico':'image/x-icon'};
async function serve(getRoot, port=0, offline=false, onLog=null) {
  const sockets=new Set();
  const server=http.createServer((req,res)=>{
    if(req.headers.host!==`127.0.0.1:${server.address().port}` || !['GET','HEAD'].includes(req.method)){res.writeHead(403).end();return;}
    if(req.url === '/') {res.writeHead(302,{Location:'/overlays/overlay-horizontal.html'}).end();return;}
    if(req.url.startsWith('/__studio-log?')){
      // Lets scene pages report to the Studio Console; OBS gives no F12 console.
      const text=new URL(req.url,'http://localhost').searchParams.get('m');
      if(onLog&&text)onLog('[OBS scene] '+text.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300));
      res.writeHead(204,{'Cache-Control':'no-store'}).end();return;
    }
    let name;
    try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'overlays/overlay-horizontal.html';}catch{res.writeHead(400).end();return;}
    if(name==='__studio-preview.js'&&offline){res.writeHead(200,{'Content-Type':'text/javascript'}).end(bridge);return;}
    if(name==='__studio-audio.js'){
      try {
        const sceneFile = new URL(req.url, 'http://localhost').searchParams.get('scene');
        const scene = scenes.scenes(getRoot()).find(scene => scene.file === sceneFile ||
          (scene.external && sceneFile === 'overlay-vertical.html'))?.config;
        const settings = {scene:{file:scene?.audio || '',volume:scene?.audioVolume ?? 100,delay:scene?.audioDelay ?? 0},
          alerts:alertSounds(events.read(getRoot()).settings.sounds),offline};
        const script = 'window.TSS_STUDIO_AUDIO = ' + JSON.stringify(settings).replace(/</g, '\\u003c') + ';\n' +
          fs.readFileSync(path.join(__dirname, 'audio-runtime.js'), 'utf8');
        res.writeHead(200, {'Content-Type':'text/javascript','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:script);
      } catch { res.writeHead(400).end('Invalid audio settings.'); }
      return;
    }
    if (name === '__studio-project.js') {
      try {
        const root = getRoot();
        const sceneFile = new URL(req.url, 'http://localhost').searchParams.get('scene');
        const scene = scenes.scenes(root).find(scene => scene.file === sceneFile);
        const script = 'window.TSS_EVENTS = ' + JSON.stringify(events.read(root).settings).replace(/</g, '\\u003c') + ';\n' +
          (scene ? 'window.TSS_SCENE = ' + JSON.stringify(scene.config).replace(/</g, '\\u003c') + ';\n' : '');
        res.writeHead(200, {'Content-Type':'text/javascript','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:script);
      } catch {res.writeHead(400).end('Invalid project settings.');}
      return;
    }
    if (/^scenes\/tss_[a-z0-9_-]+\/config.js$/.test(name)) {
      try {
        const scene = scenes.read(getRoot(), name.split('/')[1]);
        if (scene.config.type === 'custom') {
          res.writeHead(200, {'Content-Type':'text/javascript','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:'window.TSS_SCENE = '+JSON.stringify(scene.config).replace(/</g, '\\u003c')+';');
          return;
        }
      } catch {}
    }
    if(name==='events'){
      if(offline){res.writeHead(410).end();return;}
      const upstream=http.get('http://127.0.0.1:8787/events',response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain'});res.end('Start the Twitch runner to receive live events.');});
      res.on('close',()=>upstream.destroy());return;
    }
    try{
      const ext=path.extname(name).toLowerCase();
      if(!['.html','.js','.mjs','.css','.svg'].includes(ext)&&!media.has(ext)){res.writeHead(404).end();return;}
      const file=resolveFile(getRoot(),name),stat=fs.statSync(file);
      if(!stat.isFile()){res.writeHead(404).end();return;}
      const headers={'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
      if(ext==='.html'){
        if(stat.size>10e6){res.writeHead(413).end();return;}
        const scripts=(offline?'<script src="/__studio-preview.js"></script>':'')+'<script src="/__studio-project.js?scene='+encodeURIComponent(name)+'"></script><script src="/__studio-audio.js?scene='+encodeURIComponent(name)+'"></script>';
        const body=fs.readFileSync(file,'utf8').replace(/<head[^>]*>/i,match=>match+scripts);
        res.writeHead(200,headers).end(req.method==='HEAD'?undefined:body);return;
      }
      let start=0,end=stat.size-1,status=200;
      if(req.headers.range){
        const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!range||(!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
        start=range[1]?Number(range[1]):Math.max(0,stat.size-Number(range[2]));end=range[1]&&range[2]?Math.min(Number(range[2]),end):end;
        if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
      if(req.method==='HEAD'||stat.size===0){res.end();return;}
      const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    }catch{if(!res.headersSent)res.writeHead(404);res.end('File not found');}
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>{for(const socket of sockets)socket.destroy();server.close();}};
}
module.exports={serve};
