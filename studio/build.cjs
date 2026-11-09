const {spawnSync}=require('node:child_process');
const path=require('node:path');
const pkg=require('../package.json');
const repository=process.env.GITHUB_REPOSITORY || pkg.repository?.url?.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/)?.[1];
const args=[require.resolve('electron-builder/cli.js'),'--win','nsis','--x64','--publish','never'];
if(repository){
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))throw Error('GITHUB_REPOSITORY must be owner/repository.');
  const [owner,repo]=repository.split('/');
  args.push('-c.publish.provider=github','-c.publish.owner='+owner,'-c.publish.repo='+repo);
}else console.warn('No GitHub repository configured. This local build will not receive automatic updates.');
const result=spawnSync(process.execPath,args,{cwd:path.join(__dirname,'..'),stdio:'inherit',env:{...process.env,ELECTRON_BUILDER_COMPRESSION_LEVEL:'3'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
