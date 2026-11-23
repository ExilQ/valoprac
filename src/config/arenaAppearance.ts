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
export function arenaPalette(map:string,theme?:BayTheme) {
 return theme&&map==='complex'?BAY_APPEARANCE[theme]:Object.hasOwn(maps,map)?maps[map]:utility;
}

export function arenaLight(map:string) {
 const warm=['long','site','tower'].includes(map);
 return warm
  ? {zenith:0x639bc7,horizon:0xe1cdb1,sun:0xffd5a2,ambient:0xc8dbed,ground:0xa58573,fill:0xabc3e8,exposure:1.12}
  : {zenith:0x70a9cf,horizon:0xc4dedb,sun:0xffe4ba,ambient:0xd4e8f4,ground:0x8e9b93,fill:0xa0c6dd,exposure:1.10};
}
