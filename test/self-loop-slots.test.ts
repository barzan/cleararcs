import test from 'node:test';
import assert from 'node:assert/strict';
import {layout} from '../src/index.js';

test('five same-side self-loops use disjoint local slots instead of nested wide lanes',async()=>{
 const result=await layout({version:1,direction:'LR',theme:{visual:true},nodes:[{id:'review',title:'Review',width:300}],edges:Array.from({length:5},(_,i)=>({id:`loop${i}`,source:'review',target:'review',label:`Change selected item ${i}`,sourceSide:'EAST',targetSide:'EAST',labelPlacement:'horizontal'}))},10000);
 assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)return;
 const scene=result.value,box=scene.nodes[0].box;
 const spans=scene.edges.map(e=>({min:Math.min(...e.points.map(p=>p.y)),max:Math.max(...e.points.map(p=>p.y)),reach:Math.max(...e.points.map(p=>p.x))-box.x-box.width}));
 for(let i=0;i<spans.length;i++)for(let j=i+1;j<spans.length;j++)assert.ok(spans[i].max<spans[j].min||spans[j].max<spans[i].min);
 assert.ok(Math.max(...spans.map(s=>s.reach))-Math.min(...spans.map(s=>s.reach))<5,'loop reach should be local rather than progressively nested');
 assert.ok(scene.canvas.width<500,'five loops should add one label column, not five nested columns');
});

test('ordinary arrivals and departures remain spaced outside reserved self-loop slots',async()=>{
 const nodes:any[]=[{id:'review',title:'Review',presentation:'reference',canonicalNodeId:'review',showcasePage:2,width:160}];
 const edges:any[]=[{id:'loop',source:'review',target:'review',sourceSide:'EAST',targetSide:'EAST',label:'Change selection'}];
 for(let i=0;i<7;i++){nodes.push({id:`source${i}`,title:`Source ${i}`});edges.push({id:`in${i}`,source:`source${i}`,target:'review'});}
 nodes.push({id:'next',title:'Next'});edges.push({id:'out',source:'review',target:'next'});
 const result=await layout({version:1,direction:'LR',theme:{visual:true},nodes,edges},10000);
 assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)return;
 const ports=result.value.ports.filter(p=>p.nodeId==='review'&&p.side==='WEST').sort((a,b)=>a.point.y-b.point.y);
 for(let i=1;i<ports.length;i++)assert.ok(ports[i].point.y-ports[i-1].point.y>=4.25);
});
