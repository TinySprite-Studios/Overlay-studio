const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createUpdates}=require('../updates.cjs');
function fixture(enabled=true){
  const updater=new EventEmitter();let checks=0,downloads=0,installs=0,notifications=0;
  updater.checkForUpdates=async()=>{checks++;updater.emit('checking-for-update');updater.emit('update-available',{version:'1.3.0'});};
  updater.downloadUpdate=async()=>{downloads++;updater.emit('download-progress',{percent:52});updater.emit('update-downloaded',{version:'1.3.0'});};
  updater.quitAndInstall=()=>installs++;
  const events=[];
  const controller=createUpdates({updater,version:'1.2.0',enabled,send:event=>events.push(event),notify:()=>notifications++});
  return {controller,updater,events,counts:()=>({checks,downloads,installs,notifications})};
}
test('release notice never downloads or installs without a click',async()=>{
  const f=fixture();await f.controller.check();await f.controller.check();
  assert.equal(f.controller.state().status,'available');
  assert.deepEqual(f.counts(),{checks:1,downloads:0,installs:0,notifications:1});
  assert.equal(f.updater.autoInstallOnAppQuit,false);assert.equal(f.updater.autoDownload,false);
  assert.throws(()=>f.controller.install());
  await f.controller.download();assert.ok(f.events.some(e=>e.percent===52));
  assert.equal(f.controller.state().status,'downloaded');
  await f.controller.check();await f.controller.download();f.controller.install();
  assert.deepEqual(f.counts(),{checks:1,downloads:1,installs:1,notifications:1});
});
test('development and portable copies do not contact the release server',async()=>{
  const f=fixture(false);await f.controller.check();await f.controller.download();assert.throws(()=>f.controller.install());
  assert.equal(f.counts().checks,0);assert.equal(f.controller.state().status,'disabled');
});
test('network and download failures can be retried',async()=>{
  const f=fixture();f.updater.checkForUpdates=async()=>{throw Error('offline');};
  await f.controller.check();assert.equal(f.controller.state().status,'error');
  f.updater.checkForUpdates=async()=>f.updater.emit('update-available',{version:'1.3.0'});
  await f.controller.check();f.updater.downloadUpdate=async()=>{throw Error('interrupted');};
  await f.controller.download();assert.equal(f.controller.state().status,'error');
  await f.controller.check();assert.equal(f.controller.state().status,'available');
});
test('overlapping checks are suppressed',async()=>{
  const f=fixture();let release,calls=0;
  f.updater.checkForUpdates=()=>{calls++;return new Promise(resolve=>{release=resolve;});};
  const pending=f.controller.check();await f.controller.check();assert.equal(calls,1);
  release();await pending;
});
