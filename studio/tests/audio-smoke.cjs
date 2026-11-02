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
    await page.locator('#scene-apply').click();
    await page.waitForFunction(() => selectedScene.config.audio === 'assets/cue.mp3' && !sceneDirty);
    let frame = await (await page.locator('#preview').elementHandle()).contentFrame();
    await frame.waitForFunction(() => document.querySelector('audio[data-studio-audio]')?.currentTime > 0, null, {timeout:15000});
    assert.equal(await frame.locator('audio').evaluate(audio => audio.volume), .35);
    await frame.locator('audio[data-studio-audio]').waitFor({state:'detached'});
    assert.equal(await frame.locator('audio').count(), 0);
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
      await frame.locator('audio').waitFor({state:'detached'});
    }
    await page.locator('#view-scenes').click();
    await page.evaluate(id => selectScene(id), sceneId);
    await page.locator('#scene-vertical').click();
    await page.locator('#vertical-method').selectOption('fit');
    await page.locator('#vertical-form button[type=submit]').click();
    await page.locator('#vertical-dialog').waitFor({state:'hidden'});
    frame = await (await page.locator('#preview').elementHandle()).contentFrame();
    await frame.waitForFunction(() => document.querySelector('audio')?.currentTime > 0, null, {timeout:15000});
    assert.equal(await page.frameLocator('#preview').frameLocator('#portrait-source').locator('audio').count(), 0);
    assert.equal(await page.locator('#scene-audio').isVisible(), true);
    await page.locator('#scene-audio').selectOption('');
    await page.locator('#scene-apply').click();
    await page.waitForFunction(() => !sceneDirty && selectedScene.config.audio === '');
    await page.reload();
    await page.waitForFunction(() => typeof state !== 'undefined' && state && editor);
    await page.locator('#view-events').click();
    assert.equal(await page.locator('#sound-donation').inputValue(), 'assets/cue.mp4');
    assert.equal(await page.locator('#sound-volume-donation').inputValue(), '25');
    await page.screenshot({path:path.join(source,'studio/artifacts/audio-events.png')});
    console.log('PASS: imported MP3/MP4 decode, scene cue, all four alert sounds, volume, stop, persistence, and portrait playback without doubling.');
  } finally {
    if (app) { await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(win => win.removeAllListeners('close'))); await app.close(); }
    fs.rmSync(root, {recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error => {console.error(error);process.exitCode=1;});
