import type { WeaponId, HitZone } from '../engine/types';
export interface WeaponProfile {
  id:WeaponId; name:string; kind:'vandal'|'phantom'|'sheriff'; fireMode:'auto'|'semi'; fireRate:number; adsFireRate:number; adsZoom:number; equipTime:number; reserve:number;adsTransition:number;
  magazine:number; reloadTime:number; firstSpread:number; movementSpread:number;
  airSpread:number; bloomPerShot:number; maxBloom:number; bloomRecovery:number; resetTime:number;
  recoilRecovery:number; recoveryDelay:number; cameraScale:number; randomness:number;
  crouchSpread:number; crouchRecoil:number; adsSpread:number; adsMoveModifier:number;
  yawSwitchTime:number; yawSwitchChance:number; protectedBullets:number;
  damage:readonly {maxDistance:number;head:number;body:number;leg:number}[];
  recoil:readonly (readonly [number,number])[];
}
// Calibration v2: published 11.08 PC switching values; requested base specifications.
// Recoil curves, movement/spread recovery, equip time and animation are provisional.
export const WEAPONS:Record<WeaponId,WeaponProfile> = {
  rifleA:{id:'rifleA',name:'밴달',kind:'vandal',fireMode:'auto',fireRate:9.75,adsFireRate:8.775,adsZoom:1.25,equipTime:1,reserve:75,adsTransition:.14,
    magazine:25,reloadTime:2.5,firstSpread:0.25,movementSpread:6,airSpread:8.5,bloomPerShot:0.13,maxBloom:1.25,bloomRecovery:2.3,resetTime:0.38,
    recoilRecovery:6.8,recoveryDelay:0.18,cameraScale:1,randomness:0.065,crouchSpread:0.72,crouchRecoil:0.8,adsSpread:0.8,adsMoveModifier:0.76,
    yawSwitchTime:0.6,yawSwitchChance:0.1,protectedBullets:6,
    damage:[{maxDistance:Infinity,head:160,body:40,leg:34}],
    recoil:[[0.2,0],[0.4,0.025],[0.57,-0.035],[0.69,0.045],[0.78,0.065],[0.78,0.04],[0.69,0.18],[0.59,0.27],[0.47,0.37],[0.37,0.43],[0.28,0.48],[0.2,0.45],[0.14,0.4],[0.08,0.43],[0.04,0.48],[0.03,0.5],[0.02,0.5],[0.01,0.48],[0.01,0.46]]},
  rifleB:{id:'rifleB',name:'팬텀',kind:'phantom',fireMode:'auto',fireRate:11,adsFireRate:9.9,adsZoom:1.25,equipTime:1,reserve:90,adsTransition:.12,
    magazine:30,reloadTime:2.5,firstSpread:0.2,movementSpread:6,airSpread:8,bloomPerShot:0.105,maxBloom:1.1,bloomRecovery:2.5,resetTime:0.35,
    recoilRecovery:7.2,recoveryDelay:0.16,cameraScale:1,randomness:0.055,crouchSpread:0.68,crouchRecoil:0.78,adsSpread:0.78,adsMoveModifier:0.76,
    yawSwitchTime:0.6,yawSwitchChance:0.1,protectedBullets:8,
    damage:[{maxDistance:20,head:156,body:39,leg:33.15},{maxDistance:Infinity,head:140,body:35,leg:29.75}],
    recoil:[[0.14,0],[0.3,-0.025],[0.41,0.025],[0.49,0.03],[0.57,-0.03],[0.59,0.04],[0.56,0.08],[0.5,0.1],[0.42,0.21],[0.34,0.3],[0.26,0.34],[0.19,0.36],[0.12,0.34],[0.07,0.36],[0.03,0.38],[0.02,0.4],[0.01,0.39],[0.01,0.38]]},
  sheriff:{id:'sheriff',name:'셰리프',kind:'sheriff',fireMode:'semi',fireRate:4,adsFireRate:4,adsZoom:1,equipTime:1,reserve:24,adsTransition:0,
    magazine:6,reloadTime:2.25,firstSpread:0.25,movementSpread:5.2,airSpread:8,bloomPerShot:0.9,maxBloom:3.2,bloomRecovery:2.4,resetTime:0.55,
    recoilRecovery:5.7,recoveryDelay:0.25,cameraScale:1,randomness:0.025,crouchSpread:0.75,crouchRecoil:0.9,adsSpread:1,adsMoveModifier:1,
    yawSwitchTime:0.6,yawSwitchChance:0,protectedBullets:6,
    damage:[{maxDistance:30,head:159.5,body:55,leg:46.75},{maxDistance:Infinity,head:145,body:50,leg:42.5}],
    recoil:[[1.8,0.08],[1.95,-0.04],[2.05,0.06],[2.1,0.1],[2.15,-0.06],[2.2,0.08]]}
};
export const WEAPON_ORDER:WeaponId[]=['rifleA','rifleB','sheriff'];
export function damageAt(profile:WeaponProfile,zone:HitZone,distance:number){const d=profile.damage.find(d=>distance<=d.maxDistance)??profile.damage[profile.damage.length-1];return zone==='head'?d.head:zone==='leg'?d.leg:zone==='torso'||zone==='arm'?d.body:0;}
export function adsFov(horizontalDegrees:number,zoom:number){return 2*Math.atan(Math.tan(horizontalDegrees*Math.PI/360)/zoom)*180/Math.PI;}
