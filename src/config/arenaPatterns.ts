/*! Surface options and default scale adapted from openVaim v1.4.3, app/studio/arena.js.
 * Copyright (c) 2026 unkwsr. MIT notice: /licenses/openVaim-MIT.txt */
export const ARENA_PATTERNS=[
 ['auto','맵 기본'],
 ['plain','단색'],
 ['tile','정사각 타일'],
 ['industrial','산업용 패널'],
] as const;
export type ArenaPattern=typeof ARENA_PATTERNS[number][0];
export type SurfacePatternStyle='squares'|'industrial-grid'|'industrial';
export interface ArenaPatternPreferences {floor:ArenaPattern;walls:ArenaPattern;floorScale:number;wallScale:number}
export interface ArenaPatternSpec {surfacePattern?:SurfacePatternStyle;metersPerTile?:number}
const KEY='valoprac-arena-patterns-v1';
const defaults:ArenaPatternPreferences={floor:'auto',walls:'auto',floorScale:2.4,wallScale:1.2};
const options=new Set<string>(ARENA_PATTERNS.map(([value])=>value));
const bounded=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(.25,Math.min(8,value)):fallback;
export function loadArenaPatterns():ArenaPatternPreferences{
 try{
  const raw=localStorage.getItem(KEY);
  if(!raw||raw.length>500)return {...defaults};
  const value=JSON.parse(raw);
  if(!value||typeof value!=='object')return {...defaults};
  return {
   floor:options.has(value.floor)?value.floor:defaults.floor,walls:options.has(value.walls)?value.walls:defaults.walls,
   floorScale:bounded(value.floorScale,defaults.floorScale),wallScale:bounded(value.wallScale,defaults.wallScale),
  };
 }catch{return {...defaults};}
}
export function storeArenaPatterns(preferences:ArenaPatternPreferences){
 localStorage.setItem(KEY,JSON.stringify(preferences));
}
export function arenaPattern(map:string,floor:boolean,preferences:ArenaPatternPreferences):ArenaPatternSpec {
 const candidate=floor?preferences.floor:preferences.walls;
 const industrial=['range','complex','garage','tactical','bunny','wallbang'].includes(map);
 const selected=candidate==='auto'?(industrial?'industrial':floor?'tile':'plain'):candidate;
 if(selected==='plain')return {};
 return {
  surfacePattern:selected==='industrial'?(floor?'industrial-grid':'industrial'):'squares',
  metersPerTile:floor?preferences.floorScale:preferences.wallScale,
 };
}
