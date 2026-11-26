/** Explicit mechanical rule selection. Imported recordings select a registered
 * ruleset before construction; current settings never silently upgrade them. */
export type SimulationRulesId='legacy-v2'|'materials-v3'|'air-steering-v4'|'bunny-hop-v5'|'weapons-v6';
export const CURRENT_SIMULATION_RULES:SimulationRulesId='weapons-v6';
/** 12.19 movement calibration; weapons-v6 keeps it and only updates firearm values. */
export const BUNNY_HOP_SIMULATION_RULES:SimulationRulesId='bunny-hop-v5';
/** Rulesets that use the calibrated tactical bunny hop (v5 and later). */
export const usesBunnyHopCalibration=(rules:SimulationRulesId)=>rules==='bunny-hop-v5'||rules==='weapons-v6';
/** Rulesets that use the 12.27 firearm values (official wiki: reserve, airborne error). */
export const usesCurrentWeapons=(rules:SimulationRulesId)=>rules==='weapons-v6';
export const AIR_STEERING_SIMULATION_RULES:SimulationRulesId='air-steering-v4';
export const MATERIALS_SIMULATION_RULES:SimulationRulesId='materials-v3';
export const LEGACY_SIMULATION_RULES:SimulationRulesId='legacy-v2';
