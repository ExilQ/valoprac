import type {MouseEvent} from 'react';
import type {ScenarioDefinition} from '../training/scenarios/types';
import {scenarioLevel,scenarioApproach} from '../training/scenarios/validation';

export function ScenarioPlan({definition,selected=0,onPlace}:{definition:ScenarioDefinition;selected?:number|'player';onPlace?:(x:number,z:number)=>void}){
 const level=scenarioLevel(definition),b=level.bounds;
 const place=(event:MouseEvent<SVGSVGElement>)=>{if(!onPlace)return;const svg=event.currentTarget,matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(matrix.inverse());onPlace(Math.round(p.x*100)/100,Math.round(p.y*100)/100);};
 return <svg className={`scenario-plan ${onPlace?'editable':''}`} viewBox={`${b[0]} ${b[1]} ${b[2]} ${b[3]}`} role="img" aria-label="시나리오 평면도 · 붉은 원은 수비수, 청록색은 시작 위치" onClick={place}>
  <rect x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill="#111820"/>
  {level.obstacles.map((o,i)=><rect key={i} x={o.box.min.x} y={o.box.min.z} width={o.box.max.x-o.box.min.x} height={o.box.max.z-o.box.min.z} fill={o.kind==='cover'?'#596e75':'#384650'} opacity={o.box.max.y<.5?.45:.85}/>)}
  <polyline points={scenarioApproach(definition).map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke="#84b7b2" strokeWidth=".12" strokeDasharray=".5 .35"/>
  <circle cx={definition.player.position.x} cy={definition.player.position.z} r={selected==='player'?.5:.35} fill="#84d5c8" stroke="#ecedeb" strokeWidth=".08"/>
  {definition.bots.map((bot,i)=><g key={bot.id}>{bot.alternatives.map((p,j)=><circle key={j} cx={p.x} cy={p.z} r=".22" fill="none" stroke="#ef5261" strokeWidth=".08"/>)}<circle cx={bot.position.x} cy={bot.position.z} r={selected===i?.5:.35} fill="#ef5261" stroke={selected===i?'#ecedeb':'#ef5261'} strokeWidth=".1"/><text x={bot.position.x+.48} y={bot.position.z+.2} fill="#ecedeb" fontSize=".7">{i+1}</text></g>)}
 </svg>;
}
