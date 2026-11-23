import { useState } from 'react';
import { SOURCE_GAMES, convertSensitivity } from '../config/sensitivityConversion';
import { sensitivityUnits } from '../engine/input/sensitivity';
import type { Settings } from '../engine/types';

export function SensitivityConversion({settings,update}:{settings:Settings;update:(patch:Partial<Settings>)=>void}) {
  const [game,setGame]=useState<string>(SOURCE_GAMES[0].id);
  const [value,setValue]=useState('');
  const [dpi,setDpi]=useState('');
  const source=SOURCE_GAMES.find(candidate=>candidate.id===game)??SOURCE_GAMES[0];
  const converted=convertSensitivity(Number(value),source.yaw,dpi?Number(dpi):settings.dpi,settings.degreesPerCount,settings.dpi);
  const canApply=converted!==null&&converted>=.01&&converted<=5;
  return <section className="settings-card sens-conversion">
    <h3>다른 게임 감도 변환</h3>
    <div className="settings-grid">
      <label>게임<select value={game} onChange={event=>setGame(event.target.value)}>{SOURCE_GAMES.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label>게임 감도<input type="number" min=".001" step="any" inputMode="decimal" value={value} onChange={event=>setValue(event.target.value)}/></label>
      <label>게임에서 사용한 DPI<input type="number" min="1" step="1" inputMode="numeric" placeholder={String(settings.dpi)} value={dpi} onChange={event=>setDpi(event.target.value)}/></label>
    </div>
    <p className="field-note">DPI를 비워 두면 현재 VALOPRAC과 같은 DPI로 계산합니다. 변환값은 비조준 360° 회전 거리 기준입니다.</p>
    {converted!==null&&<p><strong>변환 감도 {Number(converted.toFixed(5))}</strong> · {sensitivityUnits(converted,settings.dpi,settings.degreesPerCount).cm360?.toFixed(1)} cm/360°</p>}
    {converted!==null&&!canApply&&<p className="field-note">변환 감도가 적용 범위 0.01–5를 벗어납니다.</p>}
    <button type="button" className="secondary-button" disabled={!canApply} onClick={()=>{if(canApply)update({sensitivity:Number(converted.toFixed(6))});}}>변환 감도 적용</button>
  </section>;
}
