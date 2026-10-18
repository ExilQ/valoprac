import type { WeaponId } from '../engine/types';
export interface WeaponProfile {
  id:WeaponId; fireRate:number; magazine:number; reloadTime:number; firstSpread:number; movementSpread:number;
  airSpread:number; bloomPerShot:number; maxBloom:number; bloomRecovery:number; resetTime:number;
  recoilRecovery:number; recoveryDelay:number; cameraScale:number; randomness:number;
  crouchSpread:number; crouchRecoil:number; adsSpread:number; recoil:readonly (readonly [number,number])[];
}
// Angles are degrees. Both profiles are tunable approximations, never game data claims.
export const WEAPONS:Record<WeaponId,WeaponProfile> = {
  rifleA:{id:'rifleA',fireRate:9.3,magazine:25,reloadTime:2.35,firstSpread:0.12,movementSpread:3.5,
    airSpread:6.5,bloomPerShot:0.09,maxBloom:0.9,bloomRecovery:2.3,resetTime:0.34,
    recoilRecovery:6.8,recoveryDelay:0.16,cameraScale:0.8,randomness:0.065,crouchSpread:0.72,crouchRecoil:0.8,adsSpread:0.8,
    recoil:[[0.18,0],[0.38,0.03],[0.52,-0.04],[0.64,0.04],[0.72,0.08],[0.72,-0.02],[0.64,0.15],[0.55,0.24],[0.43,0.35],[0.35,0.4],[0.26,0.46],[0.18,0.4],[0.12,0.26],[0.06,-0.1],[0.03,-0.35],[0.02,-0.5],[0,-0.52],[0,-0.48],[0,-0.32],[0,0.08],[0,0.32],[0,0.46],[0,0.4],[0,0.3],[0,-0.1]]},
  rifleB:{id:'rifleB',fireRate:11,magazine:30,reloadTime:2.25,firstSpread:0.09,movementSpread:3.2,
    airSpread:6,bloomPerShot:0.075,maxBloom:0.8,bloomRecovery:2.5,resetTime:0.32,
    recoilRecovery:7.2,recoveryDelay:0.14,cameraScale:0.75,randomness:0.085,crouchSpread:0.68,crouchRecoil:0.78,adsSpread:0.78,
    recoil:[[0.13,0],[0.28,-0.03],[0.39,0.03],[0.46,0.04],[0.54,-0.04],[0.56,0.06],[0.54,0.12],[0.48,0.21],[0.4,0.3],[0.32,0.35],[0.24,0.4],[0.18,0.34],[0.1,0.22],[0.06,-0.1],[0.02,-0.26],[0,-0.38],[0,-0.42],[0,-0.4],[0,-0.3],[0,-0.16],[0,0.12],[0,0.28],[0,0.4],[0,0.38],[0,0.3],[0,0.08],[0,-0.22],[0,-0.36],[0,-0.4],[0,-0.3]]}
};
