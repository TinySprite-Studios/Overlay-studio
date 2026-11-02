const {_electron:electron} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const {list} = require('../workspace.cjs');

(async () => {
  const source = path.join(__dirname, '../..'), root = fs.mkdtempSync(path.join(os.tmpdir(), 'tss-audio-app-'));
  for (const file of list(source)) {
    const target = path.join(root, file.name);
    if (file.type === 'directory') fs.mkdirSync(target, {recursive:true});
    else { fs.mkdirSync(path.dirname(target), {recursive:true}); fs.copyFileSync(path.join(source, file.name), target); }
  }
  const env = {...process.env,TSS_STUDIO_TEST_ROOT:root}; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({args:[source],env});
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await page.waitForFunction(() => typeof state !== 'undefined' && state && editor);
    await app.evaluate(({dialog}, fixtures) => {dialog.showOpenDialog=async()=>({canceled:false,filePaths:fixtures});},
      ['mp3','mp4'].map(ext => path.join(__dirname,'fixtures/cue.'+ext)));
    await page.locator('#import-assets').click();
    await page.waitForFunction(() => state.files.some(file => file.name === 'assets/cue.mp4'));
    await page.locator('#view-scenes').click();
    await page.locator('#scene-audio').selectOption('assets/cue.mp3');
    await page.locator('#scene-audio-volume').fill('35');
    await page.locator('#scene-audio-delay').fill('1');
    await page.locator('#scene-apply').click();
    await page.waitForFunction(() => selectedScene.config.audio === 'assets/cue.mp3' && !sceneDirty);
    let frame = await (await page.locator('#preview').elementHandle()).contentFrame();
    await frame.waitForFunction(() => window.TSS_STUDIO_AUDIO, null, {timeout:15000});
    assert.equal(await frame.locator('audio').count(),0,'Apply must not start the scene song');
    await page.locator('#scene-audio-test').click();
    assert.equal(await page.evaluate(() => soundPreview?.paused),true);
    await page.waitForFunction(() => soundPreview?.currentTime > 0);
    assert.equal(await page.evaluate(() => soundPreview.volume),.35);
    await page.evaluate(() => {window.testPlayer=soundPreview;});
    await page.locator('#scene-form [data-stop-audio]').click();
    assert.equal(await page.evaluate(() => testPlayer.paused),true);
    assert.equal(await page.evaluate(() => soundPreview),null);
    await page.locator('#scene-audio-test').click();
    await page.locator('#scene-form [data-stop-audio]').click();
    assert.equal(await page.evaluate(() => soundPreviewTimer),null);
    const sceneId = await page.evaluate(() => selectedScene.id);

    await page.locator('#view-events').click();
    for (const kind of ['follow','sub','cheer','donation']) {
      await page.locator('#sound-'+kind).selectOption(kind === 'follow' ? 'assets/cue.mp3' : 'assets/cue.mp4');
      await page.locator('#sound-volume-'+kind).fill('25');
    }
    await page.locator('[aria-label="Preview subscriber sound"]').click();
    await page.waitForFunction(() => soundPreview?.currentTime > 0);
    await page.locator('#events-panel [data-stop-audio]').click();
    assert.equal(await page.evaluate(() => soundPreview), null);
    await page.locator('#events-save').click();
    await page.waitForFunction(() => !eventsDirty && state.events.settings.sounds?.donation.volume === 25);
    await page.locator('#view-workspace').click();
    frame = await (await page.locator('#preview').elementHandle()).contentFrame();
    await frame.waitForFunction(() => window.TSS_STUDIO_AUDIO?.alerts.donation.file, null, {timeout:15000});
    await frame.locator('audio[data-studio-audio]').waitFor({state:'detached'});
    for (const kind of ['follow','sub','cheer','donation']) {
      await page.locator('[data-alert='+kind+']').click();
      await frame.waitForFunction(() => document.querySelector('audio[data-studio-audio]')?.currentTime > 0, null, {timeout:15000});
      assert.equal(await frame.locator('audio').evaluate(audio => audio.volume), .25);
      assert.equal(await frame.locator('video').count(), 0);
      if(kind==='donation'){
        await page.locator('#view-scenes').click();
        await page.locator('#scene-form [data-stop-audio]').click();
      }
      await frame.locator('audio').waitFor({state:'detached'});
    }
    await page.locator('#view-scenes').click();
    await page.evaluate(id => selectScene(id), sceneId);
    await page.locator('#scene-vertical').click();
    await page.locator('#vertical-method').selectOption('fit');
    await page.locator('#vertical-form button[type=submit]').click();
    await page.locator('#vertical-dialog').waitFor({state:'hidden'});
    frame = await (await page.locator('#preview').elementHandle()).contentFrame();
    await frame.waitForFunction(() => window.TSS_STUDIO_AUDIO, null, {timeout:15000});
    assert.equal(await frame.locator('audio').count(),0,'portrait preview must stay silent');
    assert.equal(await page.frameLocator('#preview').frameLocator('#portrait-source').locator('audio').count(), 0);
    assert.equal(await page.locator('#scene-audio').isVisible(), true);
    assert.equal(await page.locator('#scene-audio-delay').inputValue(),'1');
    await page.locator('#scene-audio').selectOption('');
    await page.locator('#scene-apply').click();
    await page.waitForFunction(() => !sceneDirty && selectedScene.config.audio === '');
    await page.reload();
    await page.waitForFunction(() => typeof state !== 'undefined' && state && editor);
    await page.locator('#view-events').click();
    assert.equal(await page.locator('#sound-donation').inputValue(), 'assets/cue.mp4');
    assert.equal(await page.locator('#sound-volume-donation').inputValue(), '25');
    // Exercise the published runtime with OBS's documented lifecycle events.
    await page.locator('#view-scenes').click();
    await page.evaluate(id => selectScene(id),sceneId);
    await page.locator('#preview-mode').selectOption('live');
    frame=await (await page.locator('#preview').elementHandle()).contentFrame();
    await frame.goto(frame.url().split('?')[0]);
    await frame.waitForFunction(() => window.TSS_STUDIO_AUDIO, null, {timeout:15000});
    assert.equal(await frame.locator('audio').count(),0,'cached inactive source stays silent');
    await frame.evaluate(() => dispatchEvent(new CustomEvent('obsSourceActiveChanged',{detail:{active:true}})));
    assert.equal(await frame.locator('audio').count(),0,'music must wait for its delay');
    await frame.waitForFunction(() => document.querySelector('audio')?.currentTime > 0,null,{timeout:15000});
    await frame.evaluate(() => {
      window.previousSong=document.querySelector('audio');
      dispatchEvent(new CustomEvent('obsSourceActiveChanged',{detail:{active:false}}));
    });
    assert.equal(await frame.evaluate(() => previousSong.paused),true);
    assert.equal(await frame.locator('audio').count(),0);
    await frame.evaluate(() => dispatchEvent(new CustomEvent('obsSourceActiveChanged',{detail:{active:true}})));
    assert.equal(await frame.locator('audio').count(),0,'music must wait for its delay');
    await frame.waitForFunction(() => document.querySelector('audio')?.currentTime > 0,null,{timeout:15000});
    assert.equal(await frame.evaluate(() => previousSong!==document.querySelector('audio')),true);
    await frame.evaluate(() => dispatchEvent(new CustomEvent('obsSourceActiveChanged',{detail:{active:false}})));
    await page.locator('#scene-audio-delay').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(source,'studio/artifacts/audio-delay.png')});
    console.log('PASS: MP3/MP4 previews, silent Apply/portrait previews, working Stop, all alert sounds, volume and persistence.');
  } finally {
    if (app) { await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(win => win.removeAllListeners('close'))); await app.close(); }
    fs.rmSync(root, {recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error => {console.error(error);process.exitCode=1;});
