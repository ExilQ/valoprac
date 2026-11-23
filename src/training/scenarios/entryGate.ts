import type { Vec3 } from '../../engine/types';
import { scenarioRoute } from './templates';
import type { ScenarioDefinition } from './types';

export interface ScenarioEntryGate {
  center:Vec3;
  forwardX:number;
  forwardZ:number;
  halfWidth:number;
}

export function scenarioEntryGate(definition:ScenarioDefinition):ScenarioEntryGate|null {
  const from=definition.player.position,to=scenarioRoute(definition.routeId).route[1];
  const length=Math.hypot(to.x-from.x,to.z-from.z);
  if(length<.8)return null;
  return {
    center:{x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:(from.z+to.z)/2},
    forwardX:(to.x-from.x)/length,forwardZ:(to.z-from.z)/length,halfWidth:1,
  };
}

export function gateEndpoints(gate:ScenarioEntryGate):[Vec3,Vec3] {
  const {center,forwardX,forwardZ,halfWidth}=gate;
  return [-1,1].map(side=>({x:center.x-forwardZ*halfWidth*side,y:center.y,z:center.z+forwardX*halfWidth*side})) as [Vec3,Vec3];
}

export function crossesEntryGate(gate:ScenarioEntryGate,previous:Vec3,current:Vec3) {
  const {center,forwardX,forwardZ,halfWidth}=gate;
  const from=(previous.x-center.x)*forwardX+(previous.z-center.z)*forwardZ;
  const to=(current.x-center.x)*forwardX+(current.z-center.z)*forwardZ;
  if(from>0||to<=0)return false;
  const fraction=-from/(to-from),x=previous.x+(current.x-previous.x)*fraction,z=previous.z+(current.z-previous.z)*fraction;
  const y=previous.y+(current.y-previous.y)*fraction;
  return Math.abs((x-center.x)*forwardZ-(z-center.z)*forwardX)<=halfWidth && Math.abs(y-center.y)<=.65;
}
