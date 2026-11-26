import type {EnemyHighlight} from '../engine/rendering/CharacterMaterial';
export type {EnemyHighlight} from '../engine/rendering/CharacterMaterial';

/**
 * Display-only preference, stored apart from Settings (like arena patterns) so
 * replay headers and their integrity checksums are unchanged.
 */
const KEY='valoprac-enemy-highlight-v1';
export const ENEMY_HIGHLIGHT_CHANGED='valoprac:enemy-highlight';
const VALUES:readonly EnemyHighlight[]=['red','yellow','purple','off'];
export function loadEnemyHighlight():EnemyHighlight{
 try{const raw=localStorage.getItem(KEY);return VALUES.includes(raw as EnemyHighlight)?raw as EnemyHighlight:'red';}catch{return 'red';}
}
export function storeEnemyHighlight(value:EnemyHighlight){
 if(!VALUES.includes(value))return;
 try{localStorage.setItem(KEY,value);}catch{/* The current page still updates without storage. */}
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(ENEMY_HIGHLIGHT_CHANGED,{detail:value}));
}
