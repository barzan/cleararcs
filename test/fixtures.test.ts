import test from 'node:test'; import assert from 'node:assert/strict';
import {layout,svg} from '../src/index.js';
const ns=(...ids:string[])=>ids.map(id=>({id,title:id}));const es=(pairs:[string,string,string?][])=>pairs.map(([source,target,label],i)=>({id:`e${i}`,source,target,label}));
const cases=[
 ['single-chain',{version:1 as const,nodes:ns('A','B','C'),edges:es([['A','B'],['B','C']])}],
 ['fork',{version:1 as const,nodes:ns('A','B','C'),edges:es([['A','B'],['A','C']])}],
 ['join',{version:1 as const,nodes:ns('A','B','C'),edges:es([['A','C'],['B','C']])}],
 ['diamond',{version:1 as const,nodes:ns('A','B','C','D'),edges:es([['A','B'],['A','C'],['B','D'],['C','D']])}],
 ['cycles',{version:1 as const,nodes:ns('A','B','C'),edges:es([['A','B'],['B','C'],['C','A']])}],
 ['opposite',{version:1 as const,nodes:ns('A','B'),edges:es([['A','B'],['B','A']])}],
 ['parallel',{version:1 as const,nodes:ns('A','B'),edges:es([['A','B','one'],['A','B','two'],['A','B','three']])}],
 ['self-loop',{version:1 as const,nodes:ns('A'),edges:es([['A','A','loop']])}],
 ['disconnected',{version:1 as const,nodes:ns('A','B','C','D'),edges:es([['A','B'],['C','D']])}],
 ['fan',{version:1 as const,nodes:ns('A','B','C','D','E','F','G','H','I'),edges:es([['A','B'],['A','C'],['A','D'],['A','E'],['B','I'],['C','I'],['D','I'],['E','I']])}],
 ['multiline',{version:1 as const,direction:'TB' as const,nodes:[{id:'A',title:'A long title',body:'first\nsecond'},{id:'B',title:'Unequal'}],edges:es([['A','B','a long edge label']])}],
 ['research',{version:1 as const,nodes:ns('Project','Develop','Funding','Budget','Running','Review','Portfolio','Revision','Validate','Writing','Paused','Failed'),edges:es([['Project','Develop','create'],['Project','Funding','grant'],['Funding','Budget','approve'],['Develop','Budget','develop'],['Budget','Running','approve'],['Running','Review','complete'],['Review','Portfolio','result'],['Portfolio','Writing','choose'],['Portfolio','Revision','feedback'],['Revision','Budget','approve revision'],['Portfolio','Validate','validate selected'],['Validate','Portfolio','findings'],['Running','Paused','pause'],['Running','Failed','error'],['Validate','Paused','pause validation'],['Validate','Failed','validation error'],['Paused','Budget','continue'],['Failed','Budget','retry'],['Review','Develop','revise'],['Revision','Portfolio','cancel'],['Budget','Develop','cancel'],['Portfolio','Review','return to review']])}]
] as const;
for(const [name,input] of cases)test(`fixture ${name} renders valid SVG`,async()=>{const r=await layout(input);assert.equal(r.ok,true, r.ok?'':r.error.message);if(r.ok){const out=svg(r.value);assert.equal(out.ok,true);if(out.ok)assert.match(out.value,/<svg /)}});
