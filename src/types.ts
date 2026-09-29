export type Side = 'NORTH'|'SOUTH'|'EAST'|'WEST';
export type Direction = 'AUTO'|'LR'|'TB';
export type RowRole='input'|'shown'|'condition'|'cta'|'rule'|'note'|'warning'|'defined';
export interface NodeRow { role:RowRole; text?:string; label?:string; choice?:string; predicate?:string; then?:string; thenRole?:'input'|'shown'|'cta'|'note'; required?:boolean; enabled?:boolean; indent?:number; emphasis?:boolean; icon?:string }
export interface Node { id:string; title:string; body?:string; state?:string; kind?:'screen'|'dialog'|'boundary'|'external'|'other'; rows?:NodeRow[]; presentation?:'full'|'reference'; canonicalNodeId?:string; showcasePage?:number; width?:number; strokeWidth?:number; sourceSide?:Side; targetSide?:Side }
export type EdgeClass='primary'|'secondary'|'alert'|'optional';
export interface EdgeLabelParts { action:string; predicates?:string[]; effect?:string }
export interface Edge { id:string; source:string; target:string; label?:string; displayLabel?:string; labelParts?:EdgeLabelParts; labelPlacement?:'auto'|'horizontal'|'vertical'|'aligned'; semanticClass?:EdgeClass; style?:'solid'|'dashed'; sourceSide?:Side; targetSide?:Side }
export interface Theme { groupEdgesByAction?:boolean; visual?:boolean; labelWidth?:number; margin?:number; crossingBridges?:boolean; palette?:Partial<Record<EdgeClass,string>>; colorMode?:'semantic'|'proximity' }
export interface Continuation { incomingEdge:string; outgoingEdge:string; throughNode:string }
export interface PageConstraints { width:number; height:number; margin:number; minBodyFontSize:number; orientation?:'portrait'|'landscape'; minStrokeWidth?:number }
export interface Diagram { version:1; capacity?:'extended'; direction?:Direction; nodes:Node[]; edges:Edge[]; continuations?:Continuation[]; theme?:Theme; page?:PageConstraints; layoutGoal?:'quality'|'fit-page'; maxWidth?:number; maxHeight?:number }
export interface Point { x:number;y:number }
export interface Rect { x:number;y:number;width:number;height:number }
export interface ResolvedRow extends NodeRow { renderedText:string; lines:string[]; bounds:Rect }
export interface ResolvedNode extends Node { box:Rect; displayTitle?:string; titleLines?:string[]; titleBounds?:Rect; stateBox?:Rect; resolvedRows?:ResolvedRow[]; canonicalNodeId?:string }
export interface ResolvedPort { id:string; nodeId:string; side:Side; point:Point }
export interface ResolvedEdge extends Edge { points:Point[]; labelBox?:Rect; labelLines?:string[]; labelAngle?:0|90; labelOwner?:string; labelAnchor?:Point; leader?:Point[]; color?:string; continuedAtTarget?:boolean; arrowhead:[Point,Point,Point] }
export interface ResolvedContinuation extends Continuation { entry:Point; exit:Point; points:Point[]; color:string; style:'dotted'; lane:Rect; textBounds:Rect[]; clearance:number }
export interface ExportTransform { width:number; height:number; translateX:number; translateY:number; scale:number }
export interface PrintMetrics { target:PageConstraints; transform:ExportTransform; fitScale:number; effectiveBodyFontSize:number; effectiveLabelFontSize:number; effectiveMinStrokeWidth:number; minimumPage:{width:number;height:number}; nodeCount:number; edgeCount:number; labelCount:number; constraints:string[]; collisions:number; sharedSegments:number; crossings?:number }
export interface LegendMetadata { roles:{role:RowRole;label:string;cue:string}[]; nodeKinds:string[]; edgeStyles:{id:string;label:string;style:string}[] }
export interface Scene { version:1; source:Diagram; canvas:Rect; nodes:ResolvedNode[]; ports:ResolvedPort[]; edges:ResolvedEdge[]; continuations?:ResolvedContinuation[]; legend?:LegendMetadata; print?:PrintMetrics; provenance:{engine:string; candidate:number;profile?:string} }
export type Code='INVALID_INPUT'|'UNSUPPORTED'|'NO_VALID_LAYOUT'|'TIMEOUT'|'INVALID_GEOMETRY'|'RENDER_ERROR'|'IO_ERROR';
export interface Diagnostic { code:Code; rule?:string; ids?:string[]; message:string }
export type Result<T>={ok:true;value:T;report:Report}|{ok:false;error:Diagnostic;report:Report};
export interface Report { ok:boolean; diagnostics:Diagnostic[]; crossings:number; elapsedMs?:number; print?:PrintMetrics }
