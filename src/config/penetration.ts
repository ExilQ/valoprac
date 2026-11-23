import type {Obstacle} from '../engine/collision/environment';
export type SurfaceMaterial='thinWood'|'thickWood'|'drywall'|'thinMetal'|'thickMetal'|'concrete'|'stone'|'reinforced'|'glass'|'breakable';
export interface MaterialPenetration {name:string;resistance:number;retention:number;opaque?:boolean;color:number;impact:'wood'|'metal'|'masonry'|'glass';}
/** Original resistance-metre model; not Riot's undisclosed penetration formula. */
export const PENETRATION_MATERIALS:Readonly<Record<SurfaceMaterial,MaterialPenetration>>={
 thinWood:{name:'얇은 목재',resistance:.8,retention:.96,color:0xd2ae7c,impact:'wood'},
 thickWood:{name:'두꺼운 목재',resistance:1.5,retention:.94,color:0xb99063,impact:'wood'},
 drywall:{name:'석고보드',resistance:1.1,retention:.95,color:0xd3d3c4,impact:'masonry'},
 thinMetal:{name:'얇은 금속',resistance:4,retention:.89,color:0x9bbcc4,impact:'metal'},
 thickMetal:{name:'두꺼운 금속',resistance:7,retention:.85,color:0x79929b,impact:'metal'},
 concrete:{name:'콘크리트',resistance:9,retention:.86,color:0xb6b6a9,impact:'masonry'},
 stone:{name:'석재',resistance:11,retention:.84,color:0xaaa996,impact:'masonry'},
 reinforced:{name:'보강 구조물',resistance:Infinity,retention:0,opaque:true,color:0x7a8992,impact:'metal'},
 glass:{name:'유리',resistance:.25,retention:.98,color:0xa3d4d5,impact:'glass'},
 breakable:{name:'경량 파손 패널',resistance:.6,retention:.95,color:0xc9b89a,impact:'wood'}
};
export const PENETRATION_WEAPONS={low:{power:.65,maxLayers:2,loss:.9},medium:{power:1.6,maxLayers:3,loss:.8},high:{power:3.3,maxLayers:4,loss:.72}} as const;
export const materialFor=(obstacle:Obstacle):SurfaceMaterial=>obstacle.material??(obstacle.ramp?'reinforced':obstacle.kind==='cover'?'thickWood':'concrete');
