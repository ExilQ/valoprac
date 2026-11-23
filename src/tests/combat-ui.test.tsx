import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Box3,Vector3} from 'three';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {FootstepHUD} from '../ui/FootstepHUD';
import {CombatDiagnostics} from '../ui/MechanicsFeedback';
import {GameHUD} from '../ui/GameHUD';
import {INITIAL_TELEMETRY} from '../engine/Runtime';

describe('Combat UI information boundaries',()=>{
 it('hides a physically occluded defender marker in gunfight, with explicit learning/debug exceptions',()=>{
  const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,practiceMap:'range',targetCount:1,combatMode:'gunfight',soundMinimap:true,botDiagnostics:false});
  s.targets.forEach(t=>{t.enabled=false;t.active=false;});const t=s.targets[0];t.enabled=true;t.spawn(0,-6,0);s.movement.position.set(0,0,0);s.yaw=0;
  Object.defineProperty(s,'obstacles',{value:[{box:new Box3(new Vector3(-2,0,-3.1),new Vector3(2,3,-2.9)),kind:'wall',color:0}],configurable:true});
  const draw=(patch={})=>renderToStaticMarkup(<FootstepHUD simulation={s} settings={{...s.settings,...patch}}/>);
  expect(draw()).not.toContain('data-visible-bot');expect(draw({botDiagnostics:true})).toContain('data-visible-bot="0"');expect(draw({combatMode:'learning'})).toContain('data-visible-bot="0"');
  Object.defineProperty(s,'obstacles',{value:[],configurable:true});expect(draw()).toContain('data-visible-bot="0"');s.yaw=Math.PI;expect(draw()).not.toContain('data-visible-bot');
 });
 it('does not emit internal AI diagnostics when disabled',()=>{
  const s=new Simulation('free','rifleA',{...DEFAULT_SETTINGS,practiceMap:'garage',botDiagnostics:false,penetrationDiagnostics:false});
  expect(renderToStaticMarkup(<CombatDiagnostics simulation={s}/>)).toBe('');s.settings.botDiagnostics=true;const html=renderToStaticMarkup(<CombatDiagnostics simulation={s}/>);expect(html).toContain('개발자 진단');expect(html).toContain('미인지');expect(html).not.toContain('/ unaware');
 });
 it('keeps ammunition after the closing optional stack and uses the Operator movement threshold',()=>{
  const html=renderToStaticMarkup(<GameHUD runtime={null} settings={DEFAULT_SETTINGS} telemetry={INITIAL_TELEMETRY} mode="free" weapon="operator"/>);
  expect(html).toContain('</div><div class="ammo-hud" data-ammo-state="ready">');expect(html).toContain(`left:${5.13*.72*.15/5.4*100}%`);
 });
});
