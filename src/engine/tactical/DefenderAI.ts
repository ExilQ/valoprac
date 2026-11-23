import {Box3,Matrix4,Ray,Sphere,Vector3} from 'three';
import type {Settings,Vec3,WeaponId,ShotEvent} from '../types';
import type {Target} from '../targets/Target';
import type {Obstacle} from '../collision/environment';
import {surfaceHeight,nearestEnvironmentHit} from '../collision/environment';
import {visibleBetween,standingSpace} from './levels';
import type {FootstepEvent} from '../footsteps/Footsteps';
import {SeededRandom} from '../simulation/random';
import {WEAPONS,damageAt} from '../../config/weapons';

export type DefenderState='holding'|'listening'|'alert'|'tracking'|'firing'|'recovering'|'repositioning'|'re-peeking'|'returning'|'eliminated';
export interface PlayerBody {position:Vec3;velocity:Vec3;eyeHeight:number;crouch:number;grounded:boolean;yaw:number;pitch:number;scoped?:boolean;}
/** These samples and hit volumes form the explicit human body proxy used by defender
 * perception and bullets. Sample fraction is not projected screen-space body area. */
export interface DefenderSector {facingYaw?:number;navigation?:Vec3[];alternatives?:Vec3[];weapon?:WeaponId;}
export interface DefenderShot {id?:number;time:number;bot:number;weapon:WeaponId;origin:Vec3;aim:Vec3;impact:Vec3;hit:'head'|'body'|'leg'|'miss';hitRegion?:'head'|'torso'|'arm'|'leg';observed:boolean;recoveryUntil:number;}
export interface DefenderDeath {bot:number;weapon:WeaponId;region:string;cause:'shot'|'exposure';time:number;duration:number;player:Vec3;defender:Vec3;line:Vec3[];path:Vec3[];}
export interface PeekEpisode {started:number;ended:number;duration:number;distance:number;peakSpeed:number;peakVisibleFraction:number;verticalDisplacement:number;shots:number;hits:number;shotVelocity:number|null;acquisitionTime:number|null;returnToCover:number|null;timeToCover?:number|null;}
export interface PeekReport {health:number;deaths:number;clears:number;baits:number;recoveryExploits:number;heardEvents:number;enemyShots:number;exposure:number;maxVisibleFraction:number;distance:number;peakSpeed:number;episodes:PeekEpisode[];lastDeath:DefenderDeath|null;path:Vec3[];currentTime?:number;observedRecoveryUntil?:number;visibilityMethod?:string;totalAngles?:number;currentClears?:number;unclearedAngles?:number;operator:{scopedShots:number;scopedHits:number;unscopedShots:number;unscopedHits:number;scopeTransitionSum:number;holdingSeconds:number;firstShots:number;firstHits:number;};}
interface Memory {state:DefenderState;weapon:WeaponId;visible:number;exposure:number;acquired:number;nextShot:number;lastSeen:number;known:Vec3|null;alertUntil:number;destination:Vec3|null;repeats:number;lastExposed:number;face:Vec3;decision:number;aim:Vec3|null;path:Vec3[];pathIndex:number;burst:number;lastShot:DefenderShot|null;holdingFace:Vec3;pose:number;}
const vec=(p:Vec3):Vec3=>({x:p.x,y:p.y,z:p.z});
const distance2=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const bodyHit=new Vector3(),worldHit=new Vector3(),inverse=new Matrix4(),localRay=new Ray();
function localBody(p:PlayerBody){
 const c=clamp(p.crouch,0,1),torso=p.eyeHeight-.51+c*.09;
 return [
  {region:'torso' as const,box:new Box3(new Vector3(-.24,torso-.29,-.14),new Vector3(.24,torso+.29,.14))},
  {region:'torso' as const,box:new Box3(new Vector3(-.215,.63-c*.2,-.135),new Vector3(.215,.84-c*.2,.135))},
  ...[-1,1].map(sign=>({region:'arm' as const,box:new Box3(new Vector3(sign<0?-.425:.255,torso-.22,-.1),new Vector3(sign<0?-.255:.425,torso+.23,.1))})),
  ...[-1,1].map(sign=>({region:'leg' as const,box:new Box3(new Vector3(sign<0?-.22:.04,.03,-.1),new Vector3(sign<0?-.04:.22,.65-c*.18,.17))}))
 ];
}
function toWorld(p:PlayerBody,x:number,y:number,z=0):Vec3{const c=Math.cos(p.yaw),s=Math.sin(p.yaw);return{x:p.position.x+x*c+z*s,y:p.position.y+y,z:p.position.z-x*s+z*c};}
export function playerVisibilitySamples(p:PlayerBody):Vec3[]{const torso=p.eyeHeight-.51+clamp(p.crouch,0,1)*.09;return[[0,p.eyeHeight+.04],[-.12,p.eyeHeight+.04],[.12,p.eyeHeight+.04],[0,torso],[-.34,torso+.12],[.34,torso+.12],[-.13,.3],[.13,.3],[0,.72-clamp(p.crouch,0,1)*.2]].map(([x,y])=>toWorld(p,x,y));}
/** First physical intersection with the current translated/yawed/crouched body. */
export function intersectPlayerBody(ray:Ray,p:PlayerBody,out:Vector3){
 inverse.makeRotationY(p.yaw);inverse.setPosition(p.position.x,p.position.y,p.position.z);inverse.invert();localRay.copy(ray).applyMatrix4(inverse);
 let region:'head'|'torso'|'arm'|'leg'|null=null,nearest=Infinity;
 const head=new Sphere(new Vector3(0,p.eyeHeight+.04,0),.17);
 if(localRay.intersectSphere(head,bodyHit)){worldHit.copy(bodyHit);inverse.invert();worldHit.applyMatrix4(inverse);inverse.invert();nearest=ray.origin.distanceTo(worldHit);out.copy(worldHit);region='head';}
 for(const part of localBody(p)){if(!localRay.intersectBox(part.box,bodyHit))continue;worldHit.copy(bodyHit);inverse.invert();worldHit.applyMatrix4(inverse);inverse.invert();const d=ray.origin.distanceTo(worldHit);if(d<nearest-1e-6){nearest=d;out.copy(worldHit);region=part.region;}}
 return region?{region,distance:nearest}:null;
}

export class DefenderAI {
 memories:Memory[]=[];shots:DefenderShot[]=[];health=150;death:DefenderDeath|null=null;onShot:((s:DefenderShot)=>void)|null=null;perceptionUpdates=0;
 report:PeekReport={health:150,deaths:0,clears:0,baits:0,recoveryExploits:0,heardEvents:0,enemyShots:0,exposure:0,maxVisibleFraction:0,distance:0,peakSpeed:0,episodes:[],lastDeath:null,path:[],currentTime:0,observedRecoveryUntil:0,visibilityMethod:'Nine yawed human-body samples; approximate coverage, not projected body area',operator:{scopedShots:0,scopedHits:0,unscopedShots:0,unscopedHits:0,scopeTransitionSum:0,holdingSeconds:0,firstShots:0,firstHits:0}};
 private rng:SeededRandom;private current:PeekEpisode|null=null;private episodeOrigin:Vec3|null=null;private episodeLow=0;private episodeHigh=0;private returningAt:number|null=null;private last:Vec3|null=null;private pathAt=0;private perceptionAt=0;private head=new Vector3();private ray=new Ray();private hit=new Vector3();private sequence=0;private usedBaits=new Set<number>();private usedRecoveries=new Set<number>();
 constructor(public targets:Target[],public obstacles:Obstacle[],public settings:Settings,private holdingPoint:Vec3,seed=1947,private sectors:readonly DefenderSector[]=[]){this.rng=new SeededRandom(seed^0xd3f3);this.retry();}
 setSectors(sectors:readonly DefenderSector[]){this.sectors=sectors;}
 retry(){
  this.health=150;this.death=null;this.current=null;this.last=null;this.episodeOrigin=null;this.returningAt=null;this.pathAt=0;this.perceptionAt=0;this.shots.length=0;this.report.health=150;this.report.path=[];this.report.observedRecoveryUntil=0;this.usedBaits.clear();this.usedRecoveries.clear();
  this.memories=this.targets.map((t,i)=>{const sector=this.sectors[i],yaw=sector?.facingYaw??(t.position.z>7?Math.PI:0),face={x:Math.sin(yaw),y:0,z:Math.cos(yaw)};return{state:'holding',weapon:this.settings.defenderWeapon==='mixed'?(sector?.weapon??(['rifleA','operator','sheriff','rifleB'] as WeaponId[])[i%4]):this.settings.defenderWeapon,visible:0,exposure:0,acquired:0,nextShot:0,lastSeen:-100,known:null,alertUntil:0,destination:null,repeats:0,lastExposed:-100,face,holdingFace:{...face},decision:0,aim:null,path:[],pathIndex:0,burst:0,lastShot:null,pose:0};});
 }
 hear(e:FootstepEvent){
  // No key state or current hidden player position reaches this memory. A sound is
  // a dated observation at its emitted location, attenuated by intervening cover.
  let heard=false;
  for(const t of this.targets){if(!t.enabled||!t.active)continue;const m=this.memories[t.id];if(!m)continue;t.headPosition(this.head);const source={...e.position,y:e.position.y+1};const clear=visibleBetween(this.obstacles,vec(this.head),source);if(Math.hypot(t.position.x-e.position.x,t.position.y-e.position.y,t.position.z-e.position.z)>e.radius*(clear?1:.7))continue;
   if(m.visible<=0){m.known=vec(e.position);m.alertUntil=e.timestamp+2.2;if(m.state==='holding')m.state='listening';}heard=true;
  }
  if(heard)this.report.heardEvents++;
 }
 eliminated(id:number){const m=this.memories[id];if(m&&m.state!=='eliminated'){m.state='eliminated';m.visible=0;m.destination=null;m.path=[];this.report.clears++;}}
 private visible(t:Target,p:PlayerBody,m:Memory){
  t.headPosition(this.head);const from=vec(this.head),dx=p.position.x-from.x,dz=p.position.z-from.z,d=Math.hypot(dx,dz);if(d>65)return 0;if((dx*m.face.x+dz*m.face.z)/Math.max(.001,d)<Math.cos(80*Math.PI/180))return 0;
  const points=playerVisibilitySamples(p);let n=0,selected:Vec3|null=null,best=Infinity;
  for(const point of points){if(!visibleBetween(this.obstacles,from,point))continue;n++;const score=Math.abs(point.y-(p.position.y+p.eyeHeight*.7));if(score<best){best=score;selected=point;}}
  if(selected)m.aim=selected;
  return n/points.length;
 }
 step(dt:number,time:number,p:PlayerBody){
  if(this.death||!(dt>0))return;this.report.currentTime=time;let any=0;const perception=time+1e-9>=this.perceptionAt;if(perception){this.perceptionAt=time+.04;this.perceptionUpdates++;}
  for(const t of this.targets){
   if(!t.enabled)continue;const m=this.memories[t.id];if(!m)continue;if(!t.active){this.eliminated(t.id);continue;}t.previous.copy(t.position);
   if(perception){m.visible=this.visible(t,p,m);if(m.visible>0){m.lastSeen=time;m.known=vec(p.position);if(time-m.lastExposed>.18){m.repeats++;m.acquired=0;}m.lastExposed=time;}}
   const seen=m.visible>0;any=Math.max(any,m.visible);
   if(seen){m.exposure+=dt;m.acquired+=dt;}else{m.acquired=Math.max(0,m.acquired-dt*2);m.exposure=this.settings.exposureMode==='continuous'?0:Math.max(0,m.exposure-dt*.65);}
   const knownFresh=m.known&&(time-m.lastSeen<1.5||time<m.alertUntil),look=knownFresh?m.known:null;this.turn(m,look,t,dt);
   if(time<m.nextShot){
    m.state='recovering';if(m.weapon==='operator'||m.weapon==='sheriff')m.acquired=0;
    if(time>=m.decision&&!m.destination){m.decision=time+.5;if(this.rng.next()<this.settings.defenderReposition)this.reposition(t,m,time);}
   }else if(seen){
    m.state='tracking';const reaction=Math.max(.15,this.settings.defenderReaction*(this.settings.botDifficulty==='easy'?1.5:this.settings.botDifficulty==='hard'?.8:1)*(m.weapon==='operator'?1.15:1));
    if(m.acquired>=reaction&&Math.hypot(t.velocity.x,t.velocity.z)<.55){
     // Perception is bounded at 25 Hz. Firing admission performs one fresh physical
     // sight check so a cached sample never grants a shot through new cover.
     m.visible=this.visible(t,p,m);if(m.visible>0){m.state='firing';this.fire(t,m,p,time);}else{m.acquired=0;m.burst=0;}
    }
   }else if(m.destination)m.state=time-m.lastSeen<3?'repositioning':'returning';else m.state=m.alertUntil>time?'alert':'holding';
   if(!seen&&time-m.lastSeen>1.5&&time>m.alertUntil){m.known=null;m.aim=null;}
   this.move(t,m,dt,time);
   if(this.settings.exposureEnabled&&m.exposure>=this.settings.exposureLimit&&!this.death&&this.visible(t,p,m)>0)this.kill(t,m,p,time,'exposure','노출 제한');
   if(this.death)break;
  }
  this.measure(dt,time,p,any);
 }
 private turn(m:Memory,point:Vec3|null,t:Target,dt:number){const desired=point?Math.atan2(point.x-t.position.x,point.z-t.position.z):Math.atan2(m.holdingFace.x,m.holdingFace.z),current=Math.atan2(m.face.x,m.face.z),delta=Math.atan2(Math.sin(desired-current),Math.cos(desired-current)),yaw=current+clamp(delta,-5*dt,5*dt);m.face={x:Math.sin(yaw),y:0,z:Math.cos(yaw)};}
 /** A supported floor height close enough to traverse without flying or climbing walls. */
 private ground(x:number,z:number,fromY:number):number|null{
  const heights=[0];for(const o of this.obstacles){const b=o.box;if((o.kind!=='cover'&&!o.ramp)||x<b.min.x-.001||x>b.max.x+.001||z<b.min.z-.001||z>b.max.z+.001)continue;heights.push(surfaceHeight(o,x,z));}
  const choices=heights.filter(y=>y<=fromY+.31&&y>=fromY-.31&&standingSpace(this.obstacles,{x,y,z},.3));return choices.length?Math.max(...choices):null;
 }
 private segment(a:Vec3,b:Vec3):Vec3[]|null{
  const d=distance2(a,b),n=Math.max(1,Math.ceil(d/.12));let y=a.y;const path:Vec3[]=[];
  for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,next=this.ground(x,z,y);if(next===null)return null;y=next;path.push({x,y,z});}
  return Math.abs(y-b.y)<=.32?path:null;
 }
 /** Short visibility graph only when deciding to reposition, never per simulation tick. */
 private route(a:Vec3,b:Vec3):Vec3[]|null{
  const direct=this.segment(a,b);if(direct)return[b];
  const nodes:Vec3[]=[vec(a),vec(b)];const nearby=this.obstacles.filter(o=>o.box.distanceToPoint(new Vector3(a.x,a.y,a.z))<5&&o.box.max.y>a.y+.35).slice(0,10);
  for(const o of nearby){for(const x of [o.box.min.x-.36,o.box.max.x+.36])for(const z of [o.box.min.z-.36,o.box.max.z+.36]){if(Math.hypot(x-a.x,z-a.z)>8)continue;const y=this.ground(x,z,a.y);if(y!==null)nodes.push({x,y,z});}}
  // L waypoints cover corridor turns without assuming endpoints can be connected.
  for(const point of [{x:a.x,y:a.y,z:b.z},{x:b.x,y:a.y,z:a.z}]){const y=this.ground(point.x,point.z,a.y);if(y!==null)nodes.push({...point,y});}
  const cost=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set<number>(),edges=new Map<string,boolean>();cost[0]=0;
  for(let count=0;count<nodes.length;count++){let at=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(at<0||cost[i]<cost[at]))at=i;if(at<0||!Number.isFinite(cost[at]))break;if(at===1){const result:Vec3[]=[];for(let j=1;j>0;j=prev[j])result.unshift(nodes[j]);return result;}done.add(at);
   for(let j=1;j<nodes.length;j++){if(done.has(j)||distance2(nodes[at],nodes[j])>8)continue;const proposed=cost[at]+distance2(nodes[at],nodes[j]);if(proposed>=cost[j])continue;const key=`${at}:${j}`,valid=edges.get(key)??!!this.segment(nodes[at],nodes[j]);edges.set(key,valid);if(valid){cost[j]=proposed;prev[j]=at;}}
  }
  return null;
 }
 private reposition(t:Target,m:Memory,time:number){
  m.decision=time+1;if(!m.known)return;const sector=this.sectors[t.id],candidates:Vec3[]=(sector?.alternatives?.length?sector.alternatives:sector?.navigation?.length?sector.navigation:[-1,1,-2,2].map(d=>({x:t.anchor.x+d,y:t.anchor.y,z:t.anchor.z+this.rng.range(-.8,.8)}))).map(vec);
  // Repeated visible peeks change the chosen side; hidden movement never does.
  if(m.repeats>1)candidates.sort((a,b)=>Math.sign(m.repeats%2?1:-1)*(a.x-b.x));
  const routes=candidates.flatMap(p=>{if(distance2(t.position,p)<.25||!standingSpace(this.obstacles,p,.3))return[];const path=this.route(t.position,p);return path?[{p,path}]:[];});if(!routes.length)return;
  const hidden=routes.filter(({p})=>!visibleBetween(this.obstacles,{x:p.x,y:p.y+1.5,z:p.z},{x:m.known!.x,y:m.known!.y+1.4,z:m.known!.z}));const list=hidden.length?hidden:routes,selected=list[Math.floor(this.rng.next()*list.length)];m.path=selected.path;m.pathIndex=0;m.destination=vec(selected.p);
 }
 private move(t:Target,m:Memory,dt:number,time:number){
  if(m.destination){let goal=m.path[m.pathIndex]??m.destination,d=distance2(t.position,goal);if(d<.008){m.pathIndex++;goal=m.path[m.pathIndex]??m.destination;d=distance2(t.position,goal);}
   if(d<.008&&m.pathIndex>=m.path.length){m.destination=null;m.path=[];m.state='re-peeking';t.velocity.set(0,0,0);}else{
    // Braking distance keeps turns at validated waypoints. Interpolating velocity
    // across a corner would cut through cover; each segment instead slows before
    // changing direction. Velocity always describes actual resolved displacement.
    const dx=(goal.x-t.position.x)/Math.max(.001,d),dz=(goal.z-t.position.z)/Math.max(.001,d),cap=clamp(this.settings.targetSpeed,0,1)*3.2;
    const previous=Math.max(0,t.velocity.x*dx+t.velocity.z*dz),speed=Math.min(cap,previous+6*dt,Math.sqrt(2*8*d)),n=Math.min(d,speed*dt);
    const nx=t.position.x+dx*n,nz=t.position.z+dz*n,ny=this.ground(nx,nz,t.position.y);if(ny!==null){t.velocity.set((nx-t.position.x)/dt,(ny-t.position.y)/dt,(nz-t.position.z)/dt);t.position.set(nx,ny,nz);}else{m.destination=null;m.path=[];t.velocity.set(0,0,0);}
   }
  }else t.velocity.set(0,0,0);
  t.updatePose(time);const aim=['tracking','firing'].includes(m.state)?1:m.state==='recovering'?.8:m.destination?.25:m.state==='alert'||m.state==='listening'?.6:.35;m.pose+=(aim-m.pose)*(1-Math.exp(-dt*9));t.leftArm.rotation.set(-m.pose,.0,.4*m.pose);t.rightArm.rotation.set(-1.18*m.pose,0,-.4*m.pose);t.root.rotation.y=Math.atan2(m.face.x,m.face.z);t.root.updateMatrixWorld(true);for(const part of t.parts)part.inverse.copy(part.node.matrixWorld).invert();
 }
 private fire(t:Target,m:Memory,p:PlayerBody,time:number){
  const profile=WEAPONS[m.weapon];if(!m.aim||!profile)return;m.burst++;const interval=m.weapon==='operator'?1/.6:m.weapon==='sheriff'?.65:1/profile.fireRate;m.nextShot=time+interval;if(m.weapon==='operator'||m.weapon==='sheriff'||m.burst>=3){if(m.weapon==='rifleA'||m.weapon==='rifleB')m.nextShot=time+.42;m.burst=0;m.acquired=0;}m.decision=time+.25;
  t.headPosition(this.head);const origin=this.head.clone(),aim=new Vector3(m.aim.x,m.aim.y,m.aim.z),distance=origin.distanceTo(aim),accuracy=clamp(this.settings.defenderAccuracy,.1,.98),error=(1-accuracy)*(m.weapon==='operator'?.028:.045);aim.x+=this.rng.range(-1,1)*distance*error;aim.y+=this.rng.range(-1,1)*distance*error;this.ray.set(origin,aim.clone().sub(origin).normalize());
  let region:DefenderShot['hit']='miss',detail:DefenderShot['hitRegion'];const impact=origin.clone().addScaledVector(this.ray.direction,Math.max(distance,1)),playerHit=intersectPlayerBody(this.ray,p,this.hit),wall=nearestEnvironmentHit(this.ray,Math.max(distance+2,100),new Vector3(),this.obstacles);
  if(playerHit&&playerHit.distance<=wall+1e-6){detail=playerHit.region;region=detail==='head'?'head':detail==='leg'?'leg':'body';impact.copy(this.hit);}else if(Number.isFinite(wall)&&wall<distance+2)impact.copy(origin).addScaledVector(this.ray.direction,wall);
  const playerEye={x:p.position.x,y:p.position.y+p.eyeHeight,z:p.position.z},observed=distance<=(m.weapon==='operator'?80:35)||visibleBetween(this.obstacles,playerEye,vec(origin));
  const shot:DefenderShot={id:++this.sequence,time,bot:t.id,weapon:m.weapon,origin:vec(origin),aim:vec(aim),impact:vec(impact),hit:region,hitRegion:detail,observed,recoveryUntil:m.nextShot};m.lastShot=shot;this.shots.push(shot);if(this.shots.length>96)this.shots.shift();this.report.enemyShots++;
  if(observed&&m.weapon==='operator')this.report.observedRecoveryUntil=Math.max(this.report.observedRecoveryUntil??0,m.nextShot);
  if(region!=='miss'){this.health-=damageAt(profile,detail==='head'?'head':detail==='leg'?'leg':detail==='arm'?'arm':'torso',playerHit!.distance);this.report.health=Math.max(0,this.health);if(this.health<=0)this.kill(t,m,p,time,'shot',detail??region,shot);}this.onShot?.(shot);
 }
 private kill(t:Target,m:Memory,p:PlayerBody,time:number,cause:'shot'|'exposure',region:string,shot?:DefenderShot){
  if(this.death)return;const path=[...this.report.path.slice(-59).map(vec),vec(p.position)];this.death={bot:t.id,weapon:m.weapon,region,cause,time,duration:m.exposure,player:vec(p.position),defender:vec(t.position),line:shot?[vec(shot.origin),vec(shot.impact)]:[{x:t.position.x,y:t.position.y+1.68,z:t.position.z},{x:p.position.x,y:p.position.y+p.eyeHeight,z:p.position.z}],path};this.report.lastDeath=this.death;this.report.deaths++;
 }
 private closeEpisode(time:number,covered:boolean){if(!this.current)return;const e=this.current;e.ended=time;e.duration=Math.max(0,time-e.started);e.timeToCover=covered?e.duration:null;e.returnToCover=covered&&this.returningAt!==null?time-this.returningAt:null;this.report.episodes.push({...e});if(this.report.episodes.length>64)this.report.episodes.shift();
  if(covered&&this.health>0)for(const shot of this.shots){const id=shot.id??0;if(shot.time<e.started||shot.time>time||shot.hit!=='miss'||shot.weapon!=='operator'||!shot.observed||shot.recoveryUntil<=time||this.usedBaits.has(id))continue;this.usedBaits.add(id);this.report.baits++;}this.current=null;this.episodeOrigin=null;this.returningAt=null;
 }
 private measure(dt:number,time:number,p:PlayerBody,visible:number){
  const distance=this.last?distance2(p.position,this.last):0,speed=Math.hypot(p.velocity.x,p.velocity.z);this.last=vec(p.position);if(time>=this.pathAt){this.pathAt=time+.1;this.report.path.push(vec(p.position));if(this.report.path.length>160)this.report.path.shift();}this.report.distance+=distance;this.report.peakSpeed=Math.max(this.report.peakSpeed,speed);this.report.maxVisibleFraction=Math.max(this.report.maxVisibleFraction,visible);if(p.scoped&&speed<.1&&p.grounded)this.report.operator.holdingSeconds+=dt;
  if(visible>0){this.report.exposure+=dt;if(!this.current){this.current={started:time,ended:time,duration:0,distance:0,peakSpeed:0,peakVisibleFraction:0,verticalDisplacement:0,shots:0,hits:0,shotVelocity:null,acquisitionTime:null,returnToCover:null,timeToCover:null};this.episodeOrigin=vec(p.position);this.episodeLow=this.episodeHigh=p.position.y;this.returningAt=null;}
   const e=this.current;e.ended=time;e.duration=time-e.started;e.distance+=distance;e.peakSpeed=Math.max(e.peakSpeed,speed);e.peakVisibleFraction=Math.max(e.peakVisibleFraction,visible);this.episodeLow=Math.min(this.episodeLow,p.position.y);this.episodeHigh=Math.max(this.episodeHigh,p.position.y);e.verticalDisplacement=this.episodeHigh-this.episodeLow;
   const start=this.episodeOrigin!,dx=p.position.x-start.x,dz=p.position.z-start.z;if(this.returningAt===null&&Math.hypot(dx,dz)>.04&&p.velocity.x*dx+p.velocity.z*dz<-.05)this.returningAt=time;
   if(e.acquisitionTime===null){const view=new Vector3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)),origin=new Vector3(p.position.x,p.position.y+p.eyeHeight,p.position.z);for(const t of this.targets){if(!t.active||!t.enabled)continue;t.headPosition(this.head);const delta=this.head.clone().sub(origin);if(delta.lengthSq()<1e-8)continue;if(view.dot(delta.normalize())>Math.cos(.025)&&visibleBetween(this.obstacles,vec(origin),vec(this.head))){e.acquisitionTime=time-e.started;break;}}}
  }else this.closeEpisode(time,!this.death);
  if(this.death)this.closeEpisode(time,false);
 }
 shot(s:ShotEvent){
  const hit=['head','torso','arm','leg'].includes(s.hit);if(this.current){this.current.shots++;this.current.hits+=Number(hit);this.current.shotVelocity=Math.hypot(s.velocity.x,s.velocity.z);}
  if(hit&&s.targetId!==null){const m=this.memories[s.targetId],enemyShot=m?.lastShot,id=enemyShot?.id??0,t=this.targets[s.targetId];if(enemyShot&&m.weapon==='operator'&&enemyShot.observed&&s.timestamp>=enemyShot.time&&s.timestamp<enemyShot.recoveryUntil&&(s.targetGeneration===null||s.targetGeneration===undefined||s.targetGeneration===t?.generation)&&!this.usedRecoveries.has(id)){this.usedRecoveries.add(id);this.report.recoveryExploits++;}}
  if(s.weapon==='operator'){const o=this.report.operator;if(s.ads){o.scopedShots++;o.scopedHits+=Number(hit);o.scopeTransitionSum+=s.adsTransition??0;}else{o.unscopedShots++;o.unscopedHits+=Number(hit);}if(this.current?this.current.shots===1:s.firstShot){o.firstShots++;o.firstHits+=Number(hit);}}
  // Sets retain only the same bounded recent event horizon as the shot journal.
  const oldest=this.shots[0]?.id??0;for(const set of [this.usedBaits,this.usedRecoveries])for(const id of set)if(id<oldest)set.delete(id);
 }
 snapshot():PeekReport{const enabled=this.targets.filter(t=>t.enabled),unclearedAngles=enabled.filter(t=>t.active).length;return{...this.report,totalAngles:enabled.length,currentClears:enabled.length-unclearedAngles,unclearedAngles,health:Math.max(0,this.health),episodes:[...this.report.episodes.map(e=>({...e})),...this.current?[{...this.current}]:[]],path:this.report.path.map(vec),lastDeath:this.report.lastDeath?{...this.report.lastDeath,player:vec(this.report.lastDeath.player),defender:vec(this.report.lastDeath.defender),line:this.report.lastDeath.line.map(vec),path:this.report.lastDeath.path.map(vec)}:null,operator:{...this.report.operator}};}
}
