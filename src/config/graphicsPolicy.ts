import {GRAPHICS_PRESETS} from './settings';
import type {Settings} from '../engine/types';
/** Detection is advisory, never a speed benchmark. Explicit manual selections
 * disable this policy and remain persistent across every future map. */
export function automaticGraphicsPatch(settings:Settings,recommendLow:boolean,kind?:string):Partial<Settings>{
 return settings.autoGraphics&&recommendLow?{...GRAPHICS_PRESETS.low,renderScale:Math.min(settings.renderScale,kind==='software'?.5:GRAPHICS_PRESETS.low.renderScale??.8),...(kind==='software'?{frameLimit:settings.frameLimit===0?60:Math.min(60,settings.frameLimit)}:{})}:{};
}

/** Largest drawing-buffer area any preset renders: 3840×2160. Above this, more
 * pixels stop adding visible sharpness but still multiply shading cost. */
export const MAX_RENDER_PIXELS=3840*2160;
/** Pixel ratio = device ratio (≤2) × render scale, capped so the drawing buffer
 * never exceeds MAX_RENDER_PIXELS for the current CSS size. */
export function renderPixelRatio(devicePixelRatio:number,renderScale:number,cssWidth:number,cssHeight:number,maxPixels=MAX_RENDER_PIXELS){
 const desired=Math.min(Math.max(devicePixelRatio||1,.5),2)*renderScale;
 const area=Math.max(1,cssWidth)*Math.max(1,cssHeight);
 const cap=Math.sqrt(maxPixels/area);
 return Math.max(.25,Math.min(desired,cap));
}
