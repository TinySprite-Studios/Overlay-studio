const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const scenes = require('../scenes.cjs');
const events = require('../events.cjs');
const {serve} = require('../server.cjs');

test('audio settings persist, validate assets, and reach existing and portrait scenes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-audio-'));
  let server;
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'assets/cue.mp4'), 'fixture');
    const initial = events.read(root);
    const saved = events.update(root, {sounds:{follow:{file:'assets/cue.mp4',volume:25}}}, initial.revision);
    assert.equal(saved.settings.sounds.follow.volume, 25);
    assert.equal(saved.settings.sounds.donation.file, '');
    for (const file of ['assets/../private.mp3', 'https://example.com/a.mp3', 'assets/test.js', 'assets/missing.mp3']) {
      assert.throws(() => events.update(root, {sounds:{sub:{file}}}, saved.revision));
    }
    assert.throws(() => events.update(root, {sounds:{sub:{volume:101}}}, saved.revision), /volume/);
    const original = scenes.create(root, {...scenes.defaults('brb'),audio:'assets/cue.mp4',audioVolume:40,audioDelay:5});
    const copy = scenes.vertical(root, original.id, 'fit');
    assert.equal(copy.config.audio, original.config.audio);
    assert.equal(copy.config.audioDelay,5);
    assert.equal(scenes.defaults('starting').audioDelay,0);
    for(const audioDelay of [-1,Infinity,'invalid',3601])assert.throws(()=>scenes.create(root,{...scenes.defaults('brb'),audioDelay}),/Music delay/);
    fs.writeFileSync(path.join(root, 'overlay-horizontal.html'), '<html><head></head><body>Custom</body></html>');
    const live = scenes.read(root, 'tss_project-live');
    scenes.update(root, live.id, {...live.config,audio:'assets/cue.mp4',audioVolume:0,audioDelay:5}, live.revision);
    assert.equal(scenes.read(root, live.id).config.audioVolume, 0);
    assert.equal(fs.readFileSync(path.join(root, live.file), 'utf8'), '<html><head></head><body>Custom</body></html>');
    server = await serve(() => root);
    for (const file of [copy.file, live.file]) {
      const html = await (await fetch(server.url + '/' + file)).text();
      assert.match(html, /__studio-audio.js/);
      const source = await (await fetch(server.url + '/__studio-audio.js?scene=' + encodeURIComponent(file))).text();
      const context = {window:{}};
      vm.runInNewContext(source.split('\n')[0], context);
      assert.equal(context.window.TSS_STUDIO_AUDIO.scene.file, 'assets/cue.mp4');
      assert.equal(context.window.TSS_STUDIO_AUDIO.scene.delay,5);
      assert.equal(context.window.TSS_STUDIO_AUDIO.alerts.follow.volume, 25);
    }
  } finally { server?.close(); fs.rmSync(root, {recursive:true,force:true}); }
});

test('Studio stays silent until tested, queues alerts, stops all playback, and skips nested frames', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../audio-runtime.js'), 'utf8');
  const listeners = {}, players = [];
  const parent = {location:{origin:'file://'}};
  const window = {TSS_STUDIO_AUDIO:{scene:{file:'assets/start.mp3',volume:40},offline:true,
    alerts:Object.fromEntries(['follow','sub','cheer','donation'].map(kind => [kind,{file:'assets/'+kind+'.mp4',volume:25}]))}};
  const context = {window,parent,location:{origin:'http://localhost',search:''},URLSearchParams,console,setTimeout,clearTimeout,
    addEventListener:(name,fn) => {listeners[name]=fn;},
    document:{body:{append(){}},createElement:() => {
      const player = {dataset:{},play(){return this.src.includes('broken') ? Promise.reject(Error('bad media')) : Promise.resolve();},pause(){this.paused=true;},remove(){this.removed=true;}};
      players.push(player); return player;
    }}};
  vm.runInNewContext(source, context);
  assert.equal(players.length, 0);
  const send = kind => listeners.message({source:parent,data:{type:'alert',data:{kind}}});
  for (const kind of ['follow','sub','cheer','donation']) send(kind);
  assert.equal(players.length, 1);
  for (let i = 0; i < 4; i++) {
    assert.equal(players[i].volume, .25);
    players[i].onended();
    assert.equal(players[i].removed, true);
  }
  window.TSS_STUDIO_AUDIO.alerts.follow = {file:'assets/broken.mp3',volume:100};
  send('follow'); send('donation');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(players.at(-1).src, /donation.mp4/);
  send('donation');
  const countBeforeStop=players.length;
  listeners.message({source:parent,data:{type:'audio-stop'}});
  assert.equal(players.at(-1).paused,true);
  players.at(-1).onended();
  assert.equal(players.length,countBeforeStop);
  listeners.pagehide();
  assert.equal(players[0].paused, true);
  const count = players.length;
  context.parent = {location:{origin:context.location.origin}};
  vm.runInNewContext(source, context);
  assert.equal(players.length, count);
});

test('live audio consumes runner alerts and disconnects on scene exit', () => {
  const source = fs.readFileSync(path.join(__dirname, '../audio-runtime.js'), 'utf8');
  const players = [], exits = [], listeners = {};
  let stream;
  const window = {TSS_STUDIO_AUDIO:{scene:{},alerts:{donation:{file:'assets/tip.mp3',volume:60}},offline:false}};
  const context = {window,parent:window,location:{origin:'http://localhost',search:''},URLSearchParams,console,setTimeout,clearTimeout,
    addEventListener:(name,fn) => {if(name==='pagehide')exits.push(fn);else listeners[name]=fn;},
    EventSource:class {
      constructor(url) {assert.equal(url,'/events');stream=this;}
      addEventListener(name,handler) {assert.equal(name,'alert');this.receive=handler;}
      close() {this.closed=true;}
    },
    document:{body:{append(){}},createElement:() => {
      const audio={dataset:{},play:()=>Promise.resolve(),pause(){this.paused=true;},remove(){}};
      players.push(audio);return audio;
    }}};
  vm.runInNewContext(source, context);
  stream.receive({data:JSON.stringify({kind:'donation',name:'Viewer'})});
  assert.equal(players.length,0);
  listeners.obsSourceActiveChanged({detail:{active:true}});
  stream.receive({data:JSON.stringify({kind:'donation',name:'Viewer'})});
  assert.equal(players[0].src,'/assets/tip.mp3');
  assert.equal(players[0].volume,.6);
  for(const exit of exits)exit();
  assert.equal(stream.closed,true);
  assert.equal(players[0].paused,true);
});

test('OBS cached sources stop on scene switches, restart on re-entry, and ignore preview visibility', () => {
  const source=fs.readFileSync(path.join(__dirname,'../audio-runtime.js'),'utf8');
  function browser(search=''){
    const listeners={},players=[];
    const window={TSS_STUDIO_AUDIO:{scene:{file:'assets/song.mp3',volume:100},alerts:{},offline:false}};
    vm.runInNewContext(source,{window,parent:window,URLSearchParams,location:{origin:'http://localhost',search},console,setTimeout,clearTimeout,
      addEventListener:(name,handler)=>{listeners[name]=handler;},
      document:{body:{append(){}},createElement:()=>{
        const player={dataset:{},play:()=>Promise.resolve(),pause(){this.paused=true;},remove(){this.removed=true;}};
        players.push(player);return player;
      }}});
    return {players,emit:(type,detail)=>listeners[type]?.({detail})};
  }
  const starting=browser(),ending=browser(),brb=browser();
  assert.equal(starting.players.length+ending.players.length+brb.players.length,0);
  starting.emit('obsSourceVisibleChanged',{visible:true});
  assert.equal(starting.players.length,0,'Studio Mode preview must stay silent');
  starting.emit('obsSourceActiveChanged',{active:true});
  starting.emit('obsSourceActiveChanged',{active:true});
  assert.equal(starting.players.length,1,'duplicate callbacks must not restart');
  starting.emit('obsSourceActiveChanged',{active:false});
  ending.emit('obsSourceActiveChanged',{active:true});
  assert.equal(starting.players[0].paused,true);
  assert.equal(ending.players.length,1);
  ending.emit('obsSourceActiveChanged',{active:false});
  brb.emit('obsSourceActiveChanged',{active:true});
  assert.equal(ending.players[0].paused,true);
  brb.emit('obsSourceVisibleChanged',{visible:false});
  assert.equal(brb.players[0].paused,true);
  starting.emit('obsSourceActiveChanged',{active:true});
  assert.equal(starting.players.length,2,'returning starts a fresh cue');
  const studioLive=browser('?studio=123');
  studioLive.emit('obsSourceActiveChanged',{active:true});
  assert.equal(studioLive.players.length,0,'Studio live preview must not autoplay');
});

test('music delay waits from activation, cancels on departure and unload, and resets on return', () => {
  const listeners={},players=[],timers=new Map();let now=0,id=0;
  const window={TSS_STUDIO_AUDIO:{scene:{file:'assets/song.mp3',volume:100,delay:5},alerts:{},offline:false}};
  const tick=milliseconds=>{now+=milliseconds;for(const [key,timer]of timers)if(timer.at<=now){timers.delete(key);timer.fn();}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../audio-runtime.js'),'utf8'),{
    window,parent:window,URLSearchParams,location:{origin:'http://localhost',search:''},console,
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:key=>timers.delete(key),
    addEventListener:(name,handler)=>{listeners[name]=handler;},
    document:{body:{append(){}},createElement:()=>{const player={dataset:{},play:()=>Promise.resolve(),pause(){},remove(){}};players.push(player);return player;}}
  });
  const activate=active=>listeners.obsSourceActiveChanged({detail:{active}});
  activate(true);tick(4000);assert.equal(players.length,0);
  activate(true);tick(1000);assert.equal(players.length,1,'duplicate activation does not restart delay');
  activate(false);activate(true);tick(2000);activate(false);tick(10000);
  assert.equal(players.length,1,'leaving cancels pending music');
  activate(true);tick(4999);assert.equal(players.length,1);tick(1);assert.equal(players.length,2);
  activate(false);activate(true);listeners.pagehide();tick(10000);assert.equal(players.length,2);
});
