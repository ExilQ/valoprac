import type { Settings } from '../engine/types';
import { crosshairConfiguration, crosshairSettings, sanitizeCrosshairDesign } from './crosshair';
import type { CrosshairDesign, CrosshairLine } from './crosshair';

export const MAX_SETTINGS_FILE_BYTES = 2 * 1024 * 1024;
const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function importLine(value: unknown, base: CrosshairLine) {
  const line = asRecord(value);
  return { ...base, enabled: line.bShowLines, length: line.lineLength, thickness: line.lineThickness,
    gap: line.lineOffset, opacity: line.opacity };
}

function importDesign(value: unknown, base: CrosshairDesign) {
  const source = asRecord(value);
  const rgb = asRecord(source.bUseCustomColor === true ? source.colorCustom : source.color);
  const channels = [rgb.r, rgb.g, rgb.b];
  const color = channels.every(value => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255)
    ? '#' + channels.map(value => Number(value).toString(16).padStart(2, '0')).join('')
    : base.color;
  return sanitizeCrosshairDesign({
    color, outline:source.bHasOutline, outlineThickness:source.outlineThickness, outlineOpacity:source.outlineOpacity,
    centerDot:source.bDisplayCenterDot, centerSize:source.centerDotSize, centerOpacity:source.centerDotOpacity,
    inner:importLine(source.innerLines, base.inner), outer:importLine(source.outerLines, base.outer),
  }, base);
}

/** Reads the explicitly supported local settings. The browser never opens a path itself. */
export function previewValorantSettings(text: string, settings: Settings) {
  if (text.length > MAX_SETTINGS_FILE_BYTES) throw new Error('설정 파일은 2MB 이하여야 합니다.');
  const values = new Map<string, string>();
  let section = '';
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const entry = line.trim();
    if (entry.startsWith('[') && entry.endsWith(']')) { section = entry.slice(1, -1); continue; }
    if (section !== 'Settings') continue;
    const match = entry.match(/^EAres(?:Float|String)SettingName::(MouseSensitivity(?:ADS|Zoomed)?|SavedCrosshairProfileData)\s*=\s*(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  const patch: Partial<Settings> = {};
  const rows: { label:string; from:string; to:string }[] = [];
  const warnings: string[] = [];
  for (const [name, key, label, min, max] of [
    ['MouseSensitivity','sensitivity','기본 감도',.01,5],
    ['MouseSensitivityADS','adsSensitivity','소총 정조준 배율',.1,2],
    ['MouseSensitivityZoomed','scopeSensitivity25','2.5배 조준 배율',.1,2],
    ['MouseSensitivityZoomed','scopeSensitivity5','5배 조준 배율',.1,2],
  ] as const) {
    const raw = values.get(name);
    if (raw === undefined) continue;
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value < min || value > max) { warnings.push(`${label}: 지원 범위를 벗어납니다.`); continue; }
    patch[key] = value;
    rows.push({ label, from:String(settings[key]), to:String(value) });
  }
  const encoded = values.get('SavedCrosshairProfileData');
  if (encoded !== undefined) {
    try {
      let decoded: unknown = JSON.parse(encoded);
      if (typeof decoded === 'string') decoded = JSON.parse(decoded);
      const source = asRecord(decoded);
      if (!Array.isArray(source.profiles) || typeof source.currentProfile !== 'number' || !Number.isInteger(source.currentProfile)) throw new Error();
      const profile = asRecord(source.profiles[source.currentProfile]);
      if (!Object.keys(asRecord(profile.primary)).length) throw new Error();
      const previous = crosshairConfiguration(settings);
      const primary = importDesign(profile.primary, previous.primary);
      const hasAds = Object.keys(asRecord(profile.aDS)).length > 0;
      Object.assign(patch, crosshairSettings({
        ...previous, primary,
        adsMode:profile.bUsePrimaryCrosshairForADS === true ? 'primary' : hasAds ? 'custom' : previous.adsMode,
        ads:hasAds ? importDesign(profile.aDS, previous.ads) : previous.ads,
      }));
      rows.push({ label:'활성 조준선', from:previous.primary.color, to:primary.color });
    } catch {
      warnings.push('활성 조준선 프로필을 읽지 못했습니다.');
    }
  }
  return { patch, rows, warnings };
}
