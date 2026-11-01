import fs from 'node:fs';
import path from 'node:path';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2','.woff':'font/woff'};
export function serveFile(req,res,root,offline=false){
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.writeHead(302,{Location:offline?'/overlays/offline-preview.html':'/overlays/overlay-horizontal.html'}).end();return;}
  const name=pathname.slice(1),ext=path.extname(name).toLowerCase();
  if(!types[ext]||name.split(/[\\/]/).some(p=>!p||p.startsWith('.'))||!(name==='config.js'||/^(scenes|overlays|scripts|assets)\//.test(name)))throw Error();
  const file=fs.realpathSync(path.join(root,name)),relative=path.relative(fs.realpathSync(root),file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.statSync(file).isFile())throw Error();
  let bytes=fs.readFileSync(file);
  if(offline&&ext==='.html')bytes=bytes.toString().replace(/<head[^>]*>/i,head=>head+`<script>window.EventSource=class extends EventTarget{constructor(){super();window.previewEvents=this}};addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;for(const frame of document.querySelectorAll('iframe'))frame.contentWindow.postMessage(e.data,location.origin);const {type,data}=e.data||{};if(!['alert','paint','message'].includes(type)||!window.previewEvents)return;const event=new MessageEvent(type,{data:JSON.stringify(data)});window.previewEvents.dispatchEvent(event);if(type==='message')window.previewEvents.onmessage?.(event);});<\/script>`);
  res.writeHead(200,{'Content-Type':types[ext]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(bytes);
 }catch{res.writeHead(404).end('File not found');}
}
