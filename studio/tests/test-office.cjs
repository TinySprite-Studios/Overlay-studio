const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require('playwright');
const {serve}=require('../server.cjs');
(async()=>{
  const {parseIRC,messageFromIRC,emoteParts}=await import('../../scenes/tss_gamers-office/chat.mjs');
  const {perspectiveMatrix}=await import('../../scenes/tss_gamers-office/geometry.mjs');
  const parsed=parseIRC('@display-name=Test\\sViewer;color=#37FF7D;id=local-test;emotes=25:0-4 :test!test@host PRIVMSG #johnmcklean :Kappa hello <script>');
  assert.equal(messageFromIRC(parsed).name,'Test Viewer');assert.equal(emoteParts('Kappa hello','25:0-4')[0].emote,'25');
  assert.equal(parseIRC('PING :tmi.twitch.tv').command,'PING');
  const quad=[[12,30],[400,22],[420,210],[11,200]],matrix=perspectiveMatrix(960,540,quad);
  [[0,0],[960,0],[960,540],[0,540]].forEach(([x,y],i)=>{const divisor=matrix[3]*x+matrix[7]*y+1;assert.ok(Math.abs((matrix[0]*x+matrix[4]*y+matrix[12])/divisor-quad[i][0])<1e-7);assert.ok(Math.abs((matrix[1]*x+matrix[5]*y+matrix[13])/divisor-quad[i][1])<1e-7);});
  const server=await serve(()=>path.join(__dirname,'../..'),0,false);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tss-office-preview-'));const script=path.join(temp,'preview.cjs');
  fs.writeFileSync(script,"const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({width:1920,height:1080,frame:false,useContentSize:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});w.loadURL(process.env.TSS_OFFICE_URL)});app.on('window-all-closed',()=>app.quit());");
  const env={...process.env,TSS_OFFICE_URL:server.url+'/scenes/tss_gamers-office/index.html'};delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try{
    app=await _electron.launch({args:[script],env});const page=await app.firstWindow();await page.setViewportSize({width:1920,height:1080});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>document.querySelector('#chat-state')?.dataset.state==='connected',{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('.office-art')?.complete&&document.querySelector('.office-art')?.naturalWidth>0);
    assert.equal(await page.locator('#chat-channel').textContent(),'#johnmcklean');
    assert.equal(await page.locator('.monitor').count(),3);assert.equal(await page.locator('.discord-row').count(),24);
    assert.equal(await page.locator('#start-title strong').textContent(),'Starting Soon');
    const first=await page.locator('.discord-track').evaluate(el=>getComputedStyle(el).transform);
    await page.waitForFunction(old=>getComputedStyle(document.querySelector('.discord-track')).transform!==old,first);
    assert.deepEqual(errors,[]);await page.screenshot({path:path.join(__dirname,'artifacts','tss_gamers_office_live.png')});
    // Local fake inbound messages exercise rendering/moderation without posting anything to Twitch.
    let mockSocket;const sent=[];
    await page.routeWebSocket('wss://irc-ws.chat.twitch.tv/',socket=>{
      mockSocket=socket;socket.onMessage(line=>{sent.push(String(line));if(String(line).startsWith('JOIN #johnmcklean')){
        socket.send(':tmi.twitch.tv 366 justinfan1 #johnmcklean :End of NAMES list\r\n');
        socket.send('@display-name=LocalTest;color=#37FF7D;id=test-render;badges=moderator/1 :localtest!localtest@host PRIVMSG #johnmcklean :Hello <img src=x onerror=alert(1)>\r\n');
      }});
    });
    await page.reload();await page.locator('.chat-message').waitFor();assert.ok((await page.locator('.chat-message').textContent()).includes('<img src=x onerror=alert(1)>'));assert.equal(await page.locator('.chat-message img').count(),0);
    mockSocket.send('@target-msg-id=test-render :tmi.twitch.tv CLEARMSG #johnmcklean :deleted\r\n');await page.waitForFunction(()=>document.querySelectorAll('.chat-message').length===0);
    mockSocket.send('@display-name=LocalTest;id=test-clear :localtest!localtest@host PRIVMSG #johnmcklean :Local moderation check\r\n');await page.locator('.chat-message').waitFor();
    mockSocket.send(':tmi.twitch.tv CLEARCHAT #johnmcklean :localtest\r\n');await page.waitForFunction(()=>document.querySelectorAll('.chat-message').length===0);
    assert.ok(!sent.some(line=>line.startsWith('PRIVMSG')));assert.deepEqual(errors,[]);
    console.log('PASS: monitor perspective, IRC parser, emotes, live Twitch join, Discord scrolling, safe message rendering, deletion and moderation, no chat posting.');
  }finally{if(app)await app.close();server.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
