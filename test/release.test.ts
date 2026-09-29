import test from 'node:test'; import assert from 'node:assert/strict';
import {layout,pdf,svg} from '../src/index.js';
test('release smoke: shared scene exports SVG and PDF',async()=>{
 const r=await layout({version:1,nodes:[{id:'a',title:'Release'},{id:'b',title:'Check'}],edges:[{id:'e',source:'a',target:'b',label:'verify'}]});assert.equal(r.ok,true);if(!r.ok)return;
 const s=svg(r.value),p=await pdf(r.value);assert.equal(s.ok,true);assert.equal(p.ok,true);if(p.ok)assert.ok(p.value.length>100);
});
