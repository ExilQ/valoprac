import type {Settings} from '../types';
import {zoomSensitivityMultiplier} from './zoomSensitivity';
export {horizontalFov as adsFov} from '../rendering/projection';
export const DEG=Math.PI/180;
// Existing profile coefficient is conventional, not independently Riot-verified.
export const REFERENCE_YAW=.07;
export function angularGain(s:Pick<Settings,'degreesPerCount'|'sensitivity'|'adsSensitivity'>&Partial<Pick<Settings,'scopeSensitivity25'|'scopeSensitivity5'>>,ads=false,zoom=1,scopeLevel?:1|2){return s.degreesPerCount*s.sensitivity*(ads?zoomSensitivityMultiplier(s,zoom,scopeLevel)/zoom:1);}
export function sensitivityUnits(sensitivity:number,dpi:number,coefficient=REFERENCE_YAW){
 if(![sensitivity,dpi,coefficient].every(v=>Number.isFinite(v)&&v>0))return {edpi:null,cm360:null};
 return {edpi:dpi*sensitivity,cm360:360*2.54/(dpi*coefficient*sensitivity)};
}
export function monotonicEventTime(stamp:number,now:number,origin=performance.timeOrigin){const t=stamp>1e12?stamp-origin:stamp;return Number.isFinite(t)&&t>=0&&Math.abs(t-now)<60000?t:now;}
