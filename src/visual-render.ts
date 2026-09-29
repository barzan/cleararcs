import PDFDocument from 'pdfkit';
import {Scene,ResolvedNode} from './types.js';
import {outline,fontPath,measure} from './text.js';
import {visualLineHeight} from './content.js';

const ink='#243244', muted='#667789';
const colors:Record<string,string>={input:'#087984',shown:'#315B7B',condition:'#705397',cta:'#087984',rule:'#815128',note:muted,warning:'#A44331',defined:'#087984'};
const fill=(n:ResolvedNode)=>n.kind==='dialog'?'#FBF8FD':n.kind==='boundary'?'#F5F6F8':'#F3F9FA';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
// Paint the exact union once. Repainting a shared fan-in trunk with several
// dash phases makes a correctly dotted semantic path appear solid.
function continuationSegments(scene:Scene){
 const groups=new Map<string,{horizontal:boolean;fixed:number;color:string;node:string;ranges:[number,number][]}>();
 for(const c of scene.continuations??[])for(let i=0;i<c.points.length-1;i++){
  const a=c.points[i],b=c.points[i+1],horizontal=a.y===b.y,fixed=horizontal?a.y:a.x;
  const key=`${c.throughNode}:${c.color}:${horizontal}:${fixed}`;
  const g=groups.get(key)??{horizontal,fixed,color:c.color,node:c.throughNode,ranges:[]};
  g.ranges.push(horizontal?[Math.min(a.x,b.x),Math.max(a.x,b.x)]:[Math.min(a.y,b.y),Math.max(a.y,b.y)]);groups.set(key,g);
 }
 return [...groups.values()].flatMap(g=>{
  const merged:[number,number][]=[];
  for(const range of g.ranges.sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
  return merged.map(([a,b])=>({color:g.color,node:g.node,points:g.horizontal?[{x:a,y:g.fixed},{x:b,y:g.fixed}]:[{x:g.fixed,y:a},{x:g.fixed,y:b}]}));
 });
}
/** Split already-measured lines into semantic color runs without changing geometry. */
export function rowRuns(row:any,lineIndex:number) {
 const line=row.lines[lineIndex],offset=row.lines.slice(0,lineIndex).reduce((n:number,s:string)=>n+s.length+1,0);
 const base=row.role==='cta'&&row.enabled===false?muted:colors[row.role]??ink;
 if(row.role!=='condition'||!row.then)return [{text:line,start:0,color:base}];
 const boundary=(`?(${row.predicate}) → `).length;
 const role=row.thenRole??(row.then.startsWith('[')?'cta':row.then.startsWith('Input:')?'input':row.then.startsWith('Shown:')?'shown':'note');
 const suffix=row.then.includes(' - disabled]')?muted:colors[role];
 const cut=Math.max(0,Math.min(line.length,boundary-offset));
 return [{text:line.slice(0,cut),start:0,color:colors.condition},{text:line.slice(cut),start:cut,color:suffix}].filter(r=>r.text);
}
function edgeRuns(e:any,lineIndex:number) {
 const lines=e.labelLines??[],line=lines[lineIndex],all=lines.join(' '),offset=lines.slice(0,lineIndex).reduce((n:number,s:string)=>n+s.length+1,0);
 const start=all.indexOf('?('),end=start<0?-1:all.indexOf(')',start)+1;
 if(start<0||end<=start)return [{text:line,start:0,color:e.color??ink}];
 const cuts=[0,Math.max(0,Math.min(line.length,start-offset)),Math.max(0,Math.min(line.length,end-offset)),line.length];
 return cuts.slice(0,-1).map((a,i)=>({text:line.slice(a,cuts[i+1]),start:a,color:i===1?colors.condition:e.color??ink})).filter(r=>r.text);
}
function ctaSpans(row:any,line:string){
 if(row.role==='cta')return [{start:0,text:line,disabled:row.enabled===false}];
 if(row.role!=='condition'||!row.then?.startsWith('['))return [];
 return [...line.matchAll(/\[[^\]]+\]/g)].map(m=>({start:m.index!,text:m[0],disabled:row.then.includes(m[0].slice(0,-1)+' - disabled]')}));
}
function svgCue(role:string,x:number,y:number,color:string){
 if(role==='input')return `<path d="M ${x+1} ${y+9} L ${x+3} ${y+4} L ${x+8} ${y-1} L ${x+11} ${y+2} L ${x+6} ${y+7} Z M ${x+3} ${y+4} L ${x+6} ${y+7}" fill="none" stroke="${color}" stroke-width=".8"/>`;
 if(role==='shown')return `<path d="M ${x} ${y+4} Q ${x+6} ${y-3} ${x+12} ${y+4} Q ${x+6} ${y+11} ${x} ${y+4}" fill="none" stroke="${color}" stroke-width=".8"/><circle cx="${x+6}" cy="${y+4}" r="2" fill="${color}"/>`;
 return '';
}
function pdfCue(doc:any,role:string,x:number,y:number,color:string){
 doc.save().strokeColor(color).fillColor(color).lineWidth(.8);
 if(role==='input')doc.moveTo(x+1,y+9).lineTo(x+3,y+4).lineTo(x+8,y-1).lineTo(x+11,y+2).lineTo(x+6,y+7).closePath().stroke().moveTo(x+3,y+4).lineTo(x+6,y+7).stroke();
 if(role==='shown'){doc.moveTo(x,y+4).quadraticCurveTo(x+6,y-3,x+12,y+4).quadraticCurveTo(x+6,y+11,x,y+4).stroke();doc.circle(x+6,y+4,2).fill();}doc.restore();
}
function bridgePoints(scene:Scene){
 const result:{x:number,y:number,color:string}[]=[];
 if(!scene.source.theme?.crossingBridges)return result;
 const segments=scene.edges.flatMap(e=>e.points.slice(0,-1).map((a,i)=>({e,a,b:e.points[i+1]})));
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j];if(a.e.id===b.e.id)continue;
  const av=a.a.x===a.b.x,bv=b.a.x===b.b.x;if(av===bv)continue;
  const v=av?a:b,h=av?b:a,x=v.a.x,y=h.a.y;
  if(x>Math.min(h.a.x,h.b.x)+5&&x<Math.max(h.a.x,h.b.x)-5&&y>Math.min(v.a.y,v.b.y)+5&&y<Math.max(v.a.y,v.b.y)-5)result.push({x,y,color:h.e.color??ink});
 }
 return result;
}
export function visualSvg(scene:Scene){
 const parts:string[]=[],page=scene.print?.transform,width=page?.width??scene.canvas.width,height=page?.height??scene.canvas.height,transform=page?` transform="translate(${page.translateX} ${page.translateY}) scale(${page.scale})"`:'';
 const text=(s:string,x:number,y:number,size=10,color=ink)=>`<g fill="${color}">${outline(s,x,y,size)}</g>`;
 for(const n of scene.nodes){const b=n.box;parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="8" fill="${fill(n)}"/>`);}
 for(const e of scene.edges){const color=e.color??ink;parts.push(`<g data-edge-id="${esc(e.id)}"><polyline points="${e.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.1"${e.style==='dashed'?' stroke-dasharray="5 3"':''}/>${e.continuedAtTarget?'':`<polygon points="${e.arrowhead.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${color}"/>`}</g>`);}
 for(const c of continuationSegments(scene))parts.push(`<polyline data-continuation-through="${esc(c.node)}" points="${c.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${c.color}" stroke-width="1.1" stroke-dasharray="2 3"/>`);
 for(const b of bridgePoints(scene))parts.push(`<path d="M ${b.x-4} ${b.y} Q ${b.x} ${b.y-7} ${b.x+4} ${b.y}" fill="none" stroke="white" stroke-width="4"/><path d="M ${b.x-4} ${b.y} Q ${b.x} ${b.y-7} ${b.x+4} ${b.y}" fill="none" stroke="${b.color}" stroke-width="1.1"/>`);
 for(const e of scene.edges)if(e.labelBox){const b=e.labelBox,c=e.color??ink;parts.push(`<g data-edge-label="${esc(e.id)}"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="3" fill="white" stroke="${c}" stroke-width="0.45"/>`);if(e.labelAngle===90)parts.push(`<g transform="translate(${b.x+12} ${b.y+b.height-4}) rotate(-90)">${(e.labelLines??[]).map((s,i)=>edgeRuns(e,i).map(r=>text(r.text,measure(s.slice(0,r.start)),i*12,10,r.color)).join('')).join('')}</g>`);else parts.push((e.labelLines??[]).map((s,i)=>edgeRuns(e,i).map(r=>text(r.text,b.x+4+measure(s.slice(0,r.start)),b.y+10+i*12,10,r.color)).join('')).join(''));if(e.labelAnchor){const a=e.labelAnchor,q={x:Math.max(b.x,Math.min(a.x,b.x+b.width)),y:Math.max(b.y,Math.min(a.y,b.y+b.height))};parts.push(`<path d="${(e.leader??[a,q]).map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}" stroke="${c}" stroke-width="0.65"/><circle cx="${a.x}" cy="${a.y}" r="1.8" fill="${c}"/>`);}parts.push('</g>');}
 for(const n of scene.nodes){const b=n.box;parts.push(`<rect data-node-id="${esc(n.id)}" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="8" fill="none" stroke="${ink}" stroke-width="${n.strokeWidth??1}"${n.kind==='dialog'?' stroke-dasharray="3 3"':''}/>`);const t=n.titleBounds!;for(const [i,line]of(n.titleLines??[n.title]).entries())parts.push(text(line,t.x,t.y+(n.presentation==='reference'?10:12)+i*(n.presentation==='reference'?13:17),n.presentation==='reference'?10:12));if(n.stateBox){const s=n.stateBox;parts.push(`<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="10" fill="white" stroke="#50838B" stroke-width="0.8"/>`,text(n.state??'',s.x+(n.presentation==='reference'?6:9),s.y+12,10,'#356D76'));}if(n.presentation==='reference')parts.push(text(`p. ${n.showcasePage}`,b.x+b.width-37,b.y+b.height-10,9,muted));for(const r of n.resolvedRows??[]){const c=r.role==='cta'&&r.enabled===false?muted:colors[r.role]??ink;parts.push(svgCue(r.role,r.bounds.x-16,r.bounds.y+2,c));if(r.role==='rule')parts.push(text('!',r.bounds.x-13,r.bounds.y+10,10,c));r.lines.forEach((line,i)=>{const y=r.bounds.y+10+i*visualLineHeight;for(const run of rowRuns(r,i))parts.push(text(run.text,r.bounds.x+measure(line.slice(0,run.start)),y,10,run.color));for(const span of ctaSpans(r,line)){const x=r.bounds.x+measure(line.slice(0,span.start));parts.push(`<line x1="${x}" y1="${y+2.5}" x2="${x+measure(span.text)}" y2="${y+2.5}" stroke="${span.disabled?muted:colors.cta}" stroke-width="0.6"${span.disabled?' stroke-dasharray="1 2"':''}/>`);}});}}
 return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}" role="img"><title>Semantic flow diagram</title><g data-page-transform="${page?'true':'false'}"${transform}>${parts.join('')}</g></svg>`;
}
export async function visualPdf(scene:Scene):Promise<Buffer>{
 const page=scene.print?.transform;
 const doc=new PDFDocument({size:page?[page.width,page.height]:[scene.canvas.width,scene.canvas.height],margin:0,compress:true});
 const chunks:Buffer[]=[];const done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
 doc.registerFont('Diagram',fontPath);doc.font('Diagram');if(page)doc.save().translate(page.translateX,page.translateY).scale(page.scale);
 const text=(s:string,x:number,y:number,size=10,color=ink)=>{doc.font('Diagram').fontSize(size).fillColor(color).text(s,x,y,{lineBreak:false,baseline:'alphabetic',features:['kern']});};
 const route=(points:any[],color:string,width=1.1,dash?:number[])=>{doc.save().lineWidth(width).strokeColor(color);if(dash)doc.dash(dash[0],{space:dash[1]});doc.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))doc.lineTo(p.x,p.y);doc.stroke().restore();};
 for(const n of scene.nodes){const b=n.box;doc.fillColor(fill(n)).roundedRect(b.x,b.y,b.width,b.height,8).fill();}
 for(const e of scene.edges){const c=e.color??ink;route(e.points,c,1.1,e.style==='dashed'?[5,3]:undefined);if(!e.continuedAtTarget)doc.fillColor(c).polygon(...e.arrowhead.map(p=>[p.x,p.y] as [number,number])).fill();}
 for(const c of continuationSegments(scene))route(c.points,c.color,1.1,[2,3]);
 for(const b of bridgePoints(scene)){doc.save().lineWidth(4).strokeColor('white').moveTo(b.x-4,b.y).quadraticCurveTo(b.x,b.y-7,b.x+4,b.y).stroke();doc.lineWidth(1.1).strokeColor(b.color).moveTo(b.x-4,b.y).quadraticCurveTo(b.x,b.y-7,b.x+4,b.y).stroke().restore();}
 for(const e of scene.edges)if(e.labelBox){const b=e.labelBox,c=e.color??ink;doc.save().fillColor('white').strokeColor(c).lineWidth(.45).roundedRect(b.x,b.y,b.width,b.height,3).fillAndStroke();if(e.labelAngle===90){doc.translate(b.x+12,b.y+b.height-4).rotate(-90);(e.labelLines??[]).forEach((s,i)=>edgeRuns(e,i).forEach(r=>text(r.text,measure(s.slice(0,r.start)),i*12,10,r.color)));}else(e.labelLines??[]).forEach((s,i)=>edgeRuns(e,i).forEach(r=>text(r.text,b.x+4+measure(s.slice(0,r.start)),b.y+10+i*12,10,r.color)));doc.restore();if(e.labelAnchor){const a=e.labelAnchor,q={x:Math.max(b.x,Math.min(a.x,b.x+b.width)),y:Math.max(b.y,Math.min(a.y,b.y+b.height))};route(e.leader??[a,q],c,.65);doc.fillColor(c).circle(a.x,a.y,1.8).fill();}}
 for(const n of scene.nodes){const b=n.box;doc.save().strokeColor(ink).lineWidth(n.strokeWidth??1);if(n.kind==='dialog')doc.dash(3,{space:3});doc.roundedRect(b.x,b.y,b.width,b.height,8).stroke().restore();const t=n.titleBounds!;(n.titleLines??[n.title]).forEach((line,i)=>text(line,t.x,t.y+(n.presentation==='reference'?10:12)+i*(n.presentation==='reference'?13:17),n.presentation==='reference'?10:12));if(n.stateBox){const s=n.stateBox;doc.save().fillColor('white').strokeColor('#50838B').lineWidth(.8).roundedRect(s.x,s.y,s.width,s.height,10).fillAndStroke().restore();text(n.state??'',s.x+(n.presentation==='reference'?6:9),s.y+12,10,'#356D76');}if(n.presentation==='reference')text(`p. ${n.showcasePage}`,b.x+b.width-37,b.y+b.height-10,9,muted);for(const r of n.resolvedRows??[]){const c=r.role==='cta'&&r.enabled===false?muted:colors[r.role]??ink;pdfCue(doc,r.role,r.bounds.x-16,r.bounds.y+2,c);if(r.role==='rule')text('!',r.bounds.x-13,r.bounds.y+10,10,c);r.lines.forEach((line,i)=>{const y=r.bounds.y+10+i*visualLineHeight;for(const run of rowRuns(r,i))text(run.text,r.bounds.x+measure(line.slice(0,run.start)),y,10,run.color);for(const span of ctaSpans(r,line)){const x=r.bounds.x+measure(line.slice(0,span.start));route([{x,y:y+2.5},{x:x+measure(span.text),y:y+2.5}],span.disabled?muted:colors.cta,.6,span.disabled?[1,2]:undefined);}});}}
 if(page)doc.restore();doc.end();return done;
}
