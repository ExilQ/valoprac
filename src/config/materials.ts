/** Appearance only. Ballistics, friction and sound are defined by surfaces.ts. */
export type VisualMaterialId = 'painted-concrete'|'raw-concrete'|'plaster'|'stone'|'brick'|'painted-metal'|'brushed-metal'|'steel'|'aluminum'|'wood'|'rubber'|'glass'|'plastic'|'fabric'|'composite';

export interface VisualMaterialDefinition {
  readonly label: string;
  readonly color: number;
  readonly roughness: number;
  readonly metalness: number;
  /** A repeat represents this many meters, independent of mesh dimensions. */
  readonly metersPerTile: number;
  readonly normalStrength: number;
  readonly grain: 'mineral'|'paint'|'plaster'|'stone'|'brick'|'brush'|'metal'|'wood'|'rubber'|'glass'|'plastic'|'weave'|'composite';
  readonly seed: number;
}

export const VISUAL_MATERIALS: Readonly<Record<VisualMaterialId,VisualMaterialDefinition>> = {
  'painted-concrete': {label:'도장 콘크리트',color:0xaeb7af,roughness:.86,metalness:0,metersPerTile:1.2,normalStrength:.12,grain:'paint',seed:101},
  'raw-concrete': {label:'노출 콘크리트',color:0x9b9d98,roughness:.93,metalness:0,metersPerTile:1.4,normalStrength:.24,grain:'mineral',seed:211},
  plaster: {label:'미장',color:0xd6d2c5,roughness:.96,metalness:0,metersPerTile:1.1,normalStrength:.14,grain:'plaster',seed:307},
  stone: {label:'석재',color:0xb6aa91,roughness:.82,metalness:0,metersPerTile:1.6,normalStrength:.22,grain:'stone',seed:401},
  brick: {label:'벽돌',color:0xa9785e,roughness:.94,metalness:0,metersPerTile:1.2,normalStrength:.28,grain:'brick',seed:503},
  'painted-metal': {label:'도장 금속',color:0x52636a,roughness:.58,metalness:.24,metersPerTile:.7,normalStrength:.08,grain:'paint',seed:601},
  'brushed-metal': {label:'헤어라인 금속',color:0x9ca8ac,roughness:.35,metalness:.94,metersPerTile:.4,normalStrength:.1,grain:'brush',seed:701},
  steel: {label:'강철',color:0x66757c,roughness:.32,metalness:.96,metersPerTile:.5,normalStrength:.065,grain:'metal',seed:809},
  aluminum: {label:'알루미늄',color:0xb4bec0,roughness:.41,metalness:.93,metersPerTile:.45,normalStrength:.075,grain:'brush',seed:907},
  wood: {label:'목재',color:0x997c55,roughness:.79,metalness:0,metersPerTile:1.1,normalStrength:.15,grain:'wood',seed:1009},
  rubber: {label:'고무',color:0x28373c,roughness:.97,metalness:0,metersPerTile:.28,normalStrength:.16,grain:'rubber',seed:1103},
  glass: {label:'유리',color:0x668a94,roughness:.19,metalness:.18,metersPerTile:1,normalStrength:.015,grain:'glass',seed:1201},
  plastic: {label:'폴리머',color:0x39494f,roughness:.74,metalness:0,metersPerTile:.32,normalStrength:.1,grain:'plastic',seed:1301},
  fabric: {label:'직물',color:0x64727a,roughness:.98,metalness:0,metersPerTile:.16,normalStrength:.24,grain:'weave',seed:1409},
  composite: {label:'복합재',color:0x465860,roughness:.66,metalness:.06,metersPerTile:.35,normalStrength:.11,grain:'composite',seed:1511},
};

export const VISUAL_MATERIAL_IDS = Object.freeze(Object.keys(VISUAL_MATERIALS) as VisualMaterialId[]);
