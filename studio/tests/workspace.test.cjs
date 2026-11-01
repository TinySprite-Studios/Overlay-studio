const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {resolveFile,list}=require('../workspace.cjs');
test('workspace confines files, excludes internal folders, and permits nested assets',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tss-workspace-'));
  try {
    fs.mkdirSync(path.join(root,'assets'));fs.mkdirSync(path.join(root,'node_modules'));
    fs.writeFileSync(path.join(root,'config.js'),'hello');fs.writeFileSync(path.join(root,'assets','logo.svg'),'<svg/>');
    fs.writeFileSync(path.join(root,'node_modules','private.js'),'hidden');
    assert.equal(resolveFile(root,'config.js'),path.join(root,'config.js'));
    assert.equal(resolveFile(root,'new.html'),path.join(root,'new.html'));
    for(const bad of ['../outside.js','assets/../../outside.js','node_modules/private.js','.secret'])assert.throws(()=>resolveFile(root,bad));
    assert.deepEqual(list(root).map(f=>f.name).sort(),['assets','assets/logo.svg','config.js']);
    assert.equal(list(root).find(f=>f.name==='assets').type,'directory');
    assert.equal(resolveFile(root,'new/deep/file.html'),path.join(root,'new/deep/file.html'));
    for(const bad of ['assets/file:stream.js','CON.txt','a/','a/../b','a/file.'])assert.throws(()=>resolveFile(root,bad));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
