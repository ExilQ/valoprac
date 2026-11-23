import { lazy, Suspense, useId, useState, type CSSProperties } from 'react';
import { equipWeaponFinish, loadWeaponFinishes, WEAPON_FINISHES } from '../config/weaponFinishes';
import { Check, ArrowRight } from 'lucide-react';
import { WEAPONS, WEAPON_ORDER } from '../config/weapons';
import { AUDIO_PROFILES } from '../config/audio';
import { useApp } from '../app/store';
import type { WeaponId } from '../engine/types';
import './weaponUtility.css';

const WeaponInspect=lazy(()=>import('./WeaponInspect'));

// Original vector silhouettes. These are interface illustrations, not game assets.
export function WeaponSilhouette({id}:{id:WeaponId}) {
  return <svg className={`weapon-silhouette ${id}`} viewBox="0 0 420 140" aria-hidden="true"><g fill="var(--weapon-metal,#58717a)" stroke="var(--weapon-outline,#233a43)" strokeWidth="1.5" strokeLinejoin="round">{id==='operator'?<><path d="M12 60h74l24-13h134l11 9h118v12H251l-19 12H118l-19-9-19 8-68-8z"/><path d="M104 72h25l10 42-21 4-15-12zM161 77h31v24h-31z" fill="var(--weapon-polymer,#344e58)"/><path d="M145 31h71v16h-71zM123 27h28v23h-28zM213 27h30v23h-30z"/><path d="M379 54h29v17h-29zM151 45v9M206 45v9M179 24h14v9" strokeWidth="5"/><circle cx="126" cy="67" r="5"/></>:id==='sheriff'?<><path d="M95 44h90l8-8h62l7 8h66v22h-65l-12 13h-65l-13-8h-45l-11 11-15-8z"/><path d="M104 72l34-3 8 12-4 43-27 5-12-9 7-30z" fill="var(--weapon-polymer,#344e58)"/><path d="M188 39q-13 19 0 38h55q12-19 0-38z" fill="var(--weapon-light-metal,#748991)"/><path d="M192 43h12v29h-12zM211 41h12v33h-12zM230 43h9v29h-9z" fill="var(--weapon-dark-metal,#425a65)"/><path d="M146 74h37l7 11-6 16h-35l-8-9z" fill="none" stroke="var(--weapon-edge,#82969e)" strokeWidth="4"/><path d="M160 74l4 17h8" fill="none" stroke="var(--weapon-edge,#82969e)" strokeWidth="3"/><path d="M269 47h55v6h-55zM119 40h15v5h-15zM310 38h8v7h-8zM173 33h13l7 8-12 2z"/><path d="M116 87l15-3-2 29-15 4z" fill="var(--weapon-detail,#263e48)"/><path d="M104 48h70M269 61h56M190 79h50" stroke="var(--weapon-edge,#82969e)" strokeWidth="1"/></>:id==='rifleB'?<><path d="M17 58l57-12 24 8v17l-24 6-56-5z" fill="var(--weapon-polymer,#344e58)"/><path d="M77 52h43v18H77zM107 45h113l15 9h79v16h-82l-20 10h-97l-14-9z"/><path d="M215 48h97v23h-97z" fill="var(--weapon-dark-metal,#425a65)"/><path d="M310 48h88l9 7v9l-9 6h-88z"/><path d="M113 76h24l-6 41-21-3-5-7zM165 78h30l2 39-25 2-4-10z" fill="var(--weapon-polymer,#344e58)"/><path d="M138 79h24v16h-23" fill="none" stroke="var(--weapon-edge,#82969e)" strokeWidth="4"/><path d="M126 37h66v7h-66zM276 41h14v8h-14zM326 45v28M387 49v20"/><path d="M118 52h91M220 55h75M321 54h77" stroke="var(--weapon-edge,#82969e)"/><path d="M224 62h8M240 62h8M256 62h8M272 62h8M288 62h8" stroke="var(--weapon-detail,#263e48)" strokeWidth="3"/><path d="M151 52h37v8h-37z" fill="var(--weapon-detail,#263e48)"/></>:<><path d="M16 48l58-1 25 12-13 15-16 1-54-9z" fill="var(--weapon-polymer,#344e58)"/><path d="M77 52h39v15H77zM102 43h126l16 9h40v17l-37 7h-122l-15-10z"/><path d="M238 48h66v23h-65z" fill="var(--weapon-polymer,#344e58)"/><path d="M301 53h70v10h-70zM370 50h31v16h-31z"/><path d="M126 72h23l-8 43-22-4-4-8z" fill="var(--weapon-polymer,#344e58)"/><path d="M173 77h30l2 23 8 22-26 7-8-19z" fill="var(--weapon-dark-metal,#425a65)"/><path d="M149 76h24v19h-28" fill="none" stroke="var(--weapon-edge,#82969e)" strokeWidth="4"/><path d="M116 36h92v7h-92zM291 41h10v13h-10zM367 42h9v12h-9z"/><path d="M111 48h108M244 53h52M181 92l19-3M184 104l20-4M189 116l17-5" stroke="var(--weapon-edge,#82969e)" strokeWidth="1"/><path d="M244 60h8M258 60h8M272 60h8M286 60h8" stroke="var(--weapon-detail,#263e48)" strokeWidth="3"/><path d="M143 49h45v9h-45z" fill="var(--weapon-detail,#263e48)"/></>}</g></svg>;
}

const CATEGORY:Record<WeaponId,string>={rifleA:'자동 소총',rifleB:'소음 소총',sheriff:'정밀 리볼버',operator:'볼트 액션 저격총'};
const PURPOSE:Record<WeaponId,string>={rifleA:'거리에 흔들리지 않는 첫 발을 연습하세요.',rifleB:'짧은 연사와 이동 뒤 멈추는 타이밍을 익히세요.',sheriff:'한 번의 조준과 한 발의 정확도에 집중하세요.',operator:'스코프 조준과 볼트 회복 사이의 판단을 연습하세요.'};
const decimal=(value:number)=>Number.isInteger(value)?String(value):value.toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
const zoomLabel=(id:WeaponId)=>id==='operator'?'2.5 / 5배':WEAPONS[id].adsZoom>1?`${decimal(WEAPONS[id].adsZoom)}배`:'미지원';
const distanceLabel=(id:WeaponId,index:number)=>{const values=WEAPONS[id].damage,lower=index===0?0:values[index-1].maxDistance,upper=values[index].maxDistance;return Number.isFinite(upper)?`${lower}–${decimal(upper)}미터`:`${lower}미터 이상`;};

/** The inventory changes only the existing equipped-weapon state. */
export function WeaponSelection({compact=false}:{compact?:boolean}) {
 const selected=useApp(s=>s.weapon),choose=useApp(s=>s.setWeapon),setTab=useApp(s=>s.setTab),weapon=WEAPONS[selected],closeDamage=weapon.damage[0];
 const finishGroup=useId();
 const [inspect,setInspect]=useState(false);
 const [finishes,setFinishes]=useState(loadWeaponFinishes);
 const [finishMessage,setFinishMessage]=useState('');
 const finishId=finishes[selected]??'original',finish=WEAPON_FINISHES[finishId];
 const color=(value:number)=>`#${value.toString(16).padStart(6,'0')}`;
 const swatches=finishId==='original'?undefined:{'--weapon-metal':color(finish.steel),'--weapon-polymer':color(finish.polymer),'--weapon-edge':color(finish.edge),'--weapon-dark-metal':color(finish.dark)} as CSSProperties;
 return <section className={`weapon-selection precision-weapons ${compact?'compact':''}`}>
  {!compact&&<header className="view-title weapon-utility-heading"><p className="eyebrow">훈련 장비</p><h1>무기 선택</h1><p>조준 방식과 훈련 목적에 맞춰 선택하세요. 장착은 바로 적용됩니다.</p></header>}
  <div className="inventory-layout weapon-utility-layout">
   <div className="weapon-inventory"><div className="weapon-inventory-caption"><span>사용할 무기</span><span>4종</span></div><div className="weapon-card-grid weapon-inventory-list" role="group" aria-label="무기 선택">
    {WEAPON_ORDER.map((id,index)=>{const item=WEAPONS[id],active=selected===id;return <button type="button" className={`weapon-card${active?' selected':''}`} aria-pressed={active} aria-label={`${item.name} 선택`} onClick={()=>choose(id)} key={id}>
     <span className="weapon-row-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><span className="weapon-row-art"><WeaponSilhouette id={id}/></span>
     <span className="weapon-row-info"><span className="weapon-row-category">{CATEGORY[id]}</span><strong>{item.name}</strong><span className="weapon-row-summary">{item.magazine}발 · {zoomLabel(id)==='미지원'?'정조준 없음':`정조준 ${zoomLabel(id)}`}</span></span>
     <span className="weapon-row-marker">{active?<><Check size={16} aria-hidden="true"/><span>장착</span></>:<span>선택</span>}</span>
    </button>;})}
   </div><p className="weapon-inventory-note">무기를 바꿔도 감도와 훈련 설정은 유지됩니다.</p></div>
   {!compact&&<article className="weapon-equipment-sheet" aria-label="선택한 무기 정보"><header className="weapon-sheet-header"><div><p>{CATEGORY[selected]}</p><h2>{weapon.name}</h2></div><span className="weapon-equipped"><Check size={14} aria-hidden="true"/> 현재 장착</span></header>
    <div className="weapon-sheet-art" style={swatches}><WeaponSilhouette id={selected}/><span>{finish.title}</span></div>
    <button type="button" className="secondary-button" aria-expanded={inspect} onClick={()=>setInspect(value=>!value)}>{inspect?'3D 무기 보기 닫기':'무기 3D로 보기'}</button>
    {inspect&&<Suspense fallback={<p role="status">3D 무기를 불러오는 중입니다.</p>}><WeaponInspect weapon={selected} finish={finishId}/></Suspense>}
    <fieldset className="weapon-finishes"><legend>무기 스킨</legend>{(Object.keys(WEAPON_FINISHES) as (keyof typeof WEAPON_FINISHES)[]).map(id=><label key={id}><input type="radio" name={finishGroup} checked={id===finishId} onChange={()=>{try{setFinishes(equipWeaponFinish(selected,id));setFinishMessage('');}catch{setFinishMessage('무기 스킨을 저장하지 못했습니다.');}}}/><i aria-hidden="true" style={{background:color(WEAPON_FINISHES[id].steel),borderColor:color(WEAPON_FINISHES[id].edge)}}/>{WEAPON_FINISHES[id].title}</label>)}</fieldset>
    {finishMessage&&<p className="inline-notice" role="status">{finishMessage}</p>}
    <p className="weapon-sheet-purpose">{PURPOSE[selected]}</p>
    <dl className="weapon-utility-specs"><div><dt>발사 속도</dt><dd>{decimal(weapon.fireRate)}<small>발/초</small></dd></div><div><dt>탄창</dt><dd>{weapon.magazine}<small>발</small></dd></div><div><dt>정조준</dt><dd className="weapon-zoom-value">{selected==='operator'?'2.5 · 5':weapon.adsZoom>1?decimal(weapon.adsZoom):'없음'}{weapon.adsZoom>1&&<small>배</small>}</dd></div><div><dt>비조준 초탄 산포</dt><dd>{decimal(weapon.firstSpread)}<small>도</small></dd></div></dl>
    <div className="weapon-near-damage"><div><span>근거리 피해</span><small>{distanceLabel(selected,0)}</small></div><dl><div><dt>머리</dt><dd>{decimal(closeDamage.head)}</dd></div><div><dt>몸통</dt><dd>{decimal(closeDamage.body)}</dd></div><div><dt>다리</dt><dd>{decimal(closeDamage.leg)}</dd></div></dl></div>
    <details className="weapon-advanced-details"><summary>거리별 피해와 사격 특성</summary><div className="weapon-advanced-content"><table><caption>거리별 피해</caption><thead><tr><th scope="col">거리</th><th scope="col">머리</th><th scope="col">몸통</th><th scope="col">다리</th></tr></thead><tbody>{weapon.damage.map((damage,index)=><tr key={index}><th scope="row">{distanceLabel(selected,index)}</th><td>{decimal(damage.head)}</td><td>{decimal(damage.body)}</td><td>{decimal(damage.leg)}</td></tr>)}</tbody></table>
     <dl className="weapon-handling-readouts"><div><dt>재장전</dt><dd>{decimal(weapon.reloadTime)}초</dd></div><div><dt>장착 시간</dt><dd>{decimal(weapon.equipTime)}초</dd></div><div><dt>정조준 초탄 산포</dt><dd>{weapon.adsZoom>1?`${decimal(weapon.firstSpread*weapon.adsSpread)}도`:'미지원'}</dd></div></dl>
     <p>{selected==='operator'?`한 번 클릭하면 한 발을 발사합니다. 사격 뒤 ${decimal(weapon.resetTime)}초의 볼트 회복이 필요하며, 이동·비조준·착지 직후에는 오차가 커집니다.`:selected==='sheriff'?'클릭마다 한 발을 발사합니다. 연속 발사 중에는 정확도가 회복될 시간을 확보하세요.':'이동 속도와 연사 횟수에 따라 산포가 커집니다. 멈춘 뒤 짧게 사격하는 연습부터 시작하세요.'}</p><small>{AUDIO_PROFILES[selected].alternative} · 자체 제작 대체음</small>
    </div></details>
   </article>}
  </div>
  {!compact&&<footer className="weapon-foot weapon-utility-footer"><p>반동·회복·산포는 보정 가능한 훈련 모델이며, 실제 게임과 완전한 일치는 검증하지 않았습니다.</p><button type="button" className="primary-button" onClick={()=>setTab('training')}>이 무기로 훈련 준비 <ArrowRight size={16} aria-hidden="true"/></button></footer>}
 </section>;
}
