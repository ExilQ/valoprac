import type { KnifeSkinId, WeaponId } from '../engine/types';

export const WEAPON_FINISHES = {
  original: { title: '기본 마감', steel: 0x58717a, edge: 0x8d999b, polymer: 0x344e58, dark: 0x1c282f },
  slate: { title: '극야 슬레이트', steel: 0x303c61, edge: 0xe19457, polymer: 0x252d47, dark: 0x1c2437 },
  ceramic: { title: '청록 세라믹', steel: 0xc8d8d6, edge: 0x30867c, polymer: 0x586d76, dark: 0x283d44 },
  bronze: { title:'사막 브론즈', steel:0x9f6e49, edge:0xf0c68c, polymer:0x514037, dark:0x292829, roughness:.44 },
  midnight: { title:'인디고 카본', steel:0x41405e, edge:0x9986c4, polymer:0x31354d, dark:0x222438, roughness:.24 },
} as const;

export type FinishId = keyof typeof WEAPON_FINISHES;
export type WeaponSurfaceFinish = {
  steel:number;edge:number;polymer:number;dark:number;roughness?:number;
};
type EquippedFinishes = Partial<Record<WeaponId, FinishId>>;
const KEY = 'valoprac-weapon-finishes-v1';
const WEAPONS = ['rifleA', 'rifleB', 'sheriff', 'operator'] as const;

export function loadWeaponFinishes(): EquippedFinishes {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored || stored.length > 512) return {};
    const value = JSON.parse(stored);
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(WEAPONS.flatMap(id => typeof value[id] === 'string' && Object.hasOwn(WEAPON_FINISHES, value[id]) ? [[id, value[id]]] : []));
  } catch {
    return {};
  }
}

export function equipWeaponFinish(weapon: WeaponId, finish: FinishId): EquippedFinishes {
  const next = { ...loadWeaponFinishes(), [weapon]: finish };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

const KNIFE_KEY = 'valoprac-knife-skin-v1';
export const KNIFE_SKIN_EVENT = 'valoprac:knife-skin';
const KNIFE_IDS: readonly KnifeSkinId[] = ['field', 'tanto', 'karambit', 'kunai', 'aether', 'obsidian'];

export function loadKnifeSkin(): KnifeSkinId {
  try {
    const stored = localStorage.getItem(KNIFE_KEY);
    return stored && (KNIFE_IDS as readonly string[]).includes(stored) ? stored as KnifeSkinId : 'field';
  } catch {
    return 'field';
  }
}

export function equipKnifeSkin(skin: KnifeSkinId): KnifeSkinId {
  try { localStorage.setItem(KNIFE_KEY, skin); } catch { /* Storage may be unavailable; the choice still applies to this page. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(KNIFE_SKIN_EVENT, { detail: skin }));
  return skin;
}
