import test from 'node:test'; import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises'; import {layout,svg} from '../src/index.js';

test('scored label placement wraps, rotates, and avoids other labels in a crowded graph',async()=>{
 const input={version:1 as const,direction:'LR' as const,nodes:[{id:'a',title:'A'},{id:'b',title:'B'},{id:'c',title:'C'}],edges:[{id:'one',source:'a',target:'b',label:'A deliberately long label that wraps across readable lines',labelPlacement:'vertical' as const},{id:'two',source:'a',target:'c',label:'A second deliberately long label that must not cover the first'}]};
 const result=await layout(input);assert.equal(result.ok,true);if(!result.ok)return;
 const first=result.value.edges.find(edge=>edge.id==='one')!;assert.equal(first.labelAngle,90);assert.ok((first.labelLines?.length??0)>1);
 const labels=result.value.edges.map(edge=>edge.labelBox!).filter(Boolean);assert.equal(labels.length,2);assert.ok(labels[0].x+labels[0].width<=labels[1].x||labels[1].x+labels[1].width<=labels[0].x||labels[0].y+labels[0].height<=labels[1].y||labels[1].y+labels[1].height<=labels[0].y);
 const rendered=svg(result.value);assert.equal(rendered.ok,true);if(rendered.ok)assert.match(rendered.value,/data-label-angle="90"/);
});

test('semantic edge classes use the small configurable palette and optional dashes',async()=>{
 const result=await layout({version:1,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'e',source:'a',target:'b',label:'return',semanticClass:'secondary',style:'dashed'}],theme:{palette:{secondary:'#345678'}}});assert.equal(result.ok,true);if(!result.ok)return;
 const rendered=svg(result.value);assert.equal(rendered.ok,true);if(rendered.ok){assert.match(rendered.value,/data-edge-class="secondary"/);assert.match(rendered.value,/stroke="#345678"/);assert.match(rendered.value,/stroke-dasharray="4 3"/);}
});

test('crossing bridges are emitted only when explicitly enabled for real orthogonal crossings',async()=>{
 const input=JSON.parse(await readFile('examples/complex-workflow.json','utf8'));input.theme={crossingBridges:true};delete input.page;delete input.layoutGoal;const result=await layout(input);assert.equal(result.ok,true);if(!result.ok)return;assert.ok(result.report.crossings>0);
 const rendered=svg(result.value);assert.equal(rendered.ok,true);if(rendered.ok)assert.match(rendered.value,/data-crossing-bridge="true"/);
});
