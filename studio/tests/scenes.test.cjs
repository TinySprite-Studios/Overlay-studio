const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const scenes=require('../scenes.cjs');
const {serve}=require('../server.cjs');
test('scene lifecycle preserves custom code, detects conflicts, and creates independent copies',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-scenes-'));
  try{
    const scene=scenes.create(root,{...scenes.defaults('starting'),title:'Hello <world>'});
    assert.equal(scene.config.countdown,300);
    const dir=path.join(root,'scenes',scene.id);
    const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dir,'config.js'),'utf8'),context);assert.equal(context.window.TSS_SCENE.title,'Hello <world>');
    new vm.Script(fs.readFileSync(path.join(dir,'scene.js'),'utf8'));
    fs.appendFileSync(path.join(dir,'style.css'),'\n/* custom styling */');
    const updated=scenes.update(root,scene.id,{...scene.config,title:'My stream',layout:'vertical'},scene.revision);
    assert.ok(fs.readFileSync(path.join(dir,'style.css'),'utf8').includes('custom styling'));
    assert.throws(()=>scenes.update(root,scene.id,scene.config,scene.revision),/changed on disk/);
    const copy=scenes.create(root,{...updated.config,name:'Another scene'},scene.id);
    assert.notEqual(copy.id,scene.id);assert.ok(fs.readFileSync(path.join(root,'scenes',copy.id,'style.css'),'utf8').includes('custom styling'));
    scenes.starters(root);const count=scenes.scenes(root).length;scenes.starters(root);assert.equal(scenes.scenes(root).length,count);
    assert.throws(()=>scenes.create(root,{...scene.config,background:'assets/../../secret.png'}));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('OBS server serves scenes and range requests; preview injection stays out of published output',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-server-'));let live,preview;
  try{
    const scene=scenes.create(root,scenes.defaults('brb'));fs.mkdirSync(path.join(root,'assets'));fs.writeFileSync(path.join(root,'assets','clip.mp4'),Buffer.from('0123456789'));fs.writeFileSync(path.join(root,'private.json'),'secret');
    live=await serve(()=>root);preview=await serve(()=>root,0,true);
    const html=await(await fetch(live.url+'/'+scene.file)).text();assert.ok(html.includes('scene.js'));assert.ok(!html.includes('window.EventSource='));
    assert.ok((await(await fetch(preview.url+'/'+scene.file)).text()).includes('window.EventSource='));
    const range=await fetch(live.url+'/assets/clip.mp4',{headers:{Range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(await range.text(),'2345');assert.equal(range.headers.get('content-type'),'video/mp4');
    assert.equal((await fetch(live.url+'/assets/clip.mp4',{headers:{Range:'bytes=50-60'}})).status,416);
    for(const name of ['private.json','studio/main.cjs','%2e%2e%5csecret.js'])assert.equal((await fetch(live.url+'/'+name)).status,404);
    const hostileStatus=await new Promise((resolve,reject)=>require('node:http').get(live.url+'/'+scene.file,{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject));
    assert.equal(hostileStatus,403);
  }finally{live?.close();preview?.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('bundled scenes add missing scenes and assets without replacing user changes',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-bundle-'));
  const source=path.join(root,'source'),dest=path.join(root,'project');
  fs.mkdirSync(source);fs.mkdirSync(dest);
  try{
    const original=scenes.create(source,scenes.defaults('starting'));
    const custom=scenes.create(dest,{...scenes.defaults('starting'),title:'My custom title'});
    const brb=scenes.create(source,scenes.defaults('brb'));
    fs.mkdirSync(path.join(source,'assets'));fs.mkdirSync(path.join(dest,'assets'));
    fs.writeFileSync(path.join(source,'assets','shared.png'),'bundled');
    fs.writeFileSync(path.join(dest,'assets','shared.png'),'custom');
    fs.writeFileSync(path.join(source,'assets','new.png'),'new artwork');
    scenes.bundled(dest,source);scenes.bundled(dest,source);
    assert.equal(scenes.scenes(dest).length,2);
    assert.equal(scenes.read(dest,custom.id).config.title,'My custom title');
    assert.equal(scenes.read(dest,brb.id).config.type,'brb');
    assert.equal(fs.readFileSync(path.join(dest,'assets','shared.png'),'utf8'),'custom');
    assert.equal(fs.readFileSync(path.join(dest,'assets','new.png'),'utf8'),'new artwork');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
