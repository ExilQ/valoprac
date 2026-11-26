import type { WeaponId, GunId, HitZone, KnifeSkinId } from '../engine/types';
export interface WeaponProfile {
  id:WeaponId; name:string; kind:'vandal'|'phantom'|'sheriff'|'operator'|'knife'; fireMode:'auto'|'semi'|'bolt'|'melee'; fireRate:number; adsFireRate:number; adsZoom:number; equipTime:number; reserve:number;adsTransition:number;
  movementSpeed?:number;penetration?:'high'|'medium'|'low';
  magazine:number; reloadTime:number; firstSpread:number; movementSpread:number;walkingSpread?:number;
  /** Total no-bloom hip-fire half-cone at full crouch movement speed, in degrees. */
  crouchMovingSpread?:number;
  airSpread:number; bloomPerShot:number; maxBloom:number; bloomRecovery:number; resetTime:number;
  recoilRecovery:number; recoveryDelay:number; cameraScale:number; randomness:number;
  crouchSpread:number; crouchRecoil:number; adsSpread:number; adsMoveModifier:number;
  yawSwitchTime:number; yawSwitchChance:number; protectedBullets:number;
  damage:readonly {maxDistance:number;head:number;body:number;leg:number}[];
  recoil:readonly (readonly [number,number])[];
}
// Calibration v2: published 11.08 PC switching values; requested base specifications.
// Recoil curves, movement/spread recovery, equip time and animation are provisional.
// Independent crouch-motion-1.0.0 endpoints map official 2.02 / 9.10 notes into
// this trainer's half-cone convention; see docs/peeking/CROUCH_SPREAD_CALIBRATION.md.
export const WEAPONS:Record<WeaponId,WeaponProfile> = {
  rifleA:{penetration:'medium',id:'rifleA',name:'밴달',kind:'vandal',fireMode:'auto',fireRate:9.75,adsFireRate:8.775,adsZoom:1.25,equipTime:1,reserve:50,adsTransition:.14,
    magazine:25,reloadTime:2.5,firstSpread:0.25,movementSpread:6,walkingSpread:3,crouchMovingSpread:.8,airSpread:10,bloomPerShot:0.13,maxBloom:1.25,bloomRecovery:2.3,resetTime:0.38,
    recoilRecovery:6.8,recoveryDelay:0.18,cameraScale:1,randomness:0.065,crouchSpread:0.72,crouchRecoil:0.8,adsSpread:0.63,adsMoveModifier:0.76,
    yawSwitchTime:0.6,yawSwitchChance:0.1,protectedBullets:6,
    damage:[{maxDistance:Infinity,head:160,body:40,leg:34}],
    recoil:[[0.2,0],[0.4,0.025],[0.57,-0.035],[0.69,0.045],[0.78,0.065],[0.78,0.04],[0.69,0.18],[0.59,0.27],[0.47,0.37],[0.37,0.43],[0.28,0.48],[0.2,0.45],[0.14,0.4],[0.08,0.43],[0.04,0.48],[0.03,0.5],[0.02,0.5],[0.01,0.48],[0.01,0.46]]},
  rifleB:{penetration:'medium',id:'rifleB',name:'팬텀',kind:'phantom',fireMode:'auto',fireRate:11,adsFireRate:9.9,adsZoom:1.25,equipTime:1,reserve:60,adsTransition:.12,
    magazine:30,reloadTime:2.5,firstSpread:0.2,movementSpread:6,walkingSpread:3,crouchMovingSpread:.8,airSpread:10,bloomPerShot:0.105,maxBloom:1.1,bloomRecovery:2.5,resetTime:0.35,
    recoilRecovery:7.2,recoveryDelay:0.16,cameraScale:1,randomness:0.055,crouchSpread:0.68,crouchRecoil:0.78,adsSpread:0.55,adsMoveModifier:0.76,
    yawSwitchTime:0.6,yawSwitchChance:0.1,protectedBullets:8,
    damage:[{maxDistance:20,head:156,body:39,leg:33.15},{maxDistance:Infinity,head:140,body:35,leg:29.75}],
    recoil:[[0.14,0],[0.3,-0.025],[0.41,0.025],[0.49,0.03],[0.57,-0.03],[0.59,0.04],[0.56,0.08],[0.5,0.1],[0.42,0.21],[0.34,0.3],[0.26,0.34],[0.19,0.36],[0.12,0.34],[0.07,0.36],[0.03,0.38],[0.02,0.4],[0.01,0.39],[0.01,0.38]]},
  operator:{id:'operator',name:'오퍼레이터',kind:'operator',fireMode:'bolt',fireRate:.6,adsFireRate:.6,adsZoom:2.5,equipTime:1.5,reserve:10,adsTransition:.3,movementSpeed:5.13,penetration:'high',magazine:5,reloadTime:3.7,firstSpread:5,movementSpread:10,walkingSpread:7,airSpread:12,bloomPerShot:2,maxBloom:4,bloomRecovery:3,resetTime:1.67,recoilRecovery:5,recoveryDelay:.35,cameraScale:1,randomness:.01,crouchSpread:.85,crouchRecoil:.8,adsSpread:.004,adsMoveModifier:.72,yawSwitchTime:1,yawSwitchChance:0,protectedBullets:1,damage:[{maxDistance:Infinity,head:255,body:150,leg:120}],recoil:[[2.5,.05]]},
  sheriff:{penetration:'high',id:'sheriff',name:'셰리프',kind:'sheriff',fireMode:'semi',fireRate:4,adsFireRate:4,adsZoom:1,equipTime:1,reserve:24,adsTransition:0,
    magazine:6,reloadTime:2.25,firstSpread:0.25,movementSpread:3,walkingSpread:1.2,crouchMovingSpread:.5,airSpread:7,bloomPerShot:0.9,maxBloom:3.2,bloomRecovery:2.4,resetTime:0.55,
    recoilRecovery:5.7,recoveryDelay:0.25,cameraScale:1,randomness:0.025,crouchSpread:0.75,crouchRecoil:0.9,adsSpread:1,adsMoveModifier:1,
    yawSwitchTime:0.6,yawSwitchChance:0,protectedBullets:6,
    damage:[{maxDistance:30,head:159.5,body:55,leg:46.75},{maxDistance:Infinity,head:145,body:50,leg:42.5}],
    recoil:[[1.8,0.08],[1.95,-0.04],[2.05,0.06],[2.1,0.1],[2.15,-0.06],[2.2,0.08]]},
  // Melee slot. Gun fields are inert (no magazine, spread or recoil); the
  // simulation routes attacks through KNIFE_ATTACKS instead of a bullet.
  knife:{id:'knife',name:'전술 나이프',kind:'knife',fireMode:'melee',fireRate:2,adsFireRate:2,adsZoom:1,equipTime:.6,reserve:0,adsTransition:0,movementSpeed:6.75,
    magazine:0,reloadTime:0,firstSpread:0,movementSpread:0,airSpread:0,bloomPerShot:0,maxBloom:0,bloomRecovery:1,resetTime:1,
    recoilRecovery:10,recoveryDelay:0,cameraScale:1,randomness:0,crouchSpread:1,crouchRecoil:1,adsSpread:1,adsMoveModifier:1,
    yawSwitchTime:1,yawSwitchChance:0,protectedBullets:0,
    damage:[{maxDistance:Infinity,head:50,body:50,leg:50}],
    recoil:[[0,0]]}
};
export const WEAPON_ORDER:GunId[]=['rifleA','rifleB','sheriff','operator'];
/** Every equippable item, in weapon-RNG seed order. The knife is appended so
 * the firearms keep the seeds recorded by earlier replays. */
export const EQUIP_ORDER:WeaponId[]=[...WEAPON_ORDER,'knife'];
/** Firearm values recorded by rules v2-v5 (before 12.27). Replays made with
 * those rules keep playing back with them; the official wiki values above
 * (reserve 50/60 since patch 6.11, airborne error +10/+10/+7) apply from
 * weapons-v6. Spreading over the current profile keeps each key's position, so
 * the legacy calibration fingerprint is byte-identical to the old one. */
const LEGACY_FIREARM_VALUES:Partial<Record<WeaponId,Partial<WeaponProfile>>>={rifleA:{reserve:75,airSpread:8.5},rifleB:{reserve:90,airSpread:8},sheriff:{airSpread:8}};
export const LEGACY_WEAPONS:Record<WeaponId,WeaponProfile>=Object.fromEntries((Object.keys(WEAPONS) as WeaponId[]).map(id=>[id,LEGACY_FIREARM_VALUES[id]?{...WEAPONS[id],...LEGACY_FIREARM_VALUES[id]}:WEAPONS[id]])) as Record<WeaponId,WeaponProfile>;
export function weaponProfilesFor(current:boolean){return current?WEAPONS:LEGACY_WEAPONS;}
export const PRIMARY_WEAPONS:GunId[]=['rifleA','rifleB','operator'];
export const SIDEARM:GunId='sheriff';
export const isGun=(id:WeaponId):id is GunId=>id!=='knife';
export const isPrimary=(id:WeaponId):id is GunId=>(PRIMARY_WEAPONS as WeaponId[]).includes(id);
/** Number-row slots: 1 primary, 2 sidearm, 3 knife. */
export function weaponForSlot(slot:number,primary:GunId):WeaponId|null{return slot===1?primary:slot===2?SIDEARM:slot===3?'knife':null;}
export function slotOf(id:WeaponId):1|2|3{return id==='knife'?3:id===SIDEARM?2:1;}

/** Melee attacks. Damage ignores hit zone; elimination follows target health
 * (150) unless the free-practice rule eliminates on any hit. */
export const KNIFE_ATTACKS={
  slash:{damage:50,range:2.2,recovery:.5,cone:16},
  stab:{damage:75,range:1.9,recovery:.95,cone:12}
} as const;
export type KnifeAttack=keyof typeof KNIFE_ATTACKS;

export interface KnifeSkin {id:KnifeSkinId;name:string;style:'real'|'fantasy';description:string;}
export const KNIFE_SKINS:readonly KnifeSkin[]=[
  {id:'field',name:'필드 나이프',style:'real',description:'검은 코팅 날 · 파라코드 손잡이'},
  {id:'tanto',name:'탄토',style:'real',description:'각진 끝 · 청록 실 감기'},
  {id:'karambit',name:'카람빗',style:'real',description:'손가락 고리 · 갈고리형 곡도'},
  {id:'kunai',name:'쿠나이',style:'real',description:'고리 손잡이 · 가벼운 단검'},
  {id:'aether',name:'에테르 블레이드',style:'fantasy',description:'떠 있는 청록 에너지 날'},
  {id:'obsidian',name:'흑요석 송곳니',style:'fantasy',description:'용암 균열이 빛나는 흑요석'}
];
export const KNIFE_SKIN_IDS=KNIFE_SKINS.map(s=>s.id);
export function damageAt(profile:WeaponProfile,zone:HitZone,distance:number){const d=profile.damage.find(d=>distance<=d.maxDistance)??profile.damage[profile.damage.length-1];return zone==='head'?d.head:zone==='leg'?d.leg:zone==='torso'||zone==='arm'?d.body:0;}
export {horizontalFov as adsFov} from '../engine/rendering/projection';
