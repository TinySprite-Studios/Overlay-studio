const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createProject}=require('../project.cjs');
(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-settings-app-'));
  createProject(root);let app;
  try {
    const env={...process.env,TSS_STUDIO_TEST_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
    app=await electron.launch({args:[path.join(__dirname,'../..')],env});
    const page=await app.firstWindow();page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    await page.locator('#view-settings').click();
    await page.waitForFunction(()=>document.querySelector('#donation-provider').options.length>5);
    assert.equal(await page.locator('#settings-panel').isVisible(),true);
    assert.equal(await page.locator('#workarea').isVisible(),false);
    assert.equal(await page.locator('#twitch-client-id, #twitch-app-setup, #twitch-developer').count(),0);
    assert.equal(await page.locator('#twitch-connect').isEnabled(),true);
    assert.equal(await page.evaluate(async()=>Object.hasOwn(await call('connections-state'),'clientId')),false);
    await page.locator('#donation-provider').selectOption('kofi');
    await page.locator('#donation-link').fill('https://ko-fi.com/streamer');
    await page.locator('#donation-overlay').fill('https://ko-fi.com/streamalerts/private-example');
    await page.locator('#donation-save').click();
    await page.waitForFunction(()=>document.querySelector('#saved-connections').textContent.includes('Ko-fi'));
    assert.equal(await page.locator('#donation-overlay').inputValue(),'');
    assert.equal((await page.locator('#settings-panel').textContent()).includes('private-example'),false);
    await page.getByRole('button',{name:'Copy OBS alert URL',exact:true}).click();
    assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'https://ko-fi.com/streamalerts/private-example');
    await page.locator('#donation-provider').selectOption('paypal');
    await page.locator('#donation-mode').selectOption('link');
    await page.locator('#donation-link').fill('https://paypal.me/streamer');
    await page.locator('#donation-save').click();
    await page.waitForFunction(()=>document.querySelectorAll('.saved-connection').length===2);
    fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'../artifacts/settings.png')});
    await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    await page.locator('#view-settings').click();
    await page.waitForFunction(()=>document.querySelectorAll('.saved-connection').length===2);
    const other=path.join(root,'other');createProject(other);
    await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},other);
    await page.locator('#import-project').click();await page.waitForFunction(folder=>state.root===folder,other);
    await page.locator('#view-settings').click();
    await page.waitForFunction(()=>document.querySelector('#connection-project').textContent==='other');
    assert.equal(await page.locator('.saved-connection').count(),0);
    await page.getByTitle(root,{exact:true}).click();await page.waitForFunction(folder=>state.root===folder,root);
    await page.locator('#view-settings').click();await page.waitForFunction(()=>document.querySelectorAll('.saved-connection').length===2);
    await page.locator('.saved-connection').filter({hasText:'Ko-fi'}).getByRole('button',{name:'Disconnect',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.saved-connection').length===1);
    assert.deepEqual(errors,[]);
    console.log('PASS: Settings navigation, hidden Twitch app configuration, provider URLs, private URL masking, persistence, project isolation and disconnect.');
  } finally {
    if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(win=>win.removeAllListeners('close')));await app.close();}
    fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
