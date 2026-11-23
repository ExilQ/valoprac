import type {Simulation} from '../engine/simulation/Simulation';
import type {Settings} from '../engine/types';
import {Vector3} from 'three';
import {visibleBetween} from '../engine/tactical/levels';
const LABELS={stationary:'정지 · 회복',walking:'걷기 · 잔여 유지',crouching:'앉기 · 잔여 유지',running:'달리기',braking:'제동 중 · 누적 회복',transition:'걷기·앉기 전환 중 · 감속',slow:'저속 이동',airborne:'공중 · 누적 보존'};

/** Readouts use the existing authoritative footstep state. Disclosure content
 * explains the calibration without occupying the combat view by default. */
export function FootstepHUD({simulation:s,settings}:{simulation:Simulation|null;settings:Settings}){
 if(!s||!settings.footstepHud&&!settings.soundMinimap)return null;
 const f=s.footsteps,p=f.profile,flash=s.time-f.lastAudibleAt<.22,events=f.recent().filter(e=>e.id>0&&s.time-e.timestamp>=0&&s.time-e.timestamp<.85),bounds=s.level?.bounds??(s.practiceMap==='tactical'?[-24,-24,48,48]:[-13,-31,26,42]);
 const eye={x:s.movement.position.x,y:s.movement.position.y+s.movement.eyeHeight,z:s.movement.position.z},head=new Vector3(),debug=settings.botDiagnostics,learning=settings.combatMode==='learning';
 const visibleTargets=s.targets.filter(t=>{if(!t.active||!t.enabled)return false;if(debug||learning)return true;t.headPosition(head);const dx=head.x-eye.x,dz=head.z-eye.z,distance=Math.hypot(dx,dz);return (-Math.sin(s.viewYaw)*dx-Math.cos(s.viewYaw)*dz)/Math.max(.0001,distance)>=Math.cos(settings.fov*Math.PI/360)&&visibleBetween(s.obstacles,eye,head);});
 const percent=Math.round(f.footstepAccumulation*100),risk=!flash&&(f.footstepAccumulation>=p.threshold*.75||f.nextEligibleMeters<.35);
 return <aside className="footstep-hud" aria-label="발소리 훈련 정보">
  {settings.soundMinimap&&<section className="hearing-map">
   <header><b>{s.practiceMap==='tactical'?'코너 피킹 지도':'훈련장 지도'}</b><span>청취 {p.hearingRadius}m</span></header>
   <svg viewBox={bounds.join(' ')} role="img" aria-label="실제 발소리 발생 위치와 청취 반경"><defs><clipPath id="hearing-map-clip"><rect x={bounds[0]} y={bounds[1]} width={bounds[2]} height={bounds[3]}/></clipPath></defs><g clipPath="url(#hearing-map-clip)"><rect x={bounds[0]} y={bounds[1]} width={bounds[2]} height={bounds[3]} fill="var(--hud-map,#16252c)"/>{s.obstacles.map((o,i)=><rect key={i} x={o.box.min.x} y={o.box.min.z} width={o.box.max.x-o.box.min.x} height={o.box.max.z-o.box.min.z} fill="var(--hud-map-wall,#6f858b)"/>)}{events.map(e=><circle key={e.id} data-sound-event={e.id} cx={e.position.x} cy={e.position.z} r={e.radius} fill="var(--hud-sound-fill,#e8bb5920)" stroke="var(--hud-warning,#ebc878)" strokeWidth=".16" opacity={1-(s.time-e.timestamp)/.85}/>)}{visibleTargets.map(t=><circle key={t.id} data-visible-bot={t.id} cx={t.position.x} cy={t.position.z} r=".45" fill={debug&&(s.hearing?.memories[t.id]??s.angles?.memories[t.id])?.alertUntil!>s.time?'var(--hud-danger,#ffaaa3)':'var(--hud-muted,#bccbd0)'}/>)}<circle cx={s.movement.position.x} cy={s.movement.position.z} r=".5" fill="var(--hud-accent,#91d7cf)"/><path d={`M ${s.movement.position.x} ${s.movement.position.z} l ${-Math.sin(s.yaw)*1.8} ${-Math.cos(s.yaw)*1.8}`} stroke="var(--hud-accent,#91d7cf)" strokeWidth=".22"/></g></svg>
   <div className="hearing-map-status"><i aria-hidden="true"/>{events.length?'발소리 발생 위치 표시':'아직 들리는 발소리 없음'}</div>
   <details className="hud-footstep-details"><summary>지도 표시 기준</summary><small>발생한 소리의 청취 반경 · {p.hearingRadius}미터</small><small>실제 시야에 보이는 표적만 표시합니다. 학습·개발 진단에서는 별도 표시가 적용됩니다.{debug&&s.hearing?` · 경계 중인 봇 ${s.hearing.memories.filter(m=>m.alertUntil>s.time).length}개`:''}</small></details>
  </section>}
  {settings.footstepHud&&<section className={`footstep-gauge${flash?' step-flash':''}${risk?' step-caution':''}`} data-footstep-state={f.state}>
   <div className="footstep-gauge-heading"><b>발소리 누적 게이지</b><strong>{percent}%</strong></div>
   <div className="step-meter" role="meter" aria-label="발소리 누적" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% · ${LABELS[f.state]}`}><i style={{width:`${f.footstepAccumulation*100}%`}}/><b style={{left:`${p.threshold*100}%`}}/></div>
   <div className="footstep-state-line"><span>{LABELS[f.state]}</span>{flash?<b className="step-audible">발소리 발생</b>:risk?<b className="step-risk">발소리 임박</b>:null}</div>
   <details className="hud-footstep-details"><summary>누적 기준과 이동 여유</summary><small>다음 발소리 기준 {(p.threshold*100).toFixed(0)}% · 소리 {f.totalEvents}회</small><small className={f.nextEligibleMeters<.35?'step-risk':''}>{f.nextEligibleMeters<.35?'재가속하면 발소리 임박':`빠른 이동 약 ${f.nextEligibleMeters.toFixed(2)}미터 여유`}</small><small>훈련용 누적 모델 · 공식 게임 수치 아님</small></details>
  </section>}
 </aside>;
}
