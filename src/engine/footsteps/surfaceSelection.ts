import {SURFACES,surfaceForObstacle,type SurfaceId,type SurfaceSemantics,type FootstepSoundProfile} from '../../config/surfaces';
import type {Obstacle} from '../collision/environment';
import {PEEK_ZONES,zoneAt} from '../tactical/complex';
import type {Vec3} from '../types';
import {Vector3} from 'three';
import {MOVEMENT} from '../../config/movement';
import {CollisionController} from '../movement/CollisionController';

export interface FloorSurfaceRegion {readonly map:string;readonly surfaceId:SurfaceId;readonly bounds:readonly[number,number,number,number];}
/** Same footprint as the visible range shooting mat. Bounds are x,z,width,depth. */
export const RANGE_MAT_SURFACE:FloorSurfaceRegion=Object.freeze({map:'range',surfaceId:'rubber',bounds:Object.freeze([-11.9,.3,23.8,9.4] as const)});
export const BASE_GROUND_SURFACE:SurfaceId='rawConcrete';
export const THEMED_FLOOR_SURFACES=Object.freeze({concrete:'concrete',steel:'steel',tile:'stone',wood:'thickWood'} as const);
export interface SurfaceContactShape {radius?:number;maxSlopeCos?:number;stepMinLandingWidth?:number;}
const contactControllers=new WeakMap<readonly Obstacle[],CollisionController>();
const contactPosition=new Vector3();
/** Authored floor finishes; quality, mesh batching and input do not select sound. */
export function baseGroundSurface(map:string,position:Vec3):SurfaceId {
 if(map==='range'){const[x,z,w,d]=RANGE_MAT_SURFACE.bounds;if(position.x>=x&&position.x<=x+w&&position.z>=z&&position.z<=z+d)return RANGE_MAT_SURFACE.surfaceId;}
 if(map==='complex'){const zone=PEEK_ZONES.find(q=>{const b=q.bounds;return b&&position.x>=b[0]&&position.x<=b[0]+b[2]&&position.z>=b[1]&&position.z<=b[1]+b[3];});if(zone)return THEMED_FLOOR_SURFACES[zone.material];}
 return BASE_GROUND_SURFACE;
}
/** Resolve the actual occupied support plane at the foot/contact position.
 * The footprint and source-order ties use CollisionController directly.
 * 5 cm tolerance covers sub-tick footstep interpolation, never a different floor.
 * Raised supports take priority over bay floor finishes. */
export function resolveGroundSurface(map:string,obstacles:readonly Obstacle[],position:Vec3,semantics:SurfaceSemantics='materials-v3',shape:SurfaceContactShape={}):SurfaceId {
 if(semantics==='legacy-v2')return map==='complex'?THEMED_FLOOR_SURFACES[zoneAt(position)?.material??'concrete']:'concrete';
 let controller=contactControllers.get(obstacles);if(!controller){controller=new CollisionController(obstacles);contactControllers.set(obstacles,controller);}
 contactPosition.set(position.x,position.y,position.z);
 const contact=controller.supportFootprint(contactPosition,position.y+.05,shape.radius??MOVEMENT.radius,shape.maxSlopeCos??Math.SQRT1_2,shape.stepMinLandingWidth??.1);
 const support=Math.abs(position.y-contact.height)<=.05?contact.obstacle:null;
 return support?.groundSurfaceId??(support?surfaceForObstacle(support,semantics):baseGroundSurface(map,position));
}
export function footstepMaterialAt(map:string,obstacles:readonly Obstacle[],position:Vec3,semantics:SurfaceSemantics='materials-v3',shape:SurfaceContactShape={}):FootstepSoundProfile {
 return SURFACES[resolveGroundSurface(map,obstacles,position,semantics,shape)].footstepSoundProfile;
}
