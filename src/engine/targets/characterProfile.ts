/** A different shooting surface needs its own identity even when movement,
 * weapon and map calibration remain compatible. */
export const LEGACY_CHARACTER_GEOMETRY='classic-1';
export const PREVIOUS_FIELD_GEOMETRY='field-agent-1';
export const TAILORED_FIELD_GEOMETRY='field-agent-2';
export const FIELD_CHARACTER_GEOMETRY='field-agent-3';
export type CharacterGeometryVersion=typeof LEGACY_CHARACTER_GEOMETRY|typeof PREVIOUS_FIELD_GEOMETRY|typeof TAILORED_FIELD_GEOMETRY|typeof FIELD_CHARACTER_GEOMETRY;

export function usesTailoredRig(version:CharacterGeometryVersion){
 return version===TAILORED_FIELD_GEOMETRY||version===FIELD_CHARACTER_GEOMETRY;
}
