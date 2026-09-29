/** Independent SVG artifact checks. It tokenizes XML tags and never imports production geometry. */
export type Semantic={nodes:{id:string;title:string;body?:string}[];edges:{id:string;source:string;target:string;label?:string}[];continuations?:{incomingEdge:string;outgoingEdge:string;throughNode:string}[]};
type Point={x:number;y:number};type Rect={id:string;x:number;y:number;w:number;h:number};type Attrs=Record<string,string>;
const EPS=.01,PARALLEL_GAP=4.25;
const attrs=(source:string):Attrs=>Object.fromEntries([...source.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const points=(source:string)=>source.trim().split(/\s+/).map(value=>{const [x,y]=value.split(',').map(Number);return{x,y};});
const boundary=(p:Point,r:Rect)=>((Math.abs(p.x-r.x)<EPS||Math.abs(p.x-r.x-r.w)<EPS)&&p.y>=r.y-EPS&&p.y<=r.y+r.h+EPS)||((Math.abs(p.y-r.y)<EPS||Math.abs(p.y-r.y-r.h)<EPS)&&p.x>=r.x-EPS&&p.x<=r.x+r.w+EPS);
const through=(a:Point,b:Point,r:Rect)=>a.x===b.x?a.x>r.x+EPS&&a.x<r.x+r.w-EPS&&Math.max(Math.min(a.y,b.y),r.y+EPS)<Math.min(Math.max(a.y,b.y),r.y+r.h-EPS):a.y===b.y&&a.y>r.y+EPS&&a.y<r.y+r.h-EPS&&Math.max(Math.min(a.x,b.x),r.x+EPS)<Math.min(Math.max(a.x,b.x),r.x+r.w-EPS);
const inCanvas=(p:Point,w:number,h:number)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=w&&p.y<=h;

function parse(document:string){
 const stack:Attrs[]=[],nodes:Rect[]=[],edges=new Map<string,{points?:Point[];arrow?:Point[];stroke?:string}>(),labels=new Set<string>(),nodePaths=new Set<string>(),continuations:{attrs:Attrs;points:Point[];stroke?:string}[]=[];let width=0,height=0;
 for(const match of document.matchAll(/<\/?[A-Za-z][^>]*>/g)){
  const tag=match[0];if(tag.startsWith('</')){stack.pop();continue;}const name=/^<([\w:-]+)/.exec(tag)?.[1]??'',own=attrs(tag),context=Object.assign({},...stack,own),self=tag.endsWith('/>');
  if(name==='svg'&&own.viewBox){const box=own.viewBox.split(/\s+/).map(Number);width=box[2];height=box[3];}
  const node=context['data-node-id'];if(name==='rect'&&node)nodes.push({id:node,x:Number(own.x),y:Number(own.y),w:Number(own.width),h:Number(own.height)});if(name==='path'&&node)nodePaths.add(node);
  const edge=context['data-edge-id'];if(name==='polyline'&&edge)edges.set(edge,{...(edges.get(edge)??{}),points:points(own.points??''),stroke:own.stroke});if(name==='polygon'&&edge)edges.set(edge,{...(edges.get(edge)??{}),arrow:points(own.points??'')});
  if(context['data-edge-label']&&name==='path')labels.add(context['data-edge-label']);
  if(name==='polyline'&&context['data-continuation-through'])continuations.push({attrs:context,points:points(own.points??''),stroke:own.stroke});
  if(!self)stack.push(context);
 }
 return {width,height,nodes,edges,labels,nodePaths,continuations};
}

export function independentSvgErrors(document:string,source:Semantic):string[]{
 const errors:string[]=[],artifact=parse(document),{width,height,nodes,edges,labels,nodePaths,continuations}=artifact;if(!width||!height)errors.push('canvas');
 const visual=document.includes('<title>Semantic flow diagram</title>'),visiblePaths=(document.match(/<path\b/g)??[]).length;
 if(nodes.length!==source.nodes.length||source.nodes.some(node=>!nodes.some(actual=>actual.id===node.id)||(!visual&&!nodePaths.has(node.id)))||(visual&&visiblePaths<source.nodes.length))errors.push('node content');
 const segments:{id:string;a:Point;b:Point}[]=[];
 for(const edge of source.edges){const actual=edges.get(edge.id);if(!actual?.points){errors.push(`edge ${edge.id} missing`);continue;}const route=actual.points,sourceBox=nodes.find(node=>node.id===edge.source),targetBox=nodes.find(node=>node.id===edge.target),continued=(source.continuations??[]).some(c=>c.incomingEdge===edge.id);if(!sourceBox||!targetBox||!boundary(route[0],sourceBox)||!boundary(route.at(-1)!,targetBox))errors.push(`edge ${edge.id} endpoint`);if(!continued){const arrow=actual.arrow;if(!arrow||arrow.length!==3||!arrow.every(point=>inCanvas(point,width,height))||Math.abs(arrow[0].x-route.at(-1)!.x)>EPS||Math.abs(arrow[0].y-route.at(-1)!.y)>EPS)errors.push(`edge ${edge.id} arrow`);else {const previous=route.at(-2)!,tip=arrow[0],base={x:(arrow[1].x+arrow[2].x)/2,y:(arrow[1].y+arrow[2].y)/2};if((tip.x-base.x)*(tip.x-previous.x)+(tip.y-base.y)*(tip.y-previous.y)<=0)errors.push(`edge ${edge.id} arrow direction`);}}
  if(edge.label&&!labels.has(edge.id))errors.push(`edge ${edge.id} label`);
  for(let index=0;index<route.length-1;index++){const a=route[index],b=route[index+1];if(!inCanvas(a,width,height)||!inCanvas(b,width,height)||!(a.x===b.x||a.y===b.y)||(a.x===b.x&&a.y===b.y))errors.push(`edge ${edge.id} segment`);for(const node of nodes)if(node.id!==edge.source&&node.id!==edge.target&&through(a,b,node))errors.push(`edge ${edge.id} node`);segments.push({id:edge.id,a,b});}
 }
 for(const continuation of source.continuations??[]){const line=continuations.find(value=>value.attrs['data-incoming-edge']===continuation.incomingEdge&&value.attrs['data-outgoing-edge']===continuation.outgoingEdge)||continuations.find(value=>value.attrs['data-continuation-through']===continuation.throughNode),node=nodes.find(value=>value.id===continuation.throughNode);if(!line||!node||line.points.length<2||!boundary(line.points[0],node)||!boundary(line.points.at(-1)!,node)||line.points.some(point=>!inCanvas(point,width,height)))errors.push(`continuation ${continuation.incomingEdge} geometry`);if(line?.attrs['data-incoming-edge']){const incoming=edges.get(continuation.incomingEdge)?.stroke,outgoing=edges.get(continuation.outgoingEdge)?.stroke;if(incoming!==line.stroke||outgoing!==line.stroke)errors.push(`continuation ${continuation.incomingEdge} color`);}}
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j];if(a.id===b.id)continue;const av=a.a.x===a.b.x,bv=b.a.x===b.b.x;if(av!==bv)continue;const distance=av?Math.abs(a.a.x-b.a.x):Math.abs(a.a.y-b.a.y),low=Math.max(av?Math.min(a.a.y,a.b.y):Math.min(a.a.x,a.b.x),av?Math.min(b.a.y,b.b.y):Math.min(b.a.x,b.b.x)),high=Math.min(av?Math.max(a.a.y,a.b.y):Math.max(a.a.x,a.b.x),av?Math.max(b.a.y,b.b.y):Math.max(a.a.x,b.b.x));if(distance<PARALLEL_GAP&&high>low+EPS)errors.push('edge overlap');}
 return errors;
}
