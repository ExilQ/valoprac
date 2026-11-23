import {LEVEL_SPECS} from '../../config/tactical';
import * as T from 'three';
import {mergeStaticArchitecture} from './StaticGeometry';
import type {Obstacle} from '../collision/environment';
import type {Quality} from '../types';
import {PEEK_ZONES,type PeekZone} from '../tactical/complex';
import {BUNNY_LEVEL,WALLBANG_SAMPLES} from '../tactical/mechanics';

type Theme=PeekZone['theme'];
const THEME_COLORS:Record<Theme,number>={facility:0xa8b3ad,research:0xc7cec8,urban:0xa99e89,courtyard:0xb7aa89};
const OLD_THEMES:Record<string,Theme>={tactical:'facility',garage:'facility',long:'courtyard',site:'courtyard',mid:'urban',tower:'urban',multi:'research',bunny:'facility',wallbang:'research'};

/** Original, meter-scale architectural kit. Finishes stay against existing solids;
 * silhouette landmarks and roofs stay above the character/jump visibility band. */
export function tacticalArchitecture(map:string,obstacles:Obstacle[],g:(a:T.BufferGeometry)=>T.BufferGeometry,m:(a:T.Material)=>T.Material,texture:(a:T.Texture)=>T.Texture=a=>a){
 const root=new T.Group();root.name='VALOPRAC original tactical architecture';
 const n=64,colorData=new Uint8Array(n*n*4),normalData=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=(y*n+x)*4,grain=((x*31+y*17+x*y*3)%13)-6,broad=Math.sin(x*.29)*Math.cos(y*.21)*2;
  const c=242+grain*.6+broad;colorData[i]=colorData[i+1]=colorData[i+2]=c;colorData[i+3]=255;
  normalData[i]=128+grain*.45;normalData[i+1]=128-grain*.4;normalData[i+2]=255;normalData[i+3]=255;
 }
 const dataTexture=(bytes:Uint8Array,colorSpace:T.ColorSpace)=>{const t=new T.DataTexture(bytes,n,n);t.colorSpace=colorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return texture(t);};
 const stoneMap=dataTexture(colorData,T.SRGBColorSpace),stoneNormal=dataTexture(normalData,T.NoColorSpace);
 const materials=Object.fromEntries(Object.entries(THEME_COLORS).map(([key,color])=>[key,m(new T.MeshStandardMaterial({color,roughness:.87,metalness:.025,map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.085,.085)}))])) as Record<Theme,T.Material>;
 const metal=m(new T.MeshStandardMaterial({color:0x40545c,roughness:.57,metalness:.47})),shadow=m(new T.MeshStandardMaterial({color:0x4c656b,roughness:.92})),warm=m(new T.MeshStandardMaterial({color:0x9b8463,roughness:.82,metalness:.08})),glass=m(new T.MeshStandardMaterial({color:0x6c8b90,roughness:.4,metalness:.18})),light=m(new T.MeshBasicMaterial({color:0xd8e4db}));
 let detail=0,chunk='campus';
 const finishUV=(o:T.Mesh)=>{
  o.updateMatrix();const p=o.geometry.getAttribute('position'),normal=o.geometry.getAttribute('normal');if(!normal)return;
  const uv=new Float32Array(p.count*2),point=new T.Vector3(),dir=new T.Vector3(),nm=new T.Matrix3().getNormalMatrix(o.matrix);
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i).applyMatrix4(o.matrix);dir.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();
   if(Math.abs(dir.y)>.65){uv[i*2]=point.x*.5;uv[i*2+1]=point.z*.5;}
   else if(Math.abs(dir.x)>.65){uv[i*2]=point.z*.5;uv[i*2+1]=point.y*.5;}
   else{uv[i*2]=point.x*.5;uv[i*2+1]=point.y*.5;}
  }
  o.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
 };
 const mesh=(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number)=>{const o=new T.Mesh(g(geo),mat);o.position.set(x,y,z);o.castShadow=detail===0;o.receiveShadow=true;o.userData.artDetail=detail;o.userData.artChunk=chunk;finishUV(o);root.add(o);return o;};
 const block=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>mesh(new T.BoxGeometry(w,h,d),mat,x,y,z);
 const profile=(pts:[number,number][],depth:number,x:number,y:number,z:number,mat:T.Material,bevel=.012)=>{
  const shape=new T.Shape();pts.forEach(([px,py],i)=>i?shape.lineTo(px,py):shape.moveTo(px,py));shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.004,depth-bevel*2),bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1,curveSegments:1});geo.translate(0,0,-Math.max(.004,depth-bevel*2)/2);return mesh(geo,mat,x,y,z);
 };
 const themeAt=(x:number,z:number):Theme=>map==='complex'?(PEEK_ZONES.find(q=>Math.abs(q.center.x-x)<12.1&&Math.sign(q.center.z)===Math.sign(z))?.theme??'facility'):(OLD_THEMES[map]??'facility');
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
  block(23,.022,29,x,.018,sign*23,color);doorway(frontDoorX,sign*8,3,theme);doorway(zone.exit.x,sign*38,3,theme,zone.id==='F'?4.2:3.2);
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
 }else if(map==='bunny'){
  chunk='movement-gallery';detail=0;
  const lane=m(new T.MeshStandardMaterial({color:0x668c92,roughness:.9})),landing=m(new T.MeshStandardMaterial({color:0xb09b72,roughness:.91}));
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
  const floorMark=m(new T.MeshStandardMaterial({color:0x718c92,roughness:.94}));
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
  }else for(const o of obstacles){const b=o.box,w=b.max.x-b.min.x,d=b.max.z-b.min.z;if(o.kind==='wall'&&w>2){chunk=`legacy-${Math.floor(b.min.z/16)}`;block(w,.14,d,(b.min.x+b.max.x)/2,b.max.y-.15,(b.min.z+b.max.z)/2,metal);}}
 }
 root.updateMatrixWorld(true);const batches=new Map<string,{material:T.Material;meshes:T.Mesh[];detail:number;chunk:string}>();
 for(const child of root.children)if(child instanceof T.Mesh&&!Array.isArray(child.material)){
  const key=`${child.userData.artChunk}:${child.userData.artDetail}:${child.material.uuid}`;const batch=batches.get(key)??{material:child.material,meshes:[] as T.Mesh[],detail:child.userData.artDetail,chunk:child.userData.artChunk};batch.meshes.push(child);batches.set(key,batch);
 }
 for(const batch of batches.values()){
  const merged=mergeStaticArchitecture(batch.meshes);if(!merged)continue;
  const o=new T.Mesh(g(merged),batch.material);o.castShadow=batch.detail===0;o.receiveShadow=true;o.name=`${batch.chunk} architecture`;o.userData.artDetail=batch.detail;merged.computeBoundingSphere();
  for(const old of batch.meshes){root.remove(old);old.geometry.dispose();}root.add(o);
 }
 root.userData.themeCount=map==='complex'?4:1;root.userData.meterScaledUVs=true;root.userData.collisionUnchanged=true;
 return root;
}

/** Decorative upper details have a bounded cost; essential cover/portals remain
 * present at every preset. Distance culling only affects finishes above combat. */
export function updateTacticalArchitecture(root:T.Group,position:T.Vector3,quality:Quality){
 const maxDistance=quality==='ultra'?110:quality==='high'?85:65,maxSq=maxDistance*maxDistance;
 for(const child of root.children){if(!(child instanceof T.Mesh)||child.userData.artDetail!==1)continue;const sphere=child.geometry.boundingSphere;child.visible=quality!=='low'&&(!sphere||sphere.center.distanceToSquared(position)<=maxSq);}
}
