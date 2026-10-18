import type { SessionData } from '../engine/types';
import { WEAPONS } from '../config/weapons';
export function SprayPlot({session}:{session:SessionData}){
  const wall=session.shots.filter(s=>s.hit==='wall'&&s.impact.z<-29.9).slice(-80);
  const cx=session.summary.spray.centerX,cy=session.summary.spray.centerY;
  const range=Math.max(0.6,...wall.map(s=>Math.max(Math.abs(s.impact.x-cx),Math.abs(s.impact.y-cy))))*1.2;
  const x=(v:number)=>180+(v-cx)/range*145,y=(v:number)=>155-(v-cy)/range*125;
  const compensation=session.shots.filter(s=>s.magazineShot<30).slice(0,30);
  const px=(v:number)=>490+v*8,py=(v:number)=>155-v*8;
  let idealPitch=0,idealYaw=0;const ideal=compensation.map(s=>{const p=WEAPONS[session.weapon].recoil[s.shotIndex%WEAPONS[session.weapon].recoil.length];if(s.firstShot){idealPitch=0;idealYaw=0;}idealPitch-=p[0];idealYaw-=p[1];return `${px(idealYaw)},${py(idealPitch)}`;}).join(' ');
  return <div className="spray-plot"><svg viewBox="0 0 660 300" role="img" aria-label="번호가 표시된 탄착군과 반동 보정 궤적"><defs><pattern id="spray-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#26343c" strokeWidth="0.6"/></pattern></defs><rect width="660" height="300" fill="url(#spray-grid)"/><path d="M 180 30 V 280 M 20 155 H 335 M 490 30 V 280 M 365 155 H 640" stroke="#44585c" strokeDasharray="4 5"/><text x="22" y="23" fill="#9eafaf" fontSize="12">탄착군 · 중심 기준</text><text x="377" y="23" fill="#9eafaf" fontSize="12">마우스 반동 보정 · 도 단위</text>
    {wall.map((s,i)=><g key={i}><circle cx={x(s.impact.x)} cy={y(s.impact.y)} r="3" fill={s.firstShot?'#f6c079':'#8aebc0'}/><text x={x(s.impact.x)+5} y={y(s.impact.y)-4} fontSize="8" fill="#aebdbb">{s.magazineShot+1}</text></g>)}<circle cx="180" cy="155" r="7" fill="none" stroke="#ffc78e"/>
    {session.settings.idealCompensation&&<polyline points={ideal} fill="none" stroke="#f4bf7b" strokeWidth="1.5" strokeDasharray="4 4"/>}<polyline points={compensation.map(s=>`${px(s.playerCompensation.yaw)},${py(s.playerCompensation.pitch)}`).join(' ')} fill="none" stroke="#8aebc0" strokeWidth="1.5"/>
  </svg><p><i className="legend-dot"/> 실제 입력 <i className="legend-dot amber"/> {session.settings.idealCompensation?'패턴 기반 보정':'첫 발 · 탄착 중심'} <span>무작위 산포는 이상적 보정에도 남습니다. 최근 80개 벽 탄착 표시.</span></p></div>;
}
