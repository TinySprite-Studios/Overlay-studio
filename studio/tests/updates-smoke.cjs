const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-update-ui-'));
 fs.writeFileSync(path.join(root,'config.js'),'// update UI test');
 fs.writeFileSync(path.join(root,'start-twitch.cmd'),'@echo off');
 const env={...process.env,TSS_STUDIO_TEST_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
 let app;
 try{
  app=await electron.launch({args:[path.join(__dirname,'../..')],env});
  const page=await app.firstWindow();
  await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    await page.locator('#developer-mode').click();
    await page.waitForFunction(()=>typeof editor!=='undefined'&&editor&&active==='config.js');
  assert.match(await page.locator('#update-status').textContent(),/installed GitHub release/);
  assert.equal(await page.locator('#update-check').isDisabled(),true);
  async function send(status,extra={}){await app.evaluate(({BrowserWindow},message)=>BrowserWindow.getAllWindows()[0].webContents.send('studio:event',message),{type:'update',status,currentVersion:'1.2.0',version:'1.3.0',...extra});}
  await send('available');await page.locator('#update-download').waitFor();
  await send('downloading',{percent:42});await page.waitForFunction(()=>document.querySelector('#update-status').textContent.includes('42%'));
  await send('downloaded');await page.locator('#update-install').waitFor();
  await page.evaluate(()=>editor.setValue('// unsaved edit'));
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:2});});
  assert.equal(await page.evaluate(()=>window.canCloseStudio()),false);
  await send('error',{message:'Connection failed. Retry.'});await page.waitForFunction(()=>!document.querySelector('#update-check').disabled);
  console.log('PASS: update UI states, progress, retry, and unsaved-edit cancellation.');
 }finally{if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});await app.close();}fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
