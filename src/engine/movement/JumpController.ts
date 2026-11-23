import type {InputState} from '../types';
import type {MovementPhysicsProfile} from '../../config/movement';
const EPS=1e-9;
/** Edge commands are dated in simulation seconds. Keeping their original age
 * prevents a delayed browser/render frame from manufacturing a fresh buffer. */
export class JumpController {
 until=-Infinity;requestedAt=-Infinity;nextTakeoff=-Infinity;lastRequest=-Infinity;blockedUntil=-Infinity;
 private held=false;expired=0;
 update(input:InputState,time:number,p:MovementPhysicsProfile){
  const pressed=(input.jumpPresses??0)>0||input.jump&&!this.held;this.held=!!input.jump;
  if(pressed){const supplied=(input as InputState&{jumpRequestedAt?:number}).jumpRequestedAt,at=typeof supplied==='number'&&Number.isFinite(supplied)?Math.min(time,supplied):time;
   if(p.jumpSpamWindow>0&&(at-this.lastRequest<p.jumpSpamWindow-EPS||(input.jumpPresses??0)>1))this.blockedUntil=Math.max(this.blockedUntil,at+p.jumpSpamPenalty);
   this.lastRequest=at;this.requestedAt=at;this.until=at+(p.jumpBufferSeconds??.08);
  }
 }
 expire(time:number){const expired=this.until<time-EPS&&Number.isFinite(this.until);if(expired){this.until=-Infinity;this.expired++;}return expired;}
 canLaunch(time:number){return this.requestedAt<=time+EPS&&this.until>=time-EPS&&time>=this.nextTakeoff-EPS&&time>=this.blockedUntil-EPS;}
 consume(time:number,p:MovementPhysicsProfile){this.until=-Infinity;this.nextTakeoff=time+(p.jumpCooldown??.08);}
 clear(){this.until=this.requestedAt=-Infinity;this.held=false;}
 reset(time=0){this.clear();this.nextTakeoff=time;this.lastRequest=this.blockedUntil=-Infinity;this.expired=0;}
}
