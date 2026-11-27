import * as T from 'three';
import type {KnifeSkinId} from '../types';
import {SurfaceMaterialLibrary,writeWorldScaleUV} from './SurfaceMaterials';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';
import {KNIFE_VIEW_ROOT,VIEWMODEL_HFOV} from './viewmodel';
const KNIFE_TAN_HALF_FOV=Math.tan(VIEWMODEL_HFOV*Math.PI/360);

/** Original knife viewmodels: one gloved hand and six interchangeable blades.
 * Knife-local axes: the blade points along -z from the guard at z=0, the
 * handle runs toward +z, +y is the spine side, -y the cutting edge.
 * Hand frame (H): the handle axis is z (index finger at low z, little finger
 * at high z), the palm faces -x, and the wrist and forearm lie toward +y.
 * Meter scale, matching the firearm views. See docs/KNIFE_HANDLING_12.33.md. */
export interface KnifeVisual {
  root:T.Group;
  readonly skin:KnifeSkinId;
  readonly grip:KnifeGrip;
  setSkin(skin:KnifeSkinId):void;
  /** attack: kind, normalized progress (0..1) and combo step (slash 0-2);
   * draw: remaining equip fraction (1 just drawn, 0 ready). */
  animate(time:number,speed:number,attack:KnifeAttackPose|null,draw?:number):void;
  /** The blade tip in viewmodel camera space after the last animate(). */
  tip(out:T.Vector3):T.Vector3;
  /** Show every blade at once so warm-up compiles all of their shaders. */
  showAll(all:boolean):void;
  dispose():void;
}
export interface KnifeAttackPose {kind:'slash'|'stab';phase:number;combo?:number;}

/** forward: hammer grip, blade out of the index side, point canted toward
 * the crosshair. saber: thumb on the spine, wrist extended so the point aims
 * at the crosshair. reverse: blade out of the little-finger side, thumb
 * capping the pommel. ring: reverse grip with the index finger through the
 * karambit ring and the claw curving forward under the little finger. */
export type KnifeGrip='forward'|'saber'|'reverse'|'ring';
export const KNIFE_GRIPS:Record<KnifeSkinId,KnifeGrip>={field:'forward',tanto:'saber',karambit:'ring',kunai:'reverse',aether:'forward',obsidian:'forward'};
export const KNIFE_SWING_SECONDS={slash:.34,stab:.46} as const;
/** The simulation resolves a knife hit on the tick the button is pressed, so
 * the blade reaches the crosshair almost at once (41 ms slash, 74 ms stab);
 * any wind-up happens before the press is visible, never before the hit. */
export const KNIFE_CONTACT_PHASE={slash:.12,stab:.16} as const;
/** Slashes within this many seconds continue the three-swing combo. */
export const KNIFE_COMBO_WINDOW=.85;
/** Combo step of a new knife attack: consecutive slashes cycle 0-1-2; a stab
 * or a pause longer than KNIFE_COMBO_WINDOW starts again from 0. */
export function nextKnifeCombo(previous:{kind:'slash'|'stab';start:number;combo:number}|null,kind:'slash'|'stab',start:number){
  if(kind!=='slash'||!previous||previous.kind!=='slash'||start-previous.start>KNIFE_COMBO_WINDOW)return 0;
  return (previous.combo+1)%3;
}

type Point=[number,number];
interface BladeShape {outline:Point[];edges:Point[][];thickness:number;}

const BLADES:Record<KnifeSkinId,BladeShape>={
  field:{thickness:.0042,outline:[[0,-.012],[-.1,-.0145],[-.146,-.0085],[-.172,.0045],[-.141,.0145],[-.09,.0162],[0,.0162]],edges:[[[0,-.012],[-.1,-.0145],[-.146,-.0085],[-.172,.0045]]]},
  tanto:{thickness:.0048,outline:[[0,-.012],[-.13,-.0122],[-.148,-.0062],[-.18,.0115],[-.171,.0158],[0,.0158]],edges:[[[0,-.012],[-.13,-.0122]],[[-.13,-.0122],[-.148,-.0062],[-.18,.0115]]]},
  karambit:{thickness:.0045,outline:[[0,.012],[-.048,.0085],[-.088,-.0105],[-.111,-.043],[-.108,-.071],[-.093,-.04],[-.068,-.0185],[-.032,-.0098],[0,-.0098]],edges:[[[-.108,-.071],[-.093,-.04],[-.068,-.0185],[-.032,-.0098]]]},
  kunai:{thickness:.0042,outline:[[0,-.006],[-.04,-.0165],[-.101,-.0102],[-.152,0],[-.101,.0102],[-.04,.0165],[0,.006]],edges:[[[-.04,-.0165],[-.101,-.0102],[-.152,0]],[[-.152,0],[-.101,.0102],[-.04,.0165]]]},
  aether:{thickness:.0036,outline:[],edges:[]},
  obsidian:{thickness:.005,outline:[[0,-.012],[-.048,-.0172],[-.074,-.0098],[-.108,-.0185],[-.148,-.0062],[-.192,.0062],[-.151,.0168],[-.1,.0192],[-.048,.0172],[0,.0162]],edges:[[[0,-.012],[-.048,-.0172],[-.074,-.0098],[-.108,-.0185],[-.148,-.0062],[-.192,.0062]]]},
};

/** Per-grip pose of the knife in the fist (mount, in H) and of the arm at
 * rest (camera space). `pinky` is the handle axis toward the little finger,
 * `elbow` the direction from the fist toward the elbow, `roll` turns the fist
 * about the handle axis, `at` moves the fist from KNIFE_VIEW_ROOT. */
export interface KnifeGripPose {mount:{p:[number,number,number];flip:boolean};pinky:[number,number,number];elbow:[number,number,number];roll:number;at:[number,number,number];fingers:'wrap'|'ring';thumb:'wrap'|'spine'|'cap';}
export const KNIFE_GRIP_POSES:Record<KnifeGrip,KnifeGripPose>={
  // Blade up-left out of the index side, edge toward the target, point
  // canted toward the crosshair; forearm from the lower right.
  forward:{mount:{p:[0,0,0],flip:false},pinky:[.5,-.6,.6],elbow:[.7,-.4,.6],roll:0,at:[.015,.01,0],fingers:'wrap',thumb:'wrap'},
  // Wrist extended so the blade nearly lines up with the forearm and the
  // point aims along the line of sight; thumb on the spine for control.
  saber:{mount:{p:[0,0,0],flip:false},pinky:[.6,-.45,.66],elbow:[.75,-.4,.5],roll:0,at:[.015,.01,0],fingers:'wrap',thumb:'spine'},
  // Blade out of the little-finger side pointing forward and down, edge
  // out, thumb capping the pommel.
  reverse:{mount:{p:[0,0,.09],flip:true},pinky:[-.6,-.45,-.66],elbow:[.65,-.45,.6],roll:0,at:[0,.07,0],fingers:'wrap',thumb:'cap'},
  // Index finger through the ring, back of the hand toward the camera, claw
  // curving forward under the little finger.
  ring:{mount:{p:[0,0,.103],flip:true},pinky:[-.6,-.45,-.66],elbow:[.65,-.45,.6],roll:0,at:[0,.07,0],fingers:'ring',thumb:'cap'},
};
const v3=(a:readonly number[])=>new T.Vector3(a[0],a[1],a[2]);
/** Rotation taking the hand frame H to camera space at rest. */
export function knifeRestRotation(g:KnifeGripPose){const z=v3(g.pinky).normalize(),y=v3(g.elbow).addScaledVector(z,-v3(g.elbow).dot(z)).normalize(),x=new T.Vector3().crossVectors(y,z);return new T.Quaternion().setFromAxisAngle(z,g.roll).multiply(new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)));}

export function createKnifeView(geometry:(g:T.BufferGeometry)=>T.BufferGeometry,material:(m:T.Material)=>T.Material,surfaceLibrary?:SurfaceMaterialLibrary,initial:KnifeSkinId='field'):KnifeVisual{
  const surfaces=surfaceLibrary??new SurfaceMaterialLibrary();
  // root (viewmodel placement) > arm (fist centre, grip orientation, animated)
  // > hand meshes, forearm and mount (knife in the fist) > spin (draw flourish).
  const root=new T.Group(),arm=new T.Group(),mount=new T.Group(),spin=new T.Group();root.name='VALOPRAC knife viewmodel';arm.name='knife arm';mount.name='knife grip mount';spin.name='knife draw flourish';
  root.add(arm);arm.add(mount);mount.add(spin);
  const mat=(family:VisualMaterialId,tint:number,roughness?:number,metalness?:number)=>material(surfaces.material(family,{tint,roughness,metalness})) as T.MeshStandardMaterial;
  const glow=(color:number,intensity:number,opacity=1)=>material(new T.MeshStandardMaterial({color:0x0b1416,emissive:color,emissiveIntensity:intensity,roughness:.35,metalness:.1,transparent:opacity<1,opacity,depthWrite:opacity>=1})) as T.MeshStandardMaterial;
  const mesh=(g:T.BufferGeometry,m:T.Material,parent:T.Object3D)=>{const family=m.userData.visualMaterialId as VisualMaterialId|undefined;if(family)writeWorldScaleUV(g,VISUAL_MATERIALS[family].metersPerTile);const o=new T.Mesh(geometry(g),m);o.castShadow=false;o.receiveShadow=false;parent.add(o);return o;};
  const extrude=(points:Point[],depth:number,m:T.Material,parent:T.Object3D,bevel=.0011)=>{
    const s=new T.Shape();points.forEach(([z,y],i)=>i?s.lineTo(-z,y):s.moveTo(-z,y));s.closePath();
    const b=Math.min(bevel,depth*.3),g=new T.ExtrudeGeometry(s,{depth:Math.max(.0004,depth-b*2),bevelEnabled:b>0,bevelSize:b,bevelThickness:b,bevelSegments:1,curveSegments:6,steps:1});
    g.translate(0,0,-(depth-b*2)/2);g.rotateY(Math.PI/2);return mesh(g,m,parent);
  };
  // A bright honed bevel along each cutting edge, inset from the outline.
  const edgeStrip=(points:Point[],depth:number,m:T.Material,parent:T.Object3D)=>{
    const strip:Point[]=[...points,...points.slice().reverse().map(([z,y]):Point=>[z,y-Math.sign(y)*.0032])];
    return extrude(strip,depth,m,parent,.0004);
  };
  const tube=(r0:number,r1:number,length:number,z:number,m:T.Material,parent:T.Object3D,y=0,segments=14)=>{const o=mesh(new T.CylinderGeometry(r1,r0,length,segments,1),m,parent);o.rotation.x=Math.PI/2;o.position.set(0,y,z+length/2);return o;};
  const ring=(radius:number,thickness:number,z:number,m:T.Material,parent:T.Object3D,y=0)=>{const o=mesh(new T.TorusGeometry(radius,thickness,6,18),m,parent);o.position.set(0,y,z);return o;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent:T.Object3D)=>{const o=mesh(new T.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;};

  const steelDark=mat('painted-metal',0x1d2427,.42,.7),steelSatin=mat('steel',0x8f9b9d,.3),steelGun=mat('steel',0x3b4448,.36),honed=mat('brushed-metal',0xc4ced0,.18,.95);
  const cord=mat('fabric',0x2c3f43,.92),wrapTeal=mat('fabric',0x2a7169,.86),leather=mat('fabric',0x3a302b,.88),g10=mat('plastic',0x22282c,.7),liner=mat('painted-metal',0xd38a52,.45,.6),graphite=mat('plastic',0x1b2226,.55);
  const glass=mat('plastic',0x0b0d11,.08,.2);glass.envMapIntensity=1.6;

  const skins=new Map<KnifeSkinId,T.Group>();
  const blade=(id:KnifeSkinId,metal:T.Material,parent:T.Group)=>{const b=BLADES[id];extrude(b.outline,b.thickness,metal,parent);for(const e of b.edges)edgeStrip(e,b.thickness*1.12,honed,parent);};
  const make=(id:KnifeSkinId,build:(g:T.Group)=>void)=>{const g=new T.Group();g.name=`knife skin ${id}`;build(g);g.visible=false;spin.add(g);skins.set(id,g);};

  make('field',g=>{
    blade('field',steelDark,g);
    box(.012,.042,.007,0,.002,.0035,steelGun,g);
    tube(.0108,.0115,.108,.007,cord,g);
    for(let i=0;i<7;i++)ring(.0116,.0019,.016+i*.014,cord,g);
    tube(.012,.0105,.012,.115,steelGun,g);
  });
  make('tanto',g=>{
    blade('tanto',steelSatin,g);
    const tsuba=mesh(new T.CylinderGeometry(.024,.024,.005,20),steelGun,g);tsuba.rotation.x=Math.PI/2;tsuba.scale.set(.82,1,1);tsuba.position.z=.0035;
    tube(.0112,.0118,.112,.006,wrapTeal,g);
    for(let i=0;i<6;i++){const d=box(.0016,.009,.009,.0112,0,.019+i*.017,g10,g);d.rotation.x=Math.PI/4;const e=box(.0016,.009,.009,-.0112,0,.019+i*.017,g10,g);e.rotation.x=Math.PI/4;}
    tube(.0122,.0112,.01,.118,steelGun,g);
  });
  make('karambit',g=>{
    blade('karambit',steelGun,g);
    tube(.0105,.0112,.086,.004,g10,g);
    box(.0236,.004,.084,0,.0098,.047,liner,g);box(.0236,.004,.084,0,-.0098,.047,liner,g);
    const finger=ring(.019,.0048,.107,steelGun,g);finger.rotation.y=Math.PI/2;finger.position.y=-.002;
  });
  make('kunai',g=>{
    blade('kunai',steelGun,g);
    tube(.0078,.0082,.094,.003,cord,g);
    for(let i=0;i<9;i++)ring(.0083,.0016,.009+i*.0098,cord,g);
    const end=ring(.0135,.0032,.112,steelGun,g);end.rotation.y=Math.PI/2;
  });
  make('aether',g=>{
    // Two levitating shards with a lit seam between them: the game's teal
    // accent, held below bloom so the blade reads as light, not a flash.
    const core=glow(0x34d6c3,1.25,.82),seam=glow(0x7ff0e1,1.6);
    extrude([[-.012,-.011],[-.088,-.0125],[-.096,.0128],[-.012,.0124]],.0034,core,g,.0008);
    extrude([[-.104,-.0118],[-.16,-.0062],[-.188,.0035],[-.158,.0112],[-.104,.0122]],.0034,core,g,.0008);
    box(.0012,.0028,.176,0,.0002,-.1,seam,g);
    box(.014,.036,.008,0,0,.003,graphite,g);
    tube(.0108,.0114,.108,.007,graphite,g);
    for(let i=0;i<3;i++)ring(.0116,.0013,.03+i*.03,seam,g);
    tube(.0124,.009,.014,.115,steelGun,g);
  });
  make('obsidian',g=>{
    blade('obsidian',glass,g);
    const magma=glow(0xff5a24,1.15);
    for(const [z,y,l,a] of [[-.06,.004,.05,.25],[-.118,-.002,.042,-.3],[-.158,.003,.026,.4]] as const){const c=box(.0054,.0014,l,0,y,z,magma,g);c.rotation.x=a;}
    box(.016,.04,.008,0,.001,.0035,glass,g);
    tube(.0112,.0118,.11,.007,leather,g);
    for(let i=0;i<5;i++)ring(.0119,.0017,.02+i*.02,leather,g);
    const pommel=mesh(new T.OctahedronGeometry(.013,0),glass,g);pommel.position.z=.123;pommel.scale.set(.9,.9,1.3);
  });

  // Gloved hand in the same fabric/rubber as the firearm arms, built in the
  // hand frame H around the handle axis (z). Grip-specific parts are toggled.
  const sleeve=mat('fabric',0x53656d),glove=mat('rubber',0x2a3b42,.9);
  const hand=new T.Group();hand.name='knife hand';arm.add(hand);
  const capsule=(r:number,l:number,from:T.Vector3,to:T.Vector3,parent:T.Object3D)=>{const d=to.clone().sub(from),o=mesh(new T.CapsuleGeometry(r,Math.max(.001,d.length()-2*r),4,10),glove,parent);o.position.copy(from).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
  // Palm and back of the hand: a flattened block behind the fingers on the
  // forearm (+y) side of the handle, knuckles toward +x.
  const palm=mesh(new T.BoxGeometry(.026,.05,.074,1,1,1),glove,hand);palm.position.set(.006,.028,.044);
  const palmRound=mesh(new T.CapsuleGeometry(.017,.048,4,10),glove,hand);palmRound.rotation.x=Math.PI/2;palmRound.position.set(.012,.012,.044);palmRound.scale.set(.85,1.1,1);
  // Four fingers close around the handle from the knuckles (+x) under the
  // edge side (-y) toward the thumb (-x). Index first, at the low-z end.
  const FINGER_Z=[.021,.036,.051,.066];
  const fingers=FINGER_Z.map((z,i)=>{const f=mesh(new T.TorusGeometry(.0146-i*.0004,.0068-i*.0003,6,12,Math.PI*1.25),glove,hand);f.rotation.z=Math.PI*.5;f.position.set(.001,.001,z);return f;});
  // Ring grip: the index finger runs through the karambit ring instead.
  const ringIndex=capsule(.0068,.05,new T.Vector3(.03,.012,-.004),new T.Vector3(-.016,-.004,-.004),hand);
  // Thumbs: wrapped over the index finger (forward), on the spine (saber), or
  // capping the pommel (reverse, ring).
  const thumbWrap=capsule(.0072,.04,new T.Vector3(-.012,.03,.05),new T.Vector3(-.014,-.002,.022),hand);
  const thumbSpine=capsule(.0072,.045,new T.Vector3(-.006,.03,.05),new T.Vector3(0,.016,.004),hand);
  const thumbCap=capsule(.0072,.04,new T.Vector3(-.012,.032,.045),new T.Vector3(-.006,.008,-.012),hand);
  // The cuff and forearm live in camera space (children of root): each frame
  // they run from the wrist to an elbow anchor below and right of the screen,
  // so the arm stays attached however the fist turns during a swing.
  const cuff=mesh(new T.CylinderGeometry(.027,.025,.034,12),glove,root);
  const forearm=mesh(new T.CylinderGeometry(.031,.037,1,12),sleeve,root);
  const WRIST_H=new T.Vector3(.008,.05,.05),wristCam=new T.Vector3(),elbowRest=new T.Vector3(),elbowCam=new T.Vector3(),armDir=new T.Vector3(),fistRest=new T.Vector3(),UP=new T.Vector3(0,1,0);

  /** Blade tip in knife-local space for each design. */
  const TIPS:Record<KnifeSkinId,T.Vector3>=Object.fromEntries((Object.keys(BLADES) as KnifeSkinId[]).map(id=>{const o=BLADES[id].outline;if(!o.length)return[id,new T.Vector3(0,.0035,-.188)];let tip=o[0];for(const p of o)if(p[0]<tip[0])tip=p;return[id,new T.Vector3(0,tip[1],tip[0])];})) as Record<KnifeSkinId,T.Vector3>;

  /** Attack keys: phase, the blade tip's screen position `at` = [x, y, depth
   * offset] (x, y in half screen widths from the crosshair, so [0,0] is on the
   * crosshair) or a plain fist offset `d`, and the fist rotation `r` (camera
   * Euler YXZ) applied on top of the rest grip. Fist positions are solved from
   * the tip target, so contact keys put the tip exactly on the line of sight. */
  type Key={t:number;at?:[number,number,number];d?:[number,number,number];r:[number,number,number]};
  const C=KNIFE_CONTACT_PHASE,REST_KEY:Key={t:1,d:[0,0,0],r:[0,0,0]};
  const slashForward:Key[][]=[
    // 1: forehand, high right to low left across the crosshair.
    [{t:0,at:[.55,.25,.01],r:[.12,-.2,-.55]},{t:C.slash,at:[0,0,-.03],r:[.05,.32,.42]},{t:.3,at:[-.48,-.38,-.02],r:[-.05,.5,.95]},{t:.62,at:[-.15,-.22,0],r:[0,.2,.4]},REST_KEY],
    // 2: rising backhand cut, low right to high left, edge turned up.
    [{t:0,at:[.35,-.45,.01],r:[.3,-.2,-.6]},{t:C.slash,at:[0,0,-.03],r:[0,.25,.15]},{t:.3,at:[-.42,.26,-.02],r:[-.15,.4,.45]},{t:.62,at:[-.1,.04,0],r:[-.05,.15,.15]},REST_KEY],
    // 3: flat horizontal cut, right to left at eye height.
    [{t:0,at:[.6,.02,0],r:[0,-.45,-.15]},{t:C.slash,at:[0,0,-.05],r:[.02,.35,.9]},{t:.3,at:[-.5,-.05,-.03],r:[0,.7,.9]},{t:.62,at:[-.15,-.06,0],r:[0,.3,.4]},REST_KEY],
  ];
  // Thrust: the point travels along the line of sight to the crosshair.
  const stabForward:Key[]=[{t:0,d:[.01,-.01,.03],r:[-.05,.05,0]},{t:C.stab,at:[0,0,-.12],r:[-.25,.3,.35]},{t:.34,at:[0,0,-.11],r:[-.24,.3,.35]},{t:.68,d:[.02,-.03,.02],r:[-.08,.1,.1]},REST_KEY];
  const slashReverse:Key[][]=[
    // 1: horizontal hook, the blade trailing below the fist, right to left.
    [{t:0,at:[.45,-.05,.01],r:[0,-.35,-.25]},{t:C.slash,at:[0,0,-.02],r:[0,.35,.15]},{t:.3,at:[-.45,-.1,-.02],r:[0,.6,.3]},{t:.62,at:[-.15,-.2,0],r:[0,.25,.12]},REST_KEY],
    // 2: diagonal downward hook, high right to low left.
    [{t:0,at:[.4,.3,.02],r:[.3,-.3,-.4]},{t:C.slash,at:[0,0,-.03],r:[.15,.3,.2]},{t:.3,at:[-.4,-.42,-.02],r:[-.1,.5,.45]},{t:.62,at:[-.1,-.32,0],r:[0,.2,.15]},REST_KEY],
    // 3: rising hook, the claw/point travelling up through the crosshair.
    [{t:0,at:[.3,-.5,.01],r:[-.35,-.2,-.1]},{t:C.slash,at:[0,0,-.03],r:[-.1,.25,.3]},{t:.3,at:[-.4,.24,-.02],r:[.2,.45,.5]},{t:.62,at:[-.1,-.1,0],r:[.05,.18,.18]},REST_KEY],
  ];
  // Overhand drive: the fist rises and drives the point down onto the crosshair.
  const stabReverse:Key[]=[{t:0,d:[0,.06,.04],r:[.35,0,-.1]},{t:C.stab,at:[0,0,-.13],r:[-.35,.35,.2]},{t:.34,at:[0,0,-.12],r:[-.38,.35,.2]},{t:.68,d:[.02,-.02,.02],r:[-.1,.1,.05]},REST_KEY];
  const ATTACKS:Record<KnifeGrip,{slash:Key[][];stab:Key[]}>={forward:{slash:slashForward,stab:stabForward},saber:{slash:slashForward,stab:stabForward},reverse:{slash:slashReverse,stab:stabReverse},ring:{slash:slashReverse,stab:stabReverse}};

  let current:KnifeSkinId=initial,grip:KnifeGrip=KNIFE_GRIPS[initial];
  const tipLocal=new T.Vector3(),tipCam=new T.Vector3(),scratch=new T.Vector3(),qa=new T.Quaternion(),qb=new T.Quaternion(),ea=new T.Euler(0,0,0,'YXZ');
  const rest=new T.Quaternion(),restAt=new T.Vector3(),mountQ=new T.Quaternion(),flipQ=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
  const applyGrip=()=>{
    const g=KNIFE_GRIP_POSES[grip];rest.copy(knifeRestRotation(g));restAt.set(...g.at);
    mount.position.set(...g.mount.p);mount.quaternion.copy(g.mount.flip?flipQ:mountQ.identity());
    for(const [i,f] of fingers.entries())f.visible=!(g.fingers==='ring'&&i===0);
    ringIndex.visible=g.fingers==='ring';thumbWrap.visible=g.thumb==='wrap';thumbSpine.visible=g.thumb==='spine';thumbCap.visible=g.thumb==='cap';
    // grip's wrist angle toward +z (ulnar deviation / extension).
    // At rest the forearm leaves the wrist along `elbow`; the elbow anchor
    // sits 0.45 m from the wrist in that direction, outside the screen.
    fistRest.set(KNIFE_VIEW_ROOT.x+g.at[0],KNIFE_VIEW_ROOT.y+g.at[1],KNIFE_VIEW_ROOT.z+g.at[2]);
    elbowRest.copy(WRIST_H).applyQuaternion(rest).add(fistRest).addScaledVector(v3(g.elbow).normalize(),.45).sub(v3([KNIFE_VIEW_ROOT.x,KNIFE_VIEW_ROOT.y,KNIFE_VIEW_ROOT.z]));
    // Blade tip in H for aim solving.
    tipLocal.copy(TIPS[current]).applyQuaternion(mount.quaternion).add(mount.position);
  };
  /** Pose of one key: fist offset and rotation in camera space. */
  const keyPose=(k:Key,q:T.Quaternion,d:T.Vector3)=>{
    q.setFromEuler(ea.set(k.r[0],k.r[1],k.r[2],'YXZ')).multiply(rest);
    if(k.at){
      // Place the fist so the tip projects to k.at (horizontal half-FOV units).
      scratch.copy(tipLocal).applyQuaternion(q);const z=KNIFE_VIEW_ROOT.z+k.at[2]+scratch.z,depth=-z*KNIFE_TAN_HALF_FOV;
      d.set(k.at[0]*depth-KNIFE_VIEW_ROOT.x-scratch.x,k.at[1]*depth-KNIFE_VIEW_ROOT.y-scratch.y,k.at[2]);
    }else d.set(k.d![0]+restAt.x,k.d![1]+restAt.y,k.d![2]+restAt.z);
  };
  const smooth=(a:number,b:number,p:number)=>{const t=T.MathUtils.clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
  const da=new T.Vector3(),db=new T.Vector3();

  const visual:KnifeVisual={
    root,
    get skin(){return current;},
    get grip(){return grip;},
    setSkin(skin){current=skins.has(skin)?skin:'field';grip=KNIFE_GRIPS[current];for(const [id,g] of skins)g.visible=id===current;applyGrip();},
    showAll(all){for(const [id,g] of skins)g.visible=all||id===current;},
    tip(out){arm.updateMatrix();spin.updateMatrix();mount.updateMatrix();return out.copy(TIPS[current]).applyMatrix4(spin.matrix).applyMatrix4(mount.matrix).applyMatrix4(arm.matrix).add(root.position);},
    animate(time,speed,attack,draw=0){
      // Rest grip, then the attack keys (if any) blended in camera space.
      let q=qa.copy(rest);da.copy(restAt);
      if(attack){
        const set=ATTACKS[grip],keys=attack.kind==='stab'?set.stab:set.slash[((attack.combo??0)%3+3)%3],p=T.MathUtils.clamp(attack.phase,0,1);
        let i=0;while(i<keys.length-2&&p>keys[i+1].t)i++;
        const a=keys[i],b=keys[i+1],u=smooth(a.t,b.t,p);
        keyPose(a,qa,da);keyPose(b,qb,db);q=qa.slerp(qb,u);da.lerp(db,u);
      }
      // Running pumps the arm with the stride (one footstep per 1.6 m), and
      // breathing keeps a small idle motion. Damped during attacks.
      const calm=attack?smooth(.6,1,attack.phase):1,stride=time*Math.PI*Math.max(1.2,speed/1.6),run=Math.min(1,speed/6.75);
      da.x+=(Math.sin(stride*.5)*.009*run)*calm;da.y+=(Math.sin(time*1.6)*.0025+Math.abs(Math.sin(stride*.5))*-.018*run)*calm;
      // Draw: the arm rises from below the screen while the wrist settles; the
      // ring grip spins the karambit once round the index finger and the
      // reverse grip flips the kunai over, both finishing before the knife is ready.
      const e=T.MathUtils.clamp(draw,0,1),lift=e*e*(3-2*e);
      da.x+=.04*lift;da.y-=.2*lift;da.z+=.04*lift;
      if(lift>0){qb.setFromEuler(ea.set(.9*lift,0,-.5*lift,'YXZ'));q=qb.multiply(q);}
      spin.rotation.set(0,0,0);spin.position.set(0,0,0);
      if(e>0&&(grip==='ring'||grip==='reverse')){
        const turn=(grip==='ring'?Math.PI*2:Math.PI)*smooth(.15,.85,e);
        // Spin round the ring (karambit) or the middle of the handle (kunai), about the finger axis (x).
        const pivotZ=grip==='ring'?.107:.05;spin.position.set(0,0,pivotZ);spin.rotateX(grip==='ring'?turn:-turn);spin.translateZ(-pivotZ);
      }
      arm.position.copy(da);arm.quaternion.copy(q);
      // Forearm from the wrist to the elbow anchor, which follows the fist a
      // little (the shoulder and elbow absorb most of a swing).
      wristCam.copy(WRIST_H).applyQuaternion(q).add(da);
      elbowCam.copy(elbowRest).addScaledVector(scratch.copy(da).sub(restAt),.5);
      armDir.subVectors(elbowCam,wristCam);const length=armDir.length();armDir.multiplyScalar(1/length);
      forearm.position.copy(wristCam).addScaledVector(armDir,length/2);forearm.quaternion.setFromUnitVectors(UP,armDir);forearm.scale.set(1,length,1);
      cuff.position.copy(wristCam).addScaledVector(armDir,.012);cuff.quaternion.setFromUnitVectors(UP,armDir);
    },
    dispose(){if(!surfaceLibrary)surfaces.dispose();}
  };
  visual.setSkin(initial);
  return visual;
}
