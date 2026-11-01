import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately independent of scripts/tss-twitch.mjs and all saved account data.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = new Set(['overlays/offline-preview.html', 'config.js', 'scripts/tss-alerts.js', 'scripts/tss-paint.js', 'scripts/tss-summon.js', 'scripts/tss-care.js', 'scripts/tss-care.mjs']);
const bridge = `<script>
window.EventSource = class extends EventTarget {
 constructor() { super(); window.previewEvents = this; }
};
window.addEventListener('message', e => {
 if (e.source !== parent || e.origin !== location.origin || !window.previewEvents) return;
 const {type, data} = e.data || {};
 if (type === 'motion') {
  if (['wave','dance','jump','look'].includes(data?.motion)) document.querySelector('.tss-alien-art')?.setAttribute('data-motion', data.motion);
  return;
 }
 if (!['alert','paint','summon','message','care'].includes(type)) return;
 const event = new MessageEvent(type, {data: JSON.stringify(data)});
 if (type === 'message') window.previewEvents.onmessage?.(event);
 else window.previewEvents.dispatchEvent(event);
});
</script>`;
const server = http.createServer((req, res) => {
 if(req.url === '/') {res.writeHead(302,{Location:'/overlays/offline-preview.html'}).end();return;}
 const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'overlays/offline-preview.html';
 if (name === 'events') { res.writeHead(410).end('Offline preview has no event connection.'); return; }
 if (name !== 'overlays/border.html' && !files.has(name) && !/^assets\/[a-zA-Z0-9_ .-]+\.(png|jpg|jpeg|webp|gif|svg)$/i.test(name)) {
  res.writeHead(404).end(); return;
 }
 fs.readFile(path.join(root, name), (error, bytes) => {
  if (error) { res.writeHead(404).end(); return; }
  const mime = {'.html':'text/html', '.mjs':'text/javascript', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp'};
  res.writeHead(200, {'Content-Type': mime[path.extname(name)] || 'application/octet-stream', 'Cache-Control':'no-store',
   'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'self'; frame-ancestors 'self'; form-action 'none'"});
  let body = bytes;
  if (name === 'overlays/border.html') {
   const alien = fs.readFileSync(path.join(root, 'assets/alien-sprite.svg'), 'utf8');
   body = bytes.toString().replace('<head>', '<head>' + bridge)
    .replace(/  <div class="tss-sprite-wing"[\s\S]*?  <div class="tss-sprite-arm"[^>]*><\/div>/,
     '<div class="tss-alien-art" data-motion="wave" style="position:absolute;left:0;bottom:0;width:150px;height:150px">' + alien + '</div>')
    .replace('bottom:146px;', 'bottom:158px;');
  }
  res.end(body);
 });
});
server.on('error', error => { console.error('Preview could not start: ' + error.message); process.exitCode = 1; });
server.listen(8790, '127.0.0.1', () => console.log('Offline preview: http://127.0.0.1:8790\nNo Twitch connection. No account data loaded. Ctrl+C stops the preview.'));
