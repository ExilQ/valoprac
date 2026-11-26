import type { InputState,Settings } from '../types';
import type { Movement } from '../movement/Movement';
import type { WeaponProfile } from '../../config/weapons';
import { Recoil } from '../recoil/Recoil';
import { SeededRandom } from '../simulation/random';
export class Weapon {
 scopeLevel:0|1|2=0;scopeAmount=0;scopeZoom=1;scopeReadyAt=0;boltUntil=0;boltStarted=-100;private rescope:0|1|2=0;private heldScope=false;private scopeActiveLast=false;scopeMode:'toggle'|'hold'='toggle';autoRescope=false;
 get operatorState(){return this.reloadingUntil!==null?'reloading':this.equipUntil>this.lastTime?'equipping':this.boltUntil>this.lastTime?'bolt-cycling':this.scopeLevel&&this.lastTime<this.scopeReadyAt?'scoping':this.scopeLevel?`scoped-${this.scopeLevel===1?'2.5':'5'}`:'unscoped';}
 private lastTime=0;get boltProgress(){return this.boltUntil>this.lastTime?Math.min(1,Math.max(0,(this.lastTime-this.boltStarted)/(this.boltUntil-this.boltStarted))):0;}
 configureScope(s:Settings){if(this.scopeMode!==s.operatorScopeMode){this.heldScope=false;if(s.operatorScopeMode==='hold'){this.setScope(0,this.lastTime);this.rescope=0;}}this.scopeMode=s.operatorScopeMode;this.autoRescope=s.operatorAutoRescope;if(!this.autoRescope)this.rescope=0;}
 private setScope(level:0|1|2,time:number){if(level!==this.scopeLevel){this.scopeLevel=level;this.scopeReadyAt=time+this.profile.adsTransition;this.onAction?.('scope');}}
 updateScope(time:number,dt:number,input:InputState){this.lastTime=time;if(this.profile.id!=='operator')return;
 const blocked=this.reloadingUntil!==null||time<this.equipUntil||time<this.boltUntil;
 if(this.scopeMode==='hold'){const held=input.scopeHeld??input.ads;if(held&&!this.heldScope)this.setScope(1,time);if(!held&&this.heldScope){this.setScope(0,time);this.rescope=0;}this.heldScope=held;}else for(let i=0;i<(input.scopePresses??0);i++){this.rescope=0;this.setScope(((this.scopeLevel+1)%3) as 0|1|2,time);}
 if(input.zoomPresses&&this.scopeLevel)this.setScope(this.scopeLevel===1?2:1,time);
 if(blocked){if(this.reloadingUntil!==null||time<this.equipUntil){this.scopeLevel=0;this.rescope=0;}}else if(this.rescope){this.setScope(this.rescope,time);this.rescope=0;}
 const active=!blocked&&this.scopeLevel>0;
 // A request made during a bolt cycle is a queued intent, not elapsed scope-in
 // time. Its precision/firing window starts only when optics can actually rise.
 if(active&&!this.scopeActiveLast)this.scopeReadyAt=time+this.profile.adsTransition;
 this.scopeActiveLast=active;
 this.scopeAmount+=(Number(active)-this.scopeAmount)*(1-Math.exp(-dt*16));const target=active?(this.scopeLevel===2?5:2.5):1;this.scopeZoom+=(target-this.scopeZoom)*(1-Math.exp(-dt*16));this.ads=active;
 }

  ammo:number;reserve:number;reloadingUntil:number|null=null;reloadStarted=0;equipUntil=0;lastShot=-100;nextShot=0;shotIndex=0;magazineShot=0;bloom=0;firedAt=0;
  infiniteReserve=true;autoReload=true;ads=false;
  /** Set only while the option is on: an absent value keeps the replay checksum
   * state of every earlier recording unchanged. */
  infiniteMagazine?:true;private wasFire=false;private lastInterval=0;
  recoil=new Recoil();rng:SeededRandom;recoilRng:SeededRandom;
  onAction:((action:'reload'|'equip'|'bolt'|'scope')=>void)|null=null;
  spread={base:0,movement:0,bloom:0,air:0,landing:0,total:0,x:0,y:0};
  constructor(public profile:WeaponProfile,seed:number){this.ammo=profile.magazine;this.reserve=profile.reserve;this.rng=new SeededRandom(seed);this.recoilRng=new SeededRandom(seed^0xA91E);}
  /** Start a new life without carrying chamber, reload, input or recoil state.
   * RNG streams and user options remain session-scoped. Bots may start ready. */
  resetForEncounter(time=0,ready=false){
    this.ammo=this.profile.magazine;this.reserve=this.profile.reserve;
    this.reloadingUntil=null;this.reloadStarted=0;this.equipUntil=ready?time:time+this.profile.equipTime;
    this.lastShot=-100;this.nextShot=this.equipUntil;this.firedAt=0;
    this.shotIndex=0;this.magazineShot=0;this.bloom=0;this.recoil=new Recoil();
    this.ads=false;this.scopeLevel=0;this.scopeAmount=0;this.scopeZoom=1;this.scopeReadyAt=time;
    this.boltUntil=0;this.boltStarted=-100;this.rescope=0;this.heldScope=false;this.scopeActiveLast=false;
    this.wasFire=false;this.lastInterval=0;this.lastTime=time;
    this.spread={base:0,movement:0,bloom:0,air:0,landing:0,total:0,x:0,y:0};
  }
  requestReload(time:number){if(this.reloadingUntil===null&&time>=this.equipUntil&&this.ammo<this.profile.magazine&&(this.infiniteReserve||this.reserve>0)){if(this.profile.id==='operator'){this.setScope(0,time);this.rescope=0;}this.reloadStarted=time;this.reloadingUntil=time+this.profile.reloadTime;this.onAction?.('reload');}}
  equip(time:number){this.reloadingUntil=null;this.equipUntil=time+this.profile.equipTime;this.wasFire=true;this.ads=false;this.scopeLevel=0;this.scopeAmount=0;this.scopeZoom=1;this.rescope=0;this.heldScope=false;this.scopeActiveLast=false;this.onAction?.('equip');}
  step(time:number,dt:number,input:InputState,onShot:()=>void){
    if(this.profile.id!=='operator')this.ads=input.ads&&this.profile.adsZoom>1;this.lastTime=time;
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
    const wants=this.profile.fireMode!=='auto'?pressed:input.fire||pressed;
    const scopeReady=this.profile.id!=='operator'||this.scopeLevel===0||time+1e-9>=this.scopeReadyAt;
    if(wants&&scopeReady&&this.reloadingUntil===null&&time+1e-9>=this.equipUntil&&this.ammo>0&&time+1e-9>=this.nextShot&&time+1e-9>=this.boltUntil){
      const due=this.nextShot;this.firedAt=time-due>1/120+1e-9||this.lastShot<0?time:due;this.nextShot=this.firedAt+interval;
      onShot();if(this.profile.id==='operator'){this.boltStarted=time;this.boltUntil=time+interval;this.rescope=this.autoRescope?this.scopeLevel:0;this.scopeLevel=0;this.onAction?.('bolt');}this.lastShot=time;if(!this.infiniteMagazine)this.ammo--;this.shotIndex++;this.magazineShot++;
      this.bloom=Math.min(this.profile.maxBloom,this.bloom+this.profile.bloomPerShot);
    }
  }
  calculateSpread(m:Movement,ads:boolean,landingPenalty:boolean){
    const p=this.profile,s=this.spread;
    if(p.id==='operator'){const scoped=ads&&this.scopeLevel>0&&this.lastTime>=this.scopeReadyAt&&this.scopeAmount>.98;const threshold=.15*5.13*.72;const move=Math.max(0,(m.speed-threshold)/(5.13-threshold));s.base=scoped?.02:p.firstSpread;s.movement=move*(scoped?9:5);s.bloom=this.bloom;s.air=m.grounded?0:12;s.landing=m.grounded&&landingPenalty?7:0;s.total=(s.base+s.movement+s.bloom+s.air+s.landing)*(1-.15*m.crouch);const theta=this.rng.next()*Math.PI*2,r=Math.sqrt(this.rng.next())*s.total;s.x=Math.cos(theta)*r;s.y=Math.sin(theta)*r;return s;}
    const crouch=1+(p.crouchSpread-1)*m.crouch,aim=ads&&p.adsZoom>1?p.adsSpread:1;
    s.base=p.firstSpread*crouch*aim;
    const threshold=m.profile.accuracyVelocityThreshold,walk=m.profile.maxSpeed*m.profile.walkModifier;
    // Configured walking/running values are total no-bloom hip-fire half-cone radii.
    const walkCone=p.walkingSpread??p.movementSpread*.5;
    const standingCone=(speed:number)=>speed<=threshold?p.firstSpread:speed<=walk?p.firstSpread+(walkCone-p.firstSpread)*(speed-threshold)/(walk-threshold):walkCone+(p.movementSpread-walkCone)*Math.min(1.5,(speed-walk)/(m.profile.maxSpeed-walk));
    const total=standingCone(m.speed);
    let poseCone=total*crouch;
    if(p.crouchMovingSpread!==undefined){
      // Crouch motion is its own calibrated curve. A stationary crouch benefit
      // cannot author this endpoint by scaling the much larger walking cone.
      const crouchBase=p.firstSpread*p.crouchSpread,crouchSpeed=Math.max(threshold+1e-6,m.profile.maxSpeed*m.profile.crouchModifier),crouchEnd=Math.max(crouchBase,p.crouchMovingSpread);
      const crouchCone=m.speed<=threshold?crouchBase:m.speed<=crouchSpeed?crouchBase+(crouchEnd-crouchBase)*(m.speed-threshold)/(crouchSpeed-threshold):crouchEnd+Math.max(0,total-standingCone(crouchSpeed))*p.crouchSpread;
      const amount=Math.min(1,Math.max(0,m.crouch));poseCone=total+(crouchCone-total)*amount;
    }
    s.movement=Math.max(0,poseCone*aim-s.base);s.bloom=this.bloom*crouch*aim;s.air=m.grounded?0:p.airSpread;s.landing=m.grounded&&landingPenalty?0.35:0;
    s.total=s.base+s.movement+s.bloom+s.air+s.landing;
    const theta=this.rng.next()*Math.PI*2,r=Math.sqrt(this.rng.next())*s.total;
    s.x=Math.cos(theta)*r;s.y=Math.sin(theta)*r;return s;
  }
}
