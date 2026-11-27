/** Explicit mechanical rule selection. Imported recordings select a registered
 * ruleset before construction; current settings never silently upgrade them. */
export type SimulationRulesId='legacy-v2'|'materials-v3'|'air-steering-v4'|'bunny-hop-v5'|'weapons-v6'|'training-v7'|'audio-v8'|'consistency-v9'|'acceleration-v10'|'reference-v11'|'braking-v12';
export const CURRENT_SIMULATION_RULES:SimulationRulesId='braking-v12';
/** 12.36 reference rules; braking-v12 keeps them. */
export const REFERENCE_SIMULATION_RULES:SimulationRulesId='reference-v11';
/** 12.35 acceleration rules; reference-v11 keeps them. */
export const ACCELERATION_SIMULATION_RULES:SimulationRulesId='acceleration-v10';
/** 12.34 consistency rules; acceleration-v10 keeps them. */
export const CONSISTENCY_SIMULATION_RULES:SimulationRulesId='consistency-v9';
/** 12.32 audio rules; consistency-v9 keeps them. */
export const AUDIO_SIMULATION_RULES:SimulationRulesId='audio-v8';
/** 12.31 training rules; audio-v8 keeps them. */
export const TRAINING_SIMULATION_RULES:SimulationRulesId='training-v7';
/** 12.27 firearm values; training-v7 keeps them. */
export const WEAPONS_SIMULATION_RULES:SimulationRulesId='weapons-v6';
/** 12.19 movement calibration; weapons-v6 keeps it and only updates firearm values. */
export const BUNNY_HOP_SIMULATION_RULES:SimulationRulesId='bunny-hop-v5';
/** Rulesets that use the calibrated tactical bunny hop (v5 and later). */
export const usesBunnyHopCalibration=(rules:SimulationRulesId)=>rules==='bunny-hop-v5'||rules==='weapons-v6'||rules==='training-v7'||rules==='audio-v8'||rules==='consistency-v9'||rules==='acceleration-v10'||rules==='reference-v11'||rules==='braking-v12';
/** Rulesets that use the 12.27 firearm values (official wiki: reserve, airborne error). */
export const usesCurrentWeapons=(rules:SimulationRulesId)=>rules==='weapons-v6'||rules==='training-v7'||rules==='audio-v8'||rules==='consistency-v9'||rules==='acceleration-v10'||rules==='reference-v11'||rules==='braking-v12';
/** 12.31 training rules: bots return on training maps, bots hear gunfire,
 * crouching in the air tucks the legs (the feet rise, landing comes later). */
export const usesTrainingRules=(rules:SimulationRulesId)=>rules==='training-v7'||rules==='audio-v8'||rules==='consistency-v9'||rules==='acceleration-v10'||rules==='reference-v11'||rules==='braking-v12';
/** 12.32 audio rules: footstep audibility scales with the weapon's run speed
 * (walking is silent with any weapon) and jumps make a push-off sound unless
 * the player was already crouched at takeoff. */
export const usesAudioRules=(rules:SimulationRulesId)=>rules==='audio-v8'||rules==='consistency-v9'||rules==='acceleration-v10'||rules==='reference-v11'||rules==='braking-v12';
/** 12.34 consistency rules: every air speed cap scales with the takeoff
 * weapon's run speed, whatever the takeoff state (see docs/PHYSICS_CONSISTENCY_12.34.md). */
export const usesConsistencyRules=(rules:SimulationRulesId)=>rules==='consistency-v9'||rules==='acceleration-v10'||rules==='reference-v11'||rules==='braking-v12';
/** 12.35: ground acceleration of an Unreal character (2048 cm/s^2), so a
 * stop-to-run takes about a quarter second instead of 0.14 s. */
export const usesRecoveryAcceleration=(rules:SimulationRulesId)=>rules==='acceleration-v10'||rules==='reference-v11'||rules==='braking-v12';
export const AIR_STEERING_SIMULATION_RULES:SimulationRulesId='air-steering-v4';
export const MATERIALS_SIMULATION_RULES:SimulationRulesId='materials-v3';
export const LEGACY_SIMULATION_RULES:SimulationRulesId='legacy-v2';
/** 12.36 reference rules: accuracy, braking, landing inaccuracy and knife
 * back hits follow the official VALORANT values (docs/VALORANT_REFERENCE_12.36.md). */
export const usesReferenceRules=(rules:SimulationRulesId)=>rules==='reference-v11'||rules==='braking-v12';
/** 12.37 braking rules: crouching takes 0.275 s, slowing below a new top
 * speed (crouch, walk, aim, weapon) brakes like releasing the keys, crouched
 * takeoffs jump 2.5% slower and air crouches tuck the feet 0.2 m. */
export const usesBrakingRules=(rules:SimulationRulesId)=>rules==='braking-v12';
