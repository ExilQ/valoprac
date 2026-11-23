import { useState } from 'react';
import type { SessionData, ShotEvent } from '../engine/types';

const SHOT_LIMIT = 80;
const HIT_LABEL = { head:'머리', torso:'몸통', arm:'팔', leg:'다리', wall:'엄폐물', miss:'빗나감' };

function components(shot: ShotEvent) {
  return [
    Math.max(0, shot.spread.base),
    Math.max(0, shot.spread.movement),
    Math.max(0, shot.spread.bloom),
    Math.max(0, shot.spread.air) + Math.max(0, shot.spread.landing ?? 0),
  ];
}
const COMPONENT_LABELS = ['기본', '이동', '연사', '공중·착지'];
const degrees = (value: number) => `${value.toFixed(2)}°`;

export function ShotTimeline({ session, onSeek }: { session: SessionData; onSeek?: (timestamp: number) => void }) {
  const [selected, select] = useState<number | undefined>(undefined);
  const rows = session.shots.slice(-SHOT_LIMIT)
    .filter(shot => shot?.spread && Number.isFinite(shot.timestamp) && shot.timestamp >= 0 && shot.timestamp <= session.duration + 1e-6)
    .map((shot, index) => ({ shot, index, parts: components(shot) }))
    .filter(row => row.parts.every(Number.isFinite));
  const row = rows.find(item => item.index === selected) ?? rows.at(-1);
  if (!row) return null;
  const maximum = Math.max(.1, ...rows.map(item => item.parts.reduce((sum, value) => sum + value, 0)));
  const { shot, parts } = row;
  const delta = shot.thresholdDelta;
  return <section className="data-card shot-timeline" aria-label="발사별 사격 오차">
    <h3>발사별 사격 오차 <span>최근 상세 기록 {rows.length}발</span></h3>
    <div className="shot-key">{COMPONENT_LABELS.map((label, i) => <span key={label}><i className={`shot-part part-${i}`}/>{label}</span>)}</div>
    <div className="shot-bars" role="group" aria-label="시간순 발사 선택">
      {rows.map(item => <button type="button" key={item.index} aria-pressed={row.index === item.index}
        aria-label={`${item.shot.timestamp.toFixed(2)}초 · ${HIT_LABEL[item.shot.hit]}`} onClick={() => select(item.index)}>
        <span aria-hidden="true" className="shot-stack">
          {item.parts.map((value, index) => <i key={index} className={`shot-part part-${index}`} style={{ height:`${value / maximum * 100}%` }}/>)}
        </span>
      </button>)}
    </div>
    <div className="shot-readout" aria-live="polite">
      <strong>{shot.timestamp.toFixed(2)}초 · {HIT_LABEL[shot.hit]}</strong>
      <span>{COMPONENT_LABELS.map((label, i) => `${label} ${degrees(parts[i])}`).join(' · ')}</span>
      {typeof delta === 'number' && Number.isFinite(delta) && <span>이동 정확도 기준 {Math.round(Math.abs(delta) * 1000)}ms {delta < 0 ? '전' : '후'} 발사</span>}
      {typeof shot.angularError === 'number' && Number.isFinite(shot.angularError) && <span>실제 탄도와 표적 머리 사이 {degrees(shot.angularError)}</span>}
      {onSeek && <button className="secondary-button" onClick={() => onSeek(Math.min(shot.timestamp, session.duration))}>이 발 리플레이</button>}
    </div>
  </section>;
}
