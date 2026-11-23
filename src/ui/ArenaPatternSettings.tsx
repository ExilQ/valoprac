import {useState} from 'react';
import {ARENA_PATTERNS,loadArenaPatterns,storeArenaPatterns,type ArenaPattern,type ArenaPatternPreferences} from '../config/arenaPatterns';

export function ArenaPatternSettings(){
 const [patterns,setPatterns]=useState(loadArenaPatterns);
 const [message,setMessage]=useState('');
 function update(patch:Partial<ArenaPatternPreferences>){
  const next={...patterns,...patch};
  try{storeArenaPatterns(next);setPatterns(next);setMessage('다음 훈련부터 적용됩니다.');}
  catch{setMessage('브라우저에서 재질 설정을 저장할 수 없습니다.');}
 }
 return <section className="settings-card arena-patterns">
  <h3>훈련장 표면 재질</h3>
  <div className="settings-grid">
   {([['floor','floorScale','바닥'],['walls','wallScale','벽']] as const).map(([key,scale,label])=><div className="arena-pattern-control" key={key}>
    <label>{label} 패턴<select value={patterns[key]} onChange={event=>update({[key]:event.target.value as ArenaPattern})}>
     {ARENA_PATTERNS.map(([value,name])=><option key={value} value={value}>{name}</option>)}
    </select></label>
    <label>{label} 패턴 반복 간격 · {patterns[scale]}m<input type="range" min=".25" max="8" step=".05" value={patterns[scale]} disabled={patterns[key]==='plain'} onChange={event=>update({[scale]:Number(event.target.value)})}/></label>
   </div>)}
  </div>
  <p className="field-note">표면 무늬는 실제 훈련장과 편집기의 3D 재질 보기에 적용됩니다.</p>
  {message&&<p role="status">{message}</p>}
 </section>;
}
