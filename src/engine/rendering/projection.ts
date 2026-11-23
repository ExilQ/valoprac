const DEG=Math.PI/180;
export const PROJECTION_CALIBRATION={
 issue:'F3',version:'horizontal-angular-division-1',classification:'provisional-calibration',
 source:'VALOPRAC improvement report, 2026-10-29; third-party/community targets',
 baselineHorizontalDegrees:103,targets:[{zoom:1.25,horizontalDegrees:82.4},{zoom:2.5,horizontalDegrees:41.2},{zoom:5,horizontalDegrees:20.6}],
 nativeReferenceMeasured:false,
} as const;
/** Provisional horizontal-angular zoom: horizontal degrees / zoom, held fixed
 * across aspect ratios. This is not optical magnification (which would divide
 * tan(FOV/2)), nor an officially verified VALORANT equation. Sensitivity has its
 * own documented gain convention; it must not derive another camera zoom. */
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
