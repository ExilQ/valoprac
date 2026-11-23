import {Vector3} from 'three';
import type {Simulation} from '../engine/simulation/Simulation';
import type {InputObserver} from '../engine/input/Input';
import type {ShotEvent} from '../engine/types';
import {adsFov,DEG} from '../engine/input/sensitivity';
import type {Target} from '../engine/targets/Target';
import {MouseTelemetry} from './Telemetry';
import {aimAnalysis} from './AnalysisService';
import {saveAimRecord,aimDataEpoch} from './storage';
import {AIM_VERSION,GAME_VERSION,type AimMeta} from './types';
export class CombatCapture implements InputObserver {
 private telemetry=new MouseTelemetry(8192);private point=new Vector3();private target:Target|null=null;private generation=0;private began=0;private lastShot=-100;private count=0;private disposed=false;private session=globalThis.crypto?.randomUUID?.()??`combat-${Date.now()}`;
 constructor(private simulation:Simulation,private rawMode:()=>string){}
 frame(now:number){if(this.disposed||!this.simulation.settings.aimTelemetry||!this.simulation.running){this.telemetry.clear();this.target=null;return;}this.choose(now);this.capture(2,0,0,now,now,this.simulation.viewYaw,this.simulation.viewPitch);}
 private choose(now:number){const s=this.simulation,m=s.movement;let best:Target|null=null,error=Infinity;for(const t of s.targets){if(!t.active||!t.enabled)continue;t.headPosition(this.point);this.point.sub(m.position);this.point.y-=m.eyeHeight;const yaw=Math.atan2(this.point.x,-this.point.z),pitch=Math.atan2(this.point.y,Math.hypot(this.point.x,this.point.z)),e=(yaw+s.viewYaw)**2+(pitch-s.viewPitch)**2;if(e<error){best=t;error=e;}}
  if(best!==this.target||best?.generation!==this.generation){this.target=best;this.generation=best?.generation??0;this.began=now;this.telemetry.clear();}
 }
 sample(kind:0|1,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){if(this.disposed||!this.simulation.settings.aimTelemetry||!this.simulation.running)return;if(!this.target)this.choose(received);this.capture(kind,dx,dy,stamp,received,beforeYaw,beforePitch);}
 private capture(kind:number,dx:number,dy:number,stamp:number,received:number,beforeYaw:number,beforePitch:number){const s=this.simulation,t=this.target;if(!t)return;const m=s.movement;t.headPosition(this.point);const tx=this.point.x-m.position.x,ty=this.point.y-m.position.y-m.eyeHeight,tz=this.point.z-m.position.z,d=Math.hypot(tx,ty,tz),yaw=Math.atan2(tx,-tz)/DEG,pitch=Math.atan2(ty,Math.hypot(tx,tz))/DEG,radius=Math.atan2(.17*t.scale,d)/DEG;
  this.telemetry.push((received-this.began)/1000,dx,dy,-s.viewYaw/DEG,s.viewPitch/DEG,yaw,pitch,radius,kind,Math.max(0,received-stamp),-(s.viewYaw-beforeYaw)/DEG,(s.viewPitch-beforePitch)/DEG,m.position.x,m.position.y,m.position.z,this.point.x,this.point.y,this.point.z,m.speed,s.weapon.recoil.pitch,Number(s.ads));
 }
 shot(shot:ShotEvent){if(this.disposed||!this.simulation.settings.aimTelemetry||this.count>=50||shot.timestamp-this.lastShot<.5||!this.target||this.telemetry.count<6)return;this.lastShot=shot.timestamp;this.count++;const s=this.simulation,t=this.target,now=performance.now();this.capture(4,0,0,now,now,s.viewYaw,s.viewPitch);t.headPosition(this.point);const distance=this.point.distanceTo(s.origin),radius=Math.atan2(.17*t.scale,distance)/DEG;
  const meta:AimMeta={schema:1,algorithm:AIM_VERSION,game:GAME_VERSION,id:`${this.session}-${this.count}`,experiment:this.session,session:this.session,createdAt:Date.now(),task:s.mode==='tracking'?'reactive':'small',phase:'combat',sensitivity:s.settings.sensitivity,dpi:s.settings.dpi,dpiSource:'user-declared',coefficient:s.settings.degreesPerCount,fov:adsFov(s.settings.fov,s.ads?s.weapon.profile.adsZoom:1),ads:s.ads,adsMultiplier:s.settings.adsSensitivity,rawMode:this.rawMode(),renderer:'browser-webgl',seed:s.settings.seed,round:0,pair:`shot-${this.count}`,order:this.count,radius,amplitude:0,duration:(now-this.began)/1000,warmup:0,condition:`combat-${s.mode}-${s.practiceMap}`,valid:!this.telemetry.overflow&&!this.telemetry.reordered,issues:[...(this.telemetry.overflow?['buffer-overflow']:[]),...(this.telemetry.reordered?['timestamp-reordered']:[]),'intended-target-estimated'],appearanceKnown:false,monotonicStartMs:this.began,timeOriginMs:performance.timeOrigin,targetState:t.behavior,gameMode:s.mode,weapon:shot.weapon,moving:!shot.accurate,recoil:shot.recoil.pitch,spread:shot.spread.total,hit:['head','torso','arm','leg'].includes(shot.hit),shotTime:shot.timestamp,targetId:t.id,distance,targetDiameter:.34*t.scale,movementState:shot.accuracyState,weaponState:s.weapon.reloadingUntil===null?'ready':'reload',viewport:[innerWidth,innerHeight],renderScale:s.settings.renderScale};
  const epoch=aimDataEpoch();void aimAnalysis.run(this.telemetry.snapshot(),meta).then(r=>saveAimRecord(r,epoch)).catch(()=>{});this.telemetry.clear();this.began=now;
 }
 dispose(){this.disposed=true;this.telemetry.clear();this.target=null;}
}
