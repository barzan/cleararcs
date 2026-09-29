import {Node,ResolvedRow,Rect} from './types.js';
import {measure} from './text.js';

export const visualLineHeight=14;
export function visualRowText(r:any):string {
  if(r.role==='input') return `${r.required?'* ':''}${r.label??r.text??''}${r.choice?` [${r.choice}]`:''}`;
  if(r.role==='condition') return `?(${r.predicate??''})${r.then?` → ${r.then.replace(/ - disabled\]/g,']')}`:':'}`;
  if(r.role==='cta') return `[${r.text??''}]`;
  return r.text??'';
}
export function wrapText(text:string,width:number,size=10):string[] {
  return text.split('\n').flatMap(paragraph=>{
    const out:string[]=[];let line='';
    const words=(paragraph.match(/\[[^\]]+\]|\S+/g)??[]).flatMap(word=>measure(word,size)>width?word.split(/\s+/):[word]);
    for(const word of words){
      const next=line?`${line} ${word}`:word;
      if(line&&measure(next,size)>width){out.push(line);line=word;}else line=next;
    }
    out.push(line);return out;
  });
}
/** The single metric contract used by layout, rendering, and validation. */
export function nodeContent(n:Node) {
  const width=n.width??(n.presentation==='reference'?220:365), pad=14;
  if(n.presentation==='reference'){
    const titleLines=wrapText(n.title,width-20,10);
    const titleBounds={x:10,y:9,width:width-20,height:titleLines.length*13};
    const stateWidth=n.state?measure(n.state,10)+12:0;
    const stateBox=n.state?{x:10,y:12+titleBounds.height,width:stateWidth,height:17}:undefined;
    // Share the footer only when the measured pill leaves a clear page-number slot.
    const footerExtra=stateWidth+10+45>width?15:0;
    return {width,height:36+titleBounds.height+footerExtra,displayTitle:n.title,titleLines,titleBounds,stateBox,resolvedRows:[]};
  }
  const stateWidth=n.state?measure(n.state,10)+18:0;
  const inline=measure(n.title,12)+stateWidth+14<=width-pad*2;
  const titleWidth=width-pad*2-(inline?stateWidth+14:0);
  const titleLines=wrapText(n.title,titleWidth,12);
  // State has its own row: long screen names never collide with its pill.
  const titleBounds:Rect={x:pad,y:12,width:titleWidth,height:titleLines.length*17};
  const stateBox=n.state?{x:inline?width-pad-stateWidth:pad,y:inline?10:titleBounds.y+titleBounds.height+5,width:stateWidth,height:20}:undefined;
  let y=Math.max(stateBox?stateBox.y+stateBox.height:0,titleBounds.y+titleBounds.height)+13;
  const resolvedRows:ResolvedRow[]=[];
  for(const row of n.rows??[]){
    const indent=(row.indent??0)*12;
    const text=visualRowText(row),x=pad+16+indent,available=width-x-pad;
    const lines=wrapText(text,available);
    resolvedRows.push({...row,renderedText:text,lines,bounds:{x,y,width:Math.max(...lines.map(s=>measure(s))),height:lines.length*visualLineHeight}});
    y+=lines.length*visualLineHeight+2;
  }
  return {width,height:y+12,displayTitle:n.title,titleLines,titleBounds,stateBox,resolvedRows};
}
