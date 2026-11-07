const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createProject}=require('../project.cjs');
const {create,defaults}=require('../scenes.cjs');
(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-scene-settings-'));
  createProject(root);
  const folder=path.join(root,'scenes/tss_break');fs.mkdirSync(folder);
  const fields=[
    {key:'heading',label:'BRB Message',type:'text',default:"I'LL BE RIGHT BACK"},
    {key:'accent',label:'Glow Colour',type:'color',default:'#ff2d4d'},
    {key:'embers',label:'Animate Embers',type:'boolean',default:true},
    ...['facebook','youtube','twitter'].flatMap(platform=>[
      {key:platform+'Handle',label:platform+' handle',type:'text',default:'@streamer'},
      {key:platform+'Icon',label:'Show '+platform[0].toUpperCase()+platform.slice(1)+' Icon',type:'boolean',default:true},
      {key:platform+'Label',label:'Show '+platform[0].toUpperCase()+platform.slice(1)+' Label',type:'boolean',default:false}
    ]),
    {key:'duration',label:'Duration',type:'number',min:1,default:5,group:'advanced',required:true}
  ];
  fs.writeFileSync(path.join(folder,'scene.json'),JSON.stringify({type:'custom',name:'Be Right Back',fields,values:{}}));
  fs.writeFileSync(path.join(folder,'index.html'),'<html><head></head><body>Be Right Back</body></html>');
  const standard=create(root,defaults('starting'));
  let app;
  try {
    const env={...process.env,TSS_STUDIO_TEST_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
    app=await electron.launch({args:[path.join(__dirname,'../..')],env});
    const page=await app.firstWindow();page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    await page.locator('#view-scenes').click();await page.evaluate(()=>selectScene('tss_break'));
    const category=name=>page.locator('#scene-settings-nav').getByRole('button',{name,exact:true});
    assert.deepEqual(await page.locator('#scene-settings-nav button').allTextContents(),['General','Socials','Advanced']);
    assert.equal(await category('General').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-setting=facebookIcon]').isVisible(),true);
    assert.equal(await page.locator('[data-setting=facebookHandle]').isVisible(),false);
    assert.equal(await page.locator('[data-setting=embers]').getAttribute('role'),'switch');
    assert.equal(await page.locator('.scene-colour-control output').last().textContent(),'#FF2D4D');
    await page.locator('[data-setting=heading]').fill('Back shortly');
    await page.locator('[data-setting=facebookLabel]').check();
    await category('Socials').click();await page.locator('[data-setting=facebookHandle]').fill('@newhandle');
    await category('General').click();await page.locator('[data-setting=twitterIcon]').uncheck();
    assert.equal(await page.locator('[data-setting=facebookLabel]').isChecked(),true);
    await category('Advanced').click();await page.locator('[data-setting=duration]').fill('0');
    await category('General').click();await page.locator('#scene-apply').click();
    assert.equal(await category('Advanced').getAttribute('aria-pressed'),'true','invalid field category is revealed');
    await page.locator('[data-setting=duration]').fill('8');await page.locator('#scene-apply').click();
    await page.waitForFunction(()=>!sceneDirty&&selectedScene.config.values.duration===8);
    const saved=JSON.parse(fs.readFileSync(path.join(folder,'scene.json'),'utf8')).values;
    assert.equal(saved.heading,'Back shortly');assert.equal(saved.facebookHandle,'@newhandle');
    assert.equal(saved.twitterIcon,false);assert.equal(saved.facebookLabel,true);
    await category('General').click();
    fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
    await page.locator('.scene-inspector').screenshot({path:path.join(__dirname,'../artifacts/scene-settings.png')});
    await page.setViewportSize({width:1100,height:740});
    await category('Socials').click();
    assert.equal(await page.locator('.scene-inspector').evaluate(element=>element.scrollWidth<=element.clientWidth),true);
    assert.equal(await page.locator('#scene-settings-content').evaluate(element=>element.scrollWidth<=element.clientWidth),true);
    await page.evaluate(id=>selectScene(id),standard.id);
    await category('Advanced').click();assert.equal(await page.locator('#scene-audio').isVisible(),true);
    await page.locator('[name=countdown]').fill('60');await category('General').click();
    await page.locator('[name=title]').fill('Starting shortly');await page.locator('#scene-apply').click();
    await page.waitForFunction(()=>!sceneDirty&&selectedScene.config.countdown===60);
    await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state&&editor);
    await page.locator('#view-scenes').click();await page.evaluate(()=>selectScene('tss_break'));
    await category('Socials').click();assert.equal(await page.locator('[data-setting=facebookHandle]').inputValue(),'@newhandle');
    assert.deepEqual(errors,[]);
    console.log('PASS: scene categories, switches, colour readout, cross-category saves, validation, persistence and narrow layout.');
  } finally {
    if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(win=>win.removeAllListeners('close')));await app.close();}
    fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
