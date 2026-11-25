import * as T from 'three';
import type {KnifeSkinId} from '../types';
import {SurfaceMaterialLibrary,writeWorldScaleUV} from './SurfaceMaterials';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';

/** Original knife viewmodels: one gloved hand and six interchangeable blades.
 * Local axes: the blade points along -z from the guard at z=0, the handle runs
 * toward +z, +y is the spine side. Meter scale, matching the firearm views. */
export interface KnifeVisual {
  root:T.Group;
  readonly skin:KnifeSkinId;
  setSkin(skin:KnifeSkinId):void;
  /** swing: attack kind and normalized progress (0..1), or null when idle. */
  animate(time:number,speed:number,swing:{kind:'slash'|'stab';phase:number}|null):void;
  /** Show every blade at once so warm-up compiles all of their shaders. */
  showAll(all:boolean):void;
  dispose():void;
}

export const KNIFE_SWING_SECONDS={slash:.34,stab:.46} as const;

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

export function createKnifeView(geometry:(g:T.BufferGeometry)=>T.BufferGeometry,material:(m:T.Material)=>T.Material,surfaceLibrary?:SurfaceMaterialLibrary,initial:KnifeSkinId='field'):KnifeVisual{
  const surfaces=surfaceLibrary??new SurfaceMaterialLibrary();
  const root=new T.Group(),swing=new T.Group(),hold=new T.Group();root.name='VALOPRAC knife viewmodel';swing.name='knife swing pivot';hold.name='knife grip';
  root.add(swing);swing.add(hold);
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
  const make=(id:KnifeSkinId,build:(g:T.Group)=>void)=>{const g=new T.Group();g.name=`knife skin ${id}`;build(g);g.visible=false;hold.add(g);skins.set(id,g);};

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

  // Gloved fist and forearm in the same fabric/rubber as the firearm arms.
  const sleeve=mat('fabric',0x53656d),glove=mat('rubber',0x2a3b42,.9);
  const fist=new T.Group();fist.name='knife hand';hold.add(fist);
  // Back of the hand on the outer (+x) side; four curled fingers are partial
  // rings around the handle axis, closing under it toward the thumb.
  const palm=mesh(new T.CapsuleGeometry(.0165,.05,4,10),glove,fist);palm.rotation.x=Math.PI/2;palm.position.set(.0125,-.002,.047);palm.scale.set(.8,1.12,1);
  for(let i=0;i<4;i++){const f=mesh(new T.TorusGeometry(.0148-i*.0004,.0069,6,12,Math.PI*1.32),glove,fist);f.rotation.z=-Math.PI*1.32;f.position.set(.001,0,.021+i*.0152);}
  const thumb=mesh(new T.CapsuleGeometry(.0071,.03,3,8),glove,fist);thumb.position.set(-.0105,.0105,.03);thumb.rotation.set(Math.PI/2-.15,0,0);
  const cuff=mesh(new T.CylinderGeometry(.026,.024,.03,12),glove,fist);cuff.rotation.x=Math.PI/2+.25;cuff.position.set(.02,-.012,.1);
  const arm=mesh(new T.CylinderGeometry(.031,.036,.3,12),sleeve,fist);arm.rotation.x=Math.PI/2+.32;arm.position.set(.034,-.06,.24);

  // Resting pose: blade forward and up, canted toward the screen centre.
  hold.rotation.set(.3,.3,-.4);
  let current:KnifeSkinId=initial;
  const visual:KnifeVisual={
    root,
    get skin(){return current;},
    setSkin(skin){current=skins.has(skin)?skin:'field';for(const [id,g] of skins)g.visible=id===current;},
    showAll(all){for(const [id,g] of skins)g.visible=all||id===current;},
    animate(time,speed,attack){
      const smooth=(a:number,b:number,p:number)=>{const t=T.MathUtils.clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
      const breathe=Math.sin(time*1.6)*.0025+Math.sin(time*(5+Math.min(speed,6)))*Math.min(.003,speed*.0006);
      swing.position.set(0,breathe,0);swing.rotation.set(0,0,0);
      if(!attack)return;
      const p=T.MathUtils.clamp(attack.phase,0,1);
      if(attack.kind==='slash'){
        // Wind up to the right, cut across the view to the lower left, recover.
        const wind=smooth(0,.22,p)*(1-smooth(.22,.5,p)),cut=smooth(.18,.52,p)*(1-smooth(.6,1,p));
        swing.position.x+=.04*wind-.11*cut;swing.position.y+=.035*wind-.012*cut;swing.position.z+=-.03*cut;
        swing.rotation.set(-.2*wind+.12*cut,.2*wind-.4*cut,-.45*wind+.9*cut);
      }else{
        // Draw back, drive the point straight ahead, recover.
        const back=smooth(0,.3,p)*(1-smooth(.3,.48,p)),thrust=smooth(.28,.5,p)*(1-smooth(.62,1,p));
        swing.position.set(-.05*thrust,swing.position.y+.015*back+.012*thrust,.05*back-.15*thrust);
        swing.rotation.set(-.32*thrust+.1*back,-.1*thrust,.12*thrust);
      }
    },
    dispose(){if(!surfaceLibrary)surfaces.dispose();}
  };
  visual.setSkin(initial);
  return visual;
}
