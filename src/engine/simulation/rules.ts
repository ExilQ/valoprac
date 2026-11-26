/** Explicit mechanical rule selection. Imported recordings select a registered
 * ruleset before construction; current settings never silently upgrade them. */
export type SimulationRulesId='legacy-v2'|'materials-v3'|'air-steering-v4'|'bunny-hop-v5'|'weapons-v6'|'training-v7'|'audio-v8';
export const CURRENT_SIMULATION_RULES:SimulationRulesId='audio-v8';
/** 12.31 training rules; audio-v8 keeps them. */
export const TRAINING_SIMULATION_RULES:SimulationRulesId='training-v7';
/** 12.27 firearm values; training-v7 keeps them. */
export const WEAPONS_SIMULATION_RULES:SimulationRulesId='weapons-v6';
/** 12.19 movement calibration; weapons-v6 keeps it and only updates firearm values. */
export const BUNNY_HOP_SIMULATION_RULES:SimulationRulesId='bunny-hop-v5';
/** Rulesets that use the calibrated tactical bunny hop (v5 and later). */
export const usesBunnyHopCalibration=(rules:SimulationRulesId)=>rules==='bunny-hop-v5'||rules==='weapons-v6'||rules==='training-v7'||rules==='audio-v8';
/** Rulesets that use the 12.27 firearm values (official wiki: reserve, airborne error). */
export const usesCurrentWeapons=(rules:SimulationRulesId)=>rules==='weapons-v6'||rules==='training-v7'||rules==='audio-v8';
/** 12.31 training rules: bots return on training maps, bots hear gunfire,
 * crouching in the air tucks the legs (the feet rise, landing comes later). */
export const usesTrainingRules=(rules:SimulationRulesId)=>rules==='training-v7'||rules==='audio-v8';
/** 12.32 audio rules: footstep audibility scales with the weapon's run speed
 * (walking is silent with any weapon) and jumps make a push-off sound unless
 * the player was already crouched at takeoff. */
export const usesAudioRules=(rules:SimulationRulesId)=>rules==='audio-v8';
export const AIR_STEERING_SIMULATION_RULES:SimulationRulesId='air-steering-v4';
export const MATERIALS_SIMULATION_RULES:SimulationRulesId='materials-v3';
export const LEGACY_SIMULATION_RULES:SimulationRulesId='legacy-v2';
