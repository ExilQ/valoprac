import type {Vec3} from '../types';

export type AudibleOcclusionResolver=(source:Vec3,listener:Vec3)=>boolean;
/** Original audible mix calibration, not a native-game propagation equation. */
export const AUDIBLE_OCCLUSION={
  gain:.45,cutoffHz:2200,openCutoffHz:20000,smoothingSeconds:.025,refreshSeconds:1/15
} as const;
