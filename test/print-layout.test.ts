import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {layout,svg,validateScene} from '../src/index.js';

const example=JSON.parse(await readFile(new URL('examples/paper-architecture.json',`file://${process.cwd()}/`),'utf8'));

test('Letter landscape fit-page resolves structured rows, references, compact labels, legend, and print metrics',async()=>{
 const r=await layout(example);assert.equal(r.ok,true);if(!r.ok)return;
 assert.equal(validateScene(r.value).ok,true);
 assert.ok(r.value.print);assert.ok(r.value.print!.effectiveBodyFontSize>=9);assert.ok(r.value.print!.effectiveMinStrokeWidth>=.5);
 const ready=r.value.nodes.find(n=>n.id==='ingest')!;assert.equal(ready.resolvedRows?.length,2);assert.ok(ready.resolvedRows!.every(x=>x.bounds.width>0&&x.bounds.height>0));
 const edge=r.value.edges.find(e=>e.id==='capture')!;assert.match(edge.label!,/calibrated spectra/);
 assert.ok(r.value.legend?.roles.some(x=>x.role==='condition'));assert.equal(svg(r.value).ok,true);
});

test('print infeasibility reports achieved font, stroke, and minimum page',async()=>{
 const tiny=structuredClone(example);tiny.page={width:120,height:90,margin:20,minBodyFontSize:9,minStrokeWidth:.5};
 const r=await layout(tiny);assert.equal(r.ok,false);if(r.ok)return;assert.equal(r.error.rule,'print-fit');assert.ok(r.report.print);assert.match(r.error.message,/requires at least .* pt; achieved body .* pt, label .* pt, and stroke/);
});

test('overview mode remains zoomable without page constraints',async()=>{
 const d=structuredClone(example);delete d.page;delete d.layoutGoal;const r=await layout(d);assert.equal(r.ok,true);if(r.ok)assert.equal(r.value.print,undefined);
});

test('renderer-neutral scene rejects structured semantic mutation',async()=>{
 const r=await layout(example);assert.equal(r.ok,true);if(!r.ok)return;const changed=structuredClone(r.value);changed.nodes[0].resolvedRows![0].text='changed';assert.equal(validateScene(changed).ok,false);
});
