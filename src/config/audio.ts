import type { GunId } from '../engine/types';
export type AudioAction='fire'|'reload'|'equip'|'elimination'|'bolt'|'scope';
export const AUDIO_ACTIONS:AudioAction[]=['fire','reload','equip','elimination','bolt','scope'];
export interface AudioProfile {reference:string;alternative:string;gain:number;assets:Partial<Record<AudioAction,{path:string;redistributionAuthorized:boolean}>>}
// Original procedural audio is shipped. Empty paths intentionally contain no Riot recordings.
// Supply licensed same-origin files here without touching weapon physics.
export const AUDIO_PROFILES:Record<GunId,AudioProfile>={
  rifleA:{reference:'챔피언스 2023 밴달',alternative:'자체 제작 · 단단한 파열음과 묵직한 저음 펀치',gain:0.84,assets:{}},
  rifleB:{reference:'챔피언스 2026 팬텀',alternative:'자체 제작 · 소음기 공기음과 또렷한 노리쇠 소리',gain:0.82,assets:{}},
  operator:{reference:'Operator PC · 공개 사양 참조',alternative:'자체 제작 · 거대한 저음 충격과 긴 잔향, 볼트 조작음',gain:.86,assets:{}},
  sheriff:{reference:'아이온 셰리프',alternative:'자체 제작 · 큰 폭발음과 짧게 울리는 총신',gain:0.8,assets:{}}
};
