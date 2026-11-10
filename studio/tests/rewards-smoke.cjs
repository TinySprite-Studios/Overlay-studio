const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-rewards-app-'));
  fs.writeFileSync(path.join(root,'tss-events.json'),JSON.stringify({version:1,events:[
    {id:'confetti',name:'Confetti',trigger:'points'}, {id:'fireworks',name:'Fireworks',trigger:'bits'}
  ]}));
  let app;
  try {
    const env={...process.env,TSS_STUDIO_TEST_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
    app=await electron.launch({args:[path.join(__dirname,'../..')],env});
    const page=await app.firstWindow(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    const connectionData={
      twitch:{access_token:'test-only',userId:'123',login:'test-channel'},donations:{},
      twitchRewards:{updatedAt:Date.now(),errors:[],items:[
        {id:'points-id',title:'Celebrate with confetti',trigger:'points',cost:1000,enabled:true},
        {id:'bits-id',title:'Launch fireworks',trigger:'bits',cost:600,enabled:true}
      ]}
    };
    const encrypted=await app.evaluate(({safeStorage},data)=>safeStorage.encryptString(JSON.stringify(data)).toString('base64'),connectionData);
    const directory=path.join(root,'.studio-data/connections',require('node:crypto').createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex'));
    fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'connections.bin'),Buffer.from(encrypted,'base64'));
    await page.locator('#view-events').click();
    const points=page.locator('[data-reward-event="confetti"]'),bits=page.locator('[data-reward-event="fireworks"]');
    await page.waitForFunction(()=>document.querySelector('[data-reward-event="confetti"]').options.length===2);
    assert.equal(await points.locator('option[value="bits-id"]').count(),0);
    assert.equal(await bits.locator('option[value="points-id"]').count(),0);
    await points.selectOption('points-id');await bits.selectOption('bits-id');
    await page.locator('#events-save').click();
    await page.waitForFunction(()=>!eventsDirty);
    const saved=JSON.parse(fs.readFileSync(path.join(root,'tss-events.json')));
    assert.deepEqual(saved.events.map(event=>[event.twitchId,event.twitchBroadcasterId]),[['points-id','123'],['bits-id','123']]);
    await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    await page.locator('#view-events').click();
    assert.equal(await points.inputValue(),'points-id');assert.equal(await bits.inputValue(),'bits-id');
    fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'../artifacts/rewards.png')});
    await page.locator('#view-settings').click();
    await page.waitForFunction(()=>document.querySelector('#settings-panel [data-rewards-status]').textContent.includes('1 Bits power-ups'));
    assert.deepEqual(errors,[]);
    console.log('PASS: generic points/Bits selectors, type filtering, real save/reload and setup summary.');
  } finally {
    if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(win=>win.removeAllListeners('close')));await app.close();}
    fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
