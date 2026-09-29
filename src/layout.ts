import ELK from 'elkjs/lib/elk.bundled.js';
import {Worker} from 'node:worker_threads';
import {Diagram,Scene,Result,Point,Rect,ResolvedEdge,Side} from './types.js';
import {validateInput} from './schema.js'; import {validateScene} from './geometry.js';
import {measure,lineHeight} from './text.js';
import {nodeContent} from './content.js';
const rowText=(row:any)=>{const indent='  '.repeat(row.indent??0),icon=row.icon?`(${row.icon}) `:'';if(row.role==='input')return `${indent}Input: ${row.required?'* ':''}${row.label??row.text??''}${row.choice?` [${row.choice}]`:''}`;if(row.role==='shown')return `${indent}Shown: ${row.text??''}`;if(row.role==='condition')return `${indent}When ${row.predicate??''}${row.then?`: ${row.then}`:''}`;if(row.role==='cta')return `${indent}[${row.text??''}]${row.enabled===false?' (disabled)':''}`;const prefix=({rule:'Rule',note:'Note',warning:'Warning',defined:'Defined'} as any)[row.role]??row.role;return `${indent}${prefix}: ${icon}${row.text??''}`};
const displayTitle=(node:any)=>`${node.kind?`${node.kind[0].toUpperCase()+node.kind.slice(1)}: `:''}${node.title}${node.state?` | ${node.state}`:''}`;
const nodeLines=(node:any)=>node.presentation==='reference'?[`Showcased on p. ${node.showcasePage??'?'}`]:node.rows?.map(rowText)??(node.body??'').split('\n');
async function runElk(graph:unknown,timeoutMs:number):Promise<any>{return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./elk-worker.js',import.meta.url),{execArgv:[]});let done=false;const finish=(fn:(x:any)=>void,x:any)=>{if(done)return;done=true;clearTimeout(timer);worker.terminate().catch(()=>{});fn(x)};const timer=setTimeout(()=>finish(reject,new Error('timeout')),timeoutMs);worker.once('error',error=>finish(reject,error));worker.once('exit',code=>{if(!done&&code!==0)finish(reject,new Error(`ELK worker exited unexpectedly (${code})`));});worker.once('message',(message:any)=>message.ok?finish(resolve,message.value):finish(reject,new Error(message.error)));worker.postMessage(graph);});}
function size(n:any,ports:any[],continuationCount=0){const lines=[displayTitle(n),...nodeLines(n)];let width=Math.max(n.width??0,...lines.map((x:string)=>measure(x)+24),48),height=Math.max(34,lines.length*lineHeight+18);const need=(k:number)=>12+Math.max(0,k-1)*7+12;const counts:{[k:string]:number}={};for(const p of ports)counts[p.properties['org.eclipse.elk.port.side']]=(counts[p.properties['org.eclipse.elk.port.side']]??0)+1;width=Math.max(width,need(Math.max(counts.NORTH??0,counts.SOUTH??0)));height=Math.max(height,need(Math.max(counts.EAST??0,counts.WEST??0)));if(continuationCount){width+=continuationCount*10+24;height+=continuationCount*18}return {width,height}}
function arrow(p:Point,q:Point):[Point,Point,Point]{const dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;return [q,{x:q.x-7*ux+3*uy,y:q.y-7*uy-3*ux},{x:q.x-7*ux-3*uy,y:q.y-7*uy+3*ux}]}
function labelDimensions(text:string,wrapWidth=96){const words=text.split(/\s+/);let line='',width=0,lines=0;for(const word of words){const next=line?`${line} ${word}`:word;if(measure(next)<=wrapWidth||!line)line=next;else{width=Math.max(width,measure(line));lines++;line=word}}if(line){width=Math.max(width,measure(line));lines++}return {width:width+8,height:lines*lineHeight+6}}
function placeLabel(edge:any,nodes:any[],routes:any[],placed:Rect[],wrapWidth=96){
 const text=edge.displayLabel??(edge.labelParts?`${edge.labelParts.predicates?.length?`[${edge.labelParts.predicates.join(' & ')}] `:''}${edge.labelParts.action}${edge.labelParts.effect?` → ${edge.labelParts.effect}`:''}`:edge.label) as string;
 const lines:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const next=line?`${line} ${word}`:word;if(measure(next)<=wrapWidth||!line)line=next;else{lines.push(line);line=word}}if(line)lines.push(line);}
 const textWidth=Math.max(...lines.map(x=>measure(x)))+8;
 const make=(angle:0|90):Rect=>angle?{x:0,y:0,width:lines.length*lineHeight+6,height:textWidth}:{x:0,y:0,width:textWidth,height:lines.length*lineHeight+6};
 const overlap=(a:Rect,b:Rect)=>Math.max(a.x,b.x)<Math.min(a.x+a.width,b.x+b.width)&&Math.max(a.y,b.y)<Math.min(a.y+a.height,b.y+b.height);
 const expand=(r:Rect,n=3)=>({x:r.x-n,y:r.y-n,width:r.width+2*n,height:r.height+2*n});
 const hit=(a:Point,b:Point,r:Rect)=>a.x===b.x?a.x>r.x&&a.x<r.x+r.width&&Math.max(Math.min(a.y,b.y),r.y)<Math.min(Math.max(a.y,b.y),r.y+r.height):a.y===b.y&&a.y>r.y&&a.y<r.y+r.height&&Math.max(Math.min(a.x,b.x),r.x)<Math.min(Math.max(a.x,b.x),r.x+r.width);
 const intersect=(a:Point,b:Point,c:Point,d:Point)=>{
  if(a.x===b.x&&c.y===d.y)return a.x>=Math.min(c.x,d.x)&&a.x<=Math.max(c.x,d.x)&&c.y>=Math.min(a.y,b.y)&&c.y<=Math.max(a.y,b.y);
  if(a.y===b.y&&c.x===d.x)return c.x>=Math.min(a.x,b.x)&&c.x<=Math.max(a.x,b.x)&&a.y>=Math.min(c.y,d.y)&&a.y<=Math.max(c.y,d.y);
  return false;
 };
 const segments=routes.flatMap(r=>r.points.slice(0,-1).map((p:Point,i:number)=>[p,r.points[i+1],r.id]));
 const candidates:{box:Rect;angle:0|90;score:number;anchor:Point;leader:Point[]}[]=[];
 const offsets=[-6,6,-10,10,-14,14,-18,18,-22,22],positions=Array.from({length:19},(_,i)=>(i+1)/20);
 for(let i=0;i+1<edge.points.length;i++){
  const a=edge.points[i],b=edge.points[i+1],horizontal=a.y===b.y;
  const angles=(edge.labelPlacement==='horizontal'?[0]:edge.labelPlacement==='vertical'?[90]:[horizontal?0:90,horizontal?90:0]) as (0|90)[];
  for(const angle of angles)for(const t of positions)for(const offset of offsets){
   const box=make(angle),anchor={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
   if(horizontal){box.x=anchor.x-box.width/2;box.y=anchor.y+(offset<0?offset-box.height:offset);}
   else{box.x=anchor.x+(offset<0?offset-box.width:offset);box.y=anchor.y-box.height/2;}
   const nearest={x:Math.max(box.x,Math.min(anchor.x,box.x+box.width)),y:Math.max(box.y,Math.min(anchor.y,box.y+box.height))},leader=[anchor,nearest];
   const bad=routes.some(r=>r.id!==edge.id&&r.leader&&(hit(r.leader[0],r.leader[1],expand(box))||intersect(anchor,nearest,r.leader[0],r.leader[1])))||box.x<3||box.y<3||nodes.some(n=>overlap(expand(box),n.box))||placed.some(p=>overlap(expand(box),p))||segments.some(([p,q]:any)=>hit(p,q,expand(box)))||nodes.some(n=>hit(anchor,nearest,expand(n.box)))||placed.some(p=>hit(anchor,nearest,expand(p)))||segments.some(([p,q,id]:any)=>id!==edge.id&&intersect(anchor,nearest,p,q));
   if(!bad)candidates.push({box,angle,anchor,leader,score:i*20+t*10+Math.abs(offset)+(angle===90?100:0)+(angle===0&&!horizontal?80:0)});
  }
 }
 const best=candidates.sort((a,b)=>a.score-b.score)[0];
 if(!best)throw new Error(`no attached label placement for ${edge.id}`);
 return {labelBox:best.box,labelLines:lines,labelAngle:best.angle,labelOwner:edge.id,labelAnchor:best.anchor,leader:best.leader};
}
export async function layout(input:unknown, timeoutMs=5000,candidate=0):Promise<Result<Scene>>{
 const valid=validateInput(input);if(!valid.ok)return valid as any;const d=valid.value,fitPage=d.layoutGoal==='fit-page';
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0){const diagnostic={code:'TIMEOUT' as const,message:'timeoutMs must be a finite positive number'};return {ok:false,error:diagnostic,report:{ok:false,diagnostics:[diagnostic],crossings:0}};}
 if(fitPage&&(d.direction===undefined||d.direction==='AUTO')){
  const started=Date.now(),attempts:Result<Scene>[]=[];
  for(let candidate=0;candidate<(d.theme?.visual?12:1);candidate++)for(const candidateDirection of ['LR','TB'] as const){
   const remaining=timeoutMs-(Date.now()-started);if(remaining<=0)break;
   attempts.push(await layout({...d,direction:candidateDirection},remaining,candidate));
  }
  const successes=attempts.filter((r):r is Extract<typeof r,{ok:true}>=>r.ok);
  if(successes.length){successes.sort((a,b)=>(b.value.print?.fitScale??0)-(a.value.print?.fitScale??0)||a.value.canvas.width*a.value.canvas.height-b.value.canvas.width*b.value.canvas.height);const winner=successes[0];winner.value.source=d;winner.value.provenance.profile='fit-page-candidate-search';return winner;}
  const ranked=attempts.filter((r):r is Extract<typeof r,{ok:false}>=>!r.ok).sort((a,b)=>(b.report.print?.fitScale??0)-(a.report.print?.fitScale??0));
  if(ranked.length)return ranked[0];const diagnostic={code:'TIMEOUT' as const,message:'fit-page candidate search exhausted its total deadline'};return {ok:false,error:diagnostic,report:{ok:false,diagnostics:[diagnostic],crossings:0}};
 }
 const direction=d.direction==='TB'?'DOWN':'RIGHT';
 const defaultSides:{source:Side;target:Side}=direction==='DOWN'?{source:'SOUTH',target:'NORTH'}:{source:'EAST',target:'WEST'};
 // Continuation ports are fixed before ELK routing. External paths never need
 // post-routing surgery, and paired ports share a reserved text-free lane.
 const makeGraph=(free:Record<string,{source:Side;target:Side}>={})=>{
  const children=d.nodes.map(n=>{
   const cs=(d.continuations??[]).filter(c=>c.throughNode===n.id);
   const actionOrder=!!d.theme?.groupEdgesByAction&&!cs.length&&d.edges.some(e=>e.source===n.id&&d.edges.some(o=>o.id!==e.id&&o.source===n.id&&o.labelParts?.action===e.labelParts?.action));
   const loops=d.edges.filter(e=>d.theme?.visual&&e.source===n.id&&e.target===n.id).flatMap(e=>{
    const source=e.sourceSide??n.sourceSide??defaultSides.source,target=e.targetSide??n.targetSide??source;
    return source===target?[{edge:e,side:source,span:Math.max(24,labelDimensions(e.displayLabel??e.label??'',d.theme?.labelWidth??96).height+18)}]:[];
   });
   const orderedEdges=actionOrder?[...d.edges].sort((a,b)=>(a.labelParts?.action??a.label??'').localeCompare(b.labelParts?.action??b.label??'')):d.edges;
   const ports:any[]=orderedEdges.flatMap(e=>{
    const r:any[]=[];
    if(e.source===n.id)r.push({id:`${e.id}:source`,width:0,height:0,properties:{'org.eclipse.elk.port.side':e.sourceSide??n.sourceSide??free[e.id]?.source??defaultSides.source}});
    if(e.target===n.id)r.push({id:`${e.id}:target`,width:0,height:0,properties:{'org.eclipse.elk.port.side':e.targetSide??n.targetSide??free[e.id]?.target??defaultSides.target}});
    return r;
   });
   const content=d.theme?.visual?nodeContent(n):undefined;
   const parallelSides=new Set<Side>();
   if(content&&candidate>=6&&!cs.length)for(const e of d.edges.filter(e=>e.source!==e.target&&(e.source===n.id||e.target===n.id))){
    if(d.edges.filter(o=>o.source===e.source&&o.target===e.target).length>1){const suffix=e.source===n.id?'source':'target';parallelSides.add(ports.find(p=>p.id===`${e.id}:${suffix}`)!.properties['org.eclipse.elk.port.side']);}
   }
   const portSpan=(p:any)=>{const edge=d.edges.find(e=>`${e.id}:source`===p.id||`${e.id}:target`===p.id)!;return labelDimensions(edge.displayLabel??edge.label??'',d.theme?.labelWidth??96).height+8;};
   const trackSpans=cs.map(c=>content&&candidate>=6?Math.max(...[c.incomingEdge,c.outgoingEdge].map(id=>{const edge=d.edges.find(e=>e.id===id)!;return labelDimensions(edge.displayLabel??edge.label??'',d.theme?.labelWidth??96).height;}))+8:12);
   const horizontalTracks=cs.map(c=>['WEST','EAST'].includes(ports.find(p=>p.id===`${c.outgoingEdge}:source`)!.properties['org.eclipse.elk.port.side']));
   const horizontalCount=horizontalTracks.filter(Boolean).length,verticalCount=cs.length-horizontalCount;
   const trackReserve=trackSpans.reduce((sum,span,i)=>sum+(horizontalTracks[i]?span:0),0);
   const heightReserve=horizontalCount?16+trackReserve:0,widthReserve=verticalCount*12;
   const dimensions=content?{width:content.width+widthReserve,height:content.height+heightReserve}:size(n,ports,cs.length);
   for(const side of ['WEST','EAST','NORTH','SOUTH'] as Side[]){
    const onSide=loops.filter(l=>l.side===side),loopPortIds=new Set(onSide.flatMap(l=>[`${l.edge.id}:source`,`${l.edge.id}:target`]));
    const ordinaryCount=onSide.length?ports.filter(p=>p.properties['org.eclipse.elk.port.side']===side&&!loopPortIds.has(p.id)).length:0;
    const extent=24+onSide.reduce((sum,l)=>sum+l.span+8,0)+ordinaryCount*12;
    if(side==='WEST'||side==='EAST')dimensions.height=Math.max(dimensions.height,extent+(content?heightReserve:cs.length?16+trackReserve:0));
    else dimensions.width=Math.max(dimensions.width,extent+(content?widthReserve:cs.length*12));
    if(parallelSides.has(side)&&['WEST','EAST'].includes(side))dimensions.height=Math.max(dimensions.height,24+ports.filter(p=>p.properties['org.eclipse.elk.port.side']===side).reduce((sum,p)=>sum+portSpan(p),0));
   }
   if(cs.length||loops.length||parallelSides.size||actionOrder){
    const paired=new Set<string>();
    cs.forEach((c,i)=>{
     const incoming=ports.find(p=>p.id===`${c.incomingEdge}:target`)!;
     const outgoing=ports.find(p=>p.id===`${c.outgoingEdge}:source`)!;
     const side:Side=outgoing.properties['org.eclipse.elk.port.side'];
     const horizontal=side==='WEST'||side==='EAST';
     const entry:Side=horizontal?(side==='WEST'?'EAST':'WEST'):(side==='NORTH'?'SOUTH':'NORTH');
     const lane=horizontal?(content?Math.max(content.height,24+Math.max(...(['WEST','EAST'] as Side[]).map(s=>loops.filter(l=>l.side===s).reduce((sum,l)=>sum+l.span+8,0))))+8+trackSpans.slice(0,i).reduce((sum,span,j)=>sum+(horizontalTracks[j]?span:0),0):20+(1+nodeLines(n).length)*lineHeight+8+i*9):dimensions.width-12-(content?horizontalTracks.slice(0,i).filter(x=>!x).length:i)*9;
     for(const [p,s] of [[incoming,entry],[outgoing,side]] as [any,Side][]){
      if(paired.has(p.id))continue;
      p.properties['org.eclipse.elk.port.side']=s;
      p.x=horizontal?(s==='WEST'?0:dimensions.width):lane;
      p.y=horizontal?lane:(s==='NORTH'?0:dimensions.height);
      paired.add(p.id);
     }
    });
    for(const side of ['WEST','EAST','NORTH','SOUTH'] as Side[]){
     let cursor=12;
     for(const loop of loops.filter(l=>l.side===side)){
      for(const [suffix,along] of [['source',cursor],['target',cursor+loop.span]] as [string,number][]){
       const p=ports.find(p=>p.id===`${loop.edge.id}:${suffix}`)!;
       p.properties['org.eclipse.elk.port.side']=side;
       p.x=side==='WEST'?0:side==='EAST'?dimensions.width:along;
       p.y=side==='NORTH'?0:side==='SOUTH'?dimensions.height:along;
       paired.add(p.id);
      }
      cursor+=loop.span+8;
     }
    }
    for(const side of ['WEST','EAST','NORTH','SOUTH'] as Side[]){
     const ordinary=ports.filter(p=>!paired.has(p.id)&&p.properties['org.eclipse.elk.port.side']===side);
     ordinary.forEach((p,i)=>{
      const horizontal=side==='WEST'||side==='EAST';
      const extent=horizontal?Math.max(24,dimensions.height-(content?heightReserve:cs.length?16+trackReserve:0)):Math.max(24,dimensions.width-24-(content?verticalCount:cs.length)*9);
      const loopSpan=loops.filter(l=>l.side===side).reduce((sum,l)=>sum+l.span+8,0);
      const along=loopSpan?12+loopSpan+12*(i+1):parallelSides.has(side)&&horizontal?12+ordinary.slice(0,i).reduce((sum,p)=>sum+portSpan(p),0):12+(extent-24)*(i+1)/(ordinary.length+1);
      p.x=horizontal?(side==='WEST'?0:dimensions.width):along;
      p.y=horizontal?along:(side==='NORTH'?0:dimensions.height);
     });
    }
   }
   return {id:n.id,...dimensions,layoutOptions:{'elk.portConstraints':cs.length||loops.length||parallelSides.size||actionOrder?'FIXED_POS':'FIXED_SIDE'},ports};
  });
  return {id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':direction,'elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':fitPage?(candidate>=6?String([8,12,30,8,12,30][candidate-6]):'20'):'70','elk.spacing.edgeEdge':fitPage?'8':'44','elk.spacing.edgeNode':fitPage?'12':'28','elk.layered.spacing.nodeNodeBetweenLayers':fitPage?(candidate?String([72,90,120,150,190,230,80,100,0,20,180,210][candidate]):'72'):'250','elk.layered.nodePlacement.strategy':candidate===4?'LINEAR_SEGMENTS':candidate===5?'SIMPLE':'BRANDES_KOEPF','elk.layered.spacing.edgeEdgeBetweenLayers':fitPage?'10':'44','elk.layered.spacing.edgeNodeBetweenLayers':fitPage?'12':'28','elk.layered.mergeEdges':'false','elk.layered.nodePlacement.favorStraightEdges':'true','elk.layered.unnecessaryBendpoints':'true'},children:candidate===5?[...children].reverse():children,edges:d.edges.map(e=>({id:e.id,sources:[`${e.id}:source`],targets:[`${e.id}:target`],labels:e.label&&(candidate===0||candidate===6||candidate===7||candidate===8||candidate===9)?[{id:`${e.id}:label`,text:e.displayLabel??e.label,...labelDimensions(e.displayLabel??e.label,d.theme?.labelWidth??96)}]:undefined}))};
 };
 let out:any;try{out=await runElk(makeGraph(),timeoutMs);const byId=new Map(out.children.map((n:any)=>[n.id,n]));const free:Record<string,{source:Side;target:Side}>={};for(const e of d.edges){if(e.sourceSide||e.targetSide||d.nodes.find(n=>n.id===e.source)?.sourceSide||d.nodes.find(n=>n.id===e.target)?.targetSide)continue;const a:any=byId.get(e.source),b:any=byId.get(e.target);if(a.x>b.x)free[e.id]={source:'WEST',target:'EAST'};}if(Object.keys(free).length)out=await runElk(makeGraph(free),timeoutMs);}catch(err){const timeout=String(err).includes('timeout');return {ok:false,error:{code:timeout?'TIMEOUT':'NO_VALID_LAYOUT',message:String(err)},report:{ok:false,diagnostics:[{code:timeout?'TIMEOUT':'NO_VALID_LAYOUT',message:String(err)}],crossings:0}}}
 try {
 const margin=d.theme?.margin??(fitPage?10:18);
 const nodes=out.children.map((n:any)=>{
  const source=d.nodes.find(x=>x.id===n.id)!,box={x:n.x+margin,y:n.y+margin,width:n.width,height:n.height};
  if(d.theme?.visual){
   const content=nodeContent(source),absolute=(r:Rect)=>({...r,x:r.x+box.x,y:r.y+box.y});
   return {...source,canonicalNodeId:source.canonicalNodeId??source.id,displayTitle:content.displayTitle,box,titleLines:content.titleLines,titleBounds:absolute(content.titleBounds),stateBox:content.stateBox?absolute(content.stateBox):undefined,resolvedRows:content.resolvedRows.map(r=>({...r,bounds:absolute(r.bounds)}))};
  }
  return {...source,canonicalNodeId:source.canonicalNodeId??source.id,displayTitle:displayTitle(source),box,resolvedRows:source.rows?.map((row,i)=>({...row,renderedText:rowText(row),lines:[rowText(row)],bounds:{x:box.x+12,y:box.y+20+i*lineHeight,width:measure(rowText(row)),height:lineHeight}}))};
 });
 const routes=out.edges.map((e:any)=>{const original=d.edges.find(x=>x.id===e.id)!;const sec=e.sections?.[0];const points=[sec?.startPoint,...(sec?.bendPoints??[]),sec?.endPoint].filter(Boolean).map((p:any)=>({x:Math.round((p.x+margin)*100)/100,y:Math.round((p.y+margin)*100)/100}));const last=points.at(-1)??{x:0,y:0};return {...original,points,arrowhead:arrow(points.at(-2)??last,last)};});
 const edges:ResolvedEdge[]=routes;
 const palette=d.theme?.visual?['#006A9E','#A64900','#00745B','#91466E','#796000']:['#0072B2','#D55E00','#009E73','#CC79A7','#E69F00'];if(d.theme?.colorMode==='proximity'){// A declared continuation is one visual flow, including chains through several nodes.
 const parent=new Map(edges.map(e=>[e.id,e.id]));const find=(id:string):string=>{const p=parent.get(id)!;if(p===id)return p;const r=find(p);parent.set(id,r);return r};const join=(a:string,b:string)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a)};for(const c of d.continuations??[])join(c.incomingEdge,c.outgoingEdge);
 const groups=[...new Set(edges.map(e=>find(e.id)))].map(id=>edges.filter(e=>find(e.id)===id)).sort((a,b)=>a[0].id.localeCompare(b[0].id));
 const distance=(a:any[],b:any[])=>Math.min(...a.flatMap(e=>b.flatMap(f=>e.points.flatMap((p:any)=>f.points.map((q:any)=>Math.hypot(p.x-q.x,p.y-q.y))))));
 const assigned=new Map<string,string>();for(const group of groups){const used=new Set(groups.filter(other=>assigned.has(find(other[0].id))&&distance(group,other)<90).map(other=>assigned.get(find(other[0].id))!));const ink=palette.find(color=>!used.has(color))??palette[groups.indexOf(group)%palette.length];assigned.set(find(group[0].id),ink);for(const edge of group)edge.color=ink;}}
 let canvas={x:0,y:0,width:(out.width??0)+margin*2,height:(out.height??0)+margin*2};
 const inferredSide=(n:any,p:any):Side=>p.x===0?'WEST':p.x===n.width?'EAST':p.y===0?'NORTH':'SOUTH';const ports=out.children.flatMap((n:any)=>n.ports.map((p:any)=>({id:p.id,nodeId:n.id,side:(p.properties?.['org.eclipse.elk.port.side']??inferredSide(n,p)) as Side,point:{x:Math.round((n.x+p.x+margin)*100)/100,y:Math.round((n.y+p.y+margin)*100)/100}})));

 const continuations=(d.continuations??[]).map(c=>{
  const incoming=edges.find(e=>e.id===c.incomingEdge)!,outgoing=edges.find(e=>e.id===c.outgoingEdge)!;
  const node=nodes.find((n:any)=>n.id===c.throughNode)!;
  const ip=ports.find((p:any)=>p.id===`${c.incomingEdge}:target`)!,op=ports.find((p:any)=>p.id===`${c.outgoingEdge}:source`)!;
  const flowColor=incoming.color??outgoing.color??'#25324a';
  incoming.color=flowColor;outgoing.color=flowColor;incoming.continuedAtTarget=true;
  const textBounds=d.theme?.visual?[node.titleBounds,...(node.stateBox?[node.stateBox]:[]),...node.resolvedRows.map((r:any)=>r.bounds)]:[{x:node.box.x+12,y:node.box.y+7,width:measure(node.displayTitle),height:lineHeight},...nodeLines(node).map((line:string,i:number)=>({x:node.box.x+12,y:node.box.y+20+i*lineHeight,width:measure(line),height:lineHeight}))];
  const entry=ip.point,exit=op.point,horizontal=op.side==='WEST'||op.side==='EAST';
  const border=(node.strokeWidth??1.25)/2,clearance=4;
  const groups=[...new Set((d.continuations??[]).filter(x=>x.throughNode===c.throughNode).map(x=>x.outgoingEdge))];
  const offset=border+clearance+6+groups.indexOf(c.outgoingEdge)*9;
  const trunk=horizontal?(op.side==='EAST'?exit.x-offset:exit.x+offset):(op.side==='SOUTH'?exit.y-offset:exit.y+offset);
  const points=horizontal?(entry.y===exit.y?[entry,exit]:[entry,{x:trunk,y:entry.y},{x:trunk,y:exit.y},exit]):(entry.x===exit.x?[entry,exit]:[entry,{x:entry.x,y:trunk},{x:exit.x,y:trunk},exit]);
  const lane=horizontal?{x:node.box.x+border+clearance,y:Math.min(entry.y,exit.y)-4,width:node.box.width-2*(border+clearance),height:Math.abs(entry.y-exit.y)+8}:{x:Math.min(entry.x,exit.x)-4,y:node.box.y+border+clearance,width:Math.abs(entry.x-exit.x)+8,height:node.box.height-2*(border+clearance)};
  return {...c,entry,exit,points,color:flowColor,style:'dotted' as const,lane,textBounds,clearance};
 });
 const relabeled:Rect[]=[];for(const edge of (d.theme?.visual?[...edges].sort((a,b)=>measure(b.displayLabel??b.label??'')-measure(a.displayLabel??a.label??'')):edges)){if(edge.label){const label=placeLabel(edge,nodes,edges,relabeled,d.theme?.labelWidth??96);Object.assign(edge,label);relabeled.push(label.labelBox)}}canvas={x:0,y:0,width:Math.max(canvas.width,...edges.map(e=>(e.labelBox?.x??0)+(e.labelBox?.width??0)+3)),height:Math.max(canvas.height,...edges.map(e=>(e.labelBox?.y??0)+(e.labelBox?.height??0)+3))};if((d.maxWidth&&canvas.width>d.maxWidth)||(d.maxHeight&&canvas.height>d.maxHeight))return {ok:false,error:{code:'NO_VALID_LAYOUT',message:'layout exceeds requested physical canvas'},report:{ok:false,diagnostics:[{code:'NO_VALID_LAYOUT',message:'layout exceeds requested physical canvas'}],crossings:0}};
 const legend={roles:[{role:'input' as const,label:'Input',cue:'required inputs use an asterisk'},{role:'shown' as const,label:'Shown',cue:'visible state'},{role:'condition' as const,label:'Condition',cue:'When/then predicate'},{role:'cta' as const,label:'Action',cue:'bracketed; disabled is named'},{role:'rule' as const,label:'Rule',cue:'behavioral invariant'},{role:'note' as const,label:'Note',cue:'supporting information'},{role:'warning' as const,label:'Warning',cue:'warning text plus color'},{role:'defined' as const,label:'Defined term',cue:'term label'}],nodeKinds:['screen','dialog','boundary','external','reference','showcase'],edgeStyles:[{id:'solid',label:'declared transition',style:'solid'},{id:'dashed',label:'automatic or optional transition',style:'dashed'},{id:'dotted',label:'through-node continuation',style:'dotted'}]};const scene:Scene={version:1,source:d,canvas,nodes,ports,edges,continuations,legend,provenance:{engine:'elkjs 0.12.0',candidate:candidate*2+(direction==='DOWN'?1:0),profile:fitPage?'fit-page':'quality'}};if(d.page){const availableWidth=d.page.width-2*d.page.margin,availableHeight=d.page.height-2*d.page.margin,fitScale=Math.min(1,availableWidth/canvas.width,availableHeight/canvas.height),body=10,label=10,meaningfulStrokes=d.theme?.visual?[1.1,.65,...nodes.map((n:any)=>n.strokeWidth??1),...(continuations.length?[1.1]:[])]:[1.25,.8,...nodes.map((n:any)=>n.strokeWidth??1.25)],minStroke=Math.min(...meaningfulStrokes),requiredScale=Math.max(d.page.minBodyFontSize/body,d.page.minBodyFontSize/label,(d.page.minStrokeWidth??.5)/minStroke);scene.print={target:d.page,transform:{width:d.page.width,height:d.page.height,translateX:d.page.margin,translateY:d.page.margin,scale:fitScale},fitScale,effectiveBodyFontSize:body*fitScale,effectiveLabelFontSize:label*fitScale,effectiveMinStrokeWidth:minStroke*fitScale,minimumPage:{width:canvas.width*requiredScale+2*d.page.margin,height:canvas.height*requiredScale+2*d.page.margin},nodeCount:nodes.length,edgeCount:edges.length,labelCount:edges.filter(e=>e.label).length,constraints:[`layout direction ${direction}`,fitPage?'compact spacing profile':'quality spacing profile','body and labels at 10 pt; meaningful connector/annotation strokes include edge, continuation, node border, and label tether'],collisions:0,sharedSegments:0};if(scene.print.effectiveBodyFontSize+1e-6<d.page.minBodyFontSize||scene.print.effectiveLabelFontSize+1e-6<d.page.minBodyFontSize||scene.print.effectiveMinStrokeWidth+1e-6<(d.page.minStrokeWidth??.5)){const diagnostic={code:'NO_VALID_LAYOUT' as const,rule:'print-fit',message:`page fit requires at least ${scene.print.minimumPage.width.toFixed(1)} x ${scene.print.minimumPage.height.toFixed(1)} pt; achieved body ${scene.print.effectiveBodyFontSize.toFixed(2)} pt, label ${scene.print.effectiveLabelFontSize.toFixed(2)} pt, and stroke ${scene.print.effectiveMinStrokeWidth.toFixed(2)} pt`};return {ok:false,error:diagnostic,report:{ok:false,diagnostics:[diagnostic],crossings:0,print:scene.print}}}}const checked=validateScene(scene);if(!checked.ok)return checked;if(scene.print)scene.print.crossings=checked.report.crossings;return {...checked,report:{...checked.report,print:scene.print}};
 } catch(error) {
  const diagnostic={code:'NO_VALID_LAYOUT' as const,rule:'label-placement',message:String(error)};
  return {ok:false,error:diagnostic,report:{ok:false,diagnostics:[diagnostic],crossings:0}};
 }
}
