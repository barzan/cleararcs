import test from 'node:test';
import assert from 'node:assert/strict';
import {layout,svg,pdf,validateScene} from '../src/index.js';
import {nodeContent,visualRowText} from '../src/content.js';
import {rowRuns} from '../src/visual-render.js';
import {measure} from '../src/text.js';

test('conditional consequences retain their role color across wrapped lines',()=>{
 assert.equal(visualRowText({role:'condition',predicate:'Parent'}),'?(Parent):');
 for(const [then,thenRole,color] of [['[Continue]','cta','#087984'],['Input: Value','input','#087984'],['Shown: Result','shown','#315B7B']]){
  const row=nodeContent({id:'a',title:'Screen',width:180,rows:[{role:'condition',predicate:'A long condition requiring wrapping',then,thenRole:thenRole as any}]}).resolvedRows[0];
  const runs=row.lines.flatMap((_,i)=>rowRuns(row,i));
  assert.equal(runs[0].color,'#705397');
  assert.equal(runs.at(-1)!.color,color);
  assert.equal(runs.map(r=>r.text).join('').replace(/ /g,''),row.renderedText.replace(/ /g,''));
 }
 const disabled=nodeContent({id:'b',title:'Screen',rows:[{role:'condition',predicate:'Invalid',then:'[Continue - disabled]'}]}).resolvedRows[0];
 assert.equal(rowRuns(disabled,0).at(-1)!.color,'#667789');
});

test('action grouping reserves consecutive source ports before routing',async()=>{
 const actions=['View progress','Develop directions','View progress','Review work','Develop directions'];
 const input:any={version:1,direction:'LR',theme:{visual:true,groupEdgesByAction:true},
  nodes:[{id:'source',title:'Overview',width:260},...actions.map((_,i)=>({id:`n${i}`,title:`Destination ${i}`}))],
  edges:actions.map((action,i)=>({id:`e${i}`,source:'source',target:`n${i}`,label:action,labelParts:{action},labelPlacement:'horizontal'}))};
 const result=await layout(input,30000);assert.ok(result.ok,JSON.stringify(result));if(!result.ok)return;
 const order=result.value.ports.filter(p=>p.nodeId==='source').sort((a,b)=>a.point.y-b.point.y).map(p=>actions[Number(p.id.match(/e(\d+)/)![1])]);
 for(const action of new Set(actions)){
  const indexes=order.flatMap((value,i)=>value===action?[i]:[]);
  assert.equal(indexes.at(-1)!-indexes[0]+1,indexes.length);
 }
 assert.ok(validateScene(result.value).ok);
});

test('visual content uses measured rows, separate state pill, and page footer',async()=>{
 const input:any={version:1,theme:{visual:true},nodes:[{id:'a',title:'Long screen name with a readable title that deliberately wraps across multiple lines',state:'Ready to review',width:240,kind:'dialog',strokeWidth:2.8,rows:[
  {role:'input',label:'Required input',required:true},
  {role:'shown',text:'Visible information'},
  {role:'condition',predicate:'Input valid',then:'[Continue]'},
  {role:'condition',predicate:'Input missing',then:'[Continue - disabled]'},
  {role:'rule',text:'Keep the original caller.'}]}],edges:[]};
 const result=await layout(input);assert.ok(result.ok);if(!result.ok)return;
 assert.ok(validateScene(result.value).ok);
 const n=result.value.nodes[0];assert.ok(n.stateBox);assert.ok(n.titleLines!.length>1);
 for(const row of n.resolvedRows!)for(const line of row.lines)assert.ok(measure(line)<=row.bounds.width+.001);
 const rendered=svg(result.value);assert.ok(rendered.ok);if(rendered.ok){
  assert.match(rendered.value,/stroke-dasharray="3 3"/);
  assert.match(rendered.value,/stroke-dasharray="1 2"/);
  assert.match(rendered.value,/stroke-width="0.6"/);
  assert.ok(!rendered.value.includes('font-family="Helvetica"'));
 }
 const printed=await pdf(result.value);assert.ok(printed.ok);if(printed.ok)assert.equal(printed.value.subarray(0,4).toString(),'%PDF');
 const ref=nodeContent({id:'r',title:'Screen name',state:'Direction approved',width:120,presentation:'reference',canonicalNodeId:'r',showcasePage:12});
 assert.ok(ref.stateBox!.y+ref.stateBox!.height<ref.height-19);
});

test('Unicode arrows are measured and unsupported glyphs still fail',async()=>{
 const good=await layout({version:1,theme:{visual:true},nodes:[{id:'a',title:'Screen',rows:[{role:'condition',predicate:'Input valid',then:'Continue → next state'}]}],edges:[]});
 assert.ok(good.ok);
 const bad=await layout({version:1,nodes:[{id:'a',title:'Unsupported 🦄'}],edges:[]});assert.equal(bad.ok,false);
});

test('shared fan-in dotted geometry is painted once, not overpainted into solid strokes',async()=>{
 const incoming=Array.from({length:6},(_,i)=>({id:`in${i}`,source:`s${i}`,target:'dialog'}));
 const input:any={version:1,direction:'LR',theme:{visual:true},nodes:[...incoming.map((e,i)=>({id:`s${i}`,title:`Source ${i}`})),{id:'dialog',title:'Dialog',kind:'dialog'},{id:'end',title:'End'}],edges:[...incoming,{id:'out',source:'dialog',target:'end'}],continuations:incoming.map(e=>({incomingEdge:e.id,outgoingEdge:'out',throughNode:'dialog'}))};
 const result=await layout(input);assert.ok(result.ok);if(!result.ok)return;
 const rendered=svg(result.value);assert.ok(rendered.ok);if(!rendered.ok)return;
 const lines=[...rendered.value.matchAll(/data-continuation-through="dialog" points="([^"]+)"/g)].map(m=>m[1].split(' ').map(p=>p.split(',').map(Number)));
 assert.ok(lines.length>0);
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const [a,b]=lines[i],[c,d]=lines[j];
  if(a[0]===b[0]&&c[0]===d[0]&&a[0]===c[0])assert.ok(Math.min(b[1],d[1])<=Math.max(a[1],c[1]));
  if(a[1]===b[1]&&c[1]===d[1]&&a[1]===c[1])assert.ok(Math.min(b[0],d[0])<=Math.max(a[0],c[0]));
 }
});
