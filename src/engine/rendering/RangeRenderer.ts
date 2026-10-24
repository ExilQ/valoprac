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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createWeaponView, type WeaponVisual } from './WeaponView';
const DEG=Math.PI/180;
interface Impact {mesh:THREE.Mesh;shot:ShotEvent|null}
export class RangeRenderer {
  renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(75,1,0.05,180);
  private size=new THREE.Vector3();private color=new THREE.Color();private position=new THREE.Vector3();
  private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();private textures=new Set<THREE.Texture>();
  private targetBatches:THREE.InstancedMesh[]=[];private targetMeshes:THREE.Mesh[][]=[];private targetRings:THREE.Mesh[]=[];private impacts:Impact[]=[];private impactIndex=0;
  private tracers:THREE.Line[]=[];private tracerIndex=0;private weapon=new THREE.Group();private muzzle!:THREE.Mesh;
  private lastRenderedShot=-1;private lastShotAt=-100;private previousViewYaw=0;private previousViewPitch=0;
  private environmentTarget:THREE.WebGLRenderTarget|null=null;private sparks:{mesh:THREE.Mesh;velocity:THREE.Vector3;until:number}[]=[];private sparkIndex=0;
  private visuals={} as Record<WeaponId,WeaponVisual>;private sun!:THREE.DirectionalLight;private composer:EffectComposer|null=null;private bloom:UnrealBloomPass|null=null;private ao:SSAOPass|null=null;private fxaa:ShaderPass|null=null;private adsBlend=0;private settingsKey='';
  private surfaceMaterials:THREE.MeshStandardMaterial[]=[];private surfaceTextures=new Map<string,THREE.DataTexture>();
  private shells:{mesh:THREE.Mesh;velocity:THREE.Vector3;until:number}[]=[];private shellIndex=0;
  private gunSlide=0;private observer:ResizeObserver;private mounted=true;
  constructor(private host:HTMLElement,public simulation:Simulation,private settings:Settings){
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
    this.renderer.info.autoReset=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.setClearColor(0x15212a);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)*settings.renderScale);
    this.renderer.domElement.setAttribute('aria-label','전술 사격 훈련장');host.appendChild(this.renderer.domElement);
    const probe=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.environmentTarget=pmrem.fromScene(probe,0.04);this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=0.55;probe.dispose();pmrem.dispose();
    this.scene.fog=new THREE.Fog(0x15212a,26,90);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xddefff,0x596260,2.0));
    const sun=this.sun=new THREE.DirectionalLight(0xffead4,2.8);sun.position.set(-8,14,8);sun.target.position.set(0,0,-16);this.scene.add(sun,sun.target);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.bias=-0.00025;sun.shadow.normalBias=0.025;sun.shadow.radius=2;
    const fill=new THREE.DirectionalLight(0xa4e2f2,1.3);fill.position.set(4,5,-18);this.scene.add(fill);
    this.buildEnvironment();this.buildTargets();this.buildWeapon();this.buildImpacts();this.buildShells();this.buildPolish();this.batchStaticArchitecture();this.applySettings(settings);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  }
  get canvas(){return this.renderer.domElement;}
  private material(color:number,roughness=0.8){const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0.12});this.materials.add(m);return m;}
  private box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material){const g=new THREE.BoxGeometry(w,h,d);this.geometries.add(g);const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.staticRange=true;this.scene.add(m);return m;}
  private buildEnvironment(){
    if(this.simulation.practiceMap==='tactical'){this.buildTactical();return;}

    const floor=this.material(0x64716f),trim=this.material(0x2c3940),metal=this.material(0x707d7d),accent=this.material(0x6cf1bd);
    this.box(24,0.15,40,0,-0.09,-10,floor);
    const grid=new THREE.GridHelper(40,40,0x96b0aa,0x788981);grid.position.set(0,0.005,-10);this.scene.add(grid);this.geometries.add(grid.geometry);const gridM=grid.material as THREE.Material;this.materials.add(gridM);gridM.transparent=true;gridM.opacity=0.22;
    for(const o of this.simulation.obstacles){o.box.getSize(this.size);o.box.getCenter(this.position);this.box(this.size.x,this.size.y,this.size.z,this.position.x,this.position.y,this.position.z,this.material(o.color));}
    for(let z=6;z>-30;z-=6){this.box(0.12,5,0.3,-11.94,2.5,z,metal);this.box(0.12,5,0.3,11.94,2.5,z,metal);this.box(24,0.22,0.3,0,5,z,trim);}
    for(let x=-10;x<=10;x+=5){this.box(0.06,0.015,35,x,0.013,-10,metal);}
    this.box(21,0.08,0.06,0,0.014,0,accent);this.box(0.06,0.015,28,0,0.013,-14,accent);
    this.box(18,3.9,0.08,0,2,-29.94,this.material(0x1b2b30));
    const points:THREE.Vector3[]=[];for(let x=-9;x<=9;x+=0.5){points.push(new THREE.Vector3(x,0.1,-29.885),new THREE.Vector3(x,3.9,-29.885));}for(let y=0.1;y<=3.9;y+=0.5){points.push(new THREE.Vector3(-9,y,-29.885),new THREE.Vector3(9,y,-29.885));}
    const geometry=new THREE.BufferGeometry().setFromPoints(points);this.geometries.add(geometry);const mat=new THREE.LineBasicMaterial({color:0x607c78,transparent:true,opacity:0.35});this.materials.add(mat);this.scene.add(new THREE.LineSegments(geometry,mat));
    for(const radius of [0.07,0.3,0.65,1.1]){const g=new THREE.RingGeometry(radius-0.009,radius,64);this.geometries.add(g);const m=new THREE.MeshBasicMaterial({color:0x9bcab6,side:THREE.DoubleSide});this.materials.add(m);const ring=new THREE.Mesh(g,m);ring.position.set(0,1.64,-29.87);this.scene.add(ring);}
    this.addSign('정',-10,3.4,-29.82,1.2);this.addSign('머리만 유효',0,4.5,-29.82,2.6);
    for(const [label,z] of [['10 미터',-5],['20 미터',-15],['30 미터',-25]] as const)this.addSign(label,-10.7,0.025,z,1.6,true);
    // Simple faux skylight strips use emissive materials with no dynamic shadow cost.
    const light=new THREE.MeshBasicMaterial({color:0xcde7df});this.materials.add(light);
    for(let z=3;z>-29;z-=6){this.box(3,0.04,0.25,-6,4.85,z,light);this.box(3,0.04,0.25,6,4.85,z,light);}
  }
  private addSign(text:string,x:number,y:number,z:number,width:number,floor=false){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.fillStyle='#b4c4bd';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 48px sans-serif';ctx.fillText(text,256,64);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.textures.add(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});this.materials.add(material);const g=new THREE.PlaneGeometry(width,width/4);this.geometries.add(g);const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);if(floor)mesh.rotation.x=-Math.PI/2;this.scene.add(mesh);
  }
  private buildTargets(){
    const head=this.material(0xed7f65),torso=this.material(0xd1dad3),arm=this.material(0x879c99),leg=this.material(0x728582);
    const headGeo=new THREE.SphereGeometry(1,16,12),boxGeo=new THREE.BoxGeometry(1,1,1);this.geometries.add(headGeo);this.geometries.add(boxGeo);
    const batchMaterials=[head,torso,arm,leg],batchCounts=[1,2,4,4],batchSlots=[0,0,0,0];
    for(let i=0;i<4;i++){const batch=new THREE.InstancedMesh(i===0?headGeo:boxGeo,batchMaterials[i],this.simulation.targets.length*batchCounts[i]);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;this.targetBatches.push(batch);this.scene.add(batch);}
    for(const target of this.simulation.targets){const meshes:THREE.Mesh[]=[];for(const part of target.parts){const m=new THREE.Mesh(part.shape==='sphere'?headGeo:boxGeo,part.zone==='head'?head:part.zone==='torso'?torso:part.zone==='arm'?arm:leg);m.matrixAutoUpdate=false;m.frustumCulled=false;const bi=part.zone==='head'?0:part.zone==='torso'?1:part.zone==='arm'?2:3;m.userData.batch=this.targetBatches[bi];m.userData.slot=batchSlots[bi]++;meshes.push(m);}this.targetMeshes.push(meshes);
      const g=new THREE.RingGeometry(0.53,0.56,40);this.geometries.add(g);const mat=new THREE.MeshBasicMaterial({color:0x7ce9bc,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false});this.materials.add(mat);const ring=new THREE.Mesh(g,mat);ring.rotation.x=-Math.PI/2;this.scene.add(ring);this.targetRings.push(ring);
    }
  }
  private buildWeapon(){
    this.camera.add(this.weapon);
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
  private buildTactical(){
    const wall=this.material(0x52636a,.8),trim=this.material(0x293e48,.6),floor=this.material(0x384e55,.93),light=new THREE.MeshBasicMaterial({color:0x91c9c5});this.materials.add(light);
    this.box(48,.15,48,0,-.09,0,floor);
    for(const o of this.simulation.obstacles){o.box.getSize(this.size);o.box.getCenter(this.position);this.box(this.size.x,this.size.y,this.size.z,this.position.x,this.position.y,this.position.z,wall);this.box(this.size.x,.08,this.size.z,this.position.x,3.5,this.position.z,trim);}
    for(const x of [-17,-7,7,17])for(const z of [-17,-3,12,19])this.box(1.5,.015,.06,x,.015,z,light);
    this.addSign('코너 피킹 · 발소리 훈련장',-7,.025,16,4,true);
    this.sun.shadow.camera.left=-30;this.sun.shadow.camera.right=30;this.sun.shadow.camera.top=36;this.sun.shadow.camera.bottom=-30;this.sun.shadow.camera.updateProjectionMatrix();
  }
  private buildPolish(){
    if(this.simulation.practiceMap!=='tactical')this.buildRangePolish();
    this.buildContactShadows();
  }
  private buildRangePolish(){
    const concrete=this.material(0x92a39e,0.88),paint=this.material(0x243d4b,0.44),rubber=this.material(0x192e36,0.94),edge=this.material(0x587782,0.55);
    this.surfaceMaterials.push(concrete,rubber);concrete.userData.surface='concrete';rubber.userData.surface='rubber';
    this.box(23.8,0.012,9.4,0,0.012,5,rubber);this.box(24,0.26,0.4,0,0.13,9.7,paint);
    for(const x of [-11.85,11.85]){this.box(0.12,1.15,39,x,0.58,-10,concrete);this.box(0.13,0.045,39,x,1.2,-10,edge);for(let z=7;z>-30;z-=4){this.box(0.16,2.6,0.11,x,2.75,z,paint);this.box(0.05,0.08,1.8,x+(x<0?0.03:-0.03),2.3,z-1,edge);}}
    const glow=new THREE.MeshStandardMaterial({color:0x82dacb,emissive:0x2b7a6c,emissiveIntensity:0.8,roughness:0.35});this.materials.add(glow);
    for(const x of [-10.9,10.9])this.box(0.04,0.022,34,x,0.025,-12,glow);
    for(let z=3;z>-29;z-=6){this.box(24,0.15,0.17,0,5.3,z,paint);this.box(24,0.018,0.08,0,5.2,z,glow);}
    for(let x=-9;x<=9;x+=4.5){this.box(3.8,0.07,0.04,x,4.55,-29.83,glow);this.box(0.07,4.1,0.1,x-2.12,2.35,-29.84,paint);}
    for(let i=0;i<4;i++){const x=-8.1+i*5.4;this.box(0.045,0.009,6,x,0.027,5,edge);this.addSign(`사선 0${i+1}`,x+1.8,0.033,7,1.3,true);}
    this.addSign('발로프랙 · 전술 훈련 시설',0,5.4,-29.8,5.2);
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
    for(const [material,list] of groups){if(list.length<2)continue;const copies=list.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld));const merged=mergeGeometries(copies);for(const g of copies)g.dispose();if(!merged)continue;this.geometries.add(merged);merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);for(const item of list)this.scene.remove(item);}
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
  resize(){if(!this.mounted)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.updateFov();this.composer?.setPixelRatio(this.renderer.getPixelRatio());this.composer?.setSize(w,h);if(this.ao)this.ao.setSize(Math.ceil(w*this.renderer.getPixelRatio()*0.5),Math.ceil(h*this.renderer.getPixelRatio()*0.5));if(this.fxaa)this.fxaa.uniforms.resolution.value.set(1/(w*this.renderer.getPixelRatio()),1/(h*this.renderer.getPixelRatio()));}
  private updateFov(){const horizontal=this.settings.fov*DEG;this.camera.fov=2*Math.atan(Math.tan(horizontal/2)/this.camera.aspect)/DEG;this.camera.updateProjectionMatrix();}
  render(alpha:number,elapsed:number,preview:boolean,ads:boolean){
    this.renderer.info.reset();const s=this.simulation,m=s.movement;
    if(preview){if(s.practiceMap==='tactical'){this.camera.position.set(-7,3.8,18);this.camera.lookAt(-7,1.05,0);}else{this.camera.position.set(3.6,2.3,6.5);this.camera.lookAt(0,1.05,-16);}this.weapon.visible=false;}
    else{
      this.camera.position.lerpVectors(m.previous,m.position,alpha);this.camera.position.y+=m.previousEyeHeight+(m.eyeHeight-m.previousEyeHeight)*alpha;
      // Mouse rotation is applied directly at render cadence; no extra look smoothing.
      this.camera.rotation.set(s.viewPitch,s.viewYaw,0,'YXZ');
      const swayX=THREE.MathUtils.clamp((s.viewYaw-this.previousViewYaw)*2,-0.04,0.04),swayY=THREE.MathUtils.clamp((s.viewPitch-this.previousViewPitch)*2,-0.04,0.04);
      this.adsBlend+=(Number(ads)-this.adsBlend)*(1-Math.exp(-18*elapsed));
      this.gunSlide*=Math.exp(-(s.weaponId==='sheriff'?13:22)*elapsed);
      const w=s.weapon,reload=w.reloadingUntil===null?0:THREE.MathUtils.clamp((s.time-w.reloadStarted)/w.profile.reloadTime,0,1),reloadPose=Math.sin(reload*Math.PI),equip=THREE.MathUtils.clamp((w.equipUntil-s.time)/w.profile.equipTime,0,1);
      const bob=Math.sin(s.time*10)*Math.min(0.007,m.speed*0.002)*(1-this.adsBlend);
      this.weapon.position.set(0.24*(1-this.adsBlend)-swayX*(1-this.adsBlend),-0.22+0.12*this.adsBlend-swayY*(1-this.adsBlend)+bob-equip*0.35,-0.43+this.gunSlide*(s.weaponId==='sheriff'?0.075:0.038));
      this.weapon.rotation.set(this.gunSlide*(s.weaponId==='sheriff'?0.35:0.065)-reloadPose*0.2+equip*0.7,0,-reloadPose*0.55);
      for(const id of WEAPON_ORDER){const v=this.visuals[id];v.root.visible=id===s.weaponId;if(id!==s.weaponId)continue;v.magazine.position.y=-0.06-reloadPose*0.18;v.cylinder.position.x=-reloadPose*0.09;v.cylinder.rotation.z=-w.magazineShot*Math.PI/3+reloadPose*4;v.hammer.rotation.x=-this.gunSlide*0.45;v.muzzle.visible=s.time-w.lastShot<0.027&&this.settings.effectsQuality!=='low';v.muzzle.rotation.z=w.magazineShot*1.7;}
      this.weapon.visible=true;
      this.weapon.visible=true;this.previousViewYaw=s.viewYaw;this.previousViewPitch=s.viewPitch;
    }
    const zoom=preview?1:1+(s.weapon.profile.adsZoom-1)*this.adsBlend;const vf=2*Math.atan(Math.tan(this.settings.fov*DEG/2)/zoom/this.camera.aspect)/DEG;if(Math.abs(this.camera.fov-vf)>0.001){this.camera.fov=vf;this.camera.updateProjectionMatrix();}
    for(let i=0;i<s.targets.length;i++){
      const t=s.targets[i],death=THREE.MathUtils.clamp((s.time-t.deadAt)/0.4,0,1),dx=(t.previous.x+(t.position.x-t.previous.x)*alpha)-t.position.x,dz=(t.previous.z+(t.position.z-t.previous.z)*alpha)-t.position.z;
      for(let j=0;j<t.parts.length;j++){
        const p=t.parts[j],mesh=this.targetMeshes[i][j];mesh.visible=t.enabled&&(t.active||death<1);mesh.castShadow=this.settings.shadowQuality!=='off';mesh.matrix.copy(p.node.matrixWorld);
        mesh.matrix.elements[12]+=dx;mesh.matrix.elements[14]+=dz;
        if(p.shape==='sphere')mesh.matrix.scale(this.size.setScalar(p.size.x/2));else mesh.matrix.scale(p.size);
        if(!t.active){mesh.matrix.elements[13]-=death*0.85;mesh.matrix.scale(this.size.setScalar(1-death*0.45));}
        if(!mesh.visible)mesh.matrix.scale(this.size.setScalar(0));const batch=mesh.userData.batch as THREE.InstancedMesh;batch.setMatrixAt(mesh.userData.slot,mesh.matrix);
      }
      this.targetRings[i].position.set(t.position.x+dx,0.016,t.position.z+dz);this.targetRings[i].visible=t.active&&t.enabled;const contact=this.targetRings[i].userData.contactShadow as THREE.Mesh;contact.position.copy(this.targetRings[i].position);contact.visible=t.active&&t.enabled;contact.scale.setScalar(t.scale);
    }
    for(const batch of this.targetBatches){batch.instanceMatrix.needsUpdate=true;batch.castShadow=this.settings.shadowQuality!=='off';}
    for(const tracer of this.tracers)if(tracer.visible&&s.time>tracer.userData.expire)tracer.visible=false;
    for(const shell of this.shells){if(!shell.mesh.visible)continue;if(s.time>=shell.until){shell.mesh.visible=false;continue;}const dt=s.running?Math.min(elapsed,0.05):0;shell.velocity.y-=9.8*dt;shell.mesh.position.addScaledVector(shell.velocity,dt);shell.mesh.rotation.x+=dt*12;shell.mesh.rotation.z+=dt*8;}
    for(const p of this.sparks){if(!p.mesh.visible)continue;if(s.time>=p.until){p.mesh.visible=false;continue;}const dt=s.running?Math.min(elapsed,0.05):0;p.velocity.y-=5*dt;p.mesh.position.addScaledVector(p.velocity,dt);}
    if(this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
  }
  get calls(){return this.renderer.info.render.calls;}
  dispose(){this.mounted=false;this.observer.disconnect();this.disposeComposer();this.environmentTarget?.dispose();for(const batch of this.targetBatches)batch.dispose();this.sun.shadow.map?.dispose();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.scene.clear();}
}
