const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
test('standalone preview serves reusable scenes and refuses private paths',async()=>{
 const {serveFile}=await import('../../scripts/public-files.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-public-'));
 fs.mkdirSync(path.join(root,'scenes'));fs.writeFileSync(path.join(root,'scenes','demo.html'),'<html><head></head><body>Demo</body></html>');
 fs.writeFileSync(path.join(root,'private.json'),'secret');
 const server=http.createServer((req,res)=>serveFile(req,res,root,true));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.match(await(await fetch(url+'/scenes/demo.html')).text(),/window.EventSource/);
  assert.equal((await fetch(url+'/private.json')).status,404);
  assert.equal((await fetch(url+'/scenes/%2e%2e%5cprivate.json')).status,404);
  assert.equal((await fetch(url+'/scripts/missing.js')).status,404);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
