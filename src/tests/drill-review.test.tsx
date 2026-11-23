import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS } from '../config/settings';
import { previewValorantSettings } from '../config/valorantSettingsImport';
import { equipWeaponFinish, loadWeaponFinishes } from '../config/weaponFinishes';
import { Simulation } from '../engine/simulation/Simulation';
import { createScenario } from '../training/scenarios/templates';
import { scenarioWithDifferentPlacement, selectScenarioPlacements } from '../training/scenarios/compile';
import { loadDrills, saveDrill, scenarioComparisonKey, updateDrill } from '../training/scenarios/library';
import { ShotTimeline } from '../ui/ShotTimeline';

afterEach(() => vi.unstubAllGlobals());

describe('drill review and local presentation settings', () => {
  it('stores distinct validated drills, favorites, and recency across reloads', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const first = createScenario('ramp-approach');
    const second = createScenario('sniper-jamb');
    const [saved] = saveDrill(first);
    saveDrill(first);
    saveDrill(second);
    updateDrill(saved.code, { favorite:true, lastPlayed:123 });
    expect(loadDrills()).toHaveLength(2);
    expect(loadDrills()[0]).toMatchObject({ title:first.title, favorite:true, lastPlayed:123 });
    updateDrill(saved.code, null);
    expect(loadDrills().map(row => row.title)).toEqual([second.title]);
    expect(loadWeaponFinishes()).toEqual({});
    equipWeaponFinish('operator', 'slate');
    equipWeaponFinish('rifleA', 'ceramic');
    expect(loadWeaponFinishes()).toEqual({ operator:'slate', rifleA:'ceramic' });
  });

  it('keeps a different opening layout and a different physics profile out of the same record group', () => {
    const scenario = createScenario('close-corner');
    const other = scenarioWithDifferentPlacement(scenario)!;
    expect(selectScenarioPlacements(other, 0).map(s => s.position))
      .not.toEqual(selectScenarioPlacements(scenario, 0).map(s => s.position));
    const session = new Simulation('free', 'sheriff', structuredClone(DEFAULT_SETTINGS), { scenario }).snapshot();
    const renamed = { ...session, sessionOptions:{ scenario:{...scenario,title:'다른 이름'} } };
    const changed = { ...session, sessionOptions:{ scenario:other } };
    expect(scenarioComparisonKey(session)).toEqual(scenarioComparisonKey(renamed));
    expect(scenarioComparisonKey(session)).not.toEqual(scenarioComparisonKey(changed));
    expect(scenarioComparisonKey(session)).not.toEqual(scenarioComparisonKey({ ...session, settings:{...session.settings,movementPhysics:'counterStrike'} }));
  });

  it('previews explicit supported settings and leaves absent input settings alone', () => {
    const profile = { profiles:[{ primary:{ color:{ r:12,g:64,b:173 }, bDisplayCenterDot:false, innerLines:{lineLength:5} } }], currentProfile:0 };
    const input = '[Settings]\nEAresFloatSettingName::MouseSensitivity=0.42\nEAresFloatSettingName::MouseSensitivityADS=9\nEAresFloatSettingName::MouseSensitivityZoomed=0.87\nEAresStringSettingName::SavedCrosshairProfileData=' + JSON.stringify(JSON.stringify(profile));
    const preview = previewValorantSettings(input, DEFAULT_SETTINGS);
    expect(preview.patch).toMatchObject({ sensitivity:.42,scopeSensitivity25:.87,scopeSensitivity5:.87,crosshairColor:'#0c40ad',crosshairLength:5,crosshairAdvanced:{primary:{centerDot:false}} });
    expect(preview.patch).not.toHaveProperty('adsSensitivity');
    expect(preview.patch).not.toHaveProperty('dpi');
    expect(preview.warnings).toHaveLength(1);
  });

  it('renders retained shot components and signed braking timing for legacy records', () => {
    const sim = new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS));
    sim.running=true;
    sim.step(1/120,{forward:0,strafe:0,walk:false,crouch:false,jump:false,fire:true,ads:false,reload:false});
    const session=sim.snapshot(),source=session.shots.at(-1)!;
    const shot={...source,thresholdDelta:-.042,spread:{...source.spread,landing:undefined}};
    const html=renderToStaticMarkup(<ShotTimeline session={{...session,shots:[shot]}} onSeek={()=>{}}/>);
    expect(html).toContain('42ms');
    expect(html).toContain('공중·착지');
    expect(html).toContain('이 발 리플레이');
  });
});
