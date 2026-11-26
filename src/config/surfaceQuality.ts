import type {Quality} from '../engine/types';
/** Procedural material map size, maps and anisotropic filtering per texture quality. */
export const SURFACE_QUALITY:Readonly<Record<Quality,{size:number;normal:boolean;roughness:boolean;anisotropy:number}>>={
  low:{size:32,normal:false,roughness:false,anisotropy:1},
  medium:{size:64,normal:false,roughness:true,anisotropy:2},
  // 12.21: High gains Ultra's 256px maps so joints and trims stay crisp at arm's
  // length; the complete library stays inside the 16 MiB budget. Ultra adds
  // sharper oblique filtering instead of larger maps.
  high:{size:256,normal:true,roughness:true,anisotropy:8},
  ultra:{size:256,normal:true,roughness:true,anisotropy:16},
};
