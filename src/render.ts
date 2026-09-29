import PDFDocument from 'pdfkit';
import {Writable} from 'node:stream';
import {Scene,Result} from './types.js';
import {validateScene} from './geometry.js';
import {outline,pdfOutline,lineHeight} from './text.js';
import {visualSvg,visualPdf} from './visual-render.js';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const color=(scene:Scene,e:any)=>e.color??(({primary:'#25324a',secondary:'#4d6f95',alert:'#aa5b46',optional:'#85909b',...(scene.source.theme?.palette??{})} as Record<string,string>)[e.semanticClass??'primary']);
const title=(n:any)=>n.displayTitle??n.title;
const bodyLines=(n:any):string[]=>n.resolvedRows?.map((r:any)=>r.renderedText)??(n.presentation==='reference'?[`Showcased on p. ${n.showcasePage??'?'}`]:(n.body??'').split('\n'));
const renderError=(error:unknown):Result<never>=>({ok:false,error:{code:'RENDER_ERROR',message:String(error)},report:{ok:false,diagnostics:[{code:'RENDER_ERROR',message:String(error)}],crossings:0}});
const svgLabel=(e:any)=>{if(!e.labelBox)return '';const lines=e.labelLines??[e.displayLabel??e.label],b=e.labelBox;if(e.labelAngle===90)return `<g data-edge-label="${esc(e.id)}" data-label-owner="${esc(e.labelOwner??e.id)}" data-label-angle="90" fill="#172033" transform="translate(${b.x+lineHeight} ${b.y+b.height-4}) rotate(-90)">${lines.map((line:string,i:number)=>outline(line,0,i*lineHeight)).join('')}</g>`;return `<g data-edge-label="${esc(e.id)}" data-label-owner="${esc(e.labelOwner??e.id)}" data-label-angle="0" fill="#172033">${lines.map((line:string,i:number)=>outline(line,b.x+4,b.y+10+i*lineHeight)).join('')}</g>`;};
const bridges=(scene:Scene)=>{if(!scene.source.theme?.crossingBridges)return '';const segments=scene.edges.flatMap(e=>e.points.slice(0,-1).map((a,i)=>({e,a,b:e.points[i+1]}))),out:string[]=[];for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j],av=a.a.x===a.b.x,bv=b.a.x===b.b.x;if(av===bv)continue;const v=av?a:b,h=av?b:a,x=v.a.x,y=h.a.y;if(!(x>Math.min(h.a.x,h.b.x)&&x<Math.max(h.a.x,h.b.x)&&y>Math.min(v.a.y,v.b.y)&&y<Math.max(v.a.y,v.b.y)))continue;if(scene.edges.some(e=>e.labelBox&&x>e.labelBox.x-6&&x<e.labelBox.x+e.labelBox.width+6&&y>e.labelBox.y-6&&y<e.labelBox.y+e.labelBox.height+6))continue;const d=`M ${x-6} ${y} C ${x-3} ${y-5} ${x+3} ${y-5} ${x+6} ${y}`;out.push(`<path data-crossing-bridge="true" d="${d}" fill="none" stroke="white" stroke-width="4"/><path data-crossing-bridge="true" d="${d}" fill="none" stroke="${color(scene,h.e)}" stroke-width="1.25"/>`);}return out.join('');};

export function svg(scene:Scene):Result<string>{
 const checked=validateScene(scene);if(!checked.ok)return checked as any;
 try {
  if(scene.source.theme?.visual)return {ok:true,value:visualSvg(scene),report:checked.report};
  const natural=scene.canvas,page=scene.print?.transform,width=page?.width??natural.width,height=page?.height??natural.height,transform=page?` transform="translate(${page.translateX} ${page.translateY}) scale(${page.scale})"`:'';
  const backgrounds=scene.nodes.map(n=>`<rect data-node-background="${esc(n.id)}" x="${n.box.x}" y="${n.box.y}" width="${n.box.width}" height="${n.box.height}" rx="4" fill="white"/>`).join('');
  const fronts=scene.nodes.map(n=>`<g data-node-id="${esc(n.id)}"><rect x="${n.box.x}" y="${n.box.y}" width="${n.box.width}" height="${n.box.height}" rx="4" fill="none" stroke="#172033" stroke-width="${n.strokeWidth??1.25}"/><g data-node-text="${esc(n.id)}" fill="#172033">${outline(title(n),n.box.x+12,n.box.y+19)}${bodyLines(n).map((line,i)=>outline(line,n.box.x+12,n.box.y+32+i*lineHeight)).join('')}</g></g>`).join('');
  const continuations=(scene.continuations??[]).map(c=>`<polyline data-continuation-through="${esc(c.throughNode)}" data-incoming-edge="${esc(c.incomingEdge)}" data-outgoing-edge="${esc(c.outgoingEdge)}" points="${c.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${c.color}" stroke-width="0.8" stroke-dasharray="2 2"/>`).join('');
  const edges=scene.edges.map(e=>{const ink=color(scene,e);return `<g data-edge-id="${esc(e.id)}"><polyline data-edge-class="${e.semanticClass??'primary'}" points="${e.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${ink}" stroke-width="1.25"${e.style==='dashed'||e.semanticClass==='optional'?' stroke-dasharray="4 3"':''}/>${e.continuedAtTarget?'':`<polygon points="${e.arrowhead.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${ink}"/>`}${svgLabel(e)}</g>`;}).join('');
  return {ok:true,value:`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}" role="img"><title>ClearArcs diagram</title><desc>${esc(scene.source.nodes.map(n=>n.title).join('; '))}</desc><g data-page-transform="${page?'true':'false'}"${transform}>${backgrounds}${edges}${continuations}${bridges(scene)}${fronts}</g></svg>`,report:checked.report};
 } catch(error) {return renderError(error) as Result<string>;}
}

export async function pdf(scene:Scene):Promise<Result<Buffer>>{
 const checked=validateScene(scene);if(!checked.ok)return checked as any;
 try {
  if(scene.source.theme?.visual)return {ok:true,value:await visualPdf(scene),report:checked.report};
  const page=scene.print?.transform,doc=new PDFDocument({size:page?[page.width,page.height]:[scene.canvas.width,scene.canvas.height],margin:0,compress:false}),chunks:Buffer[]=[];
  const done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(b:Buffer)=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  doc.pipe(new Writable({write(_chunk,_encoding,callback){callback();}}));
  if(page)doc.save().translate(page.translateX,page.translateY).scale(page.scale);
  for(const n of scene.nodes)doc.fillColor('white').roundedRect(n.box.x,n.box.y,n.box.width,n.box.height,4).fill();
  for(const e of scene.edges){const ink=color(scene,e);doc.strokeColor(ink).fillColor(ink).lineWidth(1.25);if(e.style==='dashed'||e.semanticClass==='optional')doc.dash(4,{space:3});doc.moveTo(e.points[0].x,e.points[0].y);for(const p of e.points.slice(1))doc.lineTo(p.x,p.y);doc.stroke().undash();if(!e.continuedAtTarget)doc.polygon(...e.arrowhead.map(p=>[p.x,p.y])).fill();if(e.labelBox){const lines=e.labelLines??[e.displayLabel??e.label!],b=e.labelBox;doc.fillColor('#172033');if(e.labelAngle===90){doc.save().translate(b.x+lineHeight,b.y+b.height-4).rotate(-90);for(const [i,line] of lines.entries())pdfOutline(doc,line,0,i*lineHeight);doc.restore();}else for(const [i,line] of lines.entries())pdfOutline(doc,line,b.x+4,b.y+10+i*lineHeight);}}
  for(const c of scene.continuations??[]){doc.strokeColor(c.color).lineWidth(.8).dash(2,{space:2}).moveTo(c.points[0].x,c.points[0].y);for(const p of c.points.slice(1))doc.lineTo(p.x,p.y);doc.stroke().undash();}
  for(const n of scene.nodes){doc.strokeColor('#172033').lineWidth(n.strokeWidth??1.25).roundedRect(n.box.x,n.box.y,n.box.width,n.box.height,4).stroke();pdfOutline(doc,title(n),n.box.x+12,n.box.y+19);for(const [i,line] of bodyLines(n).entries())pdfOutline(doc,line,n.box.x+12,n.box.y+32+i*lineHeight);}
  if(page)doc.restore();doc.end();return {ok:true,value:await done,report:checked.report};
 } catch(error) {return renderError(error) as Result<Buffer>;}
}
