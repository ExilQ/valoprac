/** Explicit mechanical rule selection. Imported recordings select a registered
 * ruleset before construction; current settings never silently upgrade them. */
export type SimulationRulesId='legacy-v2'|'materials-v3';
export const CURRENT_SIMULATION_RULES:SimulationRulesId='materials-v3';
export const LEGACY_SIMULATION_RULES:SimulationRulesId='legacy-v2';
