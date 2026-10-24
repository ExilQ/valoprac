import type { ShotEvent, KillEvent, SessionSummary, WeaponId, WeaponTotals } from '../../engine/types';
const rate=(n:number,d:number)=>d?n/d*100:0;
class Moments {n=0;sum=0;squares=0;add(v:number){this.n++;this.sum+=v;this.squares+=v*v;}get mean(){return this.n?this.sum/this.n:0;}get sd(){return this.n?Math.sqrt(Math.max(0,this.squares/this.n-this.mean*this.mean)):0;}}
const totals=():WeaponTotals=>({shots:0,hits:0,heads:0,recoilSquared:0,spreadSum:0});
export class LifetimeStats {
  shots=0;heads=0;bodies=0;limbs=0;first=0;firstHits=0;firstHeads=0;eliminations=0;early=0;brakes=0;
  elimination=new Moments();brake=new Moments();deceleration=new Moments();speed=new Moments();timing=new Moments();angular=new Moments();
  comparison={neutral:{duration:new Moments(),timing:new Moments(),heads:0},opposite:{duration:new Moments(),timing:new Moments(),heads:0}};
  weapons:Record<WeaponId,WeaponTotals>={rifleA:totals(),rifleB:totals(),sheriff:totals()};
  shot(s:ShotEvent){this.shots++;const hit=s.hit==='head'||s.hit==='torso'||s.hit==='arm'||s.hit==='leg';if(s.hit==='head')this.heads++;if(s.hit==='torso')this.bodies++;if(s.hit==='arm'||s.hit==='leg')this.limbs++;
    if(s.firstShot){this.first++;if(hit)this.firstHits++;if(s.hit==='head')this.firstHeads++;}
    if(s.releaseTime!==null){this.brakes++;if(!s.accurate)this.early++;this.speed.add(Math.hypot(s.velocity.x,s.velocity.z));}
    if(s.angularError!==null)this.angular.add(s.angularError);
    const w=this.weapons[s.weapon];w.shots++;w.hits+=Number(hit);w.heads+=Number(s.hit==='head');w.recoilSquared+=s.recoil.pitch**2+s.recoil.yaw**2;w.spreadSum+=s.spread.total;
  }
  kill(k:KillEvent){this.eliminations++;this.elimination.add(k.elapsed);}
  settleBrake(s:ShotEvent){if(s.brakingDuration!==null){this.brake.add(s.brakingDuration);if(s.brakingKind){const c=this.comparison[s.brakingKind];c.duration.add(s.brakingDuration);if(s.thresholdDelta!==null)c.timing.add(s.thresholdDelta);if(s.hit==='head')c.heads++;}}
    if(s.thresholdDelta!==null)this.timing.add(s.thresholdDelta);if(s.decelerationDuration!==null)this.deceleration.add(s.decelerationDuration);
  }
  apply(recent:SessionSummary,pending:ShotEvent|null):SessionSummary{
    const hits=this.heads+this.bodies+this.limbs,misses=this.shots-hits;
    const comparison=(kind:'neutral'|'opposite')=>{const c=this.comparison[kind],extra=pending?.brakingKind===kind&&pending.brakingDuration!==null?1:0;return {count:c.duration.n+extra,duration:(c.duration.sum+(extra?pending!.brakingDuration!:0))/Math.max(1,c.duration.n+extra),delta:(c.timing.sum+(extra?pending!.thresholdDelta??0:0))/Math.max(1,c.timing.n+Number(extra&&pending!.thresholdDelta!==null)),headshotRate:rate(c.heads+(extra&&pending!.hit==='head'?1:0),c.duration.n+extra)};};
    const avg=(m:Moments,v:number|null|undefined)=>(m.sum+(v??0))/(m.n+Number(v!==null&&v!==undefined)||1);
    return {...recent,shots:this.shots,heads:this.heads,bodies:this.bodies,limbs:this.limbs,misses,eliminations:this.eliminations,headshotAccuracy:rate(this.heads,this.shots),hitAccuracy:rate(hits,this.shots),missRate:rate(misses,this.shots),firstShotAccuracy:rate(this.firstHits,this.first),firstShotHeadshot:rate(this.firstHeads,this.first),averageEliminationTime:this.elimination.mean,
      earlyShots:this.early,brakingSamples:this.brakes,averageShotSpeed:this.speed.mean,averageBrakeDuration:avg(this.brake,pending?.brakingDuration),averageDecelerationDuration:avg(this.deceleration,pending?.decelerationDuration),averageThresholdDelta:avg(this.timing,pending?.thresholdDelta),brakingMeasuredSamples:this.brake.n+Number(pending?.brakingDuration!=null),brakingTimingSamples:this.timing.n+Number(pending?.thresholdDelta!=null),decelerationSamples:this.deceleration.n+Number(pending?.decelerationDuration!=null),brakingConsistency:Math.sqrt(Math.max(0,(this.timing.squares+(pending?.thresholdDelta??0)**2)/(this.timing.n+Number(pending?.thresholdDelta!=null)||1)-avg(this.timing,pending?.thresholdDelta)**2)),neutral:comparison('neutral'),opposite:comparison('opposite')};
  }
}
