import type { SessionData } from '../../engine/types';
import { encodeScenario } from './codec';
import type { ScenarioDefinition } from './types';

const STORAGE_KEY = 'valoprac-saved-drills-v1';
const MAX_DRILLS = 40;
export interface SavedDrill {
  code: string;
  title: string;
  favorite: boolean;
  lastPlayed: number;
}

export function loadDrills(): SavedDrill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 1_400_000) return [];
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, MAX_DRILLS).filter((row): row is SavedDrill =>
      row && typeof row.code === 'string' && /^VP-S1\.[A-Za-z0-9_-]{1,32000}$/.test(row.code) &&
      typeof row.title === 'string' && row.title.length > 0 && row.title.length <= 64 &&
      typeof row.favorite === 'boolean' && Number.isSafeInteger(row.lastPlayed) && row.lastPlayed >= 0
    );
  } catch {
    return [];
  }
}

function writeDrills(rows: SavedDrill[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  return rows;
}

export function saveDrill(scenario: ScenarioDefinition) {
  const code = encodeScenario(scenario);
  const rows = loadDrills();
  if (rows.some(row => row.code === code)) return rows;
  if (rows.length >= MAX_DRILLS) throw new Error('보관함이 가득 찼습니다. 드릴을 하나 삭제한 뒤 저장하세요.');
  return writeDrills([...rows, { code, title: scenario.title, favorite: false, lastPlayed: 0 }]);
}

export function updateDrill(code: string, patch: Partial<Pick<SavedDrill, 'favorite' | 'lastPlayed'>> | null) {
  const rows = loadDrills();
  return writeDrills(patch ? rows.map(row => row.code === code ? { ...row, ...patch } : row) : rows.filter(row => row.code !== code));
}

export function sessionScenario(session: SessionData) {
  return session.sessionOptions?.scenario ?? session.replay?.header.initial.options?.scenario;
}

function scenarioLayoutKey(scenario: ScenarioDefinition) {
  const point = ({ x, y, z }: ScenarioDefinition['player']['position']) => [x, y, z];
  const { player, rules } = scenario;
  return [
    scenario.schema, scenario.routeId, scenario.template, scenario.seed,
    point(player.position), player.yaw, player.pitch, player.weapon,
    scenario.bots.map(bot => [bot.id, point(bot.position), bot.weapon, bot.movement, bot.alternatives.map(point)]),
    rules.difficulty, rules.combatMode, rules.duration, rules.exposureLimit, rules.randomSpawns,
    rules.infiniteReserve, rules.autoReload, rules.exposurePolicy, rules.arrival ?? null,
  ];
}

export function scenarioComparisonKey(session: SessionData) {
  const scenario = sessionScenario(session);
  if (!scenario) return null;
  const { movementPhysics, csMovementPreset, jumpBufferMs, gameplayRevision, sensitivity,
    adsSensitivity, scopeSensitivity25, scopeSensitivity5, degreesPerCount, fov, defenderAimSpeed,
    defenderAimAcceleration, defenderStability, defenderFirstShotError, defenderRecoilControl,
    defenderTactics, defenderReaction, defenderAccuracy } = session.settings;
  return JSON.stringify([
    scenarioLayoutKey(scenario), session.runtime ?? 'browser', session.mode,
    session.weapon, session.seed, session.physics?.rules ?? null, session.physics?.version ?? null,
    session.physics?.materialPhysicsVersion ?? null, gameplayRevision, movementPhysics,
    movementPhysics === 'counterStrike' ? csMovementPreset : null, jumpBufferMs,
    sensitivity, adsSensitivity, scopeSensitivity25, scopeSensitivity5, degreesPerCount, fov,
    defenderAimSpeed, defenderAimAcceleration, defenderStability, defenderFirstShotError,
    defenderRecoilControl, defenderTactics, defenderReaction, defenderAccuracy,
  ]);
}
