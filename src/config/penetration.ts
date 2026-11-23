import type {Obstacle} from '../engine/collision/environment';
import {SURFACES,SURFACE_IDS,surfaceForObstacle,type SurfaceId,type SurfaceSemantics,type BulletImpactProfile} from './surfaces';
/** Stable V11 IDs remain valid; authored V12 surfaces share the same resolver. */
export type SurfaceMaterial=SurfaceId;
export interface MaterialPenetration {name:string;resistance:number;retention:number;opaque?:boolean;color:number;impact:BulletImpactProfile;}
/** Original resistance-metre model; not Riot's undisclosed penetration formula.
 * Compatibility projection only. Physical values have one source: SURFACES. */
export const PENETRATION_MATERIALS:Readonly<Record<SurfaceMaterial,MaterialPenetration>>=Object.freeze(Object.fromEntries(SURFACE_IDS.map(id=>{
 const s=SURFACES[id];return[id,Object.freeze({name:s.name,resistance:s.penetrationResistance,retention:s.penetrationRetention,...(s.opaque?{opaque:true}:{}),color:s.impactColor,impact:s.bulletImpactProfile})];
})) as Record<SurfaceMaterial,MaterialPenetration>);
export const PENETRATION_WEAPONS={low:{power:.65,maxLayers:2,loss:.9},medium:{power:1.6,maxLayers:3,loss:.8},high:{power:3.3,maxLayers:4,loss:.72}} as const;
/** No-argument semantics preserve every existing call/replay. */
export const materialFor=(obstacle:Obstacle,semantics:SurfaceSemantics='legacy-v2'):SurfaceMaterial=>surfaceForObstacle(obstacle,semantics);
