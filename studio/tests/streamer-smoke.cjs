const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {list}=require('../workspace.cjs');
(async()=>{
 const source=path.join(__dirname,'../..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-streamer-'));
 for(const file of list(source)){const dest=path.join(root,file.name);if(file.type==='directory')fs.mkdirSync(dest,{recursive:true});else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,file.name),dest);}}
 const env={...process.env,TSS_STUDIO_TEST_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
 let app;
 try{
  app=await electron.launch(process.env.TSS_TEST_EXE?{executablePath:process.env.TSS_TEST_EXE,env}:{args:[source],env});
  const page=await app.firstWindow();await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
  assert.equal(await page.locator('#developer-mode').getAttribute('aria-pressed'),'false');
  for(const selector of ['#files','#filter','.editor-panel','#new-file','#new-folder'])assert.equal(await page.locator(selector).isVisible(),false,selector);
  for(const selector of ['.preview-panel','.test-controls','.manual-colour'])assert.equal(await page.locator(selector).isVisible(),true,selector);
  assert.equal(await page.evaluate(()=>documents.size),0);
  assert.equal(await page.locator('aside .update-bar #update-check').count(),1);
  assert.equal(await page.locator('main .update-bar').count(),0);
  assert.equal(await page.locator('.console-panel').isVisible(),false);
  await page.locator('[data-alert=follow]').click();assert.match(await page.locator('#notice').textContent(),/Preview alert sent/);
  await page.locator('#force-apply').click();await page.waitForFunction(()=>document.querySelector('#console').textContent.includes('Start Run overlay first'));
  await page.locator('#playground').click();await page.frameLocator('#preview').locator('h1').waitFor();
  await page.locator('#view-scenes').click();await page.waitForFunction(()=>!!selectedScene);
  assert.equal(await page.locator('#scene-code').isVisible(),false);
  assert.equal(await page.locator('.scene-inspector').isVisible(),true);
  assert.equal(await page.locator('.test-controls').isVisible(),true);
  assert.equal(await page.locator('.console-panel').isVisible(),false);
  const originalScene=await page.evaluate(()=>selectedScene.id);
  for(const method of ['responsive','fit','fill']){
    await page.evaluate(id=>selectScene(id),originalScene);
    await page.locator('#scene-vertical').click();await page.locator('#vertical-method').selectOption(method);
    await page.locator('#vertical-form button[type=submit]').click();await page.locator('#vertical-dialog').waitFor({state:'hidden'});
    assert.equal(await page.locator('#layout').inputValue(),'vertical');
    assert.equal(await page.evaluate(()=>selectedScene.config.layout),'vertical');
    if(method==='responsive')await page.frameLocator('#preview').locator('body.vertical').waitFor();
    else{
      const frame=page.frameLocator('#preview').locator('#portrait-source[style*="scale("]');await frame.waitFor();
      const {bounds,outer}=await frame.evaluate(el=>({bounds:{width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height},outer:{width:innerWidth,height:innerHeight}}));
      if(method==='fit')assert.ok(bounds.width<=outer.width+1&&bounds.height<outer.height,JSON.stringify({bounds,outer}));
      else assert.ok(bounds.width>outer.width&&Math.abs(bounds.height-outer.height)<2);
      await page.frameLocator('#preview').frameLocator('#portrait-source').locator('#studio-alert').waitFor({state:'attached'});
      await page.locator('[data-alert=follow]').click();
      await page.frameLocator('#preview').frameLocator('#portrait-source').locator('#studio-alert').waitFor({state:'visible'});
    }
    await page.locator('#copy-url').click();const url=await app.evaluate(({clipboard})=>clipboard.readText());assert.equal((await fetch(url)).status,200);
  }
  assert.equal(await page.evaluate(id=>state.scenes.find(s=>s.id===id).config.layout,originalScene),'horizontal');
  await page.evaluate(id=>selectScene(id),originalScene);
  await page.locator('#view-console').click();assert.equal(await page.locator('.console-panel').isVisible(),true);
  await page.locator('#view-workspace').click();
  await page.frameLocator('#preview').locator('#title').waitFor();
  fs.mkdirSync(path.join(source,'studio/artifacts'),{recursive:true});await page.screenshot({path:path.join(source,'studio/artifacts/streamer-mode.png')});
  await page.locator('#developer-mode').click();await page.waitForFunction(()=>active==='config.js');
  assert.equal(await page.locator('#files').isVisible(),true);assert.equal(await page.locator('.editor-panel').isVisible(),true);
  const original=await page.evaluate(()=>editor.getValue());await page.evaluate(()=>editor.setValue(editor.getValue()+'\n// mode test'));
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:2});});await page.locator('#developer-mode').click();
  assert.equal(await page.locator('#developer-mode').getAttribute('aria-pressed'),'true');
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0});});await page.locator('#developer-mode').click();
  assert.ok(fs.readFileSync(path.join(root,'config.js'),'utf8').includes('// mode test'));
  assert.equal(await page.locator('.editor-panel').isVisible(),false);
  await page.locator('#developer-mode').click();await page.evaluate(()=>editor.setValue(editor.getValue()+'\n// discard me'));
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});await page.locator('#developer-mode').click();
  await page.locator('#developer-mode').click();assert.ok(!(await page.evaluate(()=>editor.getValue())).includes('discard me'));
  await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
  assert.equal(await page.locator('#developer-mode').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('.console-panel').isVisible(),false);
  console.log('PASS: streamer defaults, previews, scenes, alerts, overrides, console, Developer mode, Save/Discard/Cancel, and reset on launch.');
 }finally{if(app)await app.close();fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
