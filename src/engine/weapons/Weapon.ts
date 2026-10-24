import type { InputState } from '../types';
import type { Movement } from '../movement/Movement';
import type { WeaponProfile } from '../../config/weapons';
import { Recoil } from '../recoil/Recoil';
import { SeededRandom } from '../simulation/random';
export class Weapon {
  ammo:number;reserve:number;reloadingUntil:number|null=null;reloadStarted=0;equipUntil=0;lastShot=-100;nextShot=0;shotIndex=0;magazineShot=0;bloom=0;firedAt=0;
  infiniteReserve=true;autoReload=true;ads=false;private wasFire=false;private lastInterval=0;
  recoil=new Recoil();rng:SeededRandom;recoilRng:SeededRandom;
  onAction:((action:'reload'|'equip')=>void)|null=null;
  spread={base:0,movement:0,bloom:0,air:0,total:0,x:0,y:0};
  constructor(public profile:WeaponProfile,seed:number){this.ammo=profile.magazine;this.reserve=profile.reserve;this.rng=new SeededRandom(seed);this.recoilRng=new SeededRandom(seed^0xA91E);}
  requestReload(time:number){if(this.reloadingUntil===null&&time>=this.equipUntil&&this.ammo<this.profile.magazine&&(this.infiniteReserve||this.reserve>0)){this.reloadStarted=time;this.reloadingUntil=time+this.profile.reloadTime;this.onAction?.('reload');}}
  equip(time:number){this.reloadingUntil=null;this.equipUntil=time+this.profile.equipTime;this.wasFire=true;this.ads=false;this.onAction?.('equip');}
  step(time:number,dt:number,input:InputState,onShot:()=>void){
    this.ads=input.ads&&this.profile.adsZoom>1;
    const pressed=(input.firePresses??0)>0||input.fire&&!this.wasFire;this.wasFire=input.fire;
    if(input.reload)this.requestReload(time);
    if(this.reloadingUntil!==null&&time+1e-9>=this.reloadingUntil){const n=Math.min(this.profile.magazine-this.ammo,this.infiniteReserve?this.profile.magazine:this.reserve);this.ammo+=n;if(!this.infiniteReserve)this.reserve-=n;this.magazineShot=0;this.reloadingUntil=null;}
    this.bloom=Math.max(0,this.bloom-this.profile.bloomRecovery*dt);
    this.recoil.recover(dt,this.profile,time-this.lastShot);
    if(time-this.lastShot>this.profile.resetTime)this.shotIndex=0;
    const interval=1/(this.ads?this.profile.adsFireRate:this.profile.fireRate);
    if(this.lastInterval&&interval!==this.lastInterval)this.nextShot=this.firedAt+interval;
    this.lastInterval=interval;
    if(this.ammo===0&&this.autoReload)this.requestReload(time);
    const wants=this.profile.fireMode==='semi'?pressed:input.fire||pressed;
    if(wants&&this.reloadingUntil===null&&time+1e-9>=this.equipUntil&&this.ammo>0&&time+1e-9>=this.nextShot){
      const due=this.nextShot;this.firedAt=time-due>1/120+1e-9||this.lastShot<0?time:due;this.nextShot=this.firedAt+interval;
      onShot();this.lastShot=time;this.ammo--;this.shotIndex++;this.magazineShot++;
      this.bloom=Math.min(this.profile.maxBloom,this.bloom+this.profile.bloomPerShot);
    }
  }
  calculateSpread(m:Movement,ads:boolean,landingPenalty:boolean){
    const p=this.profile,s=this.spread;const crouch=1+(p.crouchSpread-1)*m.crouch,aim=ads&&p.adsZoom>1?p.adsSpread:1;
    s.base=p.firstSpread*crouch*aim;
    const f=Math.max(0,(m.speed-m.profile.accuracyVelocityThreshold)/(m.profile.maxSpeed-m.profile.accuracyVelocityThreshold));
    s.movement=p.movementSpread*Math.min(1.5,f)**1.3*crouch*aim;s.bloom=this.bloom*crouch*aim;s.air=m.grounded?(landingPenalty?0.35:0):p.airSpread;
    s.total=s.base+s.movement+s.bloom+s.air;
    const theta=this.rng.next()*Math.PI*2,r=Math.sqrt(this.rng.next())*s.total;
    s.x=Math.cos(theta)*r;s.y=Math.sin(theta)*r;return s;
  }
}
