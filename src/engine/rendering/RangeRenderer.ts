import * as THREE from 'three';
import type { Simulation } from '../simulation/Simulation';
import type { Settings, ShotEvent } from '../types';
import { ENVIRONMENT } from '../collision/environment';
const DEG=Math.PI/180;
interface Impact {mesh:THREE.Mesh;shot:ShotEvent|null}
export class RangeRenderer {
  renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(75,1,0.05,180);
  private size=new THREE.Vector3();private color=new THREE.Color();private position=new THREE.Vector3();
  private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();private textures=new Set<THREE.Texture>();
  private targetMeshes:THREE.Mesh[][]=[];private targetRings:THREE.Mesh[]=[];private impacts:Impact[]=[];private impactIndex=0;
  private tracers:THREE.Line[]=[];private tracerIndex=0;private weapon=new THREE.Group();private muzzle!:THREE.Mesh;
  private lastRenderedShot=-1;private lastShotAt=-100;private previousViewYaw=0;private previousViewPitch=0;
  private gunSlide=0;private observer:ResizeObserver;private mounted=true;
  constructor(private host:HTMLElement,public simulation:Simulation,private settings:Settings){
    this.renderer=new THREE.WebGLRenderer({antialias:settings.antialias,powerPreference:'high-performance',alpha:false});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0x15212a);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)*settings.renderScale);
    this.renderer.domElement.setAttribute('aria-label','전술 사격 훈련장');host.appendChild(this.renderer.domElement);
    this.scene.fog=new THREE.Fog(0x15212a,26,90);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xddefff,0x596260,2.0));
    const sun=new THREE.DirectionalLight(0xffead4,2.6);sun.position.set(-4,12,6);this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0xa4e2f2,1.3);fill.position.set(4,5,-18);this.scene.add(fill);
    this.buildEnvironment();this.buildTargets();this.buildWeapon();this.buildImpacts();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  }
  get canvas(){return this.renderer.domElement;}
  private material(color:number,roughness=0.8){const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0.12});this.materials.add(m);return m;}
  private box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material){const g=new THREE.BoxGeometry(w,h,d);this.geometries.add(g);const m=new THREE.Mesh(g,material);m.position.set(x,y,z);this.scene.add(m);return m;}
  private buildEnvironment(){
    const floor=this.material(0x64716f),trim=this.material(0x2c3940),metal=this.material(0x707d7d),accent=this.material(0x6cf1bd);
    this.box(24,0.15,40,0,-0.09,-10,floor);
    const grid=new THREE.GridHelper(40,40,0x96b0aa,0x788981);grid.position.set(0,0.005,-10);this.scene.add(grid);this.geometries.add(grid.geometry);const gridM=grid.material as THREE.Material;this.materials.add(gridM);gridM.transparent=true;gridM.opacity=0.22;
    for(const o of ENVIRONMENT){o.box.getSize(this.size);o.box.getCenter(this.position);this.box(this.size.x,this.size.y,this.size.z,this.position.x,this.position.y,this.position.z,this.material(o.color));}
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
    for(const target of this.simulation.targets){const meshes:THREE.Mesh[]=[];for(const part of target.parts){const m=new THREE.Mesh(part.shape==='sphere'?headGeo:boxGeo,part.zone==='head'?head:part.zone==='torso'?torso:part.zone==='arm'?arm:leg);m.matrixAutoUpdate=false;m.frustumCulled=false;this.scene.add(m);meshes.push(m);}this.targetMeshes.push(meshes);
      const g=new THREE.RingGeometry(0.53,0.56,40);this.geometries.add(g);const mat=new THREE.MeshBasicMaterial({color:0x7ce9bc,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false});this.materials.add(mat);const ring=new THREE.Mesh(g,mat);ring.rotation.x=-Math.PI/2;this.scene.add(ring);this.targetRings.push(ring);
    }
  }
  private buildWeapon(){
    this.camera.add(this.weapon);this.weapon.position.set(0.24,-0.25,-0.48);this.weapon.rotation.y=0.025;
    const metal=this.material(0x28373c),dark=this.material(0x111a20),trim=this.material(0x6de1b7);
    const part=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const g=new THREE.BoxGeometry(w,h,d);this.geometries.add(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);this.weapon.add(mesh);return mesh;};
    part(0.075,0.09,0.32,0,0,0,metal);part(0.055,0.055,0.3,0,0.006,-0.29,dark);part(0.035,0.045,0.1,0,0.038,-0.1,trim);
    const magazine=part(0.058,0.16,0.085,0,-0.105,0.03,dark);magazine.rotation.x=-0.14;
    const stock=part(0.075,0.1,0.16,0,-0.01,0.22,metal);stock.rotation.x=-0.1;
    part(0.09,0.06,0.2,-0.025,-0.12,-0.12,this.material(0x7d8c87));
    const g=new THREE.ConeGeometry(0.04,0.14,5);this.geometries.add(g);const mat=new THREE.MeshBasicMaterial({color:0xffdf8a,transparent:true,opacity:0.8});this.materials.add(mat);this.muzzle=new THREE.Mesh(g,mat);this.muzzle.rotation.x=-Math.PI/2;this.muzzle.position.set(0,0,-0.5);this.muzzle.visible=false;this.weapon.add(this.muzzle);
  }
  private buildImpacts(){
    const geo=new THREE.SphereGeometry(0.022,6,4);this.geometries.add(geo);const mat=new THREE.MeshBasicMaterial({color:0xc0ff98});this.materials.add(mat);
    for(let i=0;i<160;i++){const mesh=new THREE.Mesh(geo,mat);mesh.visible=false;this.scene.add(mesh);this.impacts.push({mesh,shot:null});}
    const tracerMat=new THREE.LineBasicMaterial({color:0xffddb1,transparent:true,opacity:0.23});this.materials.add(tracerMat);
    for(let i=0;i<8;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));this.geometries.add(g);const l=new THREE.Line(g,tracerMat);l.visible=false;l.frustumCulled=false;this.tracers.push(l);this.scene.add(l);}
  }
  addShot(shot:ShotEvent){
    this.lastShotAt=this.simulation.time;this.gunSlide=1;
    if(shot.hit==='wall'){const entry=this.impacts[this.impactIndex++%this.impacts.length];entry.shot=shot;entry.mesh.position.set(shot.impact.x,shot.impact.y,shot.impact.z+0.015);entry.mesh.visible=true;}
    const tracer=this.tracers[this.tracerIndex++%this.tracers.length];const a=tracer.geometry.getAttribute('position') as THREE.BufferAttribute;
    a.setXYZ(0,shot.position.x+0.2,shot.position.y+this.simulation.movement.eyeHeight-0.16,shot.position.z-0.35);a.setXYZ(1,shot.impact.x,shot.impact.y,shot.impact.z);a.needsUpdate=true;tracer.visible=true;tracer.userData.expire=this.simulation.time+0.045;
  }
  resize(){if(!this.mounted)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.updateFov();}
  private updateFov(){const horizontal=this.settings.fov*DEG;this.camera.fov=2*Math.atan(Math.tan(horizontal/2)/this.camera.aspect)/DEG;this.camera.updateProjectionMatrix();}
  render(alpha:number,elapsed:number,preview:boolean,ads:boolean){
    const s=this.simulation,m=s.movement;
    if(preview){this.camera.position.set(3.6,2.3,6.5);this.camera.lookAt(0,1.05,-16);this.weapon.visible=false;}
    else{
      this.camera.position.lerpVectors(m.previous,m.position,alpha);this.camera.position.y+=m.previousEyeHeight+(m.eyeHeight-m.previousEyeHeight)*alpha;
      // Mouse rotation is applied directly at render cadence; no extra look smoothing.
      this.camera.rotation.set(s.viewPitch,s.viewYaw,0,'YXZ');
      const swayX=THREE.MathUtils.clamp((s.viewYaw-this.previousViewYaw)*2,-0.04,0.04),swayY=THREE.MathUtils.clamp((s.viewPitch-this.previousViewPitch)*2,-0.04,0.04);
      this.gunSlide*=Math.exp(-20*elapsed);this.weapon.position.set((ads?0.02:0.24)-swayX,(ads?-0.17:-0.25)-swayY,-0.48+this.gunSlide*0.055);
      this.weapon.rotation.x=this.gunSlide*0.08;this.weapon.rotation.z=s.weapon.reloadingUntil!==null?-0.45:0;
      this.weapon.visible=true;this.previousViewYaw=s.viewYaw;this.previousViewPitch=s.viewPitch;
    }
    const fov=this.settings.fov*(ads&&!preview?0.85:1);const vf=2*Math.atan(Math.tan(fov*DEG/2)/this.camera.aspect)/DEG;if(Math.abs(this.camera.fov-vf)>0.001){this.camera.fov=vf;this.camera.updateProjectionMatrix();}
    this.muzzle.visible=s.time-this.lastShotAt<0.035&&!preview;
    for(let i=0;i<s.targets.length;i++){
      const t=s.targets[i],death=THREE.MathUtils.clamp((s.time-t.deadAt)/0.4,0,1),dx=(t.previous.x+(t.position.x-t.previous.x)*alpha)-t.position.x,dz=(t.previous.z+(t.position.z-t.previous.z)*alpha)-t.position.z;
      for(let j=0;j<t.parts.length;j++){
        const p=t.parts[j],mesh=this.targetMeshes[i][j];mesh.visible=t.active||death<1;mesh.matrix.copy(p.node.matrixWorld);
        mesh.matrix.elements[12]+=dx;mesh.matrix.elements[14]+=dz;
        if(p.shape==='sphere')mesh.matrix.scale(this.size.setScalar(p.size.x/2));else mesh.matrix.scale(p.size);
        if(!t.active){mesh.matrix.elements[13]-=death*0.85;mesh.matrix.scale(this.size.setScalar(1-death*0.45));}
        mesh.matrixWorldNeedsUpdate=true;
      }
      this.targetRings[i].position.set(t.position.x+dx,0.016,t.position.z+dz);this.targetRings[i].visible=t.active;
    }
    for(const tracer of this.tracers)if(tracer.visible&&s.time>tracer.userData.expire)tracer.visible=false;
    this.renderer.render(this.scene,this.camera);
  }
  get calls(){return this.renderer.info.render.calls;}
  dispose(){this.mounted=false;this.observer.disconnect();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.scene.clear();}
}
