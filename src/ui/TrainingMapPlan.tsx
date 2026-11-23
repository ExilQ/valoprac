import {MapPin} from 'lucide-react';
import {levelFor} from '../engine/tactical/levels';
import {ENVIRONMENT} from '../engine/collision/environment';

/** Menu-only plan drawn from the same original collision/route definitions. */
export function TrainingMapPlan({map}:{map:string}){
 const level=levelFor(map),obstacles=level?.obstacles??ENVIRONMENT,bounds=level?.bounds??[-13,-31,26,42],spawn=level?.spawn??{x:0,y:0,z:5},angles=level?.angles??[],route=level?.route??[];
 if(map==='tactical')return <div className="utility-legacy-map-note"><MapPin size={30}/><strong>기존 코너 피킹</strong><p>이전 발소리 시제품입니다. 노출 사망은 지원하지 않습니다.</p></div>;
 return <svg className="utility-map-plan" viewBox={`${bounds[0]-1} ${bounds[1]-1} ${bounds[2]+2} ${bounds[3]+2}`} role="img" aria-label={`${map==='range'?'기본 사격장':level?.title??'현재 맵'} 실제 엄폐물과 이동 경로 평면도`}>
  <rect x={bounds[0]} y={bounds[1]} width={bounds[2]} height={bounds[3]} className="utility-plan-floor"/>
  {obstacles.map((o,i)=><rect key={i} x={o.box.min.x} y={o.box.min.z} width={Math.max(.12,o.box.max.x-o.box.min.x)} height={Math.max(.12,o.box.max.z-o.box.min.z)} className={o.kind==='wall'?'utility-plan-wall':'utility-plan-cover'}/>)}
  {route.length>1&&<polyline points={route.map(p=>`${p.x},${p.z}`).join(' ')} className="utility-plan-route" fill="none" strokeWidth=".35"/>}
  {angles.map(angle=><circle key={angle.id} cx={angle.position.x} cy={angle.position.z} r=".7" className="utility-plan-defender"/>)}
  <circle cx={spawn.x} cy={spawn.z} r=".85" className="utility-plan-start"/><path d={`M${spawn.x-1.5} ${spawn.z+2.3}h3l-1.5-1.4z`} className="utility-plan-start"/>
 </svg>;
}

