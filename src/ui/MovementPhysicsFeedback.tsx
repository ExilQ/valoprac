import type {Simulation} from '../engine/simulation/Simulation';
import type {Settings} from '../engine/types';
import type {Movement} from '../engine/movement/Movement';
import {movementPhysicsLabel} from './MovementPhysicsSettings';
const fixed=(n:number)=>Number.isFinite(n)?n.toFixed(2):'—';
const vector=(v:{x:number;y:number;z:number})=>`${fixed(v.x)}, ${fixed(v.y)}, ${fixed(v.z)}`;
const since=(at:number|null,now:number)=>at===null||!Number.isFinite(at)?'—':`${Math.max(0,now-at).toFixed(2)}초`;
export function MovementProfileStatus({settings,movement}:{settings:Settings;movement?:Movement}){
 const snapshot=movement?.physicsSnapshot();
 const selected=snapshot?{movementPhysics:snapshot.profile,csMovementPreset:snapshot.preset??'cs2' as const}:settings;
 return <div className="movement-profile-status" role="status" aria-label="현재 이동 물리엔진" data-movement-physics={selected.movementPhysics}>물리 · {movementPhysicsLabel(selected)}</div>;
}
/** Essential contact/timing feedback is pinned outside the scrollable optional
 * stack. It is readable with Pointer Lock, without opening or scrolling details. */
export function MovementPhysicsDiagnostics({simulation:s}:{simulation:Simulation}){
 if(!s.settings.physicsDiagnostics)return null;
 const p=s.movement.physicsSnapshot(),h=s.movement.hopSnapshot(),timing=h.lastInputTimingMs;
 return <aside className="movement-physics-diagnostics" aria-label="이동 물리 진단" data-physics-profile={p.profile}><h3>이동 물리 진단 <span>{p.grounded?'지상':'공중'}</span></h3><div className="physics-essential-readouts"><span className="physics-speeds"><span>수평 · 수직 속도</span><b>{fixed(p.horizontalSpeed)} · {fixed(p.verticalSpeed)}m/s</b></span><span className="physics-jump-times"><span>최근 점프 · 착지</span><b>{since(p.lastJumpAt,s.time)} · {since(p.lastLandingAt,s.time)}</b></span><span className="physics-chain-timing"><span>연속 점프 · 입력</span><b>{p.chainedJumps}회 · {timing===null?'—':`${timing>=0?'+':''}${Math.round(timing)}ms`}</b></span><span className="physics-air-buffer"><span>공중 가속 · 입력 창</span><b>{fixed(Math.hypot(p.airAcceleration.x,p.airAcceleration.z))}m/s² · {Math.round(p.effectiveJumpBufferMs)}ms</b></span></div></aside>;
}
/** Secondary vector details can use the optional stack; essential jump rows
 * above never depend on this disclosure's size or scroll position. */
export function MovementPhysicsDetails({simulation:s}:{simulation:Simulation}){
 if(!s.settings.physicsDiagnostics)return null;
 const p=s.movement.physicsSnapshot();
 const direction=(v:{x:number;z:number})=>{const length=Math.hypot(v.x,v.z);return length>1e-8?{x:v.x/length*27,z:v.z/length*27}:{x:0,z:0};},velocity=direction(p.velocity),wish=direction(p.wishDirection),acceleration=direction(p.acceleration);
 return <details className="physics-vector-details" aria-label="이동 물리 세부 정보"><summary>이동 벡터 · 세부 정보</summary><div className="mechanics-readouts"><span>실제 속도 벡터<b>{vector(p.velocity)}m/s</b></span><span>실제 가속<b>{vector(p.acceleration)}m/s²</b></span><span>공중 가속 기여<b>{vector(p.airAcceleration)}m/s²</b></span><span>입력 방향<b>{fixed(p.wishDirection.x)}, {fixed(p.wishDirection.z)}</b></span><span>속도 방향<b>{fixed(velocity.x/27)}, {fixed(velocity.z/27)}</b></span></div><svg viewBox="-34 -34 68 68" role="img" aria-label="현재 속도, 희망 입력과 실제 가속의 수평 방향"><path d="M -32 0 H 32 M 0 -32 V 32" stroke="var(--line)" strokeWidth=".6"/><line x1="0" y1="0" x2={velocity.x} y2={velocity.z} stroke="var(--interactive)" strokeWidth="1.7"/><line x1="0" y1="0" x2={wish.x} y2={wish.z} stroke="var(--success)" strokeWidth="1.2"/><line x1="0" y1="0" x2={acceleration.x} y2={acceleration.z} stroke="var(--warning)" strokeWidth="1.2"/><circle cx="0" cy="0" r="1.2" fill="var(--ink)"/></svg><small><i/> 속도 <i/> 입력 <i/> 가속 · 방향을 정규화한 표시</small></details>;
}
