import type {Settings} from '../types';
export type ZoomSensitivitySettings=Pick<Settings,'adsSensitivity'>&Partial<Pick<Settings,'scopeSensitivity25'|'scopeSensitivity5'>>;
/** Select a multiplier independently of the zoom divisor. The optional target
 * scope level stays stable while Operator magnification interpolates. */
export function zoomSensitivityMultiplier(s:ZoomSensitivitySettings,zoom=1,scopeLevel?:1|2){
 const fallback=s.adsSensitivity;
 return scopeLevel===2||scopeLevel===undefined&&zoom>=3.75?s.scopeSensitivity5??fallback:scopeLevel===1||scopeLevel===undefined&&zoom>=1.75?s.scopeSensitivity25??fallback:fallback;
}
/** Browser-delivered counts, not independently measured physical sensor counts. */
export function rotationCounts(s:ZoomSensitivitySettings&Pick<Settings,'sensitivity'|'degreesPerCount'>,zoom=1,scopeLevel?:1|2){
 const gain=s.sensitivity*s.degreesPerCount*(zoom>1?zoomSensitivityMultiplier(s,zoom,scopeLevel)/zoom:1);
 return Number.isFinite(gain)&&gain>0?360/gain:null;
}
