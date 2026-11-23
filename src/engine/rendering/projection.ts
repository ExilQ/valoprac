const DEG=Math.PI/180;
/** Independent VALOPRAC camera calibration: divide horizontal degrees by zoom.
 * This camera convention is separate from the existing sensitivity/zoom gain. */
export function horizontalFov(baseDegrees:number,zoom=1){
 const base=Math.min(179,Math.max(1,Number.isFinite(baseDegrees)?baseDegrees:103));
 return base/Math.max(1,Number.isFinite(zoom)?zoom:1);
}
export function verticalFovFromHorizontal(horizontalDegrees:number,aspect:number){
 const horizontal=Math.min(179,Math.max(.001,Number.isFinite(horizontalDegrees)?horizontalDegrees:103));
 const ratio=Number.isFinite(aspect)&&aspect>0?aspect:16/9;
 return 2*Math.atan(Math.tan(horizontal*DEG/2)/ratio)/DEG;
}
export function cameraVerticalFov(baseDegrees:number,zoom:number,aspect:number){return verticalFovFromHorizontal(horizontalFov(baseDegrees,zoom),aspect);}
