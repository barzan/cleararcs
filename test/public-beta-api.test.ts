import test from 'node:test';
import assert from 'node:assert/strict';
import {layout,pdf,svg,validateInput} from '../src/index.js';

const base={version:1 as const,nodes:[{id:'a',title:'A'},{id:'b',title:'B'}],edges:[{id:'go',source:'a',target:'b'}]};

test('public input rejects unsupported nested options and unsafe palette values',()=>{
  for(const input of [
    {...base,theme:{palette:{primary:'#123456" onload="alert(1)'}}},
    {...base,theme:{fontSize:11}},
    {...base,nodes:[{id:'a',title:'A',rows:[{role:'shown',text:'x',unknown:true}]},...base.nodes.slice(1)]},
    {...base,edges:[{id:'go',source:'a',target:'b',sourceSide:'SIDEWAYS'}]},
    {...base,page:{width:100,height:100,margin:10,minBodyFontSize:9,extra:true}}
  ]) assert.equal(validateInput(input).ok,false);
});

test('AUTO fit-page with no time budget returns a structured timeout',async()=>{
  const result=await layout({...base,direction:'AUTO',layoutGoal:'fit-page',page:{width:300,height:200,margin:20,minBodyFontSize:9}},0);
  assert.equal(result.ok,false);
  if(!result.ok) assert.equal(result.error.code,'TIMEOUT');
});

test('page-constrained SVG and PDF use the recorded physical export transform once',async()=>{
  const input={...base,layoutGoal:'fit-page' as const,page:{width:792,height:612,margin:30,minBodyFontSize:9,minStrokeWidth:.5}};
  const result=await layout(input);assert.equal(result.ok,true);if(!result.ok)return;
  const printed=result.value.print!;assert.deepEqual(printed.transform,{width:792,height:612,translateX:30,translateY:30,scale:printed.fitScale});
  const image=svg(result.value);const document=await pdf(result.value);assert.equal(image.ok,true);assert.equal(document.ok,true);if(!image.ok||!document.ok)return;
  assert.match(image.value,/width="792pt" height="612pt" viewBox="0 0 792 612"/);
  assert.match(image.value,new RegExp(`data-page-transform="true" transform="translate\\(30 30\\) scale\\(${printed.fitScale}`));
  assert.match(document.value.toString('latin1'),/\/MediaBox \[0 0 792 612\]/);
  const natural=await layout(base);assert.equal(natural.ok,true);if(natural.ok){const plain=svg(natural.value);assert.equal(plain.ok,true);if(plain.ok)assert.match(plain.value,/data-page-transform="false"/);}
});
