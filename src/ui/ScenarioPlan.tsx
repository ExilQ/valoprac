import type {MouseEvent} from 'react';
import type {ScenarioDefinition} from '../training/scenarios/types';
import {scenarioLevel,scenarioApproach} from '../training/scenarios/validation';

export function ScenarioPlan({definition,selected=0,onPlace}:{definition:ScenarioDefinition;selected?:number|'player';onPlace?:(x:number,z:number)=>void}){
 const level=scenarioLevel(definition);
 const route=scenarioApproach(definition);
 const points=[...route,...definition.bots.flatMap(bot=>[bot.position,...bot.alternatives])];
 const padding=4,[left,top,width,height]=level.bounds;
 const x=Math.max(left,Math.min(...points.map(point=>point.x))-padding);
 const z=Math.max(top,Math.min(...points.map(point=>point.z))-padding);
 const right=Math.min(left+width,Math.max(...points.map(point=>point.x))+padding);
 const bottom=Math.min(top+height,Math.max(...points.map(point=>point.z))+padding);
 const b=onPlace?level.bounds:[x,z,right-x,bottom-z];
 const place=(event:MouseEvent<SVGSVGElement>)=>{if(!onPlace)return;const svg=event.currentTarget,matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(matrix.inverse());onPlace(Math.round(p.x*100)/100,Math.round(p.y*100)/100);};
 return <svg className={`scenario-plan ${onPlace?'editable':''}`} viewBox={`${b[0]} ${b[1]} ${b[2]} ${b[3]}`} role="img" aria-label="시나리오 평면도 · 붉은 원은 수비수, 청록색은 시작 위치" onClick={place}>
  <rect x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill="var(--plot-bg,#f5f7f4)"/>
  {level.obstacles.map((o,i)=><rect key={i} x={o.box.min.x} y={o.box.min.z} width={o.box.max.x-o.box.min.x} height={o.box.max.z-o.box.min.z} fill="var(--control-border,#798b8b)" stroke="var(--muted,#53636d)" strokeWidth=".04" opacity={o.box.max.y<.5?.45:.85}/>)}
  <polyline points={route.map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke="var(--accent,#146d73)" strokeWidth=".12" strokeDasharray=".5 .35"/>
  <circle cx={definition.player.position.x} cy={definition.player.position.z} r={selected==='player'?.5:.35} fill="var(--accent,#146d73)" stroke="var(--ink,#1c2933)" strokeWidth=".08"/>
  {definition.bots.map((bot,i)=><g key={bot.id}>{bot.alternatives.map((p,j)=><circle key={j} cx={p.x} cy={p.z} r=".22" fill="none" stroke="var(--danger,#b74743)" strokeWidth=".08"/>)}<circle cx={bot.position.x} cy={bot.position.z} r={selected===i?.5:.35} fill="var(--danger,#b74743)" stroke={selected===i?'var(--ink,#1c2933)':'var(--danger,#b74743)'} strokeWidth=".1"/><text x={bot.position.x+.48} y={bot.position.z+.2} fill="var(--ink,#1c2933)" fontSize=".7">{i+1}</text></g>)}
 </svg>;
}
