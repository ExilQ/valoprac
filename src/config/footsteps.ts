import type {Settings} from '../engine/types';
export interface FootstepProfile {
 accumulationPerMeter:number;walkingAccumulationMultiplier:number;walkingDecay:number;
 stationaryDecay:number;stationaryVelocity:number;stationaryDelay:number;
 audibleVelocity:number;threshold:number;firstStepGraceDistance:number;hearingRadius:number;
 /** Quiet-range recovery from actual resolved horizontal braking, per second. */
 brakingDecay?:number;
}
// Provisional behavioral calibration, not exposed or verified Riot engine constants.
export const FOOTSTEP_BASELINE:FootstepProfile={accumulationPerMeter:0.625,walkingAccumulationMultiplier:0,walkingDecay:0.02,stationaryDecay:3.5,stationaryVelocity:0.035,stationaryDelay:0.12,audibleVelocity:2.7,threshold:1,firstStepGraceDistance:0.2,hearingRadius:20,brakingDecay:1.4};
export const FOOTSTEP_PRESETS={retained:{label:'잔여 유지 · 기준',walkingDecay:0.02},hold:{label:'걷기 회복 없음 · 비교',walkingDecay:0},recovery:{label:'걷기 완만 회복 · 비교',walkingDecay:0.08}};
export function footstepProfile(s:Settings):FootstepProfile{return {accumulationPerMeter:s.stepPerMeter,walkingAccumulationMultiplier:s.stepWalkingGain,walkingDecay:s.stepWalkingDecay,stationaryDecay:s.stepStationaryDecay,stationaryVelocity:s.stepStationaryVelocity,stationaryDelay:s.stepStationaryDelay,audibleVelocity:s.stepAudibleVelocity,threshold:s.stepThreshold,firstStepGraceDistance:s.stepGraceDistance,hearingRadius:s.stepHearingRadius,brakingDecay:FOOTSTEP_BASELINE.brakingDecay};}
