/*! openVaim v1.4.3 sensitivity table, Copyright (c) 2026 unkwsr. MIT notice: /licenses/openVaim-MIT.txt */
export const SOURCE_GAMES = [
  { id: 'cs2', name: 'Counter-Strike 2 / CS:GO', yaw: 0.022 },
  { id: 'apex', name: 'Apex Legends', yaw: 0.022 },
  { id: 'ow2', name: 'Overwatch 2', yaw: 0.0066 },
  { id: 'cod', name: 'Call of Duty (MW / Warzone)', yaw: 0.0066 },
  { id: 'destiny2', name: 'Destiny 2', yaw: 0.0066 },
] as const;

export function convertSensitivity(value:number,sourceYaw:number,sourceDpi:number,targetYaw:number,targetDpi:number) {
  if (![value,sourceYaw,sourceDpi,targetYaw,targetDpi].every(number=>Number.isFinite(number)&&number>0))return null;
  const converted=(value*sourceYaw*sourceDpi)/(targetYaw*targetDpi);
  return Number.isFinite(converted)&&converted>0?converted:null;
}
