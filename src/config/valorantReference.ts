import type {WeaponId} from '../engine/types';

/** Official VALORANT values used by rules reference-v11 (12.36). Every number
 * cites its source; docs/VALORANT_REFERENCE_12.36.md lists what is still a
 * calibration. Part of the replay calibration fingerprint. */
export interface ReferenceSpread {
  /** First-shot spread, standing, hip fire (deg). */
  first:number;
  /** Maximum spread from firing, standing, hip fire (deg). */
  max:number;
  /** Aim-down-sights (alternate fire) first-shot and maximum spread (deg). */
  adsFirst?:number;adsMax?:number;
  /** Crouched spread multiplier (crouched first/max = standing x this). */
  crouch:number;
  /** Movement penalties added on top (deg): crouch-moving, walking, running, airborne. */
  penalties:{crouch:number;walk:number;run:number;air:number};
}
export const VALORANT_REFERENCE=Object.freeze({
  /** Weapons page, patch 3.0: "Deadzone accuracy speed threshold decreased from
   * 30% >>> 27.5%". At or below this fraction of the weapon's run speed there
   * is no movement penalty. */
  deadzone:.275,
  /** Riot developer timings (2020): "Run -> Walk (61%)": the walking-accuracy
   * band ends at 61% of run speed; faster is running accuracy. */
  walkAccuracy:.61,
  /** Weapons page, patch 1.09: jump land inaccuracy is binary, 7.0 deg for
   * 0.225 s after landing. */
  landing:{spread:7,seconds:.225},
  /** Weapons page, patch 0.50: "You will no longer enter the walking accuracy
   * state when transitioning from run to stop." */
  noWalkStateWhenStopping:true,
  /** Riot developer stop timings on the Phantom (2020): releasing the key reaches
   * 25% speed in 0.110 s and stops in 0.170 s; counter-strafing reaches 61% in
   * 0.055 s, 25% in 0.104 s and stops in 0.160 s. dv/dt = -(friction*v + deceleration). */
  braking:{friction:5.7,deceleration:18.8},
  counterStrafe:{friction:4.1,deceleration:24.2},
  /** Melee page: back hits deal double damage (front 50/75, back 100/150). */
  knifeBackMultiplier:2,
  /** Weapon pages (Spread values tables, current patch). */
  spread:Object.freeze({
    rifleA:{first:.25,max:1,adsFirst:.157,adsMax:1.02,crouch:.85,penalties:{crouch:.8,walk:3,run:6,air:10}},
    rifleB:{first:.2,max:.9,adsFirst:.11,adsMax:.91,crouch:.85,penalties:{crouch:.8,walk:3,run:6,air:10}},
    sheriff:{first:.25,max:2.75,crouch:.75,penalties:{crouch:.5,walk:1.2,run:3,air:7}},
    operator:{first:5,max:5,adsFirst:0,adsMax:0,crouch:.9,penalties:{crouch:7.5,walk:10,run:15,air:15}},
  } satisfies Partial<Record<WeaponId,ReferenceSpread>>),
});

/** Counter-Strike 2 server defaults for the trainer's CS physics option
 * (reference-v11). 1 game unit = 0.0254 m. sv_jump_impulse 301.993 u/s,
 * sv_air_max_wishspeed 30 u/s, sv_stopspeed 80 u/s, sv_stepsize 18 u. Gravity
 * (800), accelerate (5.5), friction (5.2), airaccelerate (12) and the duck
 * speed (0.34) already matched. */
export const CS2_REFERENCE=Object.freeze({jumpImpulse:301.993378*.0254,airWishSpeedCap:30*.0254,groundStopSpeed:80*.0254,stepHeight:18*.0254});
