import test from 'node:test';
import assert from 'node:assert/strict';
import {layout,svg,validateInput,validateScene} from '../src/index.js';

const graph=(nodes:number,edges:number)=>({version:1,nodes:Array.from({length:nodes},(_,i)=>({id:`n${i}`,title:`Node ${i}`})),edges:Array.from({length:edges},(_,i)=>({id:`e${i}`,source:`n${i%nodes}`,target:`n${(i+1)%nodes}`}))});

test('default capacity remains 30 nodes and 60 edges',()=>{
 assert.equal(validateInput(graph(30,60)).ok,true);
 for(const input of [graph(31,0),graph(2,61)]){const result=validateInput(input);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'UNSUPPORTED');}
});
test('extended capacity is explicit and bounded at 60 nodes and 120 edges',()=>{
 assert.equal(validateInput({...graph(60,120),capacity:'extended'}).ok,true);
 for(const input of [graph(61,0),graph(2,121)]){const result=validateInput({...input,capacity:'extended'});assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'UNSUPPORTED');}
 for(const capacity of ['standard','unlimited',true,120,null])assert.equal(validateInput({...graph(2,1),capacity}).ok,false);
});
test('extended capacity retains semantic validation',()=>{
 const input={...graph(60,120),capacity:'extended'};
 input.edges[119].target='missing';
 const result=validateInput(input);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'INVALID_INPUT');
});
test('60-node extended chain passes normal geometry validation and SVG export',async()=>{
 const result=await layout({...graph(60,59),capacity:'extended'},10000);
 assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)return;
 assert.equal(result.value.nodes.length,60);assert.equal(result.value.edges.length,59);
 assert.equal(result.value.source.capacity,'extended');
 assert.equal(validateScene(result.value).ok,true);assert.equal(svg(result.value).ok,true);
});
