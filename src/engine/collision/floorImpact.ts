import {baseGroundSurface,resolveGroundSurface} from '../footsteps/surfaceSelection';
import {CURRENT_SIMULATION_RULES,type SimulationRulesId} from '../simulation/rules';
import type {ShotEvent,Vec3} from '../types';
import type {Obstacle} from './environment';
const EMPTY:readonly Obstacle[]=[];
/** A world-floor hit stops at the structural boundary. Its thin authored finish
 * selects sound/debris, never a way to penetrate the world or a nearby ledge. */
export function floorImpactSurfaceAt(map:string,point:Vec3,rules:SimulationRulesId=CURRENT_SIMULATION_RULES){
 if(![point.x,point.y,point.z].every(Number.isFinite)||Math.abs(point.y)>1e-6)return null;
 return rules==='legacy-v2'?resolveGroundSurface(map,EMPTY,point,'legacy-v2'):baseGroundSurface(map,point);
}
export function floorImpactSurface(map:string,shot:Pick<ShotEvent,'hit'|'impact'|'penetrationStop'>,rules:SimulationRulesId=CURRENT_SIMULATION_RULES){
 return shot.hit==='wall'&&shot.penetrationStop==='floor'?floorImpactSurfaceAt(map,shot.impact,rules):null;
}
