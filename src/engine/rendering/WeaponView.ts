import * as T from 'three';
import type { WeaponId } from '../types';
import {mergeStaticArchitecture} from './StaticGeometry';
export interface WeaponVisual {
  root:T.Group;sights:T.Group;magazine:T.Group;cylinder:T.Group;hammer:T.Group;muzzle:T.Mesh;accent:T.MeshStandardMaterial;
  animate?:(time:number,speed:number,reload:number,kick:number,ads:number)=>void;
  dispose?:()=>void;
}
// Independently authored, meter-scale weapon artwork. No downloaded game assets.
// Receivers, stocks, magazines and grips use their own side-profile topology, not scaled cubes.
export function createWeaponView(id:WeaponId,geometry:(g:T.BufferGeometry)=>T.BufferGeometry,material:(m:T.Material)=>T.Material):WeaponVisual {
  const root=new T.Group(),sights=new T.Group(),magazine=new T.Group(),cylinder=new T.Group(),hammer=new T.Group();
  root.name=`VALOPRAC ${id} original viewmodel`;sights.name="open sight posts";magazine.name="magazine";cylinder.name="revolver cylinder";hammer.name="hammer";root.add(sights,magazine,cylinder,hammer);
  const sheriff=id==='sheriff',phantom=id==='rifleB';
  const mat=(color:number,roughness:number,metalness:number)=>material(new T.MeshStandardMaterial({color,roughness,metalness})) as T.MeshStandardMaterial;
  const steel=mat(sheriff?0x77858a:phantom?0x344549:0x3e484d,.34,.78),edge=mat(0x8d999b,.31,.82),dark=mat(0x111a20,.51,.52),polymer=mat(phantom?0x243238:0x273034,.83,.08),rubber=mat(0x11191c,.95,.02),brass=mat(0x9c8863,.46,.68);
  // Kept for existing theme API; no decorative emissive stripes are used.
  const accent=mat(phantom?0x6e8c90:0xa79570,.49,.6);accent.emissive.set(0x000000);
  const mesh=(g:T.BufferGeometry,m:T.Material,parent:T.Group=root)=>{const o=new T.Mesh(geometry(g),m);o.castShadow=false;o.receiveShadow=false;parent.add(o);return o;};
  const profile=(points:[number,number][],width:number,m:T.Material,parent:T.Group=root,offset=0,bevel=.002,holes:[number,number][][]=[])=>{
    const s=new T.Shape();points.forEach(([z,y],i)=>i?s.lineTo(-z,y):s.moveTo(-z,y));s.closePath();
    for(const loop of holes){const hole=new T.Path();loop.forEach(([z,y],i)=>i?hole.lineTo(-z,y):hole.moveTo(-z,y));hole.closePath();s.holes.push(hole);}
    const b=Math.min(bevel,width*.18),g=new T.ExtrudeGeometry(s,{depth:width-b*2,bevelEnabled:b>0,bevelSize:b,bevelThickness:b,bevelSegments:1,curveSegments:2,steps:1});
    g.translate(0,0,-(width-b*2)/2);g.rotateY(Math.PI/2);const o=mesh(g,m,parent);o.position.x=offset;return o;
  };
  const plate=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent:T.Group=root)=>{const o=profile([[z-d/2,y-h/2],[z+d/2,y-h/2],[z+d/2,y+h/2],[z-d/2,y+h/2]],w,m,parent,x);return o;};
  const tube=(r:number,l:number,x:number,y:number,z:number,m:T.Material,parent:T.Group=root,n=16)=>{const o=mesh(new T.CylinderGeometry(r,r,l,n,1),m,parent);o.rotation.x=Math.PI/2;o.position.set(x,y,z);return o;};
  const fastener=(x:number,y:number,z:number,r=.003)=>{const o=mesh(new T.CylinderGeometry(r,r,.002,8),dark);o.rotation.z=Math.PI/2;o.position.set(x,y,z);};
  const triggerGuard=(z:number,y:number,width:number)=>{
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,y+.017,z+.027),new T.Vector3(0,y-.016,z+.015),new T.Vector3(0,y-.021,z-.029),new T.Vector3(0,y+.009,z-.042)]);
    mesh(new T.TubeGeometry(curve,10,width,6,false),steel);
    const trigger=profile([[z+.002,y+.019],[z-.004,y+.003],[z-.001,y-.008],[z-.009,y-.005],[z-.012,y+.005],[z-.009,y+.021]],.008,dark);trigger.name='curved trigger';
  };
  if(sheriff){
    // Open revolver frame, individual barrel, six-chamber fluted cylinder and swept grip.
    profile([[-.084,.053],[.075,.053],[.091,.024],[.061,-.051],[.016,-.057],[-.026,-.035],[-.073,-.025]],.052,steel,root,0,.002,[[[-.035,-.036],[.065,-.036],[.065,.041],[-.035,.041]]]).name="receiver";
    profile([[-.282,.047],[-.068,.047],[-.068,.015],[-.272,.014]],.038,steel);
    tube(.018,.208,0,.031,-.183,dark,root,8).name="barrel";tube(.021,.009,0,.031,-.29,edge,root,8);tube(.012,.011,0,.031,-.296,dark);
    profile([[-.282,.014],[-.075,.014],[-.075,-.004],[-.245,-.004],[-.274,.002]],.027,steel);
    plate(.027,.007,.225,0,.054,-.173,dark);plate(.006,.012,.016,0,.062,-.265,dark);
    for(const x of [-.017,.017])plate(.004,.009,.022,x,.062,.061,dark);
    cylinder.position.set(0,-.002,.018);
    // Radially scalloped longitudinal cylinder wall; chambers and extractor appear on rear face.
    const vertices:number[]=[],indices:number[]=[],n=60,half=.043;
    for(const z of [-half,half])for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=.043-.0035*Math.pow(Math.max(0,Math.cos(a*6)),4);vertices.push(Math.sin(a)*r,Math.cos(a)*r,z);}
    for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();mesh(g,mat(0x53646c,.32,.8),cylinder);tube(.04,.003,0,0,.044,edge,cylinder,24);tube(.013,.006,0,0,.047,dark,cylinder,12);
    for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.sin(a)*.027,y=Math.cos(a)*.027;tube(.008,.004,x,y,.047,dark,cylinder,12);tube(.006,.004,x,y,.049,brass,cylinder,12);}
    profile([[.049,-.033],[.083,-.027],[.108,-.084],[.128,-.16],[.111,-.176],[.061,-.166],[.045,-.133],[.032,-.072]],.048,polymer);
    for(const x of [-.025,.025])profile([[.057,-.065],[.079,-.056],[.113,-.15],[.101,-.162],[.068,-.155],[.047,-.096]],.003,rubber,root,x,.0006);
    plate(.05,.009,.061,0,-.171,.093,steel);triggerGuard(-.022,-.069,.0035);
    profile([[.064,.055],[.083,.058],[.099,.078],[.111,.076],[.093,.05],[.073,.039]],.014,dark,hammer);
    for(const x of [-.027,.027]){fastener(x,.028,.06);fastener(x,-.119,.078);}
  }else if(phantom){
    // Compact monolithic receiver and tapered ventilated shroud, unlike the Vandal's split construction.
    profile([[-.184,.043],[.104,.043],[.151,.019],[.147,-.042],[.07,-.051],[-.108,-.039],[-.184,-.015]],.063,steel).name="receiver";
    profile([[-.383,.029],[-.185,.042],[-.173,-.015],[-.358,-.02],[-.384,-.006]],.056,polymer);
    tube(.014,.07,0,.014,-.406,steel).name="barrel";tube(.027,.174,0,.014,-.505,dark,root,24).name="suppressor";tube(.029,.012,0,.014,-.421,steel,root,24);tube(.024,.008,0,.014,-.596,edge,root,24);tube(.015,.009,0,.014,-.601,dark);
    for(const z of [-.566,-.546,-.448])tube(.0274,.003,0,.014,z,steel,root,24);
    plate(.036,.013,.18,0,-.003,.223,dark);
    profile([[.175,.018],[.314,.013],[.329,-.091],[.304,-.1],[.27,-.06],[.191,-.052]],.051,polymer).name="stock";
    plate(.055,.112,.018,0,-.038,.331,rubber);
    profile([[.071,-.042],[.119,-.045],[.151,-.146],[.128,-.158],[.089,-.145],[.063,-.079]],.043,polymer);
    magazine.position.set(0,-.06,-.01);profile([[-.053,.019],[.018,.015],[.02,-.134],[.007,-.155],[-.047,-.151],[-.055,-.112]],.039,dark,magazine);plate(.044,.012,.072,0,-.15,-.017,steel,magazine);
    for(const x of [-.030,.030]){profile([[-.158,.031],[.072,.031],[.1,.017],[.092,-.014],[-.141,-.017]],.003,polymer,root,x,.0006);for(let z=-.344;z<-.215;z+=.026)plate(.003,.012,.013,x,.007,z,dark);plate(.003,.012,.06,x,.015,-.05,dark);fastener(x,.006,.063);}
    triggerGuard(.033,-.069,.003);
  }else{
    // Long automatic rifle: faceted upper, separate gas tube, slender barrel and swept magazine.
    profile([[-.148,.042],[.107,.042],[.129,.018],[.118,-.047],[.058,-.056],[-.112,-.046],[-.157,-.021]],.064,steel).name="receiver";
    profile([[-.347,.027],[-.161,.034],[-.149,-.021],[-.316,-.025],[-.348,-.008]],.048,polymer);
    tube(.012,.243,0,.005,-.448,steel).name="barrel";tube(.007,.151,0,.029,-.388,dark);tube(.017,.042,0,.005,-.566,dark);tube(.011,.007,0,.005,-.591,edge);
    tube(.018,.015,0,.005,-.337,steel);plate(.012,.027,.019,0,.027,-.46,steel);
    profile([[.125,.025],[.272,.018],[.322,-.006],[.319,-.104],[.296,-.105],[.248,-.056],[.138,-.056]],.049,polymer).name="stock";
    // The negative-space underside makes the stock read as a designed skeletal form.
    profile([[.167,-.041],[.264,-.042],[.289,-.088],[.306,-.087],[.282,-.024],[.167,-.02]],.028,dark);
    plate(.054,.11,.019,0,-.044,.327,rubber);
    profile([[.067,-.046],[.112,-.047],[.144,-.147],[.119,-.16],[.081,-.15],[.055,-.08]],.042,polymer);
    magazine.position.set(0,-.06,-.01);profile([[-.064,.02],[.009,.015],[.018,-.064],[.043,-.139],[.027,-.162],[-.034,-.157],[-.055,-.093]],.041,dark,magazine);profile([[-.037,-.149],[.028,-.153],[.037,-.143],[.039,-.159],[.023,-.174],[-.038,-.168]],.045,steel,magazine);
    for(const x of [-.034,.034]){profile([[-.131,.026],[.084,.026],[.096,.008],[.076,-.024],[-.128,-.024]],.003,dark,root,x,.0005);plate(.002,.013,.08,x,.002,-.02,steel);for(let z=-.307;z<-.19;z+=.027)plate(.003,.015,.014,x*.75,.01,z,dark);fastener(x,.012,.081);fastener(x,-.022,-.11);}
    triggerGuard(.028,-.069,.003);
  }
  if(!sheriff){
    plate(.026,.009,.34,0,.048,-.087,dark);
    for(let z=-.225;z<.075;z+=.022)plate(.031,.003,.008,0,.055,z,steel);
    // Open, narrow sight posts align with the real crosshair; no housing crosses the aim ray.
    for(const z of [-.33,.092])for(const x of [-.035,.035])plate(.0038,.025,.009,x,.1435,z,dark,sights);
    for(const x of [-.035,.035])plate(.004,.003,.009,x,.157,-.33,edge,sights);
    plate(.066,.003,.009,0,.112,-.33,dark,sights);plate(.066,.003,.009,0,.112,.092,dark,sights);
  }
  const arms=createArms(root,sheriff,geometry,material);
  const flash=material(new T.MeshBasicMaterial({color:0xffddb1,transparent:true,opacity:.68,depthWrite:false}));
  const muzzle=mesh(new T.ConeGeometry(.019,sheriff?.065:.085,6),flash);muzzle.rotation.x=-Math.PI/2;muzzle.position.set(0,sheriff?.031:phantom?.014:.005,sheriff?-.326:phantom?-.637:-.624);muzzle.visible=false;
  // Batch static details within their existing articulated parent. Local-space
  // transforms keep magazines, sights, cylinder and hammer independently animated.
  // Named major forms stay inspectable; skinned arms and muzzle stay separate.
  for(const parent of [root,sights,magazine,cylinder,hammer]){
    const groups=new Map<T.MeshStandardMaterial,T.Mesh[]>();
    for(const child of parent.children){
      if(!(child instanceof T.Mesh)||child instanceof T.SkinnedMesh||child.name||!(child.material instanceof T.MeshStandardMaterial))continue;
      const list=groups.get(child.material)??[];list.push(child);groups.set(child.material,list);
    }
    for(const [surface,list] of groups){
      if(list.length<2)continue;
      const merged=mergeStaticArchitecture(list,'local');if(!merged)continue;
      const batch=new T.Mesh(geometry(merged),surface);batch.name='batched static detail';parent.add(batch);
      for(const part of list){parent.remove(part);part.geometry.dispose();}
    }
  }
  return {root,sights,magazine,cylinder,hammer,muzzle,accent,animate(time,speed,reload,kick,ads){arms.animate(time,speed,reload,kick,ads);},dispose(){arms.dispose();}};
}

/** Lightweight original glove/forearm rigs. Ring-lofted anatomy is skinned to wrist,
 * palm and two joints per digit. No disconnected cylinders; bones share a bind pose. */
function createArms(parent:T.Group,sheriff:boolean,geometry:(g:T.BufferGeometry)=>T.BufferGeometry,material:(m:T.Material)=>T.Material){
  const rigs:{root:T.Bone;wrist:T.Bone;finger:T.Bone[];rest:T.Vector3}[]=[],skeletons:T.Skeleton[]=[];
  const sleeve=material(new T.MeshStandardMaterial({color:0x43565d,roughness:.94,metalness:0})),glove=material(new T.MeshStandardMaterial({color:0x253238,roughness:.87,metalness:.03}));
  for(const support of [false,true]){
    const elbow=new T.Vector3(support?-.19:.15,-.32,.32),wristAt=new T.Vector3(support?-.048:.029,support?-.092:-.075,support?(sheriff?.075:-.235):.115),palmAt=wristAt.clone().add(new T.Vector3(support?.012:-.003,.018,-.029));
    const bones:T.Bone[]=[],addBone=(at:T.Vector3,p:T.Bone|null)=>{const b=new T.Bone();b.position.copy(at);if(p){const absolute=new T.Vector3();p.getWorldPosition(absolute);b.position.sub(absolute);p.add(b);}bones.push(b);if(!p)parent.add(b);parent.updateMatrixWorld(true);return b;};
    const root=addBone(elbow,null),wrist=addBone(wristAt,root),palm=addBone(palmAt,wrist);
    const positions:number[]=[],normals:number[]=[],skinIndices:number[]=[],skinWeights:number[]=[],indices:number[]=[],groups:{start:number;count:number;materialIndex:number}[]=[];
    const loft=(points:T.Vector3[],radii:[number,number][],boneIds:number[],materialIndex:number)=>{
      const start=positions.length/3,indexStart=indices.length,n=10;
      for(let r=0;r<points.length;r++){
        const tangent=points[Math.min(r+1,points.length-1)].clone().sub(points[Math.max(0,r-1)]).normalize(),axis=new T.Vector3(1,0,0);if(Math.abs(tangent.dot(axis))>.95)axis.set(0,1,0);const u=new T.Vector3().crossVectors(tangent,axis).normalize(),v=new T.Vector3().crossVectors(tangent,u).normalize();
        for(let j=0;j<n;j++){const a=j/n*Math.PI*2,d=u.clone().multiplyScalar(Math.cos(a)*radii[r][0]).addScaledVector(v,Math.sin(a)*radii[r][1]);positions.push(...points[r].clone().add(d).toArray());normals.push(...d.normalize().toArray());skinIndices.push(boneIds[r],0,0,0);skinWeights.push(1,0,0,0);}
      }
      for(let r=0;r<points.length-1;r++)for(let j=0;j<n;j++){const a=start+r*n+j,b=start+r*n+(j+1)%n,c=a+n,d=b+n;indices.push(a,b,c,b,d,c);}
      for(let j=1;j<n-1;j++){indices.push(start,start+j+1,start+j);const last=start+(points.length-1)*n;indices.push(last,last+j,last+j+1);}
      const previous=groups[groups.length-1],count=indices.length-indexStart;
      if(previous&&previous.materialIndex===materialIndex&&previous.start+previous.count===indexStart)previous.count+=count;
      else groups.push({start:indexStart,count,materialIndex});
    };
    const fore=wristAt.clone().sub(elbow);
    loft([elbow,elbow.clone().addScaledVector(fore,.45),elbow.clone().addScaledVector(fore,.84),elbow.clone().addScaledVector(fore,.91)],[[.031,.036],[.028,.031],[.021,.025],[.021,.025]],[0,0,0,1],0);
    loft([elbow.clone().addScaledVector(fore,.87),wristAt,palmAt,palmAt.clone().add(new T.Vector3(0,.003,-.028))],[[.019,.021],[.017,.021],[.022,.028],[.021,.025]],[1,1,2,2],1);
    const fingers:T.Bone[]=[];
    for(let f=0;f<5;f++){
      // Curved fingers close around the narrow pistol grip / fore-end; thumb opposes the four fingers.
      const thumb=f===4,base=thumb?palmAt.clone().add(new T.Vector3(support?-.013:.013,.019,.004)):palmAt.clone().add(new T.Vector3(support?-.014:.011,-.023+f*.012,-.023));
      const middle=base.clone().add(thumb?new T.Vector3(support?.018:-.021,.004,-.024):new T.Vector3(support?.031:-.035,.002,-.004));
      const tip=middle.clone().add(thumb?new T.Vector3(support?.011:-.009,-.012,-.008):new T.Vector3(support?.008:-.007,.014,.012));
      const finger=addBone(base,palm),joint=addBone(middle,finger);fingers.push(finger);
      const bi=bones.indexOf(finger),ji=bones.indexOf(joint);loft([base,middle,tip],[[.0058,.0064],[.0055,.006],[.0038,.0044]],[bi,ji,ji],1);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeights,4));g.setIndex(indices);for(const a of groups)g.addGroup(a.start,a.count,a.materialIndex);g.computeVertexNormals();
    const body=new T.SkinnedMesh(geometry(g),[sleeve,glove]);body.name=support?'support arm · articulated glove':'dominant arm · articulated glove';body.frustumCulled=false;parent.add(body);parent.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeletons.push(skeleton);body.bind(skeleton);rigs.push({root,wrist,finger:fingers,rest:root.position.clone()});
  }
  return {dispose(){for(const skeleton of skeletons)skeleton.dispose();},animate(time:number,speed:number,reload:number,kick:number,ads:number){for(let i=0;i<rigs.length;i++){const r=rigs[i];r.root.position.copy(r.rest);if(i===1){r.root.position.y+=reload*(sheriff?.055:-.065);r.root.position.z+=reload*(sheriff?-.045:.12);r.root.position.x-=reload*(sheriff?.04:0);r.wrist.rotation.x=reload*(sheriff?-.15:.32);}else r.wrist.rotation.x=-kick*.035;for(let j=0;j<r.finger.length;j++)r.finger[j].rotation.z=Math.sin(time*1.9+j*.3)*.006*(1-ads)*Math.min(1,speed+.2);}}};
}
