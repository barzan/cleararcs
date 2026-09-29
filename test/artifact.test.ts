import test from 'node:test'; import assert from 'node:assert/strict';
import {layout,svg} from '../src/index.js'; import {independentSvgErrors,Semantic} from './svg-checker.js';
const one:Semantic={nodes:[{id:'a',title:'Alpha'},{id:'b',title:'Beta'}],edges:[{id:'e',source:'a',target:'b',label:'edge label'}]};
const multi:Semantic={nodes:[{id:'a',title:'Alpha'},{id:'b',title:'Beta'},{id:'c',title:'Gamma'}],edges:[{id:'e0',source:'a',target:'b',label:'first'},{id:'e1',source:'a',target:'c',label:'second'}]};
async function emitted(source:Semantic){const result=await layout({version:1,...source});assert.equal(result.ok,true);if(!result.ok)throw new Error('layout failed');const rendered=svg(result.value);assert.equal(rendered.ok,true);if(!rendered.ok)throw new Error('render failed');return rendered.value;}
const errors=(document:string,source:Semantic,reason:RegExp)=>assert.match(independentSvgErrors(document,source).join('\n'),reason);
const points=(document:string,id:string)=>new RegExp(`<g data-edge-id="${id}">[\\s\\S]*?<polyline [^>]*points="([^"]+)"`).exec(document)?.[1]??'';

test('independent SVG checker accepts a valid emitted multi-edge artifact',async()=>assert.deepEqual(independentSvgErrors(await emitted(multi),multi),[]));
test('independent SVG checker accepts visual renderer output',async()=>{const result=await layout({version:1,...one,theme:{visual:true}});assert.equal(result.ok,true);if(!result.ok)return;const rendered=svg(result.value);assert.equal(rendered.ok,true);if(rendered.ok)assert.deepEqual(independentSvgErrors(rendered.value,one),[]);});
test('independent SVG checker catches endpoint, arrow, label, and missing-edge corruption',async()=>{
  const document=await emitted(one);
  errors(document.replace(/(<polyline [^>]*points=")[^"]+/, '$10,0 1,0'),one,/endpoint/);
  errors(document.replace(/(<polygon points=")[^ ]+/, '$10,0'),one,/arrow/);
  errors(document.replace('data-edge-label="e"','data-edge-label="gone"'),one,/label/);
  errors(document.replace(/<g data-edge-id="e">[\s\S]*?(?=<g data-node-id)/,''),one,/missing/);
});
test('independent SVG checker catches malformed, clipped, and node-crossing connectors',async()=>{
  const document=await emitted(multi);
  errors(document.replace(/(<polyline [^>]*points=")[^"]+/, '$10,0 7,9'),multi,/segment/);
  errors(document.replace(/(<polyline [^>]*points=")[^"]+/, '$10,0 0,0'),multi,/segment/);
  errors(document.replace(/(<polyline [^>]*points=")[^"]+/, '$1-1,0 1,0'),multi,/segment/);
  const c=/<g data-node-id="c"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/.exec(document)!;
  const y=Number(c[2])+Number(c[4])/2;
  errors(document.replace(/(<g data-edge-id="e0">[\s\S]*?<polyline [^>]*points=")[^"]+/,(_,prefix)=>`${prefix}0,${y} 1000,${y}`),multi,/node/);
});
test('independent SVG checker catches positive-length near-parallel edge overlap',async()=>{
  const document=await emitted(multi), shared=points(document,'e0');
  assert.ok(shared);
  errors(document.replace(/(<g data-edge-id="e1">[\s\S]*?<polyline [^>]*points=")[^"]+/,`$1${shared}`),multi,/edge overlap/);
});
