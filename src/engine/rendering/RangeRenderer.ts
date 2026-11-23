import {defenderWeaponGeometry} from './DefenderWeaponGeometry';
import {tacticalArchitecture,updateTacticalArchitecture} from './TacticalArchitecture';
import {PEEK_ZONES,zoneForScenario} from '../tactical/complex';
import {characterPartGeometry} from './CharacterGeometry';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {surfaceHeight} from '../collision/environment';
import {VIEWMODEL_HFOV,poseViewmodel} from './viewmodel';
import * as THREE from 'three';
import type { Simulation } from '../simulation/Simulation';
import type { Settings, ShotEvent, WeaponId } from '../types';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { WEAPON_ORDER } from '../../config/weapons';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeStaticArchitecture} from './StaticGeometry';
import { createWeaponView, type WeaponVisual } from './WeaponView';
const DEG=Math.PI/180;
interface Impact {mesh:THREE.Mesh;shot:ShotEvent|null}
export class RangeRenderer {
  renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(75,1,0.05,180);
  private weaponScene=new THREE.Scene();private weaponCamera=new THREE.PerspectiveCamera(55,1,.03,4);
  private size=new THREE.Vector3();private color=new THREE.Color();private position=new THREE.Vector3();
  private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();private textures=new Set<THREE.Texture>();
  private architecture:THREE.Group|null=null;private defenderWeapons=new Map<WeaponId,THREE.InstancedMesh>();private heldMatrix=new THREE.Matrix4();private heldPose=new THREE.Object3D();
  private targetBatches:THREE.InstancedMesh[]=[];private targetMeshes:THREE.Mesh[][]=[];private targetMatrices:THREE.Matrix4[][]=[];private renderedTargetPositions:THREE.Vector3[]=[];private targetRings:THREE.Mesh[]=[];private impacts:Impact[]=[];private impactIndex=0;
  private tracers:THREE.Line[]=[];private tracerIndex=0;private weapon=new THREE.Group();private muzzle!:THREE.Mesh;
  private lastRenderedShot=-1;private lastShotAt=-100;private previousViewYaw=0;private previousViewPitch=0;
  private environmentTarget:THREE.WebGLRenderTarget|null=null;private sparks:{mesh:THREE.Mesh;velocity:THREE.Vector3;until:number}[]=[];private sparkIndex=0;
  private visuals={} as Record<WeaponId,WeaponVisual>;private sun!:THREE.DirectionalLight;private composer:EffectComposer|null=null;private bloom:UnrealBloomPass|null=null;private ao:SSAOPass|null=null;private fxaa:ShaderPass|null=null;private adsBlend=0;private settingsKey='';
  private surfaceMaterials:THREE.MeshStandardMaterial[]=[];private surfaceTextures=new Map<string,THREE.DataTexture>();
  private shells:{mesh:THREE.Mesh;velocity:THREE.Vector3;until:number}[]=[];private shellIndex=0;
  private gunSlide=0;private observer:ResizeObserver;private mounted=true;
  constructor(private host:HTMLElement,public simulation:Simulation,private settings:Settings){
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
    this.renderer.info.autoReset=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.setClearColor(0x9aafb3);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)*settings.renderScale);
    simulation.renderedTargets.attach();this.renderer.domElement.setAttribute('aria-label','전술 사격 훈련장');host.appendChild(this.renderer.domElement);
    const probe=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.environmentTarget=pmrem.fromScene(probe,0.04);this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=0.38;probe.dispose();pmrem.dispose();
    this.scene.fog=new THREE.Fog(0x9aafb3,38,110);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xe2edf0,0x9a9184,1.85));
    const sun=this.sun=new THREE.DirectionalLight(0xffeedb,2.5);sun.position.set(-8,14,8);sun.target.position.set(0,0,-16);this.scene.add(sun,sun.target);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.bias=-0.00025;sun.shadow.normalBias=0.025;sun.shadow.radius=2;
    const fill=new THREE.DirectionalLight(0xb8d8e5,.8);fill.position.set(4,5,-18);this.scene.add(fill);
    this.buildEnvironment();this.buildTargets();this.buildDefenderWeapons();this.buildWeapon();this.buildImpacts();this.buildShells();this.buildPolish();this.batchStaticArchitecture();this.applySettings(settings);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  }
  get canvas(){return this.renderer.domElement;}
  private material(color:number,roughness=0.8){const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0.12});this.materials.add(m);return m;}
  private box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material){const r=Math.min(.035,Math.min(w,h,d)*.12),g=Math.min(w,h,d)>.09?new RoundedBoxGeometry(w,h,d,1,r):new THREE.BoxGeometry(w,h,d);this.geometries.add(g);const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.staticRange=true;this.scene.add(m);return m;}
  private buildEnvironment(){
    if(this.simulation.practiceMap!=='range'){this.buildTactical();return;}

    const floor=this.material(0x89958f,.94),trim=this.material(0x3e535b,.7),metal=this.material(0x667b80,.55),accent=this.material(0xbcb18b,.85);
    this.box(24,0.15,40,0,-0.09,-10,floor);
    // Broad expansion seams give depth without high-frequency combat clutter.
    const seam=this.material(0x76857f,.95);for(let z=5;z>-30;z-=5)this.box(23.9,.006,.024,0,.004,z,seam);
    for(const o of this.simulation.obstacles){o.box.getSize(this.size);o.box.getCenter(this.position);this.box(this.size.x,this.size.y,this.size.z,this.position.x,this.position.y,this.position.z,this.archMaterial(o.kind==='cover'?'rangeCover':'rangePlaster',o.kind==='cover'?0x668183:0xc1beb0,.88));this.refineObstacle(o);}
    for(let z=6;z>-30;z-=6){this.box(0.12,5,0.3,-11.94,2.5,z,metal);this.box(0.12,5,0.3,11.94,2.5,z,metal);this.box(24,0.22,0.3,0,5,z,trim);}
    for(let x=-10;x<=10;x+=5){this.box(0.06,0.015,35,x,0.013,-10,metal);}
    this.box(21,0.08,0.06,0,0.014,0,accent);this.box(0.06,0.015,28,0,0.013,-14,accent);
    this.box(18,3.9,0.08,0,2,-29.94,this.material(0x728780,.92));
    const points:THREE.Vector3[]=[];for(let x=-9;x<=9;x+=0.5){points.push(new THREE.Vector3(x,0.1,-29.885),new THREE.Vector3(x,3.9,-29.885));}for(let y=0.1;y<=3.9;y+=0.5){points.push(new THREE.Vector3(-9,y,-29.885),new THREE.Vector3(9,y,-29.885));}
    const geometry=new THREE.BufferGeometry().setFromPoints(points);this.geometries.add(geometry);const mat=new THREE.LineBasicMaterial({color:0x607c78,transparent:true,opacity:0.35});this.materials.add(mat);this.scene.add(new THREE.LineSegments(geometry,mat));
    for(const radius of [0.07,0.3,0.65,1.1]){const g=new THREE.RingGeometry(radius-0.009,radius,64);this.geometries.add(g);const m=new THREE.MeshBasicMaterial({color:0x9bcab6,side:THREE.DoubleSide});this.materials.add(m);const ring=new THREE.Mesh(g,m);ring.position.set(0,1.64,-29.87);this.scene.add(ring);}
    this.addSign('01',-10,3.4,-29.82,1.2);this.addSign('머리만 유효',0,4.5,-29.82,2.6);
    for(const [label,z] of [['10 미터',-5],['20 미터',-15],['30 미터',-25]] as const)this.addSign(label,-10.7,0.025,z,1.6,true);
    // Simple faux skylight strips use emissive materials with no dynamic shadow cost.
    const light=new THREE.MeshBasicMaterial({color:0xcde7df});this.materials.add(light);
    for(let z=3;z>-29;z-=6){this.box(3,0.04,0.25,-6,4.85,z,light);this.box(3,0.04,0.25,6,4.85,z,light);}
  }
  private addSign(text:string,x:number,y:number,z:number,width:number,floor=false,reverse=false){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.fillStyle='#e3e5d9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 48px sans-serif';ctx.fillText(text,256,64);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.textures.add(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});this.materials.add(material);const g=new THREE.PlaneGeometry(width,width/4);this.geometries.add(g);const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);if(floor)mesh.rotation.x=-Math.PI/2;else if(reverse)mesh.rotation.y=Math.PI;this.scene.add(mesh);
  }
  private buildTargets(){
    // The same authoritative articulated nodes animate both collision and visual
    // parts. Independent authored geometry replaces hitbox-shaped mannequins.
    const colors=[0xffffff,0xffffff,0xffffff,0xffffff];
    const materials=colors.map(()=>{const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.77,metalness:.06});this.materials.add(m);return m;});
    const count=this.simulation.targets.length;
    for(let j=0;j<11;j++){const g=characterPartGeometry(j);this.geometries.add(g);const material=materials[j===0?0:j<3?1:j<7?2:3];const batch=new THREE.InstancedMesh(g,material,count);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;this.targetBatches.push(batch);this.scene.add(batch);}
    for(let i=0;i<count;i++){const target=this.simulation.targets[i],meshes:THREE.Mesh[]=[];for(let j=0;j<target.parts.length;j++){const batch=this.targetBatches[j],m=new THREE.Mesh(batch.geometry,batch.material);m.matrixAutoUpdate=false;m.userData.batch=batch;m.userData.slot=i;meshes.push(m);}this.targetMeshes.push(meshes);this.targetMatrices.push(meshes.map(mesh=>mesh.matrix));this.renderedTargetPositions.push(new THREE.Vector3());
      const g=new THREE.RingGeometry(.45,.46,32);this.geometries.add(g);const mat=new THREE.MeshBasicMaterial({color:0x9aa8a5,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});this.materials.add(mat);const ring=new THREE.Mesh(g,mat);ring.rotation.x=-Math.PI/2;this.scene.add(ring);this.targetRings.push(ring);
    }
  }
  private buildDefenderWeapons(){
    if(!this.simulation.defenders)return;
    const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.65,metalness:.42});this.materials.add(material);
    for(const id of WEAPON_ORDER){const geometry=defenderWeaponGeometry(id);this.geometries.add(geometry);const batch=new THREE.InstancedMesh(geometry,material,this.simulation.targets.length);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;batch.name=`${id} defender equipment`;this.scene.add(batch);this.defenderWeapons.set(id,batch);}
  }
  private updateDefenderWeapons(alpha:number){
    const ai=this.simulation.defenders;if(!ai)return;
    for(const [id,batch] of this.defenderWeapons){
      let equipped=0;
      for(const t of this.simulation.targets){const memory=ai.memories[t.id];
        if(!memory||memory.weapon!==id||!t.enabled||!t.active){this.heldMatrix.makeScale(0,0,0);batch.setMatrixAt(t.id,this.heldMatrix);continue;}
        equipped++;
        const pose=(memory as {pose?:number}).pose??.35;this.heldPose.position.set(.13,.9+.37*pose,.1+.35*pose);this.heldPose.rotation.set((1-pose)*.75,0,0);this.heldPose.scale.setScalar(1);this.heldPose.updateMatrix();
        this.heldMatrix.multiplyMatrices(t.root.matrixWorld,this.heldPose.matrix);this.heldMatrix.elements[12]+=(t.previous.x-t.position.x)*(1-alpha);this.heldMatrix.elements[14]+=(t.previous.z-t.position.z)*(1-alpha);batch.setMatrixAt(t.id,this.heldMatrix);
      }
      batch.visible=equipped>0;batch.instanceMatrix.needsUpdate=true;batch.castShadow=this.settings.shadowQuality!=='off';
    }
  }
  private buildWeapon(){
    this.weaponCamera.add(this.weapon);this.weaponScene.add(this.weaponCamera);this.weaponScene.environment=this.scene.environment;this.weaponScene.environmentIntensity=.8;this.weaponScene.add(new THREE.HemisphereLight(0xddefff,0x506565,2.4));const light=new THREE.DirectionalLight(0xffead4,3);light.position.set(-3,5,4);this.weaponScene.add(light);
    for(const id of WEAPON_ORDER){const v=createWeaponView(id,g=>{this.geometries.add(g);return g;},m=>{this.materials.add(m);return m;});this.visuals[id]=v;this.weapon.add(v.root);}
  }
  private buildShells(){
    const g=new THREE.CylinderGeometry(0.008,0.008,0.03,6);this.geometries.add(g);const m=this.material(0xa58e52,0.28);
    for(let i=0;i<24;i++){const mesh=new THREE.Mesh(g,m);mesh.visible=false;this.scene.add(mesh);this.shells.push({mesh,velocity:new THREE.Vector3(),until:0});}
    const particleGeometry=new THREE.SphereGeometry(0.012,4,3);this.geometries.add(particleGeometry);const particleMaterial=new THREE.MeshBasicMaterial({color:0xffd7a4});this.materials.add(particleMaterial);
    for(let i=0;i<32;i++){const mesh=new THREE.Mesh(particleGeometry,particleMaterial);mesh.visible=false;this.scene.add(mesh);this.sparks.push({mesh,velocity:new THREE.Vector3(),until:0});}
  }
  clearImpacts(){for(const entry of this.impacts){entry.shot=null;entry.mesh.visible=false;}for(const tracer of this.tracers)tracer.visible=false;}
  private surfaceTexture(kind:string){
    const key=kind+this.settings.textureQuality;const existing=this.surfaceTextures.get(key);if(existing)return existing;
    const n={low:32,medium:64,high:128,ultra:256}[this.settings.textureQuality],data=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4;const grain=((x*17+y*43+x*y*3)%13)-6;const line=kind==='rubber'&&(x%16===0||y%16===0)?-25:0;const c=220+grain+line;if(kind.endsWith('normal')){data[i]=128+grain;data[i+1]=128-grain;data[i+2]=255;}else data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;}
    const t=new THREE.DataTexture(data,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='rubber'?12:5,kind==='rubber'?20:5);t.colorSpace=kind.endsWith('normal')?THREE.NoColorSpace:THREE.SRGBColorSpace;t.needsUpdate=true;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.add(t);this.surfaceTextures.set(key,t);return t;
  }
  private tacticalSurface(o:import('../collision/environment').Obstacle){
    const b=o.box,x=(b.min.x+b.max.x)/2,z=(b.min.z+b.max.z)/2;
    const theme=this.simulation.practiceMap==='complex'?PEEK_ZONES.find(q=>Math.abs(q.center.x-x)<12.1&&Math.sign(q.center.z)===Math.sign(z))?.theme:undefined;
    const palette={facility:[0xa8b8b5,0x607c7c],research:[0xb8c7cc,0x607b8a],urban:[0xb5a38e,0x837b6e],courtyard:[0xc5b28e,0x8e967b]} as const;
    if(theme)return this.archMaterial(`${theme}-${o.kind}`,palette[theme][o.kind==='cover'?1:0],.9);
    return this.archMaterial(o.kind==='cover'?'tacticalCover':'tacticalPlaster',o.kind==='cover'?0x718e8b:(this.simulation.practiceMap==='garage'||this.simulation.practiceMap==='tower'?0xadb6b0:0xc6bfae),.9);
  }
  private buildTactical(){
    const trim=this.material(0x52666c,.68),floor=this.material(0x89968e,.96),light=new THREE.MeshBasicMaterial({color:0xc3c4b3});this.materials.add(light);
    const b=this.simulation.level?.bounds??[-24,-24,48,48];this.box(b[2],.15,b[3],b[0]+b[2]/2,-.09,b[1]+b[3]/2,floor);
    for(const o of this.simulation.obstacles){o.box.getSize(this.size);o.box.getCenter(this.position);this.box(this.size.x,this.size.y,this.size.z,this.position.x,this.position.y,this.position.z,this.tacticalSurface(o));if(o.ramp){const mesh=this.scene.children[this.scene.children.length-1] as THREE.Mesh,b=o.box;this.geometries.delete(mesh.geometry);mesh.geometry.dispose();const pts=[new THREE.Vector3(b.min.x,b.min.y,b.min.z),new THREE.Vector3(b.max.x,b.min.y,b.min.z),new THREE.Vector3(b.max.x,b.min.y,b.max.z),new THREE.Vector3(b.min.x,b.min.y,b.max.z)];for(let i=0;i<4;i++)pts.push(new THREE.Vector3(pts[i].x,surfaceHeight(o,pts[i].x,pts[i].z),pts[i].z));const faces=[4,6,5,4,7,6,0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0],positions=faces.flatMap(i=>pts[i].toArray());const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();this.geometries.add(g);mesh.geometry=g;mesh.position.set(0,0,0);continue;}this.box(this.size.x,.08,this.size.z,this.position.x,o.box.max.y-.08,this.position.z,trim);this.refineObstacle(o);}
    for(const x of [-17,-7,7,17])for(const z of [-17,-3,12,19])this.box(1.5,.015,.06,x,.015,z,light);
    if(this.simulation.level&&this.simulation.practiceMap!=='complex'){const l=this.simulation.level;this.addSign(l.title,l.spawn.x+2,.025,l.spawn.z,3,true);for(let i=0;i<l.angles.length;i++){const a=l.angles[i];this.addSign(a.label,l.route[i*3+2].x,3,-.38,3);const x=l.route[i*3+2].x;this.addSign(`${i+1} →`,x,.025,5,1.5,true);this.box(2.9,.08,.08,x,4.8,-.5,light);this.box(.06,4.6,.09,x-1.5,2.3,-.5,trim);this.box(.06,4.6,.09,x+1.5,2.3,-.5,trim);for(let z=-4;z>l.angles[i].position.z;z-=5)this.box(2,.04,.15,x,5.2,z,light);}}else if(this.simulation.practiceMap!=='complex')this.addSign('코너 피킹 · 발소리 훈련장',-7,.025,16,4,true);
    if(this.simulation.practiceMap==='complex'){for(const zone of PEEK_ZONES){this.addSign(`${zone.id} / ${zone.name}`,zone.center.x-6,4.1,Math.sign(zone.center.z)*7.93,3.6,false,zone.center.z>0);this.addSign(`${zone.id} →`,zone.center.x-6,.045,zone.entry.z,2,true);}this.scene.fog=new THREE.Fog(0xa9bdc0,65,160);}
    this.sun.shadow.camera.left=-30;this.sun.shadow.camera.right=30;this.sun.shadow.camera.top=36;this.sun.shadow.camera.bottom=-30;this.sun.shadow.camera.updateProjectionMatrix();
    const centerX=b[0]+b[2]/2,centerZ=b[1]+b[3]/2,span=Math.max(b[2],b[3])*.64;
    this.sun.position.set(centerX-35,65,centerZ+38);this.sun.target.position.set(centerX,0,centerZ);
    this.sun.shadow.camera.left=-span;this.sun.shadow.camera.right=span;this.sun.shadow.camera.top=span;this.sun.shadow.camera.bottom=-span;this.sun.shadow.camera.far=220;this.sun.shadow.camera.updateProjectionMatrix();
  }
  private buildPolish(){
    if(this.simulation.practiceMap==='range')this.buildRangePolish();this.buildArchitecturalLayers();
    if(this.simulation.practiceMap!=='range'){this.architecture=tacticalArchitecture(this.simulation.practiceMap,this.simulation.obstacles,g=>{this.geometries.add(g);return g;},m=>{this.materials.add(m);return m;},t=>{this.textures.add(t);return t;});this.scene.add(this.architecture);}
    this.buildContactShadows();
  }
  private buildRangePolish(){
    const concrete=this.material(0xa8b1a5,.92),paint=this.material(0x52686c,.7),rubber=this.material(0x596c69,.97),edge=this.material(0x93a6a3,.65);
    this.surfaceMaterials.push(concrete,rubber);concrete.userData.surface='concrete';rubber.userData.surface='rubber';
    this.box(23.8,0.012,9.4,0,0.012,5,rubber);this.box(24,0.26,0.4,0,0.13,9.7,paint);
    for(const x of [-11.85,11.85]){this.box(0.12,1.15,39,x,0.58,-10,concrete);this.box(0.13,0.045,39,x,1.2,-10,edge);for(let z=7;z>-30;z-=4){this.box(0.16,2.6,0.11,x,2.75,z,paint);this.box(0.05,0.08,1.8,x+(x<0?0.03:-0.03),2.3,z-1,edge);}}
    const glow=new THREE.MeshStandardMaterial({color:0xc4d7cc,emissive:0x81958b,emissiveIntensity:0.12,roughness:0.8});this.materials.add(glow);
    for(const x of [-10.9,10.9])this.box(0.04,0.022,34,x,0.025,-12,glow);
    for(let z=3;z>-29;z-=6){this.box(24,0.15,0.17,0,5.3,z,paint);this.box(24,0.018,0.08,0,5.2,z,glow);}
    for(let x=-9;x<=9;x+=4.5){this.box(3.8,0.07,0.04,x,4.55,-29.83,glow);this.box(0.07,4.1,0.1,x-2.12,2.35,-29.84,paint);}
    for(let i=0;i<4;i++){const x=-8.1+i*5.4;this.box(0.045,0.009,6,x,0.027,5,edge);this.addSign(`사선 0${i+1}`,x+1.8,0.033,7,1.3,true);}
    this.addSign('발로프랙 · 전술 훈련 시설',0,5.4,-29.8,5.2);
  }
  /** Visual dressing follows existing solids; surface reveals stay within 2 cm. No colliders, spawn points,
   * navigation surfaces or head-height sightlines are changed. */
  private refineObstacle(o:import('../collision/environment').Obstacle){
    if(o.ramp)return;const b=o.box,w=b.max.x-b.min.x,h=b.max.y-b.min.y,d=b.max.z-b.min.z,cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2;
    const trim=this.archMaterial('trim',0x617577,.78),base=this.archMaterial('base',0x7a8982,.92),panel=this.archMaterial('panel',0xa6b4ab,.91),metal=this.archMaterial('metal',0x405861,.63);
    if(o.kind==='cover'){
      // Flush inset cladding follows the exact footprint of the old cover.
      this.box(w*.95,.045,d*.95,cx,b.max.y+.001,cz,metal);
      if(w>.8&&d>.6&&h>.5){for(const z of [b.min.z-.004,b.max.z+.004]){this.box(w*.8,h*.62,.018,cx,b.min.y+h*.47,z,panel);this.box(w*.83,.035,.024,cx,b.min.y+.13,z,trim);}}
      return;
    }
    if(h<2.5)return;
    // Lower plinth and upper cornice are kept inside the original wall volume.
    this.box(w,.22,d,cx,b.min.y+.11,cz,base);this.box(w,.12,d,cx,b.max.y-.06,cz,trim);
    if(w>d&&w>2){for(const z of [b.min.z-.003,b.max.z+.003]){
      this.box(w,.11,.025,cx,b.min.y+2.7,z,trim);
      const count=Math.max(1,Math.floor(w/3.8));for(let i=0;i<count;i++){const x=b.min.x+(i+.5)*w/count;
        if(h>4){this.box(Math.min(2.6,w/count-.2),.78,.03,x,b.max.y-1.04,z,metal);for(let k=-1;k<=1;k++)this.box(.035,.78,.035,x+k*.52,b.max.y-1.04,z,trim);}
        this.box(.11,Math.max(.1,h-2.9),.03,x,b.min.y+2.85+(h-2.9)/2,z,panel);
      }
    }}else if(d>w&&d>2){for(const x of [b.min.x-.003,b.max.x+.003]){
      this.box(.025,.11,d,x,b.min.y+2.7,cz,trim);const count=Math.max(1,Math.floor(d/4));for(let i=0;i<count;i++){const z=b.min.z+(i+.5)*d/count;
        if(h>4){this.box(.03,.78,Math.min(2.5,d/count-.2),x,b.max.y-1.04,z,metal);for(let k=-1;k<=1;k++)this.box(.035,.78,.035,x,b.max.y-1.04,z+k*.52,trim);}
        this.box(.03,Math.max(.1,h-2.9),.11,x,b.min.y+2.85+(h-2.9)/2,z,panel);
      }
    }}
  }
  private archMaterials=new Map<string,THREE.MeshStandardMaterial>();
  private archMaterial(key:string,color:number,roughness:number){let m=this.archMaterials.get(key);if(!m){m=this.material(color,roughness);m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;this.archMaterials.set(key,m);}return m;}
  private buildArchitecturalLayers(){
    const frame=this.archMaterial('metal',0x405861,.63),inset=this.archMaterial('inset',0x809d9d,.8),warm=this.archMaterial('warm',0xc5b998,.88);
    if(this.simulation.practiceMap==='range'){
      // High clerestory openings and paired ribs compose an original training
      // campus. All new forms are above combat height or outside the play area.
      for(const x of [-11.98,11.98])for(let z=3;z>-29;z-=6){this.box(.025,1.08,3.6,x,3.4,z,inset);this.box(.04,.055,3.75,x,2.84,z,frame);this.box(.04,.055,3.75,x,3.96,z,frame);for(const k of [-1,0,1])this.box(.05,1.12,.045,x,3.4,z+k,frame);}
      for(let z=3;z>-29;z-=6){this.box(23.9,.06,.42,0,5.43,z,warm);this.box(23.9,.08,.08,0,5.31,z-.24,frame);}
      this.addSign('VALOPRAC  /  TRAINING FACILITY',0,4.6,-29.8,8);
    }else{
      const level=this.simulation.level;
      if(level&&this.simulation.practiceMap!=='complex'){for(let i=0;i<level.angles.length;i++){
        const x=level.route[i*3+2].x;
        // Threshold construction remains within the pre-existing doorway wall.
        this.box(3.1,.17,.65,x,5.63,0,frame);this.box(2.55,.07,.72,x,5.5,0,warm);
        this.addSign(`SECTOR  0${i+1}`,x,4.1,.365,2.2);
        // Raised platforms retain their exact top surfaces; riser stripes sit on
        // the solids, with no floating railings that would imply false collision.
        const a=level.angles[i];if(a.position.y>0)this.addSign('상단 수비각',x,a.position.y+.02,a.position.z+2,1.8,true);
      }}
      const bounds=level?.bounds??[-24,-24,48,48];const x=bounds[0]+bounds[2]/2;
      this.addSign('VALOPRAC  /  TACTICAL CAMPUS',x,5,bounds[1]+1.05,8);
    }
  }
  private buildContactShadows(){
    // Shared radial contact-shadow texture. No additional dynamic light per target.
    const n=32,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,r=Math.hypot(x/(n-1)*2-1,y/(n-1)*2-1);data[i]=data[i+1]=data[i+2]=0;data[i+3]=Math.round(Math.max(0,1-r)**2*125);}
    const tex=new THREE.DataTexture(data,n,n);tex.needsUpdate=true;this.textures.add(tex);const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});this.materials.add(mat);const geo=new THREE.PlaneGeometry(1.5,1.1);this.geometries.add(geo);
    for(let i=0;i<this.targetRings.length;i++){const shadow=new THREE.Mesh(geo,mat);shadow.rotation.x=-Math.PI/2;this.targetRings[i].userData.contactShadow=shadow;this.scene.add(shadow);}
  }
  private batchStaticArchitecture(){
    this.scene.updateMatrixWorld(true);const groups=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of this.scene.children){if(!(child instanceof THREE.Mesh)||!child.userData.staticRange||Array.isArray(child.material))continue;const list=groups.get(child.material)??[];list.push(child);groups.set(child.material,list);}
    for(const [material,list] of groups){if(list.length<2)continue;const merged=mergeStaticArchitecture(list);if(!merged)continue;this.geometries.add(merged);merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);for(const item of list){this.scene.remove(item);this.geometries.delete(item.geometry);item.geometry.dispose();}}
  }
  applySettings(settings:Settings){
    this.settings={...settings};this.scene.environment=settings.graphicsPreset==='low'?null:this.environmentTarget?.texture??null;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)*settings.renderScale);
    const shadows=settings.shadowQuality!=='off';this.renderer.shadowMap.enabled=shadows;this.sun.castShadow=shadows;
    const resolution={off:256,low:512,medium:1024,high:2048,ultra:2048}[settings.shadowQuality];
    if(this.sun.shadow.mapSize.x!==resolution){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(resolution,resolution);}
    for(const m of this.surfaceMaterials){const texture=this.surfaceTexture(m.userData.surface);if(m.map!==texture){m.map=texture;m.roughnessMap=texture;m.normalMap=this.surfaceTexture(m.userData.surface+'normal');m.normalScale.set(0.12,0.12);m.needsUpdate=true;}}
    const key=[settings.postProcessing,settings.ambientOcclusion,settings.antialias,settings.effectsQuality].join(':');
    if(key!==this.settingsKey){this.settingsKey=key;this.disposeComposer();
      if(settings.postProcessing||settings.antialias||settings.ambientOcclusion){this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
        if(settings.ambientOcclusion){this.ao=new SSAOPass(this.scene,this.camera,Math.max(1,this.host.clientWidth),Math.max(1,this.host.clientHeight));this.ao.kernelRadius=3;this.ao.minDistance=0.001;this.ao.maxDistance=0.08;this.composer.addPass(this.ao);}
        if(settings.postProcessing){this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.12,0.3,1.4);this.composer.addPass(this.bloom);}
        const weaponPass=new RenderPass(this.weaponScene,this.weaponCamera);weaponPass.clear=false;weaponPass.clearDepth=true;this.composer.addPass(weaponPass);
        if(settings.antialias){this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);}
        this.composer.addPass(new OutputPass());
      }
    }
    for(const id of WEAPON_ORDER)this.visuals[id].accent.emissiveIntensity=settings.premiumTheme?0.65:0.08;
    this.resize();
  }
  private disposeComposer(){if(this.composer){for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();}this.composer=null;this.ao=null;this.bloom=null;this.fxaa=null;}
  private buildImpacts(){
    const geo=new THREE.SphereGeometry(0.022,6,4);this.geometries.add(geo);const mat=new THREE.MeshBasicMaterial({color:0xc0ff98});this.materials.add(mat);
    for(let i=0;i<160;i++){const mesh=new THREE.Mesh(geo,mat);mesh.visible=false;this.scene.add(mesh);this.impacts.push({mesh,shot:null});}
    const tracerMat=new THREE.LineBasicMaterial({color:0xffddb1,transparent:true,opacity:0.23});this.materials.add(tracerMat);
    for(let i=0;i<8;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));this.geometries.add(g);const l=new THREE.Line(g,tracerMat);l.visible=false;l.frustumCulled=false;this.tracers.push(l);this.scene.add(l);}
  }
  addShot(shot:ShotEvent){
    this.lastShotAt=this.simulation.time;this.gunSlide=1;
    if(shot.weapon!=='sheriff'&&this.settings.effectsQuality!=='low'){
      const shell=this.shells[this.shellIndex++%this.shells.length];shell.mesh.position.set(0.16,-0.12,-0.2).applyMatrix4(this.camera.matrixWorld);shell.velocity.set(1.5,1.8,-0.3).applyQuaternion(this.camera.quaternion);shell.until=this.simulation.time+0.8;shell.mesh.visible=true;
    }
    if(shot.hit!=='miss'&&this.settings.effectsQuality!=='low'){const count=this.settings.effectsQuality==='ultra'?6:this.settings.effectsQuality==='high'?4:2;for(let i=0;i<count;i++){const p=this.sparks[this.sparkIndex++%this.sparks.length];p.mesh.position.set(shot.impact.x,shot.impact.y,shot.impact.z+0.02);p.velocity.set(((shot.magazineShot+i*7)%9-4)*0.24,0.4+i*0.12,0.5+(i%3)*0.2);p.until=this.simulation.time+0.18;p.mesh.visible=true;}}
    if(shot.hit==='wall'){const entry=this.impacts[this.impactIndex++%this.impacts.length];entry.shot=shot;entry.mesh.position.set(shot.impact.x,shot.impact.y,shot.impact.z+0.015);entry.mesh.visible=true;}
    const tracer=this.tracers[this.tracerIndex++%this.tracers.length];const a=tracer.geometry.getAttribute('position') as THREE.BufferAttribute;
    a.setXYZ(0,shot.position.x+0.2,shot.position.y+this.simulation.movement.eyeHeight-0.16,shot.position.z-0.35);a.setXYZ(1,shot.impact.x,shot.impact.y,shot.impact.z);a.needsUpdate=true;tracer.visible=true;tracer.userData.expire=this.simulation.time+0.045;
  }
  resize(){if(!this.mounted)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.weaponCamera.aspect=w/h;this.weaponCamera.fov=2*Math.atan(Math.tan(VIEWMODEL_HFOV*DEG/2)/this.weaponCamera.aspect)/DEG;this.weaponCamera.updateProjectionMatrix();this.updateFov();this.composer?.setPixelRatio(this.renderer.getPixelRatio());this.composer?.setSize(w,h);if(this.ao)this.ao.setSize(Math.ceil(w*this.renderer.getPixelRatio()*0.5),Math.ceil(h*this.renderer.getPixelRatio()*0.5));if(this.fxaa)this.fxaa.uniforms.resolution.value.set(1/(w*this.renderer.getPixelRatio()),1/(h*this.renderer.getPixelRatio()));}
  private updateFov(){const horizontal=this.settings.fov*DEG;this.camera.fov=2*Math.atan(Math.tan(horizontal/2)/this.camera.aspect)/DEG;this.camera.updateProjectionMatrix();}
  render(alpha:number,elapsed:number,preview:boolean,_ads:boolean){
    this.renderer.info.reset();const s=this.simulation,m=s.movement;
    if(preview){if(s.practiceMap==='complex'){
      const zone=zoneForScenario(this.settings.peekScenario)??PEEK_ZONES[0],sign=Math.sign(zone.center.z);
      // Preview the selected real bay, including rear-facing zones. The old
      // fixed camera pointed into a gallery wall for half of the complex.
      this.camera.position.set(zone.entry.x+2,3.1,sign*10.4);this.camera.lookAt(zone.center.x+2,1.5+zone.vertical*.45,zone.center.z);
    }else if(s.level){this.camera.position.set(s.level.spawn.x,3.8,8);this.camera.lookAt(s.level.angles[1].position.x,1.5,-8);}else if(s.practiceMap==='tactical'){this.camera.position.set(-7,3.8,18);this.camera.lookAt(-7,1.05,0);}else{this.camera.position.set(3.6,2.3,6.5);this.camera.lookAt(0,1.05,-16);}this.weapon.visible=false;}
    else{
      this.camera.position.lerpVectors(m.previous,m.position,alpha);this.camera.position.y+=m.previousEyeHeight+(m.eyeHeight-m.previousEyeHeight)*alpha;
      // Mouse rotation is applied directly at render cadence; no extra look smoothing.
      this.camera.rotation.set(s.viewPitch,s.viewYaw,0,'YXZ');
      const swayX=THREE.MathUtils.clamp((s.viewYaw-this.previousViewYaw)*2,-0.04,0.04),swayY=THREE.MathUtils.clamp((s.viewPitch-this.previousViewPitch)*2,-0.04,0.04);
      this.adsBlend=s.previousAdsAmount+(s.adsAmount-s.previousAdsAmount)*alpha;
      this.gunSlide*=Math.exp(-(s.weaponId==='sheriff'?13:22)*elapsed);
      const w=s.weapon,reload=w.reloadingUntil===null?0:THREE.MathUtils.clamp((s.time-w.reloadStarted)/w.profile.reloadTime,0,1),reloadPose=Math.sin(reload*Math.PI),equip=THREE.MathUtils.clamp((w.equipUntil-s.time)/w.profile.equipTime,0,1);
      poseViewmodel(s.weaponId,this.adsBlend,this.gunSlide,equip,reloadPose,s.time,m.speed,swayX,swayY,this.weapon);
      for(const id of WEAPON_ORDER){const v=this.visuals[id];v.root.visible=id===s.weaponId;if(id!==s.weaponId)continue;v.magazine.position.y=-0.06-reloadPose*0.18;v.cylinder.position.x=-reloadPose*0.09;v.cylinder.rotation.z=-w.magazineShot*Math.PI/3+reloadPose*4;v.hammer.rotation.x=-this.gunSlide*0.45;v.sights.visible=id==='operator'||this.adsBlend>.1;v.animateBolt?.(s.weapon.boltProgress);v.muzzle.scale.setScalar(1-this.adsBlend*.5);v.muzzle.visible=s.time-w.lastShot<0.027&&this.settings.effectsQuality!=='low';v.muzzle.rotation.z=w.magazineShot*1.7;v.animate?.(s.time,m.speed,reloadPose,this.gunSlide,this.adsBlend);}
      this.weapon.visible=!(s.weaponId==='operator'&&s.weapon.scopeAmount>.75);this.previousViewYaw=s.viewYaw;this.previousViewPitch=s.viewPitch;
    }
    if(this.architecture)updateTacticalArchitecture(this.architecture,this.camera.position,this.settings.graphicsPreset);
    const zoom=preview?1:s.weaponId==='operator'?s.scopeZoom:1+(s.weapon.profile.adsZoom-1)*this.adsBlend;const vf=2*Math.atan(Math.tan(this.settings.fov*DEG/2)/zoom/this.camera.aspect)/DEG;if(Math.abs(this.camera.fov-vf)>0.001){this.camera.fov=vf;this.camera.updateProjectionMatrix();}
    for(let i=0;i<s.targets.length;i++){
      const t=s.targets[i],death=THREE.MathUtils.clamp((s.time-t.deadAt)/0.4,0,1),dx=(t.previous.x+(t.position.x-t.previous.x)*alpha)-t.position.x,dz=(t.previous.z+(t.position.z-t.previous.z)*alpha)-t.position.z;
      for(let j=0;j<t.parts.length;j++){
        const p=t.parts[j],mesh=this.targetMeshes[i][j];mesh.visible=t.enabled&&(t.active||death<1);mesh.castShadow=this.settings.shadowQuality!=='off';mesh.matrix.copy(p.node.matrixWorld);
        mesh.matrix.elements[12]+=dx;mesh.matrix.elements[14]+=dz;
        mesh.matrix.scale(p.size);
        if(!t.active){mesh.matrix.elements[13]-=death*0.85;mesh.matrix.scale(this.size.setScalar(1-death*0.45));}
        if(!mesh.visible)mesh.matrix.scale(this.size.setScalar(0));const batch=mesh.userData.batch as THREE.InstancedMesh;batch.setMatrixAt(mesh.userData.slot,mesh.matrix);
      }
      this.renderedTargetPositions[i].set(t.position.x+dx,t.position.y,t.position.z+dz);
      this.targetRings[i].position.set(t.position.x+dx,t.previous.y+(t.position.y-t.previous.y)*alpha+.016,t.position.z+dz);this.targetRings[i].visible=t.active&&t.enabled;const contact=this.targetRings[i].userData.contactShadow as THREE.Mesh;contact.position.copy(this.targetRings[i].position);contact.visible=t.active&&t.enabled;contact.scale.setScalar(t.scale);
    }
    this.updateDefenderWeapons(alpha);
    for(const batch of this.targetBatches){batch.instanceMatrix.needsUpdate=true;batch.castShadow=this.settings.shadowQuality!=='off';}
    for(const tracer of this.tracers)if(tracer.visible&&s.time>tracer.userData.expire)tracer.visible=false;
    for(const shell of this.shells){if(!shell.mesh.visible)continue;if(s.time>=shell.until){shell.mesh.visible=false;continue;}const dt=s.running?Math.min(elapsed,0.05):0;shell.velocity.y-=9.8*dt;shell.mesh.position.addScaledVector(shell.velocity,dt);shell.mesh.rotation.x+=dt*12;shell.mesh.rotation.z+=dt*8;}
    for(const p of this.sparks){if(!p.mesh.visible)continue;if(s.time>=p.until){p.mesh.visible=false;continue;}const dt=s.running?Math.min(elapsed,0.05):0;p.velocity.y-=5*dt;p.mesh.position.addScaledVector(p.velocity,dt);}
    if(this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
    if(!preview&&!this.composer){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);this.renderer.autoClear=true;}
    if(!preview)s.renderedTargets.capture(s.targets,this.targetMatrices,performance.now(),this.renderedTargetPositions);
  }
  get calls(){return this.renderer.info.render.calls;}
  dispose(){this.mounted=false;this.observer.disconnect();this.disposeComposer();this.environmentTarget?.dispose();for(const batch of this.targetBatches)batch.dispose();for(const batch of this.defenderWeapons.values())batch.dispose();this.sun.shadow.map?.dispose();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();const skeletons=new Set<THREE.Skeleton>();this.weaponScene.traverse(node=>{if(node instanceof THREE.SkinnedMesh)skeletons.add(node.skeleton);});for(const skeleton of skeletons)skeleton.dispose();this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.scene.clear();this.weaponScene.clear();}
}
