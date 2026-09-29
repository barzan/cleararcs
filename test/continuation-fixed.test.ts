import test from 'node:test';
import assert from 'node:assert/strict';
import {layout,validateScene} from '../src/index.js';
import {Diagram} from '../src/types.js';

function sixFlows(visual=false):Diagram {
 const nodes:any[]=[{id:'budget',title:'Budget approval',kind:'dialog',rows:[{role:'shown',text:'Review the requested work and cost.'},{role:'cta',text:'Approve',enabled:true}]}];
 const edges:any[]=[],continuations:any[]=[];
 for(let i=0;i<6;i++){
  nodes.push({id:`caller${i}`,title:`Caller ${i}`},{id:`result${i}`,title:`Result ${i}`});
  edges.push({id:`in${i}`,source:`caller${i}`,target:'budget'},{id:`out${i}`,source:'budget',target:`result${i}`});
  continuations.push({incomingEdge:`in${i}`,outgoingEdge:`out${i}`,throughNode:'budget'});
 }
 return {version:1,direction:'LR',theme:{visual,colorMode:'proximity'},nodes,edges,continuations};
}

for(const visual of [false,true])test(`six dialog contexts route through distinct preallocated lanes (visual=${visual})`,async()=>{
 const result=await layout(sixFlows(visual));
 assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)return;
 const scene=result.value,tracks=scene.continuations!;
 if(visual)assert.equal(scene.nodes.find(n=>n.id==='budget')!.box.width,365,'horizontal internal tracks must not add an unused width reserve');
 assert.equal(tracks.length,6);
 assert.equal(new Set(tracks.map(t=>t.entry.y)).size,6);
 for(const t of tracks){
  assert.equal(t.entry.y,t.exit.y);
  assert.equal(t.points.length,2);
  assert.deepEqual(scene.edges.find(e=>e.id===t.incomingEdge)!.points.at(-1),t.entry);
  assert.deepEqual(scene.edges.find(e=>e.id===t.outgoingEdge)!.points[0],t.exit);
 }
 assert.equal(validateScene(scene).ok,true);
});

test('measured visual continuation candidate reserves height for multiline flow labels',async()=>{
 const input=sixFlows(true);
 input.theme={...input.theme,labelWidth:120};
 for(const edge of input.edges)edge.label='Approve request with confirmed inputs and available budget';
 const result=await layout(input,10000,6);
 assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)return;
 const tracks=result.value.continuations!.sort((a,b)=>a.entry.y-b.entry.y);
 for(let i=1;i<tracks.length;i++)assert.ok(tracks[i].entry.y-tracks[i-1].entry.y>=40,'multiline labels require more than the compact twelve-point lane');
});

test('validator rejects external route re-entering its own source',async()=>{
 const result=await layout({version:1,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'ab',source:'a',target:'b'}]});
 assert.equal(result.ok,true);if(!result.ok)return;
 const scene=structuredClone(result.value),edge=scene.edges[0],p=edge.points[0],box=scene.nodes.find(n=>n.id==='a')!.box;
 edge.points=[p,{x:p.x+10,y:p.y},{x:p.x+10,y:p.y+2},{x:box.x+box.width/2,y:p.y+2},{x:box.x+box.width/2,y:p.y+4},{x:p.x+20,y:p.y+4},{x:p.x+20,y:p.y},...edge.points.slice(1)];
 const checked=validateScene(scene);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'box-clearance');
});

test('validator rejects self-retracing external route',async()=>{
 const result=await layout({version:1,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'ab',source:'a',target:'b'}]});
 assert.equal(result.ok,true);if(!result.ok)return;
 const scene=structuredClone(result.value),edge=scene.edges[0],p=edge.points[0];
 edge.points=[p,{x:p.x+20,y:p.y},{x:p.x+10,y:p.y},...edge.points.slice(1)];
 const checked=validateScene(scene);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'self-retrace');
});

test('label leader is explicit and a detached leader is rejected',async()=>{
 const result=await layout({version:1,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'ab',source:'a',target:'b',label:'Continue'}]});
 assert.equal(result.ok,true);if(!result.ok)return;
 assert.equal(result.value.edges[0].leader?.length,2);
 const scene=structuredClone(result.value);
 scene.edges[0].leader![0].y+=40;
 const checked=validateScene(scene);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'label-leader');
});

for(const direction of ['LR','TB'] as const)test(`six declared incoming contexts merge through one dialog exit (${direction})`,async()=>{
 const input=sixFlows(true);
 input.direction=direction;
 input.edges=input.edges.filter(e=>!e.id.startsWith('out')||e.id==='out0');
 input.nodes=input.nodes.filter(n=>!n.id.startsWith('result')||n.id==='result0');
 input.continuations=input.continuations!.map(c=>({...c,outgoingEdge:'out0'}));
 const result=await layout(input,10000);
 assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)return;
 const tracks=result.value.continuations!;
 assert.equal(new Set(tracks.map(t=>`${t.entry.x},${t.entry.y}`)).size,6);
 assert.equal(new Set(tracks.map(t=>`${t.exit.x},${t.exit.y}`)).size,1);
 assert.ok(tracks.some(t=>t.points.length===4));
 assert.equal(validateScene(result.value).ok,true);
 const corrupted=structuredClone(result.value);corrupted.continuations![1].incomingEdge='undeclared';
 const checked=validateScene(corrupted);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'continuation-preservation');
});

test('different declared outgoing flows cannot share an internal continuation segment',async()=>{
 const result=await layout(sixFlows(true),10000);assert.equal(result.ok,true);if(!result.ok)return;
 const scene=structuredClone(result.value),first=scene.continuations![0],other=scene.continuations![1];
 const x=(other.entry.x+other.exit.x)/2,right=other.exit.x-10;
 other.points=[other.entry,{x,y:other.entry.y},{x,y:first.entry.y},{x:right,y:first.entry.y},{x:right,y:other.exit.y},other.exit];
 const checked=validateScene(scene);assert.equal(checked.ok,false);if(!checked.ok)assert.equal(checked.error.rule,'continuation-overlap');
});
