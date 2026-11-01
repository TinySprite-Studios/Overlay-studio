const fs=require('node:fs');
const path=require('node:path');
const {list,resolveFile}=require('./workspace.cjs');
// Keep the original canvas and its settings independent of the portrait wrapper.
function wrap(root,copy,source,method){
 const dir=path.join(root,'scenes',copy.id),prefix='scenes/'+copy.id+'/';
 const originalConfig=fs.readFileSync(resolveFile(root,'scenes/'+source.id+'/config.js'));
 const originalManifest=fs.readFileSync(resolveFile(root,'scenes/'+source.id+'/scene.json'));
 for(const name of ['portrait-source.html','portrait-source-config.js','portrait-source-scene.json','portrait-layout.js']){
  if(fs.existsSync(path.join(dir,name)))throw Error('This scene already contains a portrait wrapper. Use the original scene to create another version.');
 }
 for(const file of list(root).filter(f=>f.type==='file'&&f.name.startsWith(prefix)&&/\.(html|js|mjs|css)$/.test(f.name))){
  if(file.name===prefix+'config.js')continue;
  const target=resolveFile(root,file.name);
  const text=fs.readFileSync(target,'utf8').replace(/(["'`])(?:\.\/)?config\.js\1/g,'$1portrait-source-config.js$1').replace(/(["'`])(?:\.\/)?scene\.json\1/g,'$1portrait-source-scene.json$1');
  fs.writeFileSync(target,text);
 }
 fs.renameSync(path.join(dir,'index.html'),path.join(dir,'portrait-source.html'));
 fs.writeFileSync(path.join(dir,'portrait-source-config.js'),originalConfig);
 fs.writeFileSync(path.join(dir,'portrait-source-scene.json'),originalManifest);
 const [width,height]=source.config.layout==='vertical'?[1080,1920]:[1920,1080];
 fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portrait scene</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}iframe{position:absolute;border:0;transform-origin:top left}</style></head><body><iframe id="portrait-source" src="portrait-source.html" title="Original scene" sandbox="allow-scripts allow-same-origin"></iframe><script src="portrait-layout.js"></script></body></html>');
 fs.writeFileSync(path.join(dir,'portrait-layout.js'),`(() => {const frame=document.getElementById('portrait-source');function resize(){const scale=Math.${method==='fill'?'max':'min'}(innerWidth/${width},innerHeight/${height});Object.assign(frame.style,{width:'${width}px',height:'${height}px',left:(innerWidth-${width}*scale)/2+'px',top:(innerHeight-${height}*scale)/2+'px',transform:'scale('+scale+')'});}addEventListener('resize',resize);resize();})();\n`);
}
module.exports={wrap};
