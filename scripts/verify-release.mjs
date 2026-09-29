import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const run=(command,args,cwd)=>{
  const result=spawnSync(command,args,{cwd,encoding:'utf8'});
  if(result.status!==0) throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
};
const exists=async path=>stat(path).then(()=>true,()=>false);
const workspace=await mkdtemp(join(tmpdir(),'cleararcs-release-'));
try {
  const packed=JSON.parse(run('npm',['pack','--json','--pack-destination',workspace],root));
  assert.equal(packed.length,1,'npm pack must produce one tarball');
  const tarball=join(workspace,packed[0].filename);
  assert.ok(await exists(tarball),'npm pack tarball is missing');
  const consumer=join(workspace,'fresh consumer with spaces');
  await mkdir(consumer,{recursive:true});
  await writeFile(join(consumer,'package.json'),JSON.stringify({name:'fresh-consumer',private:true,type:'module'}));
  run('npm',['install','--ignore-scripts','--no-audit','--no-fund',tarball],consumer);
  const installed=join(consumer,'node_modules','@barzan','cleararcs');
  assert.ok(await exists(join(installed,'assets','IBMPlexSans.ttf')),'packaged font missing');
  assert.ok(await exists(join(installed,'dist','src','elk-worker.js')),'packaged worker missing');
  run(process.execPath,['--input-type=module','--eval',"import {layout,svg,pdf} from '@barzan/cleararcs'; const r=await layout({version:1,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'e',source:'a',target:'b',label:'go'}]}); if(!r.ok)throw Error(r.error.message); const s=svg(r.value),p=await pdf(r.value); if(!s.ok||!p.ok||p.value.length<100)throw Error('installed API render failed');"],consumer);
  for(const name of ['basic-routing','continuation','paper-architecture','complex-workflow']){
    const input=join(installed,'examples',`${name}.json`),out=join(consumer,`${name} output`);
    run('npm',['exec','--no','--','cleararcs','render',input,'--out',out],consumer);
    for(const file of ['diagram.svg','diagram.pdf','layout.json','report.json']) assert.ok(await exists(join(out,file)),`installed CLI did not write ${file}`);
    run('npm',['exec','--no','--','cleararcs','check',input,join(out,'layout.json')],consumer);
    assert.ok((await readFile(join(out,'diagram.pdf'))).length>100,'installed CLI PDF is empty');
  }
  console.log(`clean consumer passed: ${basename(tarball)}`);
} finally { await rm(workspace,{recursive:true,force:true}); }
