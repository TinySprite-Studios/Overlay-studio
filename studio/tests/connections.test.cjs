const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const {createConnections, scopes, httpsURL} = require('../connections.cjs');
const waitFor = async predicate => {for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Timed out waiting for connection');};
function fixture(overrides={}) {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tss-connections-'));
  const key=crypto.randomBytes(32), requests=[], opened=[];
  const encryption={isEncryptionAvailable:()=>true,
    encryptString:text=>{const iv=crypto.randomBytes(16),cipher=crypto.createCipheriv('aes-256-cbc',key,iv);return Buffer.concat([iv,cipher.update(text),cipher.final()]);},
    decryptString:buffer=>{const decipher=crypto.createDecipheriv('aes-256-cbc',key,buffer.subarray(0,16));return Buffer.concat([decipher.update(buffer.subarray(16)),decipher.final()]).toString();}};
  let account='123',pending=0;
  const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
  const fetcher=async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/device'))return response({verification_uri:'https://www.twitch.tv/activate',user_code:'ABCD',device_code:'device-secret',expires_in:30,interval:.001});
    if(url.endsWith('/token')) {
      if(pending++===0)return response({message:'authorization_pending'},400);
      return response({access_token:'access-secret',refresh_token:'refresh-secret'});
    }
    if(url.endsWith('/validate'))return response({client_id:'testclient123',user_id:account,login:'streamer-'+account,scopes:scopes.split(' ')});
    if(url.endsWith('channels/me'))return response({_id:'channel',username:'streamer',provider:'twitch',providerId:account});
    throw Error('Unexpected URL: '+url);
  };
  const service=createConnections({directory:folder,encryption,fetcher,openBrowser:async url=>opened.push(url),pollDelay:0,verifyStreamlabs:async token=>{assert.equal(token,'socket-secret');},...overrides});
  return {service,folder,requests,opened,setAccount:value=>account=value,cleanup:()=>{service.cancel();fs.rmSync(folder,{recursive:true,force:true});}};
}
test('Twitch sign-in saves encrypted credentials per project and never returns secrets',async()=>{
  const f=fixture(),root=path.join(f.folder,'project-a'),other=path.join(f.folder,'project-b');
  try {
    await f.service.connect(root,'testclient123');
    await waitFor(()=>f.service.state(root).twitch.connected);
    assert.equal(f.service.state(root).twitch.login,'streamer-123');
    assert.equal(f.service.state(other).twitch.connected,false);
    assert.deepEqual(f.opened,['https://www.twitch.tv/activate']);
    assert.equal(JSON.stringify(f.service.state(root)).includes('secret'),false);
    const file=path.join(f.folder,fs.readdirSync(f.folder)[0],'connections.bin');
    assert.equal(fs.readFileSync(file).includes(Buffer.from('access-secret')),false);
    assert.ok(!fs.existsSync(root),'no account files written into the overlay project');
    await f.service.saveDonation(root,{id:'streamelements',mode:'native',token:'jwt-secret',link:'https://streamelements.com/streamer/tip'});
    await f.service.saveDonation(root,{id:'streamlabs',mode:'native',token:'socket-secret'});
    assert.equal(JSON.stringify(f.service.state(root)).includes('secret'),false);
    f.service.disconnect(root,'twitch');f.setAccount('456');
    await f.service.connect(root,'testclient123');await waitFor(()=>f.service.state(root).twitch.connected);
    assert.equal(f.service.read(root).donations.streamelements.token,undefined,'old channel tokens removed after changing Twitch account');
    assert.equal(f.service.state(root).donations[0].mode,'link');
  } finally {f.cleanup();}
});
test('cancelled sign-in cannot write credentials after the project is switched',async()=>{
  let resolve;
  const f=fixture({fetcher:()=>new Promise(done=>resolve=done)});
  try {
    const connect=f.service.connect('project-a','testclient123');
    f.service.cancel();
    resolve({ok:true,json:async()=>({verification_uri:'https://www.twitch.tv/activate',user_code:'code',expires_in:60})});
    await connect;
    assert.equal(f.service.configured('project-a'),false);assert.deepEqual(f.opened,[]);
  } finally {f.cleanup();}
});
test('provider methods validate links, preserve private browser URLs, and disconnect only the selected provider',async()=>{
  const f=fixture();
  try {
    for(const link of ['javascript:alert(1)','file:///secret','http://example.com','https://user:pass@example.com'])assert.throws(()=>httpsURL(link));
    await f.service.saveDonation('a',{id:'kofi',mode:'browser',link:'https://ko-fi.com/streamer',overlay:'https://ko-fi.com/streamalerts/private-secret'});
    await f.service.saveDonation('a',{id:'other',mode:'link',link:'https://example.com/tips'});
    await f.service.saveDonation('a',{id:'kofi',mode:'browser',link:'https://ko-fi.com/renamed'});
    assert.equal(f.service.state('a').donations.length,2);
    assert.equal(JSON.stringify(f.service.state('a')).includes('private-secret'),false);
    assert.equal(f.service.read('a').donations.kofi.overlay,'https://ko-fi.com/streamalerts/private-secret');
    await assert.rejects(()=>f.service.saveDonation('a',{id:'kofi',mode:'native',token:'secret'}),/supported/);
    await assert.rejects(()=>f.service.saveDonation('a',{id:'streamelements',mode:'native',token:'secret'}),/Connect Twitch/);
    f.service.disconnect('a','kofi');assert.equal(f.service.state('a').donations[0].id,'other');
    assert.deepEqual(f.service.state('b').donations,[]);
  } finally {f.cleanup();}
});
test('Streamlabs accepts only donation events and filters invalid amounts',async()=>{
  const {donationEvents,checkToken}=await import('../../scripts/tss-streamlabs.mjs');
  const payload={type:'donation',message:[{id:1,name:'Pat',amount:'5.50',currency:'GBP'},{name:'Invalid',amount:'bad'}]};
  assert.equal(donationEvents(payload).length,1);
  assert.equal(donationEvents(payload)[0].data.amount,5.5);
  assert.deepEqual(donationEvents({...payload,for:'twitch_account'}),[]);
  class Socket {constructor(){this.readyState=1;setTimeout(()=>this.onmessage({data:'40'}),0);}close(){this.onclose?.();}}
  await checkToken('token',{Socket});
  class BadSocket extends Socket {constructor(){super();queueMicrotask(()=>this.onmessage({data:'44{"message":"unauthorized"}'}));}}
  await assert.rejects(()=>checkToken('bad',{Socket:BadSocket}),/authenticate/);
});
