import { Check, Crosshair, ArrowRight } from 'lucide-react';
import { WEAPONS, WEAPON_ORDER } from '../config/weapons';
import { AUDIO_PROFILES } from '../config/audio';
import { useApp } from '../app/store';
import type { WeaponId } from '../engine/types';

// Original vector silhouettes. These are interface illustrations, not game assets.
export function WeaponSilhouette({id}:{id:WeaponId}) {
  return <svg className={`weapon-silhouette ${id}`} viewBox="0 0 420 140" aria-hidden="true"><defs><linearGradient id={`metal-${id}`} x2="0" y2="1"><stop stopColor="#cad1d3"/><stop offset="1" stopColor="#52616b"/></linearGradient></defs><g fill={`url(#metal-${id})`} stroke="#1d2b32" strokeWidth="2">{id==='sheriff'?<><path d="M96 47h190v20H178l-22 19-17-15H96z"/><path d="M190 42h59v37h-59zM132 68h39l-12 58h-36z"/><path d="M158 76h45v26h-38l-9-9z" fill="none" stroke="#97a4ab" strokeWidth="6"/><path d="M259 40h15v8h-15zM104 38h15v11h-15z"/></>:<><path d="M22 47l66 1 19-11h139l21 12h102v14H265l-25 16H119l-17-8-25 7-55-5z"/><path d="M162 77h43l-5 43-30-2zM120 73h26l-9 48-25-5z"/><path d="M147 78h20v22h-25" fill="none" stroke="#97a4ab" strokeWidth="5"/><path d="M113 30h97v8h-97zM298 40h12v10h-12z"/>{id==='rifleB'?<path d="M353 44h56v24h-56zM79 44h21v27H79z"/>:<path d="M367 47h27v15h-27zM240 38l31 9-9 20-31 8z"/>}</>}</g><path d={id==='sheriff'?'M195 48h46M100 54h73':'M109 50h126M275 55h56'} stroke="var(--accent)" strokeWidth="3"/><path d="M20 135h380" stroke="currentColor" opacity=".12"/></svg>;
}
export function WeaponSelection({compact=false}:{compact?:boolean}) {
  const selected=useApp(s=>s.weapon),choose=useApp(s=>s.setWeapon),setTab=useApp(s=>s.setTab);
  return <section className={`weapon-selection ${compact?'compact':''}`}>
    {!compact&&<header className="view-title"><p className="eyebrow">정확한 한 발을 위한 선택</p><h1>무기 선택</h1><p>선택한 무기는 다음 훈련과 현재 일시정지된 훈련에 바로 반영됩니다.</p></header>}
    <div className="weapon-card-grid">{WEAPON_ORDER.map((id,i)=>{const w=WEAPONS[id];return <button className={`weapon-card ${selected===id?'selected':''}`} aria-pressed={selected===id} onClick={()=>choose(id)} key={id}>
      <div className="weapon-card-heading"><span>0{i+1} / {w.fireMode==='auto'?'자동 소총':'정밀 리볼버'}</span>{selected===id?<span className="selected-label"><Check size={14}/> 장착 선택</span>:<span>선택</span>}</div>
      <WeaponSilhouette id={id}/><div className="weapon-title"><h2>{w.name}</h2><span>{id==='rifleA'?'강한 초반 상승':id==='rifleB'?'부드러운 초기 연사':'단발 정밀 사격'}</span></div>
      <dl><div><dt>탄창</dt><dd>{w.magazine}발</dd></div><div><dt>발사 속도</dt><dd>{w.fireRate}발/초</dd></div><div><dt>초탄 산포</dt><dd>{w.firstSpread}도</dd></div><div><dt>정조준</dt><dd>{w.adsZoom>1?'1.25배':'미지원'}</dd></div></dl>
      {!compact&&<><div className="weapon-damage"><span>거리별 피해 · 머리 / 몸통 / 다리</span>{w.damage.map((d,j)=><p key={j}><b>{j===0?'0':w.damage[j-1].maxDistance}–{Number.isFinite(d.maxDistance)?`${d.maxDistance}미터`:'최대 거리'}</b><span>{d.head} / {d.body} / {d.leg}</span></p>)}</div><p className="weapon-audio">{AUDIO_PROFILES[id].reference} 참고 프로필<br/><strong>현재 기본음: 자체 제작 대체음</strong></p></>}
    </button>;})}</div>
    {!compact&&<footer className="weapon-foot"><p>반동 곡선과 회복은 추정 모델입니다. 실제 게임과 동일하다고 검증하지 않았습니다.</p><button className="primary-button" onClick={()=>setTab('training')}><Crosshair size={16}/> 훈련 준비 <ArrowRight size={16}/></button></footer>}
  </section>;
}
