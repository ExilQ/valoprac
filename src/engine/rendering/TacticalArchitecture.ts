import {courseFor} from '../../config/mapCourses';
import {levelFor} from '../tactical/levels';
import {arenaPattern,loadArenaPatterns,type ArenaPatternPreferences,type ArenaPatternSpec} from '../../config/arenaPatterns';
import {arenaPalette,BAY_APPEARANCE} from '../../config/arenaAppearance';
import {LEVEL_SPECS} from '../../config/tactical';
import * as T from 'three';
import {mergeStaticArchitecture} from './StaticGeometry';
import type {Obstacle} from '../collision/environment';
import type {Quality} from '../types';
import {PEEK_ZONES,type PeekZone} from '../tactical/complex';
import {BUNNY_LEVEL,WALLBANG_SAMPLES} from '../tactical/mechanics';
import {SurfaceMaterialLibrary,writeWorldScaleUV} from './SurfaceMaterials';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';
import {SURFACES} from '../../config/surfaces';
import {baseGroundSurface} from '../footsteps/surfaceSelection';

type Theme=PeekZone['theme'];
const OLD_THEMES:Record<string,Theme>={tactical:'facility',garage:'facility',long:'courtyard',site:'courtyard',mid:'urban',tower:'urban',multi:'research',bunny:'facility',wallbang:'research'};

/** Original, meter-scale architectural kit. Finishes stay against existing solids;
 * silhouette landmarks and roofs stay above the character/jump visibility band. */
export function tacticalArchitecture(map:string,obstacles:Obstacle[],g:(a:T.BufferGeometry)=>T.BufferGeometry,m:(a:T.Material)=>T.Material,texture:(a:T.Texture)=>T.Texture=a=>a,surfaceLibrary?:SurfaceMaterialLibrary,patterns:ArenaPatternPreferences=loadArenaPatterns()){
 const root=new T.Group();root.name='VALOPRAC original tactical architecture';
 const surfaces=surfaceLibrary??new SurfaceMaterialLibrary(),registered=new Set<T.Texture>();
 const surface=(id:VisualMaterialId,color:number,roughness?:number,pattern:ArenaPatternSpec={})=>{
  const value=surfaces.material(id,{tint:color,roughness,...pattern});
  // A supplied library owns its maps across preset changes. Register fallback
  // maps only, so renderer texture sets do not retain disposed historical maps.
  if(!surfaceLibrary)for(const map of [value.map,value.normalMap,value.roughnessMap])if(map&&!registered.has(map)){registered.add(map);texture(map);}
  return m(value);
 };
 const style=arenaPalette(map),course=courseFor(map);
 const materials=Object.fromEntries(Object.entries(BAY_APPEARANCE).map(([key,zone])=>{
  const colors=map==='complex'?zone:style;
  return [key,surface(colors.wallFamily,colors.coverPanel)];
 })) as Record<Theme,T.Material>;
 const metal=surface('painted-metal',style.trim),shadow=surface('composite',style.cover,.92),warm=surface('wood',style.accent),glass=surface('glass',0x7d9daa,.28),light=m(new T.MeshBasicMaterial({color:style.accent}));
 if(!surfaceLibrary)root.userData.disposeSurfaceMaterials=()=>surfaces.dispose();
 let detail=0,chunk='campus';
 const finishUV=(o:T.Mesh)=>{
  o.updateMatrix();const mat=Array.isArray(o.material)?o.material[0]:o.material,family=mat.userData.visualMaterialId as VisualMaterialId|undefined;
  writeWorldScaleUV(o.geometry,family?(mat.userData.surfaceMetersPerTile??VISUAL_MATERIALS[family].metersPerTile):1,o.matrix);
 };
 const mesh=(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number)=>{const o=new T.Mesh(g(geo),mat);o.position.set(x,y,z);o.castShadow=detail===0;o.receiveShadow=true;o.userData.artDetail=detail;o.userData.artChunk=chunk;finishUV(o);root.add(o);return o;};
 const block=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>mesh(new T.BoxGeometry(w,h,d),mat,x,y,z);
 const profile=(pts:[number,number][],depth:number,x:number,y:number,z:number,mat:T.Material,bevel=.012)=>{
  const shape=new T.Shape();pts.forEach(([px,py],i)=>i?shape.lineTo(px,py):shape.moveTo(px,py));shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.004,depth-bevel*2),bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1,curveSegments:1});geo.translate(0,0,-Math.max(.004,depth-bevel*2)/2);return mesh(geo,mat,x,y,z);
 };
 const themeAt=(x:number,z:number):Theme=>map==='complex'?(PEEK_ZONES.find(q=>Math.abs(q.center.x-x)<12.1&&Math.sign(q.center.z)===Math.sign(z))?.theme??'facility'):(course?.style??OLD_THEMES[map]??'facility');
 const doorway=(x:number,z:number,w:number,theme:Theme,openingHeight=3.2)=>{
  const color=materials[theme],post=theme==='courtyard'?.22:.15;
  for(const side of [-1,1]){
   profile([[-post,0],[post,0],[post,openingHeight-.48],[.04,openingHeight-.08],[-post,openingHeight+.06]],.2,x+side*(w/2+post-.015),0,z,color);
   block(.045,openingHeight-.15,.22,x+side*(w/2+.025),(openingHeight-.15)/2,z,metal);
   if(theme==='urban'||theme==='courtyard')block(post*2.5,.18,.31,x+side*(w/2+post),.1,z,shadow);
  }
  // A faceted, supported entablature replaces the old floating sign/crossbar.
  const crown: [number,number][]=theme==='urban'?[[-w/2-.36,0],[-w/2-.36,.18],[-w/2+.13,.6],[w/2-.13,.6],[w/2+.36,.18],[w/2+.36,0]]:[[-w/2-.32,0],[-w/2-.32,.25],[-w/2-.04,.47],[w/2+.04,.47],[w/2+.32,.25],[w/2+.32,0]];
  profile(crown,.3,x,openingHeight+.015,z,color);block(w+.28,.055,.34,x,openingHeight+.065,z,metal);
  if(theme==='research'){block(w+.45,.07,.38,x,openingHeight+.545,z,metal);block(w*.68,.035,.025,x,openingHeight+.415,z+.172,light);}
  if(theme==='courtyard'){block(w+.65,.17,.5,x,openingHeight+.575,z,warm);for(const dx of [-w*.32,w*.32])block(.12,.2,.6,x+dx,openingHeight+.735,z,shadow);}
  block(w+.3,.025,.78,x,.018,z,shadow);
 };
 for(const o of obstacles){
  const b=o.box,w=b.max.x-b.min.x,h=b.max.y-b.min.y,d=b.max.z-b.min.z,cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2,theme=themeAt(cx,cz);
  chunk=`solid-${Math.floor(cx/24)}-${Math.floor(cz/30)}`;detail=0;if(o.ramp)continue;
  if(o.kind==='cover'&&h<2.5&&w>.7&&d>.6&&w<8&&d<8){
   // Beveled composite front panels, corner guards, recessed foot and machined lid.
   for(const z of [b.min.z-.007,b.max.z+.007]){
    profile([[-w*.445,-h*.34],[w*.445,-h*.34],[w*.445,h*.15],[w*.33,h*.32],[-w*.33,h*.32],[-w*.445,h*.15]],.024,cx,b.min.y+h*.5,z,materials[theme]);
    block(w*.75,.035,.03,cx,b.min.y+.13,z,metal);for(const side of [-1,1])block(.055,h*.67,.035,cx+side*w*.39,b.min.y+h*.46,z,metal);
    detail=1;for(const dx of [-w*.24,w*.24])block(.065,.035,.04,cx+dx,b.min.y+h*.56,z,shadow);detail=0;
   }
   block(w*.96,.045,d*.96,cx,b.max.y-.025,cz,metal);continue;
  }
  if(h>3&&Math.max(w,d)>4){
   const alongX=w>d,length=Math.max(w,d),count=Math.min(10,Math.max(1,Math.floor(length/4)));
   for(let k=0;k<count;k++){
    const along=-length/2+(k+.5)*length/count;detail=1;
    if(alongX){for(const z of [b.min.z-.014,b.max.z+.014]){block(Math.min(2.7,length/count-.3),.52,.04,cx+along,b.max.y-.64,z,glass);block(.05,.58,.065,cx+along,b.max.y-.64,z,metal);}}
    else for(const x of [b.min.x-.014,b.max.x+.014]){block(.04,.52,Math.min(2.7,length/count-.3),x,b.max.y-.64,cz+along,glass);block(.065,.58,.05,x,b.max.y-.64,cz+along,metal);}
    detail=0;
   }
  }
 }
 if(map==='complex')for(const zone of PEEK_ZONES){
  const x=zone.center.x,sign=Math.sign(zone.center.z),theme=zone.theme,color=materials[theme];chunk=`zone-${zone.id}`;detail=0;
  const frontDoorX=x-6;
  const floorFamily=SURFACES[baseGroundSurface('complex',zone.center)].visualMaterialId;
  const floorTint=new T.Color(arenaPalette(map,theme).floor);
  const floor=surface(floorFamily,floorTint.getHex(),undefined,arenaPattern(map,true,patterns)),[floorX,floorZ,floorWidth,floorDepth]=zone.bounds??[x-12,Math.min(sign*8,sign*38),24,30];
  const finish=block(floorWidth,.004,floorDepth,floorX+floorWidth/2,.002,floorZ+floorDepth/2,floor);finish.userData.floorFinish={zoneId:zone.id,surfaceId:baseGroundSurface('complex',zone.center),visualMaterialId:floorFamily,bounds:[floorX,floorZ,floorWidth,floorDepth],top:.004};
  doorway(frontDoorX,sign*8,3,theme);doorway(zone.exit.x,sign*38,3,theme,zone.id==='F'?4.2:3.2);
  // The opaque plaque is physically supported by the crown, entirely above jump/head height.
  profile([[-2,-.45],[2,-.45],[2,.35],[1.88,.48],[-1.88,.48],[-2,.35]],.1,frontDoorX,4.1,sign*8,color);
  if(theme==='facility'||theme==='research')for(const p of [15,25,35]){
   profile([[-11.3,0],[-11.3,.18],[-9,.54],[9,.54],[11.3,.18],[11.3,0]],.2,x,5.65,sign*p,metal);
   for(const side of [-1,1])profile([[-.2,0],[.2,0],[.2,.6],[-.08,.9],[-.2,.9]],.5,x+side*11.1,4.75,sign*p,color);
   if(theme==='research')block(6,.035,.18,x+1,5.5,sign*p,light);
  }
  if(theme==='urban')for(const side of [-1,1]){
   profile([[-.42,0],[.42,0],[.34,.3],[-.34,.3]],29,x+side*11.45,5.6,sign*23,warm);
   detail=1;for(const p of [14,24,34]){block(.11,.8,2.1,x+side*11.38,4.95,sign*p,shadow);block(.13,.06,2.35,x+side*11.35,4.48,sign*p,warm);}detail=0;
  }
  if(theme==='courtyard'){
   for(const p of [14,34]){
    for(const side of [-1,1]){mesh(new T.CylinderGeometry(.18,.22,5.7,8),color,x+side*11.82,2.85,sign*p);block(.8,.15,.65,x+side*11.82,5.78,sign*p,warm);}
    profile([[-10.9,0],[-10.9,.15],[-8,.42],[8,.42],[10.9,.15],[10.9,0]],.25,x,5.86,sign*p,warm);
   }
   detail=1;for(const p of [15,18,21,24,27,30,33])block(21.6,.055,.08,x,6.1,sign*p,shadow);detail=0;
  }
  // Railing parts sit at the existing solid platform edge; no invisible new blocker.
  if(zone.vertical){const height=zone.vertical;for(let px=x+2;px<x+10;px+=1.8)block(.045,.85,.045,px,height+.45,sign*36.85,metal);block(8,.05,.045,x+6,height+.88,sign*36.85,metal);}
  for(const p of [10,12,14])block(.7,.008,.045,frontDoorX,.045,sign*p,warm);
 }else if(course){
  const p=levelFor(map)!.landmark!,x=p.x,z=p.z,cap=materials[course.style],radius=course.cell*.44;
  // All silhouette details sit on the six-metre solid landmark plinth. Their
  // footprint stays over the masonry, keeping traversal and head-height sightlines clear.
  const drum=(bottom:number,top:number,h:number,y:number,mat:T.Material,sides=12,dx=0,dz=0)=>
   mesh(new T.CylinderGeometry(top,bottom,h,sides),mat,x+dx,y+h/2,z+dz);
  const tier=(w:number,h:number,y:number,mat:T.Material)=>block(w,h,w,x,y+h/2,z,mat);
  const dish=(r:number,y:number,mat:T.Material)=>mesh(new T.SphereGeometry(r,20,8,0,Math.PI*2,0,Math.PI/2),mat,x,y,z);
  // Give the districts a readable roofline. Roofs sit on real building solids;
  // open lanes, cover tops, and playable balconies remain completely clear.
  for(const solid of obstacles){
   const {min,max}=solid.box;
   if(solid.kind!=='wall'||max.y!==4.8)continue;
   const cx=(min.x+max.x)/2,cz=(min.z+max.z)/2,w=max.x-min.x,d=max.z-min.z;
   chunk='course-roofs';
   switch(course.style){
    case 'courtyard': {
     const ridge=profile([[-d*.49,0],[-d*.49,.13],[0,1.05],[d*.49,.13],[d*.49,0]],w-.04,cx,4.8,cz,warm,.01);
     ridge.rotation.y=Math.PI/2;block(w,.1,.19,cx,5.86,cz,metal);break;
    }
    case 'urban':
     block(w,.27,.19,cx,4.935,min.z+.1,cap);block(w,.27,.19,cx,4.935,max.z-.1,cap);
     block(Math.min(2.2,w*.52),.84,d*.55,cx,5.22,cz,metal);
     block(Math.min(2.4,w*.6),.12,d*.59,cx,5.7,cz,warm);break;
    case 'facility':
     block(w,.14,d,cx,4.87,cz,metal);
     for(const dx of [-w*.21,w*.21]){
      mesh(new T.CylinderGeometry(.51,.61,.57,10),cap,cx+dx,5.21,cz);
      mesh(new T.CylinderGeometry(.62,.63,.12,10),shadow,cx+dx,5.55,cz);
     }break;
    case 'research':
     profile([[-w*.48,0],[-w*.42,.44],[w*.34,.44],[w*.48,0]],d*.82,cx,4.8,cz,metal);
     block(w*.48,.21,d*.33,cx,5.34,cz,glass);break;
   }
  }
  chunk='course-landmark';tier(course.cell,.16,6,metal);
  switch(course.landmark){
   case 'antenna':
    tier(radius*1.3,1.8,6.16,cap);drum(.16,.07,3.9,7.96,metal);
    for(const y of [8.7,9.6,10.5])block(2.3,.08,.08,x,y,z,metal);break;
   case 'cistern':
    drum(radius,radius,2.1,6.16,cap);for(const y of [6.4,7.8])drum(radius+.06,radius+.06,.12,y,metal);
    drum(radius,.3,.64,8.26,warm);break;
   case 'pagoda':
    for(let i=0;i<3;i++){const w=radius*(1-i*.19),y=6.16+i*1.14;tier(w*1.05,.55,y,warm);drum(w*1.37,w*.42,.59,y+.55,cap,4).rotation.y=Math.PI/4;}
    drum(.1,.015,.85,9.58,metal);break;
   case 'campanile':
    tier(radius*1.24,2.4,6.16,cap);
    for(const dx of [-.75,.75])for(const dz of [-.75,.75])block(.22,1.1,.22,x+dx,9.11,z+dz,metal);
    drum(radius,0,1.45,9.66,warm,4).rotation.y=Math.PI/4;break;
   case 'gantry':
    for(const dx of [-radius*.8,radius*.8])block(.35,3.4,.5,x+dx,7.86,z,metal);
    block(radius*2,.46,.62,x,9.79,z,warm);block(.16,1.65,.16,x+.6,8.75,z,metal);break;
   case 'windmill':
    drum(radius*.62,radius*.35,2.8,6.16,cap,8);
    for(let i=0;i<4;i++){const a=.38+i*Math.PI/2;block(.28,radius*.82,.12,x-Math.sin(a)*radius*.48,8.65+Math.cos(a)*radius*.48,z+radius*.37,warm).rotation.z=a;}
    break;
   case 'reactor':
    drum(radius*.85,radius*.66,2.6,6.16,cap);for(const y of [6.45,7.35,8.25])drum(radius*.84,radius*.84,.13,y,metal);
    drum(radius*.5,radius*.35,.62,8.76,light);break;
   case 'dome':
    drum(radius,radius,.43,6.16,metal);dish(radius,6.59,cap);drum(.09,.03,.5,6.59+radius,metal);break;
   case 'lotus':
    drum(radius*.7,radius*.89,.55,6.16,cap,8);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,petal=mesh(new T.SphereGeometry(.58,8,6),warm,x+Math.sin(a)*radius*.43,7.2,z+Math.cos(a)*radius*.43);petal.scale.set(.55,1.7,.65);petal.rotation.set(.48*Math.cos(a),0,-.48*Math.sin(a));}
    break;
   case 'marquee':
    for(const dx of [-1.15,1.15])block(.16,2.4,.16,x+dx,7.36,z,metal);
    profile([[-1.85,0],[1.52,0],[1.85,.9],[-1.42,1.25]],.3,x,7.85,z,cap);
    block(2.5,.09,.34,x,8.28,z,warm);break;
   case 'beacon':
    drum(radius*.62,radius*.4,2.8,6.16,metal,6);drum(radius*.45,radius*.45,.9,8.96,light,6);
    drum(radius*.62,.12,.45,9.86,cap,6);break;
   case 'chimneys':
    for(const [dx,h] of [[-1,3.8],[.4,2.85],[1.25,2.2]]){drum(.4,.3,h,6.16,cap,10,dx);drum(.38,.38,.16,6.16+h,metal,10,dx);}break;
   case 'radar':
    drum(radius*.52,.38,1.65,6.16,metal);dish(radius*.87,7.81,cap);
    for(const y of [7.81,7.99])drum(radius*.91,radius*.91,.07,y,metal);break;
  }
 }else if(map==='bunny'){
  chunk='movement-gallery';detail=0;
  const lane=surface('painted-concrete',0x668c92,.9),landing=surface('painted-concrete',0xb09b72,.91);
  // A coherent long-span hall with structural ribs, inset services and floor
  // wayfinding. Supports remain within the boundary walls; no new combat cover.
  for(const z of [4,-6,-16,-26,-36,-43]){
   for(const side of [-1,1])block(.22,5.4,.32,side*12.15,2.7,z,metal);
   profile([[-12.2,0],[-12.2,.18],[-9.4,.52],[9.4,.52],[12.2,.18],[12.2,0]],.28,0,5.55,z,metal);
   block(7.4,.03,.18,0,5.48,z,light);
  }
  for(const x of [-5.6,4.6,10.2])block(.045,.008,48,x,.008,-18,lane);
  for(let z=3;z>=-41;z-=4){
   block(.65,.008,.045,-5,.012,z,lane);
   profile([[-.28,-.12],[.28,-.12],[0,.3]],.006,-5,.014,z,lane).rotation.x=-Math.PI/2;
  }
  for(const solid of BUNNY_LEVEL.obstacles){
   if(solid.kind!=='cover'||solid.ramp)continue;const b=solid.box;
   if(b.min.x===-2.8){block(5.1,.008,.055,0,b.max.y+.006,b.min.z+.07,landing);block(5.1,.008,.055,0,b.max.y+.006,b.max.z-.07,landing);}
  }
  // Narrow service bands sit inside the existing side wall volume. Their
  // contrast stays above the typical head-height band used by jump peeking.
  detail=1;for(const side of [-1,1])for(const z of [-4,-14,-24,-34]){
   block(.025,.5,3.6,side*12.005,4.32,z,glass);block(.03,.04,4,side*12.006,3.99,z,metal);
  }detail=0;
  root.userData.mechanicLayout='manual-movement-connected-gallery';
 }else if(map==='wallbang'){
  chunk='ballistics-gallery';detail=0;
  const floorMark=surface('painted-concrete',0x718c92,.94);
  // Material bays share one architectural language. Their sample surfaces are
  // left visibly distinct: trim follows the entry wall, not the shootable panel.
  for(const sample of WALLBANG_SAMPLES){
   const x=sample.centerX;doorway(x,0,2.8,'research',3.25);
   block(8.8,.008,.035,x,.008,3,floorMark);
   for(const z of [-3,-6,-10,-14,-18])block(.045,.008,.5,x+3,.008,z,floorMark);
   for(const z of [-4,-12,-20]){
    profile([[-4.7,0],[-4.7,.12],[-3,.4],[3,.4],[4.7,.12],[4.7,0]],.2,x,5.5,z,metal);
    block(4.5,.025,.15,x,5.42,z,light);
   }
   // Recessed back-wall layers frame targets without intersecting their head
   // silhouettes or supplying non-colliding apparent cover beside a sample.
   block(9.5,.09,.025,x,4.8,-20.986,metal);
   detail=1;block(5.4,.5,.015,x,4.27,-20.99,glass);detail=0;
  }
  root.userData.mechanicLayout='material-thickness-angle-bays';
 }else{
  const spec=LEVEL_SPECS[map as keyof typeof LEVEL_SPECS],theme=OLD_THEMES[map]??'facility';
  if(spec)for(let i=0;i<3;i++){
   chunk=`legacy-${i}`;doorway(i*spec.width,0,map==='garage'?1.9:2.5,theme,5.8);
   // A ceiling service spine / stone arcade distinguishes the existing maps too.
   for(const z of [-4,-9,-14].filter(z=>z>-spec.depth+1)){
    profile([[-spec.width/2+.3,0],[-spec.width/2+.3,.15],[-spec.width*.25,.4],[spec.width*.25,.4],[spec.width/2-.3,.15],[spec.width/2-.3,0]],.23,i*spec.width,5.55,z,theme==='courtyard'?warm:metal);
    if(theme==='research'||theme==='facility')block(spec.width*.5,.035,.16,i*spec.width,5.42,z,light);
   }
  }
 }
 root.updateMatrixWorld(true);const sourceMeshes=root.children.length;
 const batches=new Map<string,{material:T.Material;meshes:T.Mesh[];detail:number;chunk:string}>(),batchMaterials=new Map<string,T.Material>();
 const materialKey=(mat:T.Material)=>{const standard=mat as T.MeshStandardMaterial;return JSON.stringify([mat.type,standard.roughness,standard.metalness,standard.map?.uuid,standard.normalMap?.uuid,standard.normalScale?.toArray(),standard.emissive?.getHex(),standard.emissiveIntensity,mat.transparent,mat.opacity,mat.side,mat.depthWrite,mat.depthTest,mat.polygonOffset,mat.polygonOffsetFactor,mat.polygonOffsetUnits]);};
 for(const child of root.children)if(child instanceof T.Mesh&&!Array.isArray(child.material)){
  // Palette tints become constant linear vertex colors. Materials with identical
  // PBR/texture state can then share a draw while retaining every authored color.
  // Essential surfaces share a campus batch; optional upper finishes keep32m
  // spatial cells and their existing distance/preset visibility rules.
  const signature=materialKey(child.material),cell=child.userData.artDetail===0?'campus':`cell-${Math.floor(child.position.x/32)}-${Math.floor(child.position.z/32)}`;
  let material=batchMaterials.get(signature);
  if(!material){
   const original=child.material as T.MeshStandardMaterial,family=original.userData.visualMaterialId as VisualMaterialId|undefined;
   if(family)material=m(surfaces.material(family,{tint:0xffffff,vertexColors:true,roughness:original.roughness,metalness:original.metalness,normalStrength:original.normalScale.x,surfacePattern:original.userData.surfacePattern,metersPerTile:original.userData.surfaceMetersPerTile}));
   else {const cloned=child.material.clone() as T.MeshStandardMaterial;cloned.color.setHex(0xffffff);cloned.vertexColors=true;material=m(cloned);}
   batchMaterials.set(signature,material);
  }
  const key=`${cell}:${child.userData.artDetail}:${signature}`;const batch=batches.get(key)??{material,meshes:[] as T.Mesh[],detail:child.userData.artDetail,chunk:cell};batch.meshes.push(child);batches.set(key,batch);
 }
 for(const batch of batches.values()){
  const merged=mergeStaticArchitecture(batch.meshes,'world',true);if(!merged)continue;
  const o=new T.Mesh(g(merged),batch.material);o.castShadow=batch.detail===0;o.receiveShadow=true;o.name=`${batch.chunk} architecture`;o.userData.artDetail=batch.detail;
  const floors=batch.meshes.filter(mesh=>mesh.userData.floorFinish).map(mesh=>mesh.userData.floorFinish);if(floors.length)o.userData.floorFinishes=floors;
  merged.computeBoundingSphere();
  for(const old of batch.meshes){root.remove(old);old.geometry.dispose();}root.add(o);
 }
 root.userData.themeCount=map==='complex'?4:1;root.userData.meterScaledUVs=true;root.userData.collisionUnchanged=true;
 root.userData.batching={sourceMeshes,batches:root.children.length,palettePreserved:true,optionalCellMeters:32};
 return root;
}

/** Decorative upper details have a bounded cost; essential cover/portals remain
 * present at every preset. Distance culling only affects finishes above combat. */
export function updateTacticalArchitecture(root:T.Group,position:T.Vector3,quality:Quality){
 const maxDistance=quality==='ultra'?110:quality==='high'?85:65,maxSq=maxDistance*maxDistance;
 for(const child of root.children){if(!(child instanceof T.Mesh)||child.userData.artDetail!==1)continue;const sphere=child.geometry.boundingSphere;child.visible=quality!=='low'&&(!sphere||sphere.center.distanceToSquared(position)<=maxSq);}
}
