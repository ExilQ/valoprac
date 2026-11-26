import {MAP_COURSES} from './mapCourses';
import {SURFACES} from './surfaces';
import type { VisualMaterialId } from './materials';

export interface ArenaPalette {
 wall:number;
 skirt:number;
 trim:number;
 cover:number;
 coverPanel:number;
 floor:number;
 accent:number;
 wallFamily:VisualMaterialId;
 floorFamily:VisualMaterialId;
}
const laboratory:ArenaPalette={
 wall:0xe2e9da,skirt:0x53819a,trim:0x254353,cover:0x315c67,coverPanel:0x69adad,
 floor:0x8aa6a6,accent:0x87ead2,wallFamily:'plaster',floorFamily:'painted-concrete',
};
const utility:ArenaPalette={
 wall:0xcbd9d1,skirt:0x587379,trim:0x213947,cover:0x365865,coverPanel:0x638d9b,
 floor:0x8798a1,accent:0xf4c257,wallFamily:'painted-concrete',floorFamily:'raw-concrete',
};
const terrace:ArenaPalette={
 wall:0xebc99b,skirt:0xa56854,trim:0x5d454a,cover:0x54776e,coverPanel:0x85b6a0,
 floor:0xbc986f,accent:0xfbd290,wallFamily:'stone',floorFamily:'stone',
};
const foundry:ArenaPalette={
 wall:0xe3b598,skirt:0xac5e4f,trim:0x58434e,cover:0x4e6477,coverPanel:0x88a0ad,
 floor:0xb29c87,accent:0xf3ad65,wallFamily:'plaster',floorFamily:'raw-concrete',
};
const observatory:ArenaPalette={
 wall:0xe9e4ce,skirt:0x4a8888,trim:0x294650,cover:0x325e69,coverPanel:0x55aaa6,
 floor:0xa0a99b,accent:0xecc979,wallFamily:'plaster',floorFamily:'painted-concrete',
};

export const BAY_APPEARANCE = { facility:utility,research:laboratory,urban:foundry,courtyard:terrace };
type BayTheme=keyof typeof BAY_APPEARANCE;
const maps:Record<string,ArenaPalette>={
 range:observatory,tactical:utility,long:terrace,garage:utility,site:foundry,mid:observatory,
 tower:terrace,multi:laboratory,complex:observatory,bunny:utility,wallbang:laboratory,
};
for(const course of MAP_COURSES){
 const base=BAY_APPEARANCE[course.style], [wall,skirt,accent]=course.palette;
 maps[course.id]={...base,wall,skirt,coverPanel:skirt,accent,wallFamily:SURFACES[course.wall].visualMaterialId,floorFamily:SURFACES[course.floor].visualMaterialId};
}
export function arenaPalette(map:string,theme?:BayTheme) {
 return theme&&map==='complex'?BAY_APPEARANCE[theme]:Object.hasOwn(maps,map)?maps[map]:utility;
}

/**
 * 12.21 lighting: a stronger single key light over a dimmer sky fill gives
 * readable form (VALORANT-style "one styled directional light"), while a
 * saturated zenith and clearer horizon stop the scene reading as flat pastel.
 */
export interface ArenaLight {
 zenith:number;horizon:number;sun:number;ambient:number;ground:number;fill:number;exposure:number;
 /** Hemisphere (sky/ground bounce), key sun, cool fill and reflection-probe strengths. */
 ambientIntensity:number;sunIntensity:number;fillIntensity:number;environmentIntensity:number;
 fogNear:number;fogFar:number;
}
export function arenaLight(map:string):ArenaLight {
 const style=MAP_COURSES.find(course=>course.id===map)?.style;
 const warm=['long','site','tower'].includes(map)||style==='courtyard'||style==='urban';
 return warm
  ? {zenith:0x4d8bc9,horizon:0xdfe2dc,sun:0xfff4e4,ambient:0xc6d8ee,ground:0x86827c,fill:0xa9c0e6,exposure:.94,ambientIntensity:1.04,sunIntensity:3.3,fillIntensity:.4,environmentIntensity:.34,fogNear:70,fogFar:190}
  : {zenith:0x4f90d2,horizon:0xd2e5ee,sun:0xfff0d8,ambient:0xbfd6ec,ground:0x7f8c86,fill:0x9fc4e2,exposure:1,ambientIntensity:1.06,sunIntensity:3.35,fillIntensity:.42,environmentIntensity:.36,fogNear:70,fogFar:190};
}
