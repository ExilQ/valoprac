import type { InputState } from '../types';
import type { Movement } from '../movement/Movement';
import type { WeaponProfile } from '../../config/weapons';
import { Recoil } from '../recoil/Recoil';
import { SeededRandom } from '../simulation/random';
export class Weapon {
  ammo:number;reloadingUntil:number|null=null;lastShot=-100;nextShot=0;shotIndex=0;magazineShot=0;bloom=0;
  recoil=new Recoil();rng:SeededRandom;
  spread={base:0,movement:0,bloom:0,air:0,total:0,x:0,y:0};
  constructor(public profile:WeaponProfile,seed:number){this.ammo=profile.magazine;this.rng=new SeededRandom(seed);}
  requestReload(time:number){if(this.reloadingUntil===null&&this.ammo<this.profile.magazine)this.reloadingUntil=time+this.profile.reloadTime;}
  step(time:number,dt:number,input:InputState,onShot:()=>void){
    if(input.reload)this.requestReload(time);
    if(this.reloadingUntil!==null&&time+1e-9>=this.reloadingUntil){this.ammo=this.profile.magazine;this.magazineShot=0;this.reloadingUntil=null;}
    this.bloom=Math.max(0,this.bloom-this.profile.bloomRecovery*dt);
    this.recoil.recover(dt,this.profile,time-this.lastShot);
    if(time-this.lastShot>this.profile.resetTime)this.shotIndex=0;
    if(input.fire&&this.reloadingUntil===null){
      if(this.ammo===0){this.requestReload(time);return;}
      if(time+1e-9>=this.nextShot){
        // Keep cadence on the rate lattice while held, with no catch-up burst after release.
        const due=this.nextShot;this.nextShot=(time-due>1/120+1e-9||this.lastShot<0?time:due)+1/this.profile.fireRate;
        onShot();this.lastShot=time;this.ammo--;this.shotIndex++;this.magazineShot++;
        this.bloom=Math.min(this.profile.maxBloom,this.bloom+this.profile.bloomPerShot);
      }
    }
  }
  calculateSpread(m:Movement,ads:boolean,landingPenalty:boolean){
    const p=this.profile,s=this.spread;const crouch=1+(p.crouchSpread-1)*m.crouch,aim=ads?p.adsSpread:1;
    s.base=p.firstSpread*crouch*aim;
    const f=Math.max(0,(m.speed-m.profile.accuracyVelocityThreshold)/(m.profile.maxSpeed-m.profile.accuracyVelocityThreshold));
    s.movement=p.movementSpread*Math.min(1.5,f)**1.3*crouch;s.bloom=this.bloom*crouch;s.air=m.grounded?(landingPenalty?0.35:0):p.airSpread;
    s.total=s.base+s.movement+s.bloom+s.air;
    const theta=this.rng.next()*Math.PI*2,r=Math.sqrt(this.rng.next())*s.total;
    s.x=Math.cos(theta)*r;s.y=Math.sin(theta)*r;return s;
  }
}
