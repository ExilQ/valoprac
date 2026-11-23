import type { ShotEvent } from '../engine/types';
import type { Runtime, Telemetry } from '../engine/Runtime';
export function LiveRecoil({runtime,telemetry}:{runtime:Runtime|null;telemetry:Telemetry}){
 return <RecoilReadout shots={runtime?.simulation.shots.slice(-36)??[]} spread={telemetry.spread} recoil={telemetry.recoil}/>;
}
export function RecoilReadout({shots,spread,recoil}:{shots:ShotEvent[];spread:number;recoil:number}){
const wall=shots.filter(s=>s.hit==='wall'&&s.impact.z<-29.9);const mx=wall.reduce((a,s)=>a+s.impact.x,0)/Math.max(1,wall.length),my=wall.reduce((a,s)=>a+s.impact.y,0)/Math.max(1,wall.length),extent=Math.max(0.4,...wall.map(s=>Math.max(Math.abs(s.impact.x-mx),Math.abs(s.impact.y-my))));
 const compensation=shots.reduce((sum,s)=>sum+Math.hypot(s.recoil.pitch,s.recoil.yaw),0)/Math.max(1,shots.length);
 return <aside className="live-recoil"><b>반동 분석 · 최근 36발</b><svg viewBox="0 0 240 160" role="img" aria-label="실시간 벽 탄착과 반동 진행"><path d="M 60 15 V 145 M 10 80 H 110 M 130 80 H 230" stroke="#3c5862"/>{wall.map((s,i)=><circle key={i} cx={60+(s.impact.x-mx)/extent*46} cy={80-(s.impact.y-my)/extent*60} r="2" fill="#9de6ca"/>)}<polyline fill="none" stroke="#e8be80" strokeWidth="1.5" points={shots.map((s,i)=>`${130+i/Math.max(1,shots.length-1)*100},${140-Math.min(120,s.recoil.pitch*9)}`).join(' ')}/><polyline fill="none" stroke="#9bc9ec" points={shots.map((s,i)=>`${130+i/Math.max(1,shots.length-1)*100},${80-s.recoil.yaw*8}`).join(' ')}/></svg><span>세로 반동 · 가로 반동</span><small>현재 산포 {spread.toFixed(2)}도 · 잔여 반동 {recoil.toFixed(2)}도</small><small>보정 후 잔여 반동 {compensation.toFixed(2)}도 · 최근 벽 탄착 {wall.length}</small></aside>;
}
