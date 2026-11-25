import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { KNIFE_ATTACKS, KNIFE_SKINS, WEAPONS } from '../config/weapons';
import { equipKnifeSkin, loadKnifeSkin } from '../config/weaponFinishes';
import { useApp } from '../app/store';
import type { KnifeSkinId } from '../engine/types';

// Original vector silhouettes for the knife designs (interface illustrations).
const BLADE:Record<KnifeSkinId,string>={
  field:'M168 56 L318 50 Q366 54 394 76 Q352 88 300 90 L168 86 Z',
  tanto:'M168 56 L356 54 L396 74 L364 90 L168 88 Z',
  karambit:'M160 58 Q250 44 330 64 Q376 80 386 118 Q352 98 318 90 Q250 76 160 84 Z',
  kunai:'M168 62 Q230 44 300 58 Q350 66 398 72 Q350 78 300 86 Q230 100 168 82 Z',
  aether:'M176 58 L276 56 L276 88 L176 86 Z M290 56 L356 58 Q384 64 398 72 Q384 80 356 86 L290 88 Z',
  obsidian:'M168 56 L230 50 L262 58 L304 48 L350 58 L400 72 L352 88 L300 94 L256 86 L222 92 L168 86 Z',
};
const ACCENT:Partial<Record<KnifeSkinId,string>>={aether:'#34d6c3',obsidian:'#ff5a24',tanto:'#2a7169',karambit:'#d38a52'};

export function KnifeSilhouette({skin}:{skin:KnifeSkinId}){
  const accent=ACCENT[skin],fantasy=skin==='aether'||skin==='obsidian';
  return <svg className={`weapon-silhouette knife ${skin}`} viewBox="0 0 420 140" aria-hidden="true">
    <g strokeLinejoin="round" strokeWidth="1.5" stroke="var(--weapon-outline,#233a43)">
      <path d={BLADE[skin]} fill={skin==='aether'?'#34d6c3':skin==='obsidian'?'#15181d':skin==='field'?'#2a3235':'var(--weapon-metal,#58717a)'} fillOpacity={skin==='aether'?.8:1}/>
      {skin==='obsidian'&&<path d="M232 64 L262 70 M300 62 L326 70 M352 70 L372 74" stroke={accent} strokeWidth="3" fill="none"/>}
      {skin!=='karambit'&&<rect x="152" y={skin==='tanto'?42:48} width="16" height={skin==='tanto'?58:46} rx="3" fill="var(--weapon-dark-metal,#1c282f)"/>}
      <rect x={skin==='kunai'?60:40} y={skin==='kunai'?62:58} width={skin==='kunai'?92:112} height={skin==='kunai'?20:28} rx="8" fill={accent&&!fantasy?accent:'var(--weapon-polymer,#344e58)'}/>
      {skin==='karambit'&&<circle cx="40" cy="72" r="20" fill="none" strokeWidth="8" stroke="var(--weapon-dark-metal,#1c282f)"/>}
      {skin==='kunai'&&<circle cx="46" cy="72" r="14" fill="none" strokeWidth="6" stroke="var(--weapon-dark-metal,#1c282f)"/>}
      {skin==='aether'&&<path d="M70 72 H140" stroke={accent} strokeWidth="3"/>}
    </g>
  </svg>;
}

/** Slot 3: choose the knife design. Equipping applies on the next draw. */
export function KnifeSelection(){
  const group=useId(),[skin,setSkin]=useState(loadKnifeSkin),weapon=useApp(s=>s.weapon),choose=useApp(s=>s.setWeapon);
  const knife=WEAPONS.knife,current=KNIFE_SKINS.find(k=>k.id===skin)??KNIFE_SKINS[0];
  return <section className="knife-selection" aria-labelledby={`${group}-title`}>
    <header><div><p className="weapon-row-category">3번 슬롯 · 근접 무기</p><h2 id={`${group}-title`}>칼</h2></div>
      <button type="button" className={weapon==='knife'?'secondary-button':'primary-button'} aria-pressed={weapon==='knife'} onClick={()=>choose('knife')}>{weapon==='knife'?<><Check size={14} aria-hidden="true"/> 칼로 시작</>:'칼을 들고 시작'}</button></header>
    <p className="knife-selection-note">훈련 중 <kbd>1</kbd> 주무기 · <kbd>2</kbd> 보조무기 · <kbd>3</kbd> 칼. 칼을 들면 {knife.movementSpeed}미터/초로 더 빨리 달립니다. 좌클릭 베기 {KNIFE_ATTACKS.slash.damage} · 우클릭 찌르기 {KNIFE_ATTACKS.stab.damage} 피해.</p>
    <div className="knife-skin-grid" role="radiogroup" aria-label="칼 디자인">
      {KNIFE_SKINS.map(item=><label key={item.id} className={`knife-skin${item.id===skin?' selected':''}`}>
        <input type="radio" name={group} checked={item.id===skin} onChange={()=>setSkin(equipKnifeSkin(item.id))}/>
        <span className="knife-skin-art"><KnifeSilhouette skin={item.id}/></span>
        <span className="knife-skin-text"><strong>{item.name}</strong><small>{item.style==='fantasy'?'판타지':'실제형'} · {item.description}</small></span>
        {item.id===skin&&<Check size={15} aria-label="장착"/>}
      </label>)}
    </div>
    <p className="knife-selection-current" role="status">장착: {current.name}</p>
  </section>;
}
