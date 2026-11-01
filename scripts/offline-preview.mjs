import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {serveFile} from './public-files.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const server=http.createServer((req,res)=>{
 if(req.headers.host!=='127.0.0.1:8790'||req.method!=='GET'){res.writeHead(403).end();return;}
 serveFile(req,res,root,true);
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(8790,'127.0.0.1',()=>console.log('Offline preview: http://127.0.0.1:8790\nNo account data or live events are used.'));
