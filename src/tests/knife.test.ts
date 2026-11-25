import {describe,expect,it} from 'vitest';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type InputState,type Settings} from '../engine/types';
import {KNIFE_ATTACKS,WEAPONS,weaponForSlot,slotOf,isPrimary} from '../config/weapons';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {validateReplay} from '../engine/replay/validation';

const DT=1/120;
function arena(distance:number,extra:Partial<Settings>={}){
  const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),behavior:'stationary',targetCount:1,eliminationRule:'head',...extra});
  s.running=true;s.step(DT,emptyInput());
  const t=s.targets[0],p=s.movement.position;t.position.set(p.x,p.y,p.z-distance);t.previous.copy(t.position);t.anchor.copy(t.position);t.updatePose(s.time);
  return {s,t};
}
function run(s:Simulation,seconds:number,input:Partial<InputState>={}){for(let i=0;i<Math.round(seconds/DT);i++)s.step(DT,{...emptyInput(),...input});}

describe('Weapon slots: 1 primary, 2 sidearm, 3 knife',()=>{
  it('maps the number row to the last primary, the Sheriff and the knife',()=>{
    expect([1,2,3].map(n=>weaponForSlot(n,'rifleB'))).toEqual(['rifleB','sheriff','knife']);
    expect(weaponForSlot(1,'operator')).toBe('operator');expect(weaponForSlot(4,'rifleA')).toBeNull();
    expect((['rifleA','rifleB','operator','sheriff','knife'] as const).map(slotOf)).toEqual([1,1,1,2,3]);
    expect(isPrimary('sheriff')).toBe(false);expect(isPrimary('knife')).toBe(false);expect(isPrimary('operator')).toBe(true);
  });
});

describe('Knife melee',()=>{
  it('slashes a target at arm\'s length after the draw, without creating a gun shot',()=>{
    const {s,t}=arena(1.4);s.switchWeapon('knife');
    run(s,.1,{fire:true,firePresses:1});expect(s.meleeSerial).toBe(0);// still drawing
    run(s,WEAPONS.knife.equipTime);
    const health=t.health;s.step(DT,{...emptyInput(),fire:true,firePresses:1});
    expect(s.meleeSerial).toBe(1);expect(s.lastMelee).toMatchObject({kind:'slash',damage:KNIFE_ATTACKS.slash.damage,targetId:t.id});
    expect(t.health).toBe(health-KNIFE_ATTACKS.slash.damage);
    expect(s.shots).toHaveLength(0);expect(s.stats.shots).toBe(0);
  });
  it('waits for recovery between slashes and eliminates once health is spent',()=>{
    const {s,t}=arena(1.4);s.switchWeapon('knife');run(s,WEAPONS.knife.equipTime+DT);
    run(s,KNIFE_ATTACKS.slash.recovery*.9,{fire:true});expect(s.meleeSerial).toBe(1);
    run(s,KNIFE_ATTACKS.slash.recovery*1.6,{fire:true});
    expect(s.meleeSerial).toBe(3);expect(s.kills).toHaveLength(1);expect(t.active).toBe(false);
  });
  it('stabs with the secondary (scope) input for more damage and misses beyond reach',()=>{
    const near=arena(1.3);near.s.switchWeapon('knife');run(near.s,WEAPONS.knife.equipTime+DT);
    near.s.step(DT,{...emptyInput(),scopeHeld:true,scopePresses:1});
    expect(near.s.lastMelee).toMatchObject({kind:'stab',damage:KNIFE_ATTACKS.stab.damage});
    const far=arena(KNIFE_ATTACKS.slash.range+1.5);far.s.switchWeapon('knife');run(far.s,WEAPONS.knife.equipTime+DT);
    const health=far.t.health;far.s.step(DT,{...emptyInput(),fire:true,firePresses:1});
    expect(far.s.lastMelee).toMatchObject({hit:'miss',damage:0,targetId:null});expect(far.t.health).toBe(health);
  });
  it('runs faster with the knife out and never aims down sights',()=>{
    const {s}=arena(3);s.switchWeapon('knife');s.step(DT,{...emptyInput(),ads:true});
    expect(s.movement.speedModifier).toBeCloseTo(6.75/5.4,6);expect(s.ads).toBe(false);
    s.switchWeapon('rifleA');s.step(DT,emptyInput());expect(s.movement.speedModifier).toBeCloseTo(1,6);
  });
});

describe('Knife replays',()=>{
  it('records a knife switch and kill, validates the file and reproduces the checksum',async()=>{
    // Settings keep their real limits (targets spawn at least 5 m out), so the
    // recorded inputs walk the player into reach before stabbing.
    const s=new Simulation('free','rifleA',{...structuredClone(DEFAULT_SETTINGS),behavior:'stationary',targetCount:1,eliminationRule:'head',targetDistance:5});
    const recorder=new ReplayRecorder(s);s.running=true;
    run(s,DT);s.switchWeapon('knife');run(s,WEAPONS.knife.equipTime+DT);
    const t=s.targets[0];for(let i=0;i<600&&s.movement.position.distanceTo(t.position)>1.5;i++)s.step(DT,{...emptyInput(),forward:1});
    run(s,.6);run(s,KNIFE_ATTACKS.stab.recovery*2.1,{scopeHeld:true});run(s,.2);
    s.switchWeapon('sheriff');run(s,.2);
    expect(s.kills).toHaveLength(1);
    const record=recorder.finish()!;expect(record).toBeTruthy();
    expect(()=>validateReplay(structuredClone(record))).not.toThrow();
    expect(await new ReplayPlayer(record).verify()).toMatchObject({passed:true});
  });
});
