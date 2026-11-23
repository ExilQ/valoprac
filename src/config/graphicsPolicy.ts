import {GRAPHICS_PRESETS} from './settings';
import type {Settings} from '../engine/types';
/** Detection is advisory, never a speed benchmark. Explicit manual selections
 * disable this policy and remain persistent across every future map. */
export function automaticGraphicsPatch(settings:Settings,recommendLow:boolean,kind?:string):Partial<Settings>{
 return settings.autoGraphics&&recommendLow?{...GRAPHICS_PRESETS.low,renderScale:Math.min(settings.renderScale,kind==='software'?.5:GRAPHICS_PRESETS.low.renderScale??.8),...(kind==='software'?{frameLimit:settings.frameLimit===0?60:Math.min(60,settings.frameLimit)}:{})}:{};
}
