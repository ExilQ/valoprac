import type {Vec3} from '../types';

/**
 * 12.40 bot movement styles. Each style is a small set of measurable rules:
 * strafe and stop windows, peek width, crouch use and pressure. The pro-player
 * styles approximate what public descriptions say about their duels; they are
 * training approximations, not motion capture, and not affiliated with anyone.
 * Sources and gaps: docs/BOT_MOVEMENT_12.40.md.
 */
export const BOT_MOVEMENT_STYLE_IDS=['closeRush','wideSwing','jiggleCrouch','something','primmie','flashback','texture','karon','poppin'] as const;
export type BotMovementStyleId=typeof BOT_MOVEMENT_STYLE_IDS[number];
export type BotMovementChoice='off'|'random'|BotMovementStyleId;
type Range=readonly [number,number];
export type CrouchUse='never'|'onStop'|'moving'|'bob'|'spray'|'finalPeek'|'taps';
export interface BotMovementStyle {
  id:BotMovementStyleId;name:string;summary:string;
  /** Strafe segment and stop (shooting) window lengths in seconds. */
  strafe:Range;stop:Range;
  /** adad: alternate direction; continuous: keep one direction to the leash end;
   * tapWide: short peek, rough brake for one tap, then a wide swipe the same way and a full stop. */
  pattern:'adad'|'continuous'|'tapWide';
  /** tapWide only: the wide swipe after the tap. */
  wide?:{strafe:Range;stop:Range};
  /** Lateral half-width of the fight around the held angle (m). */
  leash:number;
  /** Peek from cover: distance of the first swing (m); jiggles before it. */
  peek:number;jiggles:number;
  crouch:CrouchUse;crouchChance:number;
  /** Time back in cover between peeks (s). */
  hidden:Range;
  /** Forward pressure toward the last known player position (fraction of run speed), down to minDistance (m). */
  advance:number;minDistance:number;
}
export const BOT_MOVEMENT_STYLES:Readonly<Record<BotMovementStyleId,BotMovementStyle>>={
  closeRush:{id:'closeRush',name:'빠른 템포 근접 교전',summary:'거리를 좁히며 짧게 좌우로 끊고, 가까우면 앉아서 연사합니다.',strafe:[.16,.26],stop:[.12,.2],pattern:'adad',leash:1.6,peek:1.6,jiggles:0,crouch:'spray',crouchChance:1,hidden:[.2,.5],advance:.7,minDistance:3.5},
  wideSwing:{id:'wideSwing',name:'와이드 피킹',summary:'엄폐물에서 넓게 크게 튀어나온 뒤 멈춰서 쏩니다.',strafe:[.55,.75],stop:[.28,.4],pattern:'adad',leash:3.2,peek:3.2,jiggles:0,crouch:'never',crouchChance:0,hidden:[.7,1.6],advance:0,minDistance:0},
  jiggleCrouch:{id:'jiggleCrouch',name:'지글 후 앉아 피킹',summary:'짧게 2~3번 흔들어 보고, 다음 피킹에서 앉으며 쏩니다.',strafe:[.12,.17],stop:[.22,.32],pattern:'adad',leash:1.4,peek:1.2,jiggles:3,crouch:'finalPeek',crouchChance:1,hidden:[.5,1.1],advance:0,minDistance:0},
  something:{id:'something',name:'썸띵 스타일 (대충 브레이킹 한 발 → 와이드)',summary:'짧게 나와 브레이킹을 대충 걸고 한 발 쏜 뒤, 멈추지 않고 같은 방향으로 와이드를 긁고 다시 멈춰 쏩니다.',strafe:[.14,.2],stop:[.08,.11],pattern:'tapWide',wide:{strafe:[.42,.58],stop:[.2,.3]},leash:3.2,peek:1.4,jiggles:0,crouch:'never',crouchChance:0,hidden:[.4,.9],advance:0,minDistance:0},
  primmie:{id:'primmie',name:'프리미 스타일 (앉았다 일어서기)',summary:'좌우로 움직이며 쏠 때마다 앉았다 일어서기를 번갈아 합니다.',strafe:[.18,.3],stop:[.16,.26],pattern:'adad',leash:2,peek:2,jiggles:0,crouch:'bob',crouchChance:1,hidden:[.4,1],advance:0,minDistance:0},
  flashback:{id:'flashback',name:'플래시백 스타일 (앉아서 좌우 이동)',summary:'앉은 채 좌우로 움직이며 쏩니다.',strafe:[.3,.5],stop:[.1,.18],pattern:'adad',leash:1.5,peek:1.8,jiggles:0,crouch:'moving',crouchChance:1,hidden:[.4,1],advance:0,minDistance:0},
  texture:{id:'texture',name:'텍스처 스타일 (빠른 템포 선사격)',summary:'숨는 시간 없이 빠르게 튀어나와, 멈추자마자 예상 위치에 쏩니다.',strafe:[.22,.34],stop:[.08,.12],pattern:'adad',leash:2.4,peek:2.6,jiggles:0,crouch:'never',crouchChance:0,hidden:[.15,.35],advance:.3,minDistance:7},
  karon:{id:'karon',name:'카론 스타일 (브레이킹 때 앉기)',summary:'서서 움직이다 멈출 때 앉아서 헤드라인을 피하며 쏩니다.',strafe:[.22,.36],stop:[.22,.32],pattern:'adad',leash:2,peek:2,jiggles:0,crouch:'onStop',crouchChance:1,hidden:[.5,1.1],advance:0,minDistance:0},
  poppin:{id:'poppin',name:'팝핀 스윙',summary:'한 방향으로 아주 넓게 계속 달리며, 짧게 멈춰 쏘고 다시 같은 방향으로 갑니다.',strafe:[.4,.55],stop:[.1,.14],pattern:'continuous',leash:4.2,peek:4.2,jiggles:0,crouch:'never',crouchChance:0,hidden:[.6,1.4],advance:0,minDistance:0},
};
/** VALORANT movement used by the bots: crouch 0.275 s, crouch speed 36%,
 * accelerate to run in about 0.25 s, release-stop about 0.17 s, counter-strafe faster. */
/** Without any sight or sound of the player, a bot waits this much longer in cover between peeks. */
export const UNAWARE_WAIT=2.5;
/** Something-style tap: at most this long braking for the tap, and this long under the deadzone without a shot. */
export const TAP_MAX_SECONDS=.22,TAP_SETTLE_SECONDS=.07;
export const BOT_KINEMATICS={acceleration:22,braking:32,counterBraking:40,crouchSeconds:.275,crouchSpeed:.36};
export interface StyleWorld {
  /** Floor height at (x,z) reachable from y, or null when blocked. */
  ground(x:number,z:number,y:number):number|null;
  standing(p:Vec3):boolean;
  /** Clear line from a bot head point to a point. */
  clear(a:Vec3,b:Vec3):boolean;
}
export interface StyleBody {position:{x:number;y:number;z:number;set(x:number,y:number,z:number):unknown};velocity:{x:number;y:number;z:number;set(x:number,y:number,z:number):unknown};crouch:number;anchor:Vec3;}
export interface StyleContext {time:number;dt:number;runSpeed:number;rng:{next():number;range(a:number,b:number):number};
  /** Bot's held direction (unit, xz). */face:Vec3;
  /** Last observed or heard player position (null when unknown). */known:Vec3|null;seen:boolean;
  /** Ready to shoot this tick (aim settled, gun ready): the stop window should be now. */wantsShot:boolean;
  /** Accurate speed for this weapon (deadzone, m/s). */deadzone?:number;}
type Phase='hide'|'peek'|'fight'|'return';
/** Per-bot movement controller. Deterministic for a given RNG sequence. */
export class BotMovementController {
  phase:Phase='hide';private until=0;private dir=1;private moving=false;private segmentEnds=0;private crouchTarget=0;private cover=0;private initialized=false;
  /** tapWide: 0 short peek, 1 rough-brake tap, 2 wide swipe, 3 full stop. */
  private tapStep=0;private tapShot=false;private slowSince=-1;
  /** Called by the AI when this bot fires. */
  shotFired(){if(this.tapping)this.tapShot=true;}
  private jigglesLeft=0;private stopCount=0;private lostAt=-1;private origin:Vec3={x:0,y:0,z:0};private jiggle=false;private segmentStart=0;
  /** Committed peeks so far (diagnostics and tests). */
  get stops(){return this.stopCount;}
  /** tapWide: true during the rough-brake tap window (one shot). */
  get tapping(){return this.style.pattern==='tapWide'&&this.phase==='fight'&&this.tapStep===1&&!this.moving;}
  constructor(readonly style:BotMovementStyle){}
  /** Signed lateral side with cover (−1/1), or 0 in the open. */
  get coverSide(){return this.cover;}
  private axis(face:Vec3){return{x:-face.z,z:face.x};}
  private init(body:StyleBody,ctx:StyleContext,world:StyleWorld){
    this.initialized=true;this.origin={...body.anchor};const lat=this.axis(ctx.face),probe={x:body.anchor.x+ctx.face.x*10,y:body.anchor.y+1.4,z:body.anchor.z+ctx.face.z*10};
    const hiddenAt=(side:number)=>{const p={x:body.anchor.x+lat.x*side*.9,y:body.anchor.y,z:body.anchor.z+lat.z*side*.9};return world.standing(p)&&world.ground(p.x,p.z,p.y)!==null&&!world.clear({x:p.x,y:p.y+1.55,z:p.z},probe);};
    const left=hiddenAt(-1),right=hiddenAt(1);this.cover=left===right?0:left?-1:1;
    this.dir=this.cover?-this.cover:(ctx.rng.next()<.5?-1:1);this.jigglesLeft=this.style.jiggles;this.until=ctx.time+ctx.rng.range(.2,.6);
  }
  step(body:StyleBody,ctx:StyleContext,world:StyleWorld){
    if(!this.initialized)this.init(body,ctx,world);
    const s=this.style,lat=this.axis(ctx.face),t=ctx.time;
    const lateral=(body.position.x-this.origin.x)*lat.x+(body.position.z-this.origin.z)*lat.z;
    // Phase changes use only what the bot perceives (seen / known), never a hidden player position.
    if(ctx.seen){this.lostAt=-1;if(this.phase!=='fight'){this.phase='fight';this.moving=false;this.segmentEnds=t+ctx.rng.range(s.stop[0],s.stop[1]);this.jiggle=false;}}
    else if(this.phase==='fight'){if(this.lostAt<0)this.lostAt=t;if(t-this.lostAt>.8){this.phase='return';this.lostAt=-1;}}
    let wishLateral=0,wishForward=0;
    const home=this.cover*.9,toHome=Math.abs(lateral-home)>.06?Math.sign(home-lateral):0,outward=this.cover?-this.cover:this.dir;
    if(this.phase==='hide'){
      wishLateral=toHome;
      if(t>=this.until&&!toHome){this.phase='peek';this.moving=true;this.dir=outward;
        this.jiggle=this.jigglesLeft>0;this.segmentEnds=t+(this.jiggle?ctx.rng.range(s.strafe[0],s.strafe[1]):s.peek/Math.max(.5,ctx.runSpeed)+.12);}
    }else if(this.phase==='peek'){
      if(this.moving){wishLateral=this.dir;if(t>=this.segmentEnds||Math.abs(lateral-home)>=s.peek){this.moving=false;this.segmentEnds=t+(this.jiggle?s.stop[0]*.5:ctx.rng.range(s.stop[0],s.stop[1])+.4);}}
      else if(t>=this.segmentEnds){this.phase='return';}
    }else if(this.phase==='fight'){
      if(this.moving){wishLateral=this.dir;
        const pastLeash=Math.sign(lateral)===this.dir&&Math.abs(lateral)>=s.leash,minimum=t>=this.segmentStart+Math.max(.12,s.strafe[0]);
        if(s.pattern==='tapWide'){
          if(t>=this.segmentEnds||pastLeash){this.moving=false;this.stopCount++;const tap=this.tapStep===0;this.tapStep=tap?1:3;const w=!tap&&s.wide?s.wide.stop:s.stop;this.segmentEnds=t+ctx.rng.range(w[0],w[1]);}
        }else if(t>=this.segmentEnds||pastLeash||ctx.wantsShot&&minimum){this.moving=false;this.stopCount++;this.segmentEnds=t+ctx.rng.range(s.stop[0],s.stop[1]);}
        if(this.tapStep===1){this.tapShot=false;this.slowSince=-1;this.segmentEnds=t+TAP_MAX_SECONDS;}
      }else if(s.pattern==='tapWide'&&this.tapStep===1&&t<this.segmentEnds){
        // Rough brake: only down to the deadzone, one tap, then swipe on without settling.
        const speed=Math.hypot(body.velocity.x,body.velocity.z),dz=ctx.deadzone??.275*ctx.runSpeed;
        if(speed<=dz){if(this.slowSince<0)this.slowSince=t;}else this.slowSince=-1;
        if(this.tapShot||this.slowSince>=0&&t-this.slowSince>=TAP_SETTLE_SECONDS)this.segmentEnds=t;
      }else if(t>=this.segmentEnds&&s.pattern==='tapWide'){
        // Tap: the brake is cut short and the swipe continues the same way; after the full stop the next cycle starts from the other side.
        this.moving=true;this.segmentStart=t;this.tapStep=this.tapStep===1?2:0;
        if(this.tapStep===0){this.dir=Math.abs(lateral)>s.leash*.5?-Math.sign(lateral)||-this.dir:-this.dir;}
        const w=this.tapStep===2&&s.wide?s.wide.strafe:s.strafe;this.segmentEnds=t+ctx.rng.range(w[0],w[1]);
      }else if(t>=this.segmentEnds){
        this.moving=true;this.segmentStart=t;const atEdge=Math.abs(lateral)>=s.leash*.95&&Math.sign(lateral)===this.dir;
        if(s.pattern==='adad'||atEdge)this.dir=-this.dir;
        // ADAD stays centred on the held angle.
        if(s.pattern==='adad'&&Math.abs(lateral)>s.leash*.8)this.dir=-Math.sign(lateral)||this.dir;
        this.segmentEnds=t+ctx.rng.range(s.strafe[0],s.strafe[1]);
      }
      if(s.advance>0&&ctx.known){const dx=ctx.known.x-body.position.x,dz=ctx.known.z-body.position.z;if(Math.hypot(dx,dz)>s.minDistance+.5)wishForward=s.advance;}
    }else{
      wishLateral=toHome;
      if(!toHome){this.phase='hide';
        if(this.jiggle&&this.jigglesLeft>0){this.jigglesLeft--;this.until=t+ctx.rng.range(.04,.1);}
        else{this.jigglesLeft=s.jiggles;this.until=t+ctx.rng.range(s.hidden[0],s.hidden[1])*(ctx.known?.6:UNAWARE_WAIT);}
        this.jiggle=false;}
    }
    // Crouch use per style.
    const stopped=!this.moving&&(this.phase==='fight'||this.phase==='peek');
    switch(s.crouch){
      case'onStop':this.crouchTarget=stopped?1:0;break;
      case'moving':this.crouchTarget=this.phase==='fight'?1:0;break;
      case'bob':if(stopped&&this.phase==='fight')this.crouchTarget=this.stopCount%2;else if(!stopped)this.crouchTarget=0;break;
      case'spray':{const near=ctx.known&&Math.hypot(ctx.known.x-body.position.x,ctx.known.z-body.position.z)<7;this.crouchTarget=stopped&&near?1:0;break;}
      case'finalPeek':this.crouchTarget=(this.phase==='peek'&&!this.jiggle||this.phase==='fight')&&stopped&&this.segmentEnds-t>.1?1:0;break;
      case'taps':if(stopped&&this.phase==='fight'&&this.segmentEnds-t>.08&&ctx.rng.next()<s.crouchChance*ctx.dt*8)this.crouchTarget=1;if(!stopped)this.crouchTarget=0;break;
      default:this.crouchTarget=0;
    }
    body.crouch+=Math.max(-ctx.dt/BOT_KINEMATICS.crouchSeconds,Math.min(ctx.dt/BOT_KINEMATICS.crouchSeconds,this.crouchTarget-body.crouch));
    // Kinematics: accelerate toward the wish velocity, brake and counter-strafe like a player.
    const cap=ctx.runSpeed*(body.crouch>.5?BOT_KINEMATICS.crouchSpeed:1),fx=ctx.face.x,fz=ctx.face.z;
    let wx=lat.x*wishLateral*cap+fx*wishForward*cap,wz=lat.z*wishLateral*cap+fz*wishForward*cap;const wl=Math.hypot(wx,wz);if(wl>cap){wx*=cap/wl;wz*=cap/wl;}
    const vx=body.velocity.x,vz=body.velocity.z,dx=wx-vx,dz=wz-vz,dl=Math.hypot(dx,dz);
    if(dl>1e-9){const opposing=vx*wx+vz*wz<0,slowing=Math.hypot(wx,wz)<Math.hypot(vx,vz);const rate=opposing?BOT_KINEMATICS.counterBraking:slowing?BOT_KINEMATICS.braking:BOT_KINEMATICS.acceleration;const k=Math.min(1,rate*ctx.dt/dl);body.velocity.set(vx+dx*k,0,vz+dz*k);}
    const nx=body.position.x+body.velocity.x*ctx.dt,nz=body.position.z+body.velocity.z*ctx.dt,ny=world.ground(nx,nz,body.position.y);
    if(ny!==null&&world.standing({x:nx,y:ny,z:nz})){body.position.set(nx,ny,nz);}
    else{body.velocity.set(0,0,0);if(this.moving){this.moving=false;this.segmentEnds=t+s.stop[0];}this.dir=-this.dir;}
  }
  /** Inside the accuracy rules this bot may shoot: stopped to the deadzone, or crouch-moving. */
  canShoot(speed:number,crouch:number,deadzone:number,runSpeed:number){return speed<=deadzone+1e-6||crouch>.5&&speed<=runSpeed*BOT_KINEMATICS.crouchSpeed+.05;}
}
export function chooseStyle(choice:BotMovementChoice|undefined,rng:{next():number}):BotMovementStyle|null{
  if(!choice||choice==='off')return null;
  if(choice==='random')return BOT_MOVEMENT_STYLES[BOT_MOVEMENT_STYLE_IDS[Math.min(BOT_MOVEMENT_STYLE_IDS.length-1,Math.floor(rng.next()*BOT_MOVEMENT_STYLE_IDS.length))]];
  return BOT_MOVEMENT_STYLES[choice]??null;
}
