const {_electron:electron} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const {list} = require('../workspace.cjs');
(async () => {
  const source = process.env.TSS_OFFICE_PROJECT;
  if (!source) throw Error('Set TSS_OFFICE_PROJECT to the office overlay project.');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-office-test-'));
  for (const file of list(source)) {
    const target = path.join(root, file.name);
    if (file.type === 'directory') fs.mkdirSync(target, {recursive:true});
    else {fs.mkdirSync(path.dirname(target), {recursive:true}); fs.copyFileSync(path.join(source, file.name), target);}
  }
  const env = {...process.env, TSS_STUDIO_TEST_ROOT:root}; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch(process.env.TSS_TEST_EXE ? {executablePath:process.env.TSS_TEST_EXE, env} : {args:[path.join(__dirname, '../..')], env});
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => typeof state !== 'undefined' && state && editor);
    await page.setViewportSize({width:1600, height:1000});
    await page.locator('#view-events').click();
    assert.equal(await page.locator('#event-settings input').count(), 6);
    await page.locator('#event-settings input[name=feed]').fill('Snack time');
    await page.locator('#events-save').click();
    await page.waitForFunction(() => !eventsDirty);
    await page.waitForTimeout(600);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'tss-events.json'))).events.find(event => event.id === 'feed').name, 'Snack time');
    fs.mkdirSync(path.join(__dirname, '../artifacts'), {recursive:true});
    if(!process.env.TSS_TEST_EXE) await page.screenshot({path:path.join(__dirname, '../artifacts/events.png')});
    await page.locator('#view-scenes').click();
    assert.equal(await page.locator('[data-scene=tss_project-live]').count(), 1);
    await page.locator('[data-scene=tss_gamers-office]').click();
    const office = page.frameLocator('#preview');
    await office.locator('canvas.office-accent').waitFor();
    await office.locator('#starting-monitor[style*=matrix3d]').waitFor();
    const paint = hex => page.evaluate(hex => {
      $('preview').contentWindow.postMessage({type:'paint', data:{active:{id:hex, colour:'purple', hex, endsAt:Date.now()+60000}}}, '*');
    }, hex);
    await paint('#b56cff');
    await office.locator('html').evaluate(element => new Promise(resolve => {
      const check = () => element.style.getPropertyValue('--accent') === '#b56cff' ? resolve() : setTimeout(check, 20); check();
    }));
    assert.ok(await office.locator('canvas.office-accent').evaluate(canvas => canvas.width > 1000 && canvas.getContext('2d').getImageData(950,120,1,1).data[3] > 0));
    await page.waitForTimeout(200);
    if(!process.env.TSS_TEST_EXE) await page.screenshot({path:path.join(__dirname, '../artifacts/office-purple.png')});
    await page.evaluate(() => $('preview').contentWindow.postMessage({type:'paint',data:{active:null}}, '*'));
    await page.waitForTimeout(100);
    assert.equal(await office.locator('html').evaluate(element => element.style.getPropertyValue('--accent')), '#37ff9b');
    await page.locator('[data-scene=tss_project-live]').click();
    const live = page.frameLocator('#preview').frameLocator('iframe');
    await live.locator('#box-tss').waitFor({state:'attached'});
    await page.locator('#scene-form input[name=accent]').fill('#ff952e');
    await page.locator('#scene-apply').click();
    await page.waitForTimeout(600);
    assert.equal(await live.locator('html').evaluate(element => element.style.getPropertyValue('--frameLight')), '#ff952e');
    await paint('#479cff');
    await page.waitForTimeout(100);
    assert.equal(await live.locator('html').evaluate(element => element.style.getPropertyValue('--frameLight')), '#479cff');
    await page.evaluate(() => $('preview').contentWindow.postMessage({type:'paint',data:{active:null}}, '*'));
    await page.waitForTimeout(100);
    assert.equal(await live.locator('html').evaluate(element => element.style.getPropertyValue('--frameLight')), '#ff952e');
    assert.deepEqual(errors, []);
    console.log('PASS: office recolouring/restoration, live overlay, event editing, and nested preview routing.');
  } finally {
    if(app){await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(win => win.removeAllListeners('close'))); await app.close();}
    try{fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(error){if(error.code!=='EBUSY')throw error;}
  }
})().catch(error => {console.error(error); process.exitCode=1;});
