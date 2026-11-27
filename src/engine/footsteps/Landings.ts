import type {FootstepEvent,FootstepMaterial} from './Footsteps';

export interface LandingSoundEvent extends FootstepEvent {kind:'landing';impactSpeed:number;}
export interface LandingMovement {
 landingSerial:number;lastLandingImpactSpeed:number;lastLandingTime:number;supportHeight:number;
 previous:{x:number;y:number;z:number};position:{x:number;y:number;z:number};speed:number;
}
/** Real contact transitions have their own sound stream. A buffered jump can
 * leave grounded=false at the end of a tick while still producing one landing.
 * This deliberately never reads keys or changes the footstep distance meter. */
export class Landings {
 totalEvents=0;onLanding:((event:LandingSoundEvent)=>void)|null=null;
 private serial=0;private encounterStartEvent=0;private journal:LandingSoundEvent[]=[];
 constructor(movement?:LandingMovement){this.serial=movement?.landingSerial??0;}
 step(m:LandingMovement,time:number,dt:number,materialAt?:(position:FootstepEvent['position'])=>FootstepMaterial|undefined,baseRadius=20,minImpact=.35):LandingSoundEvent|null {
  if(m.landingSerial===this.serial)return null;
  this.serial=m.landingSerial;
  // An invalid or near-zero contact is not an audible impact. Its serial is
  // consumed once, so later frames cannot manufacture a louder stale landing.
  const impact=m.lastLandingImpactSpeed,stamp=m.lastLandingTime;
  if(!Number.isFinite(stamp)||!Number.isFinite(impact)||impact<minImpact)return null;
  const fraction=dt>0&&Number.isFinite(dt)?Math.max(0,Math.min(1,(stamp-(time-dt))/dt)):1;
  const position={x:m.previous.x+(m.position.x-m.previous.x)*fraction,y:m.supportHeight,z:m.previous.z+(m.position.z-m.previous.z)*fraction};
  const event:LandingSoundEvent={kind:'landing',id:++this.totalEvents,timestamp:stamp,position,
   impactSpeed:impact,speed:m.speed,radius:Math.max(0,baseRadius)*Math.max(.25,Math.min(1.2,.2+impact/8)),material:materialAt?.(position)??'concrete'};
  this.journal.push(event);if(this.journal.length>32)this.journal.shift();this.onLanding?.(event);return event;
 }
 /** A retry/profile conversion is silent and cannot replay the old life. */
 resetEncounter(movement:LandingMovement){this.serial=movement.landingSerial;this.encounterStartEvent=this.totalEvents;}
 recent(){return this.copyRecent(this.encounterStartEvent);}
 historyRecent(){return this.copyRecent(0);}
 private copyRecent(after:number){return this.journal.filter(e=>e.id>after).map(e=>({...e,position:{...e.position}}));}
}
