import test from 'node:test';
import assert from 'node:assert/strict';
import {layout, pdf, svg, validateInput, validateScene} from '../src/index.js';
import type {Scene} from '../src/types.js';

const labeled={version:1 as const,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'e',source:'a',target:'b',label:'visible label'}]};
test('every declared edge label is measured, placed, and rendered', async()=>{
 const r=await layout(labeled); assert.equal(r.ok,true); if(!r.ok)return;
 assert.deepEqual(r.value.ports.map(p=>p.id).sort(),['e:source','e:target']);
 assert.ok(r.value.edges[0].labelBox,'label needs bounds');
 const out=svg(r.value); assert.equal(out.ok,true); if(out.ok)assert.match(out.value,/<g data-edge-label="e"[^>]*>\s*<path /);
});
test('PDF contains the edge-label glyph outlines', async()=>{
 const withLabel=await layout(labeled); const withoutLabel=await layout({...labeled,edges:[{id:'e',source:'a',target:'b'}]});
 assert.equal(withLabel.ok,true);assert.equal(withoutLabel.ok,true);if(!withLabel.ok||!withoutLabel.ok)return;
 const rendered=await pdf(withLabel.value), control=await pdf(withoutLabel.value);
 assert.equal(rendered.ok,true);assert.equal(control.ok,true);if(!rendered.ok||!control.ok)return;
 assert.ok(rendered.value.length>control.value.length,'label glyph paths must add PDF content');
 assert.match(rendered.value.toString('latin1'),/ cm\n/,'PDF must contain transformed outline paths');
});
test('rejects endpoint aligned with a box side but outside that side span',()=>{
 const scene:Scene={version:1,source:labeled,canvas:{x:0,y:0,width:200,height:100},nodes:[{id:'a',title:'A',box:{x:20,y:20,width:30,height:20}},{id:'b',title:'B',box:{x:120,y:20,width:30,height:20}}],ports:[{id:'e:source',nodeId:'a',side:'WEST',point:{x:20,y:90}},{id:'e:target',nodeId:'b',side:'WEST',point:{x:120,y:90}}],edges:[{id:'e',source:'a',target:'b',points:[{x:20,y:90},{x:120,y:90}],arrowhead:[{x:120,y:90},{x:113,y:87},{x:113,y:93}]}],provenance:{engine:'test',candidate:0}};
 assert.equal(validateScene(scene).ok,false);
});
test('supplied scene cannot alter original edge semantics',()=>{
 const scene:Scene={version:1,source:labeled,canvas:{x:0,y:0,width:200,height:100},nodes:[{id:'a',title:'changed',box:{x:20,y:20,width:30,height:20}},{id:'b',title:'B',box:{x:120,y:20,width:30,height:20}}],ports:[],edges:[],provenance:{engine:'test',candidate:0}};
 assert.equal(validateScene(scene).ok,false);
});
test('timeout terminates layout worker and later calls recover', async()=>{
 const timed=await layout(labeled,0);assert.equal(timed.ok,false);if(!timed.ok)assert.equal(timed.error.code,'TIMEOUT');
 const recovered=await layout(labeled,5000);assert.equal(recovered.ok,true);
});
test('rejects source re-entry and target outward direction', async()=>{
 const r=await layout(labeled);assert.equal(r.ok,true);if(!r.ok)return;
 const bad=structuredClone(r.value);bad.edges[0].points.splice(1,0,{x:bad.edges[0].points[0].x-10,y:bad.edges[0].points[0].y});
 const checked=validateScene(bad);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'direction');
});
test('rejects a floating or reversed target arrowhead', async()=>{
 const r=await layout(labeled);assert.equal(r.ok,true);if(!r.ok)return;const bad=structuredClone(r.value);bad.edges[0].arrowhead[0]={...bad.edges[0].arrowhead[0],x:bad.edges[0].arrowhead[0].x-2};
 const checked=validateScene(bad);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'arrowhead');
});
test('rejects unsupported glyphs before layout',()=>{
 const r=validateInput({version:1,nodes:[{id:'a',title:'emoji 😀'}],edges:[]});assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,'UNSUPPORTED');
});
test('rejects malformed body as invalid input',()=>{
 const r=validateInput({version:1,nodes:[{id:'a',title:'A',body:4}],edges:[]});assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,'INVALID_INPUT');
});
test('rejects a deliberately detached label with label-association diagnostic',async()=>{
 const r=await layout(labeled);assert.equal(r.ok,true);if(!r.ok)return;const bad=structuredClone(r.value);const box=bad.nodes.find(n=>n.id==='a')!.box;
 bad.edges[0].labelBox={x:box.x+2,y:box.y+2,width:20,height:12};
 const checked=validateScene(bad);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'label-association');
});
test('fails explicitly when requested physical canvas is impossible',async()=>{
 const r=await layout({...labeled,maxWidth:10,maxHeight:10});assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,'NO_VALID_LAYOUT');
});
test('honors explicit port-side constraints in LR and TB layouts',async()=>{
 for(const direction of ['LR','TB'] as const){const r=await layout({version:1,direction,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'e',source:'a',target:'b',sourceSide:'SOUTH',targetSide:'NORTH'}]});assert.equal(r.ok,true);if(r.ok)assert.deepEqual(r.value.ports.map(p=>p.side).sort(),['NORTH','SOUTH']);}
});
test('successful layout geometry and SVG are reproducible',async()=>{
 const a=await layout(labeled),b=await layout(labeled);assert.equal(a.ok,true);assert.equal(b.ok,true);if(!a.ok||!b.ok)return;
 assert.equal(JSON.stringify(a.value),JSON.stringify(b.value));const sa=svg(a.value),sb=svg(b.value);assert.equal(sa.ok,true);assert.equal(sb.ok,true);if(sa.ok&&sb.ok)assert.equal(sa.value,sb.value);
});
test('rejects unknown nested node and edge fields',()=>{
 for(const input of [{version:1,nodes:[{id:'a',title:'A',extra:true}],edges:[]},{version:1,nodes:[{id:'a',title:'A'}],edges:[{id:'e',source:'a',target:'a',extra:true}]}]){const r=validateInput(input);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,'INVALID_INPUT');}
});
test('concurrent layout workers remain independent',async()=>{
 const results=await Promise.all(Array.from({length:6},()=>layout(labeled)));assert.ok(results.every(r=>r.ok));
});

test('per-node stroke width is validated and rendered in SVG/PDF',async()=>{const input={version:1 as const,nodes:[{id:'show',title:'Showcase',strokeWidth:4},{id:'dest',title:'Destination'}],edges:[{id:'go',source:'show',target:'dest',label:'open'}]};const r=await layout(input);assert.equal(r.ok,true);if(!r.ok)return;assert.equal(r.value.nodes.find(n=>n.id==='show')!.strokeWidth,4);const image=svg(r.value);assert.equal(image.ok,true);if(image.ok)assert.match(image.value,/<g data-node-id="show"><rect[^>]*stroke-width="4"/);const document=await pdf(r.value);assert.equal(document.ok,true);assert.equal(validateInput({...input,nodes:[{id:'bad',title:'Bad',strokeWidth:9}]}).ok,false);});
