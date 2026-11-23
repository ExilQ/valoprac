import {afterEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {WeaponSelection,WeaponSilhouette} from '../ui/WeaponSelection';
import {useApp} from '../app/store';
import {WEAPONS,WEAPON_ORDER} from '../config/weapons';
import {DEFAULT_SETTINGS} from '../config/settings';
import type {WeaponId} from '../engine/types';

const initial={...useApp.getInitialState()};
function selected(weapon:WeaponId){const patch={weapon,settings:structuredClone(DEFAULT_SETTINGS)};Object.assign(useApp.getInitialState(),patch);useApp.setState(patch);}
const visible=(html:string)=>html.replace(/<[^>]+>/g,'').replace(/<!--.*?-->/g,'');
afterEach(()=>{Object.assign(useApp.getInitialState(),initial);useApp.setState(initial);});

describe('Precision Utility equipment inventory uses actual weapon configuration',()=>{
 for(const id of WEAPON_ORDER)it(`shows ${id} equipment and correct authoritative specifications`,()=>{
  selected(id);const weapon=WEAPONS[id],html=renderToStaticMarkup(<WeaponSelection/>),sheet=html.slice(html.indexOf('class="weapon-equipment-sheet"'));
  expect(html.match(/class="weapon-card(?: selected)?"/g)).toHaveLength(4);
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html).toContain(`aria-label="${weapon.name} 선택"`);
  expect(sheet).toContain(`<h2>${weapon.name}</h2>`);
  expect(sheet).toContain('<dt>발사 속도</dt>');
  expect(visible(sheet)).toContain(`${weapon.fireRate}발/초`);
  expect(visible(sheet)).toContain(`탄창${weapon.magazine}발`);
  expect(visible(sheet)).toContain(`비조준 초탄 산포${weapon.firstSpread}도`);
  for(const damage of weapon.damage)for(const value of [damage.head,damage.body,damage.leg])expect(sheet).toContain(`>${value}</td>`);
  expect(sheet).toContain('<details class="weapon-advanced-details"><summary>거리별 피해와 사격 특성</summary>');
  expect(sheet).not.toContain('<details open');
  expect(sheet).toContain('scope="col"');expect(sheet).toContain('scope="row"');
  expect(html).toContain('이 무기로 훈련 준비');
 });
 it('distinguishes no ADS, rifle ADS and the two actual sniper zoom levels',()=>{
  selected('sheriff');let html=renderToStaticMarkup(<WeaponSelection/>);let sheet=html.slice(html.indexOf('class="weapon-equipment-sheet"'));
  expect(visible(sheet)).toContain('정조준없음');expect(visible(sheet)).toContain('정조준 초탄 산포미지원');
  selected('rifleA');html=renderToStaticMarkup(<WeaponSelection/>);sheet=html.slice(html.indexOf('class="weapon-equipment-sheet"'));expect(visible(sheet)).toContain('정조준1.25배');expect(visible(sheet)).toContain('정조준 초탄 산포0.1575도');
  selected('operator');html=renderToStaticMarkup(<WeaponSelection/>);sheet=html.slice(html.indexOf('class="weapon-equipment-sheet"'));expect(visible(sheet)).toContain('정조준2.5 · 5배');expect(visible(sheet)).toContain(`${WEAPONS.operator.resetTime}초의 볼트 회복`);
 });
 it('keeps the paused compact inventory focused on the four real choices',()=>{
  selected('operator');const html=renderToStaticMarkup(<WeaponSelection compact/>);
  for(const id of WEAPON_ORDER)expect(html).toContain(`aria-label="${WEAPONS[id].name} 선택"`);
  expect(html).not.toContain('weapon-equipment-sheet');expect(html).not.toContain('weapon-utility-footer');expect(html).toContain('2.5 / 5배');
 });
 it('uses original flat vector silhouettes and Korean interface text without decorative foreign labels',()=>{
  selected('rifleB');const html=renderToStaticMarkup(<WeaponSelection/>);
  for(const id of WEAPON_ORDER){const art=renderToStaticMarkup(<WeaponSilhouette id={id}/>);expect(art).toContain('<svg');expect(art).toContain('aria-hidden="true"');expect(art).not.toContain('linearGradient');expect(art).not.toContain('<image');}
  const text=visible(html);for(const label of ['LOADOUT','SELECTED','ASSAULT','SIDEARM','HANDLING','ORIGINAL VALOPRAC EQUIPMENT'])expect(text).not.toContain(label);
  expect(text).toContain('무기를 바꿔도 감도와 훈련 설정은 유지됩니다.');
 });
});
