import {useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import type {ScenarioDefinition} from '../training/scenarios/types';
import {gateEndpoints,scenarioEntryGate} from '../training/scenarios/entryGate';
import {scenarioLevel,scenarioApproach} from '../training/scenarios/validation';

export type ScenarioSelection=number|'player';
type Point={x:number;z:number};
type Drag={id:number;selection:ScenarioSelection|null;clientX:number;clientY:number;offset:Point;origin:Point};
interface Props {
 definition:ScenarioDefinition;
 selected?:ScenarioSelection;
 onSelect?:(selection:ScenarioSelection)=>void;
 onPlace?:(x:number,z:number,selection:ScenarioSelection)=>void;
}
function pointerOnPlan(event:PointerEvent<SVGSVGElement>):Point|null {
 const svg=event.currentTarget,matrix=svg.getScreenCTM();
 if(!matrix)return null;
 const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
 const local=point.matrixTransform(matrix.inverse());
 return {x:local.x,z:local.y};
}
const round=(value:number)=>Math.round(value*100)/100;
export function ScenarioPlan({definition,selected=0,onSelect,onPlace}:Props){
 const drag=useRef<Drag|null>(null);
 const [preview,setPreview]=useState<{selection:ScenarioSelection;point:Point}|null>(null);
 const level=scenarioLevel(definition);
 const route=scenarioApproach(definition),entry=definition.rules.startOnEntry?scenarioEntryGate(definition):null;
 const points=[...route,...definition.bots.flatMap(bot=>[bot.position,...bot.alternatives])];
 const padding=4,[left,top,width,height]=level.bounds;
 const x=Math.max(left,Math.min(...points.map(point=>point.x))-padding);
 const z=Math.max(top,Math.min(...points.map(point=>point.z))-padding);
 const right=Math.min(left+width,Math.max(...points.map(point=>point.x))+padding);
 const bottom=Math.min(top+height,Math.max(...points.map(point=>point.z))+padding);
 const b=onPlace?level.bounds:[x,z,right-x,bottom-z];
 const position=(selection:ScenarioSelection)=>selection==='player'?definition.player.position:definition.bots[selection].position;
 const start=(event:PointerEvent<SVGSVGElement>)=>{
  if(!onPlace||drag.current||event.button!==0)return;
  const origin=pointerOnPlan(event);
  if(!origin)return;
  const element=(event.target as Element).closest<SVGGElement>('[data-placement-marker]');
  const marker=element?.dataset.placementMarker;
  const selection=marker==='player'?'player':marker===undefined?null:Number(marker);
  const p=selection===null?origin:position(selection);
  drag.current={id:event.pointerId,selection,clientX:event.clientX,clientY:event.clientY,offset:{x:p.x-origin.x,z:p.z-origin.z},origin};
  if(selection!==null){onSelect?.(selection);element?.focus();}
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const move=(event:PointerEvent<SVGSVGElement>)=>{
  const active=drag.current;
  if(!active||active.id!==event.pointerId||active.selection===null)return;
  if(Math.hypot(event.clientX-active.clientX,event.clientY-active.clientY)<4&&!preview)return;
  const point=pointerOnPlan(event);
  if(point)setPreview({selection:active.selection,point:{x:point.x+active.offset.x,z:point.z+active.offset.z}});
 };
 const cancel=(event:PointerEvent<SVGSVGElement>)=>{
  if(drag.current?.id!==event.pointerId)return;
  drag.current=null;setPreview(null);
 };
 const end=(event:PointerEvent<SVGSVGElement>)=>{
  const active=drag.current;
  if(!active||event.pointerId!==active.id)return;
  const point=pointerOnPlan(event);
  const moved=Math.hypot(event.clientX-active.clientX,event.clientY-active.clientY)>=4;
  cancel(event);
  if(!point)return;
  if(active.selection!==null&&moved)onPlace?.(round(point.x+active.offset.x),round(point.z+active.offset.z),active.selection);
  else if(active.selection===null&&!moved)onPlace?.(round(active.origin.x),round(active.origin.z),selected);
 };
 const key=(event:KeyboardEvent<SVGGElement>,selection:ScenarioSelection)=>{
  if(event.key==='Enter'||event.key===' '){
   event.preventDefault();onSelect?.(selection);return;
  }
  const delta=({ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]} as Record<string,number[]>)[event.key];
  if(!delta)return;
  event.preventDefault();onSelect?.(selection);
  const p=position(selection),step=event.shiftKey?1:.25;
  onPlace?.(round(p.x+delta[0]*step),round(p.z+delta[1]*step),selection);
 };
 const marker=(selection:ScenarioSelection)=>{
  const p=preview?.selection===selection?preview.point:position(selection);
  const player=selection==='player',active=selected===selection;
  const color=player?'var(--accent,#146d73)':'var(--danger,#b74743)';
  return <g transform={`translate(${p.x} ${p.z})`} data-placement-marker={onPlace?selection:undefined}
    role={onPlace?'button':undefined} tabIndex={onPlace?0:undefined} aria-pressed={onPlace?active:undefined}
    aria-label={onPlace?(player?'플레이어 시작 위치':`수비수 ${selection+1} 위치`):undefined}
    onKeyDown={onPlace?event=>key(event,selection):undefined}>
   {onPlace&&<circle className="scenario-marker-hit" r="1.2" fill="transparent"/>}
   <circle r={active?.55:.40} fill={color} stroke={active?'var(--ink,#1c2933)':color} strokeWidth=".1"/>
   {!player&&<text x=".60" y=".22" fill="var(--ink,#1c2933)" fontSize=".75">{selection+1}</text>}
  </g>;
 };
 return <svg className={`scenario-plan ${onPlace?'editable':''} ${preview?'dragging':''}`} viewBox={`${b[0]} ${b[1]} ${b[2]} ${b[3]}`}
   role={onPlace?'group':'img'} aria-label="시나리오 평면도 · 붉은 원은 수비수, 청록색은 시작 위치"
   onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}>
  <rect x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill="var(--plot-bg,#f5f7f4)"/>
  {level.obstacles.map((o,i)=><rect key={i} x={o.box.min.x} y={o.box.min.z} width={o.box.max.x-o.box.min.x} height={o.box.max.z-o.box.min.z} fill="var(--control-border,#798b8b)" stroke="var(--muted,#53636d)" strokeWidth=".04" opacity={o.box.max.y<.5?.45:.85}/>)}
  <polyline points={route.map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke="var(--accent,#146d73)" strokeWidth=".12" strokeDasharray=".5 .35"/>
  {entry&&<polyline points={gateEndpoints(entry).map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke="#9a64ce" strokeWidth=".22"/>}
  {marker('player')}
  {definition.bots.map((bot,i)=><g key={bot.id}>{bot.alternatives.map((p,j)=><circle key={j} cx={p.x} cy={p.z} r=".22" fill="none" stroke="var(--danger,#b74743)" strokeWidth=".08"/>)}{marker(i)}</g>)}
 </svg>;
}
