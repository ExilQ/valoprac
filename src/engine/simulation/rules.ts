/** Explicit mechanical rule selection. Imported recordings select a registered
 * ruleset before construction; current settings never silently upgrade them. */
export type SimulationRulesId='legacy-v2'|'materials-v3'|'air-steering-v4'|'bunny-hop-v5';
export const CURRENT_SIMULATION_RULES:SimulationRulesId='bunny-hop-v5';
export const AIR_STEERING_SIMULATION_RULES:SimulationRulesId='air-steering-v4';
export const MATERIALS_SIMULATION_RULES:SimulationRulesId='materials-v3';
export const LEGACY_SIMULATION_RULES:SimulationRulesId='legacy-v2';
