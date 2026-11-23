import type { WeaponId } from '../engine/types';

export const WEAPON_FINISHES = {
  original: { title: '기본 마감', steel: 0x58717a, edge: 0x8d999b, polymer: 0x344e58, dark: 0x1c282f },
  slate: { title: '극야 슬레이트', steel: 0x303c61, edge: 0xe19457, polymer: 0x252d47, dark: 0x1c2437 },
  ceramic: { title: '청록 세라믹', steel: 0xc8d8d6, edge: 0x30867c, polymer: 0x586d76, dark: 0x283d44 },
} as const;

type FinishId = keyof typeof WEAPON_FINISHES;
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
