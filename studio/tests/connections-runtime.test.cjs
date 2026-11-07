const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {fork}=require('node:child_process');
const {pathToFileURL}=require('node:url');

test('managed runner refreshes credentials through IPC and delivers Twitch and donation events from the selected project',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-managed-runner-'));
  const runtime=path.join(root,'runtime');
  fs.writeFileSync(path.join(root,'tss-events.json'),JSON.stringify({version:1,events:[{id:'welcome',name:'Welcome',trigger:'channel.follow'}]}));
  fs.mkdirSync(path.join(root,'scenes'));
  fs.writeFileSync(path.join(root,'scenes/index.html'),'<h1>Selected project</h1>');
  const mock=path.join(root,'network.mjs');
  fs.writeFileSync(mock,`
    import http from 'node:http';
    const listen=http.Server.prototype.listen;
    http.Server.prototype.listen=function(port,...args){
      this.once('listening',()=>{if(this.listenerCount('request'))process.send({type:'test-port',port:this.address().port});});
      return listen.call(this,0,...args);
    };
    globalThis.fetch=async(url,options={})=>{
      let body={},status=200;
      if(url.endsWith('/validate')) {
        if(options.headers.Authorization==='OAuth expired')status=401;
        else body={client_id:'testclient123',user_id:'123',login:'streamer',scopes:['moderator:read:followers','channel:read:subscriptions','bits:read','channel:read:redemptions']};
      } else if(url.endsWith('/token'))body={access_token:'refreshed-secret',refresh_token:'refresh-secret'};
      else if(url.includes('channels/followers'))body={data:[{user_name:'Latest follower'}]};
      else if(url.endsWith('eventsub/subscriptions'))body={data:[]};
      else if(url.endsWith('channels/me'))body={_id:'channel',provider:'twitch',providerId:'123'};
      else if(url.includes('activities/'))body=[];
      else if(url.includes('sessions/'))body={data:{}};
      else throw Error('Unexpected endpoint '+url);
      return {ok:status===200,status,json:async()=>body};
    };
    const sockets=new Map();
    globalThis.WebSocket=class {
      constructor(url){
        this.readyState=1;
        const provider=url.includes('streamlabs')?'streamlabs':url.includes('streamelements')?'streamelements':'twitch';
        sockets.set(provider,this);
        queueMicrotask(()=>this.onmessage({data:provider==='streamlabs'?'40':JSON.stringify(provider==='streamelements'?{type:'welcome'}:{metadata:{message_type:'session_welcome'},payload:{session:{id:'test-session',keepalive_timeout_seconds:60}}})}));
      }
      send(data){if(data.startsWith('{'))queueMicrotask(()=>this.onmessage({data:JSON.stringify({type:'response'})}));}
      close(){this.readyState=3;}
    };
    process.on('message',message=>{
      if(message.type==='test-event')sockets.get(message.provider).onmessage({data:message.data});
    });
  `);
  let child,request,stream;
  try {
    child=fork(path.join(__dirname,'../../scripts/tss-twitch.mjs'),[],{
      execArgv:['--import',pathToFileURL(mock).href],silent:true,
      env:{...process.env,TSS_STUDIO_MANAGED:'1',TSS_PROJECT_ROOT:root,TSS_RUNTIME_STORE:runtime}
    });
    const messages=[];let output='';
    child.on('message',message=>messages.push(message));
    child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
    const wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Runner timed out: '+output);};
    child.send({twitch:{clientId:'testclient123',access_token:'expired',refresh_token:'old-refresh'},donations:{
      streamelements:{mode:'native',token:'jwt-secret'},streamlabs:{mode:'native',token:'socket-secret'}
    }});
    await wait(()=>messages.filter(message=>message.type==='connection-status'&&message.message.startsWith('Connected')).length===3);
    assert.equal(messages.find(message=>message.type==='credentials').credentials.access_token,'refreshed-secret');
    assert.equal(fs.existsSync(path.join(runtime,'credentials.json')),false);
    const port=messages.find(message=>message.type==='test-port').port;
    const options={hostname:'127.0.0.1',port,headers:{Host:'127.0.0.1:8787'}};
    let page='';
    await new Promise((resolve,reject)=>http.get({...options,path:'/scenes/index.html'},response=>{response.on('data',data=>page+=data);response.on('end',resolve);}).on('error',reject));
    assert.ok(page.includes('Selected project'));
    let events='';
    await new Promise((resolve,reject)=>{request=http.get({...options,path:'/events'},response=>{stream=response;response.on('data',data=>{events+=data;resolve();});});request.on('error',reject);});
    child.send({type:'test-event',provider:'twitch',data:JSON.stringify({metadata:{message_type:'notification',message_id:'follow-1'},payload:{subscription:{type:'channel.follow'},event:{user_name:'New follower'}}})});
    await wait(()=>events.includes('event: project-event')&&events.includes('"name":"New follower"'));
    child.send({type:'test-event',provider:'streamelements',data:JSON.stringify({type:'message',topic:'channel.activities',data:{type:'tip',createdAt:new Date().toISOString(),data:{name:'Elements donor',amount:10,currency:'GBP'}}})});
    await wait(()=>events.includes('"name":"Elements donor"'));
    const donation=JSON.stringify(['event',{type:'donation',message:[{id:'tip-1',name:'Labs donor',amount:'5',currency:'USD'}]}]);
    child.send({type:'test-event',provider:'streamlabs',data:'42'+donation});
    child.send({type:'test-event',provider:'streamlabs',data:'42'+donation});
    await wait(()=>events.includes('"name":"Labs donor"'));
    assert.equal(events.match(/"name":"Labs donor"/g).length,1,'duplicate donations do not trigger twice');
    assert.ok(!output.includes('secret'),'credentials are not printed to Console');
    stream.destroy();request.destroy();
    const exited=new Promise(resolve=>child.once('exit',resolve));child.disconnect();
    assert.equal(await exited,0,'helper stops when Studio disconnects');
  } finally {
    stream?.destroy();request?.destroy();
    if(child&&child.exitCode===null){const closed=new Promise(resolve=>child.once('exit',resolve));child.kill();await closed;}
    fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
});
