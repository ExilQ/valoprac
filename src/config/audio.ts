import type { WeaponId } from '../engine/types';
export type AudioAction='fire'|'reload'|'equip'|'elimination';
export const AUDIO_ACTIONS:AudioAction[]=['fire','reload','equip','elimination'];
export interface AudioProfile {reference:string;alternative:string;gain:number;assets:Partial<Record<AudioAction,{path:string;redistributionAuthorized:boolean}>>}
// Original procedural audio is shipped. Empty paths intentionally contain no Riot recordings.
// Supply licensed same-origin files here without touching weapon physics.
export const AUDIO_PROFILES:Record<WeaponId,AudioProfile>={
  rifleA:{reference:'챔피언스 2023 밴달',alternative:'자체 제작 · 금속성 펄스',gain:0.84,assets:{}},
  rifleB:{reference:'챔피언스 2026 팬텀',alternative:'자체 제작 · 소음 억제 파동',gain:0.82,assets:{}},
  sheriff:{reference:'아이온 셰리프',alternative:'자체 제작 · 에너지 리볼버',gain:0.8,assets:{}}
};
