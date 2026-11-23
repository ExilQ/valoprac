import type {VisualMaterialId} from './materials';
import type {Obstacle} from '../engine/collision/environment';

/** Physical calibration is independent from visual PBR values and quality tiers. */
export const SURFACE_CALIBRATION_VERSION='physical-surfaces-1.0.0';
export type SurfaceSemantics='legacy-v2'|'materials-v3';
export type FootstepSoundProfile='concrete'|'steel'|'tile'|'wood'|'rubber'|'glass'|'plastic'|'fabric';
export type BulletImpactProfile='wood'|'metal'|'masonry'|'glass';
export type ParticleProfile='wood-chips'|'metal-sparks'|'masonry-dust'|'glass-shards';
export interface SurfaceDefinition {
 readonly name:string;readonly visualMaterialId:VisualMaterialId;
 /** Neutral multiplier, not a native coefficient. No material-specific traction has been measured. */
 readonly collisionFriction:number;
 readonly penetrationResistance:number;readonly penetrationRetention:number;readonly opaque?:boolean;
 /** Sight transmission is a physical rule, independent of shader opacity.
  * Collision and sound barriers do not use this flag. */
 readonly blocksSight:boolean;
 readonly footstepSoundProfile:FootstepSoundProfile;readonly bulletImpactProfile:BulletImpactProfile;
 readonly particleProfile:ParticleProfile;
 /** Retained V11 debug/impact tint, never a PBR or collision input. */
 readonly impactColor:number;
}
const physical=(name:string,visualMaterialId:VisualMaterialId,penetrationResistance:number,penetrationRetention:number,footstepSoundProfile:FootstepSoundProfile,bulletImpactProfile:BulletImpactProfile,impactColor:number,opaque=false,blocksSight=true):SurfaceDefinition=>Object.freeze({name,visualMaterialId,collisionFriction:1,penetrationResistance,penetrationRetention,blocksSight,footstepSoundProfile,bulletImpactProfile,particleProfile:({wood:'wood-chips',metal:'metal-sparks',masonry:'masonry-dust',glass:'glass-shards'} as const)[bulletImpactProfile],impactColor,...(opaque?{opaque:true}:{})});
/** The first ten stable IDs retain every V11 penetration coefficient exactly.
 * Additional authored finishes borrow a documented existing physical family;
 * these are original training approximations, not measured game constants. */
export const SURFACES=Object.freeze({
 thinWood:physical('얇은 목재','wood',.8,.96,'wood','wood',0xd2ae7c),
 thickWood:physical('두꺼운 목재','wood',1.5,.94,'wood','wood',0xb99063),
 drywall:physical('석고보드','plaster',1.1,.95,'concrete','masonry',0xd3d3c4),
 thinMetal:physical('얇은 금속','painted-metal',4,.89,'steel','metal',0x9bbcc4),
 thickMetal:physical('두꺼운 금속','steel',7,.85,'steel','metal',0x79929b),
 concrete:physical('콘크리트','painted-concrete',9,.86,'concrete','masonry',0xb6b6a9),
 stone:physical('석재','stone',11,.84,'tile','masonry',0xaaa996),
 reinforced:physical('보강 구조물','composite',Infinity,0,'steel','metal',0x7a8992,true),
 glass:physical('유리','glass',.25,.98,'glass','glass',0xa3d4d5,false,false),
 breakable:physical('경량 파손 패널','wood',.6,.95,'wood','wood',0xc9b89a),
 rawConcrete:physical('노출 콘크리트','raw-concrete',9,.86,'concrete','masonry',0xb6b6a9),
 plaster:physical('석고','plaster',1.1,.95,'concrete','masonry',0xd3d3c4),
 // A finish does not replace its load-bearing concrete core in ballistics.
 plasteredConcrete:physical('미장 콘크리트','plaster',9,.86,'concrete','masonry',0xb6b6a9),
 brick:physical('벽돌','brick',9,.86,'concrete','masonry',0xb28c77),
 paintedMetal:physical('도장 금속','painted-metal',7,.85,'steel','metal',0x79929b),
 brushedMetal:physical('브러시 금속','brushed-metal',7,.85,'steel','metal',0x9bbcc4),
 steel:physical('강철','steel',7,.85,'steel','metal',0x79929b),
 aluminum:physical('알루미늄','aluminum',4,.89,'steel','metal',0x9bbcc4),
 rubber:physical('고무','rubber',1.5,.94,'rubber','wood',0x596c69),
 plastic:physical('플라스틱','plastic',.6,.95,'plastic','wood',0xc9b89a),
 fabric:physical('직물','fabric',.6,.95,'fabric','wood',0xc9b89a),
 composite:physical('복합재','composite',7,.85,'concrete','metal',0x7a8992)
});
export type SurfaceId=keyof typeof SURFACES;
export const SURFACE_IDS=Object.freeze(Object.keys(SURFACES) as SurfaceId[]);
export const SURFACE_FOOTSTEP_SOUND_PROFILES:readonly FootstepSoundProfile[]=Object.freeze(['concrete','steel','tile','wood','rubber','glass','plastic','fabric']);
export const SURFACE_PARTICLE_PROFILES=Object.freeze({
 'wood-chips':Object.freeze({color:0xc9a577,decalColor:0x493622,speed:1.4,lifetime:.22,count:3}),
 'metal-sparks':Object.freeze({color:0xffd69b,decalColor:0x303c40,speed:2.5,lifetime:.13,count:5}),
 'masonry-dust':Object.freeze({color:0xc2c0af,decalColor:0x50504a,speed:.8,lifetime:.26,count:4}),
 'glass-shards':Object.freeze({color:0xb9e1e0,decalColor:0x658a89,speed:1.7,lifetime:.18,count:4})
});
/** Explicit material assignments remain authoritative in both rulesets. Old
 * replays ignore new metadata; current maps use surfaceId as their authored
 * fallback. A bare current cover is metal clad and a bare ramp is concrete. */
export function surfaceForObstacle(obstacle:Obstacle,semantics:SurfaceSemantics='materials-v3'):SurfaceId {
 if(semantics==='legacy-v2')return obstacle.material??(obstacle.ramp?'reinforced':obstacle.kind==='cover'?'thickWood':'concrete');
 return obstacle.material??obstacle.surfaceId??(obstacle.ramp?'concrete':obstacle.kind==='cover'?'paintedMetal':'plasteredConcrete');
}
