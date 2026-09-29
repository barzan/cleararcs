#!/usr/bin/env node
import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {layout,pdf,svg,validateInput,validateScene} from './index.js';

const usage=()=>console.log('Usage:\n  cleararcs render input.json --out output-directory\n  cleararcs check input.json output-directory/layout.json\n  cleararcs --help\n  cleararcs --version');
const failure=(message:string)=>{console.error(`cleararcs: ${message}`);process.exitCode=1;};
const readJson=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
function renderArguments(args:string[]){
 const positionals:string[]=[];let out:string|undefined;
 for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--out'){if(out!==undefined)throw Error('--out may be specified only once');out=args[++i];if(!out||out.startsWith('--'))throw Error('--out requires an output directory');}else if(arg.startsWith('-'))throw Error(`unknown option ${arg}`);else positionals.push(arg);}
 if(positionals.length!==1)throw Error('render requires exactly one input JSON path');if(!out)throw Error('--out is required');return {input:positionals[0],out:resolve(out)};
}
async function destinationMissing(path:string){try{await stat(path);return false;}catch(error:any){if(error?.code==='ENOENT')return true;throw error;}}
async function render(inputPath:string,out:string){
 if(!await destinationMissing(out))throw Error('refusing to overwrite existing output directory');
 const semantic=await readJson(inputPath),result=await layout(semantic);if(!result.ok)throw Error(`${result.error.code}: ${result.error.message}`);
 const image=svg(result.value),document=await pdf(result.value);if(!image.ok)throw Error(`${image.error.code}: ${image.error.message}`);if(!document.ok)throw Error(`${document.error.code}: ${document.error.message}`);
 const stage=`${out}.staging-${process.pid}-${Math.random().toString(16).slice(2)}`;
 let madeStage=false;
 try {
  await mkdir(stage,{recursive:false});madeStage=true;
  await Promise.all([
   writeFile(resolve(stage,'diagram.svg'),image.value),writeFile(resolve(stage,'diagram.pdf'),document.value),
   writeFile(resolve(stage,'layout.json'),JSON.stringify(result.value,null,2)),writeFile(resolve(stage,'report.json'),JSON.stringify(result.report,null,2))
  ]);
  if(!await destinationMissing(out))throw Error('refusing to overwrite existing output directory');
  await rename(stage,out);madeStage=false;
 } finally {if(madeStage)await rm(stage,{recursive:true,force:true});}
}
async function check(inputPath:string,scenePath:string){
 const input=validateInput(await readJson(inputPath));if(!input.ok)throw Error(`${input.error.code}: ${input.error.message}`);
 const checked=validateScene(await readJson(scenePath),input.value);if(!checked.ok)throw Error(`${checked.error.code}: ${checked.error.message}`);
 console.log(JSON.stringify(checked.report));
}
async function main(){
 const args=process.argv.slice(2);
 if(!args.length||args[0]==='--help'||args[0]==='-h'){usage();return;}
 if(args[0]==='--version'){console.log(process.env.npm_package_version??'0.1.0-beta.1');return;}
 if(args[0]==='render'){const {input,out}=renderArguments(args.slice(1));await render(input,out);return;}
 if(args[0]==='check'){if(args.length!==3||args.slice(1).some(arg=>arg.startsWith('-')))throw Error('check requires input JSON and layout JSON paths');await check(args[1],args[2]);return;}
 throw Error(`unknown command ${args[0]}`);
}
main().catch(error=>failure(error instanceof Error?error.message:String(error)));
