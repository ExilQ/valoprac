import {GRAPHICS_PRESETS} from './settings';
import type {Settings} from '../engine/types';
/** Detection is advisory, never a speed benchmark. Explicit manual selections
 * disable this policy and remain persistent across every future map. */
export function automaticGraphicsPatch(settings:Settings,recommendLow:boolean):Partial<Settings>{
 return settings.autoGraphics&&recommendLow?{...GRAPHICS_PRESETS.low,renderScale:Math.min(settings.renderScale,GRAPHICS_PRESETS.low.renderScale??.8)}:{};
}
