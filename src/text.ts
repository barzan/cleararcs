import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url'; import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url); const fontkit:any=require('fontkit');
const font=fontkit.openSync(join(dirname(fileURLToPath(import.meta.url)),'../../assets/IBMPlexSans.ttf'));
export const lineHeight=12;
export const fontPath=join(dirname(fileURLToPath(import.meta.url)),'../../assets/IBMPlexSans.ttf');
export function supportsText(text:string){return [...text].every(c=>c==='\n'||(c.codePointAt(0)!>=32&&font.hasGlyphForCodePoint(c.codePointAt(0)!)))}
const advances=new Map<string,number>();
export function measure(text:string,size=10){let advance=advances.get(text);if(advance===undefined){const run=font.layout(text);advance=run.glyphs.reduce((n:number,g:any,i:number)=>n+(run.positions[i]?.xAdvance??g.advanceWidth),0)/font.unitsPerEm;if(advances.size>10000)advances.clear();advances.set(text,advance!);}return advance!*size}
export function outline(text:string,x:number,y:number,size=10){const run=font.layout(text);let cursor=x;const paths:string[]=[];for(let i=0;i<run.glyphs.length;i++){const g=run.glyphs[i],p=run.positions[i];paths.push(`<path d="${g.path.toSVG()}" transform="translate(${cursor} ${y}) scale(${size/font.unitsPerEm} ${-size/font.unitsPerEm})"/>`);cursor+=(p?.xAdvance??g.advanceWidth)/font.unitsPerEm*size;}return paths.join('')}
export function pdfOutline(doc:any,text:string,x:number,y:number,size=10){const run=font.layout(text);let cursor=x;for(let i=0;i<run.glyphs.length;i++){const g=run.glyphs[i],p=run.positions[i];doc.save().transform(size/font.unitsPerEm,0,0,-size/font.unitsPerEm,cursor,y).path(g.path.toSVG()).fill('#172033').restore();cursor+=(p?.xAdvance??g.advanceWidth)/font.unitsPerEm*size;}}
