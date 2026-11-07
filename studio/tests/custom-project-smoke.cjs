const {_electron:electron} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const {createProject} = require('../project.cjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-custom-app-'));
  let app;
  try {
    createProject(root);
    const fields = [{key:'heading', type:'text', default:'Hello'}, {key:'enabled', type:'boolean', default:true}];
    fs.writeFileSync(path.join(root, 'tss-events.json'), JSON.stringify({version:1, events:[{id:'confetti',name:'Celebrate',trigger:'points',fields}]}));
    const dir = path.join(root, 'scenes/tss_custom');fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'scene.json'), JSON.stringify({type:'custom',name:'Custom',fields}));
    fs.writeFileSync(path.join(dir, 'index.html'), `<html><head></head><body><h1></h1><script>
      document.querySelector('h1').textContent=TSS_SCENE.values.heading;
      new EventSource('/events').addEventListener('project-event', e=>document.body.dataset.event=JSON.parse(e.data).id);
    </script></body></html>`);
    const env = {...process.env,TSS_STUDIO_TEST_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({args:[path.join(__dirname,'../..')],env});
    const page = await app.firstWindow();page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror', error=>errors.push(error.message));
    await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    assert.equal(await page.locator('#update-check').isVisible(),false);
    await page.frameLocator('#preview').locator('h1').filter({hasText:'Hello'}).waitFor();
    await page.locator('[data-test-event="confetti"]').click();
    await page.frameLocator('#preview').locator('body[data-event="confetti"]').waitFor();
    await page.locator('#view-events').click();
    assert.equal(await page.locator('#project-sounds').isVisible(),false);
    await page.locator('#event-settings [data-setting="heading"]').fill('Event heading');
    await page.locator('#events-save').click();
    await page.waitForFunction(()=>state.events.settings.events[0].values.heading==='Event heading');
    await page.locator('#view-scenes').click();
    await page.locator('#scene-custom-settings [data-setting="heading"]').fill('Updated scene');
    await page.locator('#scene-custom-settings [data-setting="enabled"]').uncheck();
    await page.locator('#scene-apply').click();
    await page.frameLocator('#preview').locator('h1').filter({hasText:'Updated scene'}).waitFor();
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'scene.json'))).values.enabled,false);
    await page.locator('#developer-mode').click();
    await page.locator('#scene-code').click();
    await page.waitForFunction(()=>active==='scenes/tss_custom/index.html');
    assert.equal(await page.locator('#files [data-path="studio"]').count(),0);
    const other = path.join(root, 'other-project');createProject(other);
    await app.evaluate(({dialog}, folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},other);
    await page.locator('#open').click();
    await page.waitForFunction(()=>state.name==='other-project');
    assert.equal(await page.locator('[data-test-event]').count(),0);
    assert.equal(await page.evaluate(()=>state.scenes.length),0);
    assert.equal(await page.evaluate(()=>[...documents.keys()].some(name=>name.includes('tss_custom'))),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: custom scene controls, event settings and preview delivery, developer files, hidden update button.');
  } finally {
    if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(win=>win.removeAllListeners('close')));await app.close();}
    fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
