import {floorImpactSurface,floorImpactSurfaceAt} from '../collision/floorImpact';
import {PENETRATION_MATERIALS} from '../../config/penetration';
import {SURFACES,SURFACE_PARTICLE_PROFILES,surfaceForObstacle,type SurfaceId} from '../../config/surfaces';
import {VISUAL_MATERIALS,type VisualMaterialId} from '../../config/materials';
import {SurfaceMaterialLibrary,writeWorldScaleUV} from './SurfaceMaterials';
import type {PenetrationSegment} from '../collision/Ballistics';
import type {Vec3} from '../types';
import {defenderWeaponGeometry} from './DefenderWeaponGeometry';
import {tacticalArchitecture,updateTacticalArchitecture} from './TacticalArchitecture';
import {PEEK_ZONES,zoneForScenario} from '../tactical/complex';
import {characterPartGeometry} from './CharacterGeometry';
import {useCharacterFinishes} from './CharacterMaterial';
import {LEGACY_CHARACTER_GEOMETRY} from '../targets/characterProfile';
import {architecturalBox,type BoxFinish} from './ArchitecturalBox';
import {obstacleFinishes} from './ObstacleFinishes';
import {surfaceHeight,type Obstacle} from '../collision/environment';
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
import {colorBatchSignature,mergeStaticArchitecture} from './StaticGeometry';
import {GroundContacts} from './GroundContacts';
import {createCharacterBatches,useMultiDrawCharacters,type CharacterBatches,type CharacterBatchObject} from './CharacterBatches';
import { createWeaponView, type WeaponVisual } from './WeaponView';
import {detectGraphicsCapabilities,type GraphicsCapabilities} from './GraphicsCapabilities';
import {automaticGraphicsPatch} from '../../config/graphicsPolicy';
import {cameraVerticalFov} from './projection';
import {subscribeLocale,translateText} from '../../i18n/locale';
const DEG=Math.PI/180;
const WALL_PLINTH=new THREE.Color(0x7a8982);
const WALL_CORNICE=new THREE.Color(0x617577);
const TACTICAL_CORNICE=new THREE.Color(0x52666c);
interface Impact {mesh:THREE.Mesh;shot:ShotEvent|null}
export interface ShaderPreparationReport {revision:number;milliseconds:number;programs:number;method:'parallel'|'synchronous';disposed:boolean;}
export interface ShaderPreparationStatus {stage:'idle'|'compiling'|'warming'|'gpu'|'ready'|'failed'|'disposed';revision:number;requestedRevision:number;elapsedMs:number;completedPrograms:number|null;totalPrograms:number;}
export class RangeRenderer {
  private localizedSigns:(()=>void)[]=[];
  private unsubscribeLocale:(()=>void)|undefined;
  recordFrames=true;
  /** Viewer-only camera. It never writes back into the authoritative movement,
   * aim, hit registration or submitted target-frame history. */
  inspectionCamera:{position:Vec3;target:Vec3;fov?:number}|null=null;
  readonly capabilities:GraphicsCapabilities;
  renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(75,1,0.05,180);
  private weaponScene=new THREE.Scene();private weaponCamera=new THREE.PerspectiveCamera(55,1,.03,4);
  private size=new THREE.Vector3();private color=new THREE.Color();private position=new THREE.Vector3();
  private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();private textures=new Set<THREE.Texture>();
  private architecture:THREE.Group|null=null;private defenderWeapons=new Map<WeaponId,THREE.InstancedMesh>();private heldMatrix=new THREE.Matrix4();private heldPose=new THREE.Object3D();
  private characterBatches:CharacterBatches|null=null;private targetBatches:CharacterBatchObject[]=[];private targetMeshes:THREE.Mesh[][]=[];private targetMatrices:THREE.Matrix4[][]=[];private renderedTargetPositions:THREE.Vector3[]=[];private groundContacts!:GroundContacts;private impacts:Impact[]=[];private impactIndex=0;
  private decalBatch:THREE.InstancedMesh|null=null;private decalsDirty=true;private effectUp=new THREE.Vector3(0,1,0);
  private surfaceImpacts:THREE.Mesh[]=[];private surfaceImpactIndex=0;
  private tracers:THREE.Line[]=[];private tracerIndex=0;private weapon=new THREE.Group();private muzzle!:THREE.Mesh;
  private effectNormal=new THREE.Vector3();private effectForward=new THREE.Vector3(0,0,1);
  private debrisGeometries={} as Record<keyof typeof SURFACE_PARTICLE_PROFILES,THREE.BufferGeometry>;
  private lastRenderedShot=-1;private lastShotAt=-100;private previousViewYaw=0;private previousViewPitch=0;
  private environmentTarget:THREE.WebGLRenderTarget|null=null;private sparks:{mesh:THREE.Mesh;velocity:THREE.Vector3;until:number}[]=[];private sparkIndex=0;
  private visuals={} as Record<WeaponId,WeaponVisual>;private sun!:THREE.DirectionalLight;private composer:EffectComposer|null=null;private bloom:UnrealBloomPass|null=null;private ao:SSAOPass|null=null;private fxaa:ShaderPass|null=null;private adsBlend=0;private settingsKey='';
  private materialLibrary!:SurfaceMaterialLibrary;private environmentSize=0;
  private surfaceMaterials:THREE.MeshStandardMaterial[]=[];
  private shells:{mesh:THREE.Mesh;velocity:THREE.Vector3;until:number}[]=[];private shellIndex=0;
  private gunSlide=0;private observer:ResizeObserver;private mounted=true;
  private materialRevision=0;private preparedRevision=-1;private shaderKey='';private preparationPromise:Promise<ShaderPreparationReport>|null=null;
  private canvasWarmHidden=false;private canvasVisibility='';
  private preparationPhase:ShaderPreparationStatus['stage']='idle';private preparationStarted=0;private preparationRevision=-1;private completedPrograms:number|null=null;
  private preparationReport:ShaderPreparationReport={revision:-1,milliseconds:0,programs:0,method:'synchronous',disposed:false};
  constructor(private host:HTMLElement,public simulation:Simulation,private settings:Settings,options:{recordFrames?:boolean}={}){
    this.recordFrames=options.recordFrames??true;
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
    this.capabilities=detectGraphicsCapabilities(this.renderer.getContext());
    settings={...settings,...automaticGraphicsPatch(settings,this.capabilities.recommendLow,this.capabilities.kind)};this.settings=settings;
    this.materialLibrary=new SurfaceMaterialLibrary({quality:settings.textureQuality,anisotropy:this.renderer.capabilities.getMaxAnisotropy(),scalarLow:this.capabilities.kind==='software'});
    this.renderer.info.autoReset=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.setClearColor(0x9aafb3);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)*settings.renderScale);
    if(this.recordFrames)simulation.renderedTargets.attach();this.renderer.domElement.setAttribute('aria-label','전술 사격 훈련장');host.appendChild(this.renderer.domElement);
    this.ensureEnvironment(settings.graphicsPreset);this.scene.environmentIntensity=0.38;
    this.scene.fog=new THREE.Fog(0x9aafb3,38,110);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xe7eff6,0xa39884,1.68));
    const sun=this.sun=new THREE.DirectionalLight(0xffeedb,2.5);sun.position.set(-8,14,8);sun.target.position.set(0,0,-16);this.scene.add(sun,sun.target);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.bias=-0.00025;sun.shadow.normalBias=0.025;sun.shadow.radius=2;
    const fill=new THREE.DirectionalLight(0xc2d9eb,.68);fill.position.set(4,5,-18);this.scene.add(fill);
    this.buildEnvironment();this.buildTargets();this.buildDefenderWeapons();this.buildWeapon();this.buildImpacts();this.buildShells();this.buildPolish();this.batchStaticArchitecture();this.applySettings(settings);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    // A browser may reject WebGL construction entirely. Subscribe only after
    // initialization succeeds so failed attempts do not retain the renderer.
    this.unsubscribeLocale=subscribeLocale(()=>{for(const paint of this.localizedSigns)paint();});
  }
  get canvas(){return this.renderer.domElement;}
  /** Render pacing follows the effective hardware policy, independently of
   * authoritative settings recorded for deterministic replay. */
  get effectiveFrameLimit(){return this.settings.frameLimit;}
  get preparationReady(){return this.mounted&&this.preparedRevision===this.materialRevision;}
  get preparationStatus():ShaderPreparationStatus {
    const ready=this.preparationReady,phase=this.preparationPhase??'idle';
    return {stage:!this.mounted?'disposed':ready?'ready':phase==='ready'?'idle':phase,revision:this.preparationRevision??-1,requestedRevision:this.materialRevision,elapsedMs:ready?this.preparationReport.milliseconds:this.preparationStarted?Math.max(0,performance.now()-this.preparationStarted):0,completedPrograms:this.completedPrograms??null,totalPrograms:this.renderer.info.programs?.length??0};
  }
  /** Eagerly await before offering PointerLock. Calling this repeatedly shares
   * work; quality changes during compilation are prepared at their latest revision. */
  prepare():Promise<ShaderPreparationReport>{
    if(!this.mounted)return Promise.resolve({...this.preparationReport,disposed:true});
    if(this.preparationReady)return Promise.resolve(this.preparationReport);
    if(this.preparationPromise)return this.preparationPromise;
    this.preparationPromise=this.prepareLatest().finally(()=>{this.preparationPromise=null;});return this.preparationPromise;
  }
  private async prepareLatest():Promise<ShaderPreparationReport>{
    while(this.mounted&&this.preparedRevision!==this.materialRevision){
      const revision=this.materialRevision,start=performance.now(),parallel=this.renderer.extensions.has('KHR_parallel_shader_compile');
      this.preparationRevision=revision;this.preparationStarted=start;this.preparationPhase='compiling';this.completedPrograms=null;
      try{
        this.renderer.compile(this.scene,this.camera);this.renderer.compile(this.weaponScene,this.weaponCamera);
        // Three's compileAsync owns an uncancellable material polling timer.
        // Poll the same KHR completion flag here so disposal or a changed
        // material revision cannot dereference destroyed programs later.
        if(parallel)await this.waitForPrograms(revision,start);
        if(!this.mounted)break;
        if(revision!==this.materialRevision)continue;
        // Material compilation alone does not allocate shadow/postprocessing
        // buffers or upload all hidden viewmodels. Warm those real paths into an
        // offscreen target without submitting a frame to shooting registration.
        this.preparationPhase='warming';this.warmRenderPaths();this.preparationPhase='gpu';
        await this.waitForWarmDraw(revision,start);
      }catch(error){if(this.mounted){this.preparationPhase='failed';throw error;}break;}
      if(this.mounted&&revision===this.materialRevision){this.preparedRevision=revision;this.preparationPhase='ready';this.completedPrograms=this.renderer.info.programs?.length??0;this.preparationReport={revision,milliseconds:performance.now()-start,programs:this.renderer.info.programs?.length??0,method:parallel?'parallel':'synchronous',disposed:false};}
    }
    return {...this.preparationReport,disposed:!this.mounted};
  }
  private async waitForPrograms(revision:number,start:number){
    const gl=this.renderer.getContext(),extension=gl.getExtension('KHR_parallel_shader_compile');if(!extension)return;
    while(this.mounted&&revision===this.materialRevision){
      if(gl.isContextLost())throw new Error('Graphics context lost during shader preparation');
      const programs=this.renderer.info.programs??[];this.completedPrograms=programs.reduce((count,program)=>count+Number(!program.program||!!gl.getProgramParameter(program.program,extension.COMPLETION_STATUS_KHR)),0);const pending=this.completedPrograms<programs.length;
      if(!pending)return;if(performance.now()-start>45000)throw new Error('Shader preparation did not complete within45seconds');
      await new Promise<void>(resolve=>setTimeout(resolve,8));
    }
  }
  private async waitForWarmDraw(revision:number,start:number){
    const gl=this.renderer.getContext() as WebGL2RenderingContext;
    if(typeof gl.fenceSync!=='function'){gl.finish();return;}
    const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence){gl.finish();return;}
    gl.flush();
    try{
      while(this.mounted&&revision===this.materialRevision){
        if(gl.isContextLost())throw new Error('Graphics context lost during warm rendering');
        const status=gl.clientWaitSync(fence,0,0);
        if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;
        if(status===gl.WAIT_FAILED)throw new Error('Shader warm render fence failed');
        if(performance.now()-start>45000)throw new Error('Graphics preparation did not complete within45seconds');
        await new Promise<void>(resolve=>setTimeout(resolve,8));
      }
    }finally{if(!gl.isContextLost())gl.deleteSync(fence);}
  }
  private warmRenderPaths(){
    const previousTarget=this.renderer.getRenderTarget(),previousClear=this.renderer.autoClear,weaponVisible=this.weapon.visible;
    const weaponVisibility=WEAPON_ORDER.map(id=>this.visuals[id].root.visible),probe=new THREE.WebGLRenderTarget(16,16);
    const composerScreen=this.composer?.renderToScreen;
    const candidates:(THREE.Object3D|undefined)[]=[this.impacts[0]?.mesh,this.surfaceImpacts[0],this.tracers[0],this.shells[0]?.mesh,this.sparks[0]?.mesh,...WEAPON_ORDER.map(id=>this.visuals[id].muzzle)];
    const representatives=candidates.filter((v):v is THREE.Object3D=>!!v);
    const effectVisibility=representatives.map(mesh=>mesh.visible),effectCulling=representatives.map(mesh=>mesh.frustumCulled);
    try{
      if(!this.canvasWarmHidden){this.canvasVisibility=this.canvas.style.visibility;this.canvas.style.visibility='hidden';this.canvasWarmHidden=true;}
      this.updateCharacters(1);
      this.weapon.visible=true;for(const id of WEAPON_ORDER)this.visuals[id].root.visible=true;for(const mesh of representatives){mesh.visible=true;mesh.frustumCulled=false;}this.decalsDirty=true;this.updateSurfaceDecals();
      this.scene.updateMatrixWorld(true);this.weaponScene.updateMatrixWorld(true);this.renderer.setRenderTarget(probe);
      this.renderer.render(this.scene,this.camera);this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);
      // Regular offscreen targets use linear output in Three. Also warm the
      // actual default framebuffer's sRGB variant while the canvas is hidden;
      // otherwise the first visible frame can compile a second shader set.
      this.renderer.setRenderTarget(null);for(const id of WEAPON_ORDER)this.visuals[id].root.visible=id===this.simulation.weaponId;
      this.renderer.render(this.scene,this.camera);this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);
      if(this.composer){this.composer.renderToScreen=true;this.composer.render(0);}
    }finally{
      if(this.composer&&composerScreen!==undefined)this.composer.renderToScreen=composerScreen;
      this.weapon.visible=weaponVisible;WEAPON_ORDER.forEach((id,i)=>{this.visuals[id].root.visible=weaponVisibility[i];});representatives.forEach((mesh,i)=>{mesh.visible=effectVisibility[i];mesh.frustumCulled=effectCulling[i];});this.decalsDirty=true;this.updateSurfaceDecals();
      this.renderer.autoClear=previousClear;this.renderer.setRenderTarget(previousTarget);probe.dispose();
    }
  }
  private ensureEnvironment(quality:Settings['graphicsPreset']){
    // PBR metal still has an indirect reflection on Low. The previous renderer
    // generated a256px PMREM even when its Low preset discarded the result.
    const size={low:32,medium:64,high:128,ultra:128}[quality];
    if(size!==this.environmentSize){const probe=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);let next:THREE.WebGLRenderTarget;try{next=pmrem.fromScene(probe,.04,.1,100,{size});}finally{probe.dispose();pmrem.dispose();}this.environmentTarget?.dispose();this.environmentTarget=next;this.environmentSize=size;}
    this.scene.environment=quality==='low'?null:this.environmentTarget?.texture??null;this.weaponScene.environment=this.environmentTarget?.texture??null;
  }
  get materialMemory(){return this.materialLibrary.stats();}
  get characterRendering(){return this.characterBatches?.getStats()??null;}
  private material(color:number,_roughness=.8,family:VisualMaterialId='painted-concrete'){
    const m=this.materialLibrary.material(family,{tint:color});this.materials.add(m);return m;
  }
  private box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material,finishes?:readonly BoxFinish[]){const r=Math.min(.035,Math.min(w,h,d)*.12),g=finishes||Math.min(w,h,d)>.09?architecturalBox(w,h,d,r,finishes):new THREE.BoxGeometry(w,h,d);this.geometries.add(g);const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.updateMatrix();const family=material.userData.visualMaterialId as VisualMaterialId|undefined;if(family)writeWorldScaleUV(g,VISUAL_MATERIALS[family].metersPerTile,m.matrix);m.castShadow=true;m.receiveShadow=true;m.userData.staticRange=true;this.scene.add(m);return m;}
  private obstacleBox(obstacle:Obstacle,material:THREE.MeshStandardMaterial,tactical=false){
    obstacle.box.getSize(this.size);
    obstacle.box.getCenter(this.position);
    const {x:width,y:height,z:depth}=this.size;
    const {x,y,z}=this.position;
    const plinth=obstacle.kind==='wall'&&!obstacle.material&&height>=2.5;
    if(obstacle.ramp||material.transparent||(obstacle.kind==='cover'&&obstacle.material)||(!plinth&&!tactical)){
      const mesh=this.box(width,height,depth,x,y,z,material);
      if(material.transparent){
        // Glass panes sort individually and do not cast a solid box shadow.
        mesh.userData.staticRange=false;
        mesh.castShadow=false;
      }
      return mesh;
    }

    const finishes:BoxFinish[]=[];
    if(plinth)finishes.push({below:-height/2+.22,color:WALL_PLINTH});
    finishes.push(
      {below:height/2-Math.min(.12,height/3),color:material.color},
      {below:Infinity,color:plinth?WALL_CORNICE:TACTICAL_CORNICE},
    );
    const painted=this.materialLibrary.material(material.userData.visualMaterialId??'painted-concrete',{tint:0xffffff,roughness:material.roughness,metalness:material.metalness,vertexColors:true});this.materials.add(painted);
    return this.box(width,height,depth,x,y,z,painted,finishes);
  }
  private buildEnvironment(){
    if(this.simulation.practiceMap!=='range'){this.buildTactical();return;}

    const floor=this.material(0x8a9089,.94,'raw-concrete'),trim=this.material(0x3e535b,.7,'painted-metal'),metal=this.material(0x667b80,.55,'brushed-metal'),accent=this.material(0xbcb18b,.85,'painted-concrete');
    this.box(24,0.15,40,0,-0.075,-10,floor);
    // Broad expansion seams give depth without high-frequency combat clutter.
    const seam=this.material(0x76857f,.95);for(let z=5;z>-30;z-=5)this.box(23.9,.006,.024,0,.004,z,seam);
    for(const o of this.simulation.obstacles)this.obstacleBox(o,this.tacticalSurface(o));
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
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.textures.add(texture);
    const paint=()=>{ctx.clearRect(0,0,512,128);ctx.fillStyle='#e3e5d9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 48px sans-serif';ctx.fillText(translateText(text),256,64,490);texture.needsUpdate=true;};
    paint();this.localizedSigns.push(paint);
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});this.materials.add(material);const g=new THREE.PlaneGeometry(width,width/4);this.geometries.add(g);const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);if(floor)mesh.rotation.x=-Math.PI/2;else if(reverse)mesh.rotation.y=Math.PI;this.scene.add(mesh);
  }
  private buildTargets(){
    // The canonical animated surface matrices remain the hit-registration input.
    // GPU grouping and visibility compaction never alter those world poses.
    const version=this.simulation.characterGeometry,field=version!==LEGACY_CHARACTER_GEOMETRY;
    const familyFor=(part:number):VisualMaterialId=>part===0?'composite':field||part<7?'fabric':'rubber';
    const byFamily=new Map<VisualMaterialId,THREE.MeshStandardMaterial>(),geometries:THREE.BufferGeometry[]=[],perPart:THREE.MeshStandardMaterial[]=[];
    const count=this.simulation.targets.length;
    for(let j=0;j<11;j++){
      const family=familyFor(j),geometry=characterPartGeometry(j,version),part=this.simulation.targets[0]?.parts[j];
      let material=byFamily.get(family);
      if(!material){
        const options=field?{tint:0xffffff,vertexColors:true,roughness:1,normalStrength:.12}:{tint:0xffffff,vertexColors:true};
        material=this.materialLibrary.material(family,options);
        if(field)useCharacterFinishes(material);
        byFamily.set(family,material);
        this.materials.add(material);
      }
      const scale=part?new THREE.Matrix4().makeScale(part.size.x,part.size.y,part.size.z):undefined;
      writeWorldScaleUV(geometry,VISUAL_MATERIALS[family].metersPerTile,scale);
      this.geometries.add(geometry);
      geometries.push(geometry);
      perPart.push(material);
    }
    this.characterBatches=createCharacterBatches(geometries,perPart,count,useMultiDrawCharacters(this.capabilities,!!this.renderer.getContext().getExtension('WEBGL_multi_draw')));
    this.targetBatches=[...this.characterBatches.objects];for(const batch of this.targetBatches)this.scene.add(batch);
    for(let i=0;i<count;i++){
      const meshes=geometries.map((geometry,j)=>{const mesh=new THREE.Mesh(geometry,perPart[j]);mesh.matrixAutoUpdate=false;return mesh;});
      this.targetMeshes.push(meshes);this.targetMatrices.push(meshes.map(mesh=>mesh.matrix));this.renderedTargetPositions.push(new THREE.Vector3());
    }
    this.groundContacts=new GroundContacts(count,g=>this.geometries.add(g),m=>this.materials.add(m),t=>this.textures.add(t));this.scene.add(this.groundContacts.rings,this.groundContacts.shadows);
  }
  private buildDefenderWeapons(){
    if(!this.simulation.defenders)return;
    const material=this.materialLibrary.material('painted-metal',{tint:0xffffff,vertexColors:true});this.materials.add(material);
    for(const id of WEAPON_ORDER){const geometry=defenderWeaponGeometry(id);writeWorldScaleUV(geometry,VISUAL_MATERIALS['painted-metal'].metersPerTile);this.geometries.add(geometry);const batch=new THREE.InstancedMesh(geometry,material,this.simulation.targets.length);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;batch.name=`${id} defender equipment`;this.scene.add(batch);this.defenderWeapons.set(id,batch);}
  }
  private updateDefenderWeapons(alpha:number){
    const ai=this.simulation.defenders;if(!ai)return;
    for(const [id,batch] of this.defenderWeapons){
      let equipped=0;
      for(const t of this.simulation.targets){const memory=ai.memories[t.id];
        if(!memory||memory.weapon!==id||!t.enabled||!t.active)continue;
        const slot=equipped++;
        const pose=(memory as {pose?:number}).pose??.35;this.heldPose.position.set(.13,.9+.37*pose,.1+.35*pose);const pitch=memory.motor.pitch+memory.motor.compensationPitch+memory.gun.recoil.pitch*DEG;this.heldPose.rotation.set((1-pose)*.75-pitch*pose,memory.motor.compensationYaw+memory.gun.recoil.yaw*DEG,0);this.heldPose.scale.setScalar(1);this.heldPose.updateMatrix();
        this.heldMatrix.multiplyMatrices(t.root.matrixWorld,this.heldPose.matrix);this.heldMatrix.elements[12]+=(t.previous.x-t.position.x)*(1-alpha);this.heldMatrix.elements[14]+=(t.previous.z-t.position.z)*(1-alpha);batch.setMatrixAt(slot,this.heldMatrix);
      }
      batch.count=equipped;batch.visible=equipped>0;batch.instanceMatrix.needsUpdate=true;batch.castShadow=this.settings.shadowQuality!=='off';
    }
  }
  private buildWeapon(){
    this.weaponCamera.add(this.weapon);this.weaponScene.add(this.weaponCamera);this.weaponScene.environment=this.scene.environment;this.weaponScene.environmentIntensity=.8;this.weaponScene.add(new THREE.HemisphereLight(0xddefff,0x506565,2.4));const light=new THREE.DirectionalLight(0xffead4,3);light.position.set(-3,5,4);this.weaponScene.add(light);
    for(const id of WEAPON_ORDER){const v=createWeaponView(id,g=>{this.geometries.add(g);return g;},m=>{this.materials.add(m);return m;},this.materialLibrary);this.visuals[id]=v;this.weapon.add(v.root);}
  }
  private buildShells(){
    const g=new THREE.CylinderGeometry(0.008,0.008,0.03,6);this.geometries.add(g);const m=this.material(0xa58e52,0.28,'brushed-metal');
    for(let i=0;i<24;i++){const mesh=new THREE.Mesh(g,m);mesh.visible=false;this.scene.add(mesh);this.shells.push({mesh,velocity:new THREE.Vector3(),until:0});}
    this.debrisGeometries={'wood-chips':new THREE.BoxGeometry(.012,.004,.024),'metal-sparks':new THREE.OctahedronGeometry(.009,0),'masonry-dust':new THREE.IcosahedronGeometry(.01,0),'glass-shards':new THREE.TetrahedronGeometry(.014,0)};for(const geometry of Object.values(this.debrisGeometries))this.geometries.add(geometry);
    const particleGeometry=this.debrisGeometries['metal-sparks'];this.geometries.add(particleGeometry);const particleMaterial=new THREE.MeshBasicMaterial({color:0xffd7a4});this.materials.add(particleMaterial);
    for(let i=0;i<32;i++){const pm=particleMaterial.clone();this.materials.add(pm);const mesh=new THREE.Mesh(particleGeometry,pm);mesh.visible=false;this.scene.add(mesh);this.sparks.push({mesh,velocity:new THREE.Vector3(),until:0});}
  }
  clearImpacts(){this.previousViewYaw=this.simulation.viewYaw;this.previousViewPitch=this.simulation.viewPitch;this.adsBlend=0;this.lastShotAt=-100;this.lastRenderedShot=-1;this.gunSlide=0;for(const p of [...this.sparks,...this.shells])p.mesh.visible=false;for(const p of this.surfaceImpacts)p.visible=false;this.decalsDirty=true;for(const entry of this.impacts){entry.shot=null;entry.mesh.visible=false;}for(const tracer of this.tracers)tracer.visible=false;}
  private tacticalSurface(o:import('../collision/environment').Obstacle){
    const id=surfaceForObstacle(o),definition=SURFACES[id],family=definition.visualMaterialId;
    const b=o.box,x=(b.min.x+b.max.x)/2,z=(b.min.z+b.max.z)/2;
    const theme=this.simulation.practiceMap==='complex'?PEEK_ZONES.find(q=>Math.abs(q.center.x-x)<12.1&&Math.sign(q.center.z)===Math.sign(z))?.theme:undefined;
    const palette={facility:[0xa8b8b5,0x607c7c],research:[0xb8c7cc,0x607b8a],urban:[0xb5a38e,0x837b6e],courtyard:[0xc5b28e,0x8e967b]} as const;
    const tint=o.material?PENETRATION_MATERIALS[o.material].color:theme?palette[theme][o.kind==='cover'?1:0]:o.kind==='cover'?0x718e8b:0xc6bfae;
    const m=this.materialLibrary.material(family,{tint,...(id==='glass'?{transparent:true,opacity:.32,depthWrite:false}:{})});this.materials.add(m);return m;
  }
  private buildTactical(){
    const trim=this.material(0x52666c,.68,'painted-metal'),floor=this.material(0x858d87,.96,'raw-concrete'),light=new THREE.MeshBasicMaterial({color:0xc3c4b3});this.materials.add(light);
    const b=this.simulation.level?.bounds??[-24,-24,48,48];this.box(b[2],.15,b[3],b[0]+b[2]/2,-.075,b[1]+b[3]/2,floor);
    for(const o of this.simulation.obstacles){const mesh=this.obstacleBox(o,this.tacticalSurface(o),true);if(o.ramp){const b=o.box;this.geometries.delete(mesh.geometry);mesh.geometry.dispose();const pts=[new THREE.Vector3(b.min.x,b.min.y,b.min.z),new THREE.Vector3(b.max.x,b.min.y,b.min.z),new THREE.Vector3(b.max.x,b.min.y,b.max.z),new THREE.Vector3(b.min.x,b.min.y,b.max.z)];for(let i=0;i<4;i++)pts.push(new THREE.Vector3(pts[i].x,surfaceHeight(o,pts[i].x,pts[i].z),pts[i].z));const faces=[4,6,5,4,7,6,0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0],positions=faces.flatMap(i=>pts[i].toArray());const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();this.geometries.add(g);const family=(mesh.material as THREE.Material).userData.visualMaterialId as VisualMaterialId|undefined;if(family)writeWorldScaleUV(g,VISUAL_MATERIALS[family].metersPerTile);mesh.geometry=g;mesh.position.set(0,0,0);}}
    for(const x of [-17,-7,7,17])for(const z of [-17,-3,12,19])this.box(1.5,.015,.06,x,.015,z,light);
    if(this.simulation.level&&this.simulation.practiceMap!=='complex'){const l=this.simulation.level;this.addSign(l.title,l.spawn.x+2,.025,l.spawn.z,3,true);for(let i=0;i<l.angles.length;i++){const a=l.angles[i];this.addSign(a.label,l.route[i*3+2].x,3,-.38,3);const x=l.route[i*3+2].x;this.addSign(`${i+1} →`,x,.025,5,1.5,true);this.box(2.9,.08,.08,x,4.8,-.5,light);this.box(.06,4.6,.09,x-1.5,2.3,-.5,trim);this.box(.06,4.6,.09,x+1.5,2.3,-.5,trim);for(let z=-4;z>l.angles[i].position.z;z-=5)this.box(2,.04,.15,x,5.2,z,light);}}else if(this.simulation.practiceMap!=='complex')this.addSign('코너 피킹 · 발소리 훈련장',-7,.025,16,4,true);
    if(this.simulation.practiceMap==='complex'){for(const zone of PEEK_ZONES){this.addSign(`${zone.id} / ${zone.name}`,zone.center.x-6,4.1,Math.sign(zone.center.z)*7.93,3.6,false,zone.center.z>0);this.addSign(`${zone.id} →`,zone.center.x-6,.045,zone.entry.z,2,true);}this.scene.fog=new THREE.Fog(0xa9bdc0,65,160);}
    this.sun.shadow.camera.left=-30;this.sun.shadow.camera.right=30;this.sun.shadow.camera.top=36;this.sun.shadow.camera.bottom=-30;this.sun.shadow.camera.updateProjectionMatrix();
    const centerX=b[0]+b[2]/2,centerZ=b[1]+b[3]/2,span=Math.max(b[2],b[3])*.64;
    this.sun.position.set(centerX-35,65,centerZ+38);this.sun.target.position.set(centerX,0,centerZ);
    this.sun.shadow.camera.left=-span;this.sun.shadow.camera.right=span;this.sun.shadow.camera.top=span;this.sun.shadow.camera.bottom=-span;this.sun.shadow.camera.far=220;this.sun.shadow.camera.updateProjectionMatrix();
  }
  private buildPolish(){
    if(this.simulation.practiceMap==='range')this.buildRangePolish();
    this.buildObstacleFinishes();
    this.buildArchitecturalLayers();
    if(this.simulation.practiceMap!=='range'){this.architecture=tacticalArchitecture(this.simulation.practiceMap,this.simulation.obstacles,g=>{this.geometries.add(g);return g;},m=>{this.materials.add(m);return m;},t=>{this.textures.add(t);return t;},this.materialLibrary);this.scene.add(this.architecture);}
  }
  private buildRangePolish(){
    const concrete=this.material(0xa8b1a5,.92,'raw-concrete'),paint=this.material(0x52686c,.7,'painted-metal'),rubber=this.material(0x596c69,.97,'rubber'),edge=this.material(0x93a6a3,.65,'aluminum');
    this.surfaceMaterials.push(concrete,rubber);concrete.userData.surface='concrete';rubber.userData.surface='rubber';
    this.box(23.8,0.012,9.4,0,-0.004,5,rubber);this.box(24,0.26,0.4,0,0.13,9.7,paint);
    for(const x of [-11.85,11.85]){this.box(0.12,1.15,39,x,0.58,-10,concrete);this.box(0.13,0.045,39,x,1.2,-10,edge);for(let z=7;z>-30;z-=4){this.box(0.16,2.6,0.11,x,2.75,z,paint);this.box(0.05,0.08,1.8,x+(x<0?0.03:-0.03),2.3,z-1,edge);}}
    const glow=new THREE.MeshStandardMaterial({color:0xc4d7cc,emissive:0x81958b,emissiveIntensity:0.12,roughness:0.8});this.materials.add(glow);
    for(const x of [-10.9,10.9])this.box(0.04,0.022,34,x,0.025,-12,glow);
    for(let z=3;z>-29;z-=6){this.box(24,0.15,0.17,0,5.3,z,paint);this.box(24,0.018,0.08,0,5.2,z,glow);}
    for(let x=-9;x<=9;x+=4.5){this.box(3.8,0.07,0.04,x,4.55,-29.83,glow);this.box(0.07,4.1,0.1,x-2.12,2.35,-29.84,paint);}
    for(let i=0;i<4;i++){const x=-8.1+i*5.4;this.box(0.045,0.009,6,x,0.027,5,edge);this.addSign(`사선 0${i+1}`,x+1.8,0.033,7,1.3,true);}
    this.addSign('발로프랙 · 전술 훈련 시설',0,5.4,-29.8,5.2);
  }
  private buildObstacleFinishes(){
    const geometry=obstacleFinishes(this.simulation.obstacles);
    if(!geometry)return;
    const family='painted-metal';
    writeWorldScaleUV(geometry,VISUAL_MATERIALS[family].metersPerTile);
    const material=this.materialLibrary.material(family,{tint:0xffffff,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name='flush obstacle cladding';
    mesh.receiveShadow=true;
    this.geometries.add(geometry);
    this.materials.add(material);
    this.scene.add(mesh);
  }
  private archMaterials=new Map<string,THREE.MeshStandardMaterial>();
  private archMaterial(key:string,color:number,roughness:number){let m=this.archMaterials.get(key);if(!m){const family:VisualMaterialId=/metal|trim|frame/.test(key)?'painted-metal':/base|concrete/.test(key)?'raw-concrete':/warm/.test(key)?'wood':'painted-concrete';m=this.materialLibrary.material(family,{tint:color,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});this.materials.add(m);m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;this.archMaterials.set(key,m);}return m;}
  private buildArchitecturalLayers(){
    const frame=this.archMaterial('metal',0x405861,.63),inset=this.archMaterial('inset',0x809d9d,.8),warm=this.archMaterial('warm',0xc5b998,.88);
    if(this.simulation.practiceMap==='range'){
      // High clerestory openings and paired ribs compose an original training
      // campus. All new forms are above combat height or outside the play area.
      for(const x of [-11.98,11.98])for(let z=3;z>-29;z-=6){this.box(.025,1.08,3.6,x,3.4,z,inset);this.box(.04,.055,3.75,x,2.84,z,frame);this.box(.04,.055,3.75,x,3.96,z,frame);for(const k of [-1,0,1])this.box(.05,1.12,.045,x,3.4,z+k,frame);}
      for(let z=3;z>-29;z-=6){this.box(23.9,.06,.42,0,5.43,z,warm);this.box(23.9,.08,.08,0,5.31,z-.24,frame);}
      this.addSign('VALOPRAC  /  전술 훈련 시설',0,4.6,-29.8,8);
    }else{
      const level=this.simulation.level;
      if(level&&this.simulation.practiceMap!=='complex'){for(let i=0;i<level.angles.length;i++){
        const x=level.route[i*3+2].x;
        // Threshold construction remains within the pre-existing doorway wall.
        this.box(3.1,.17,.65,x,5.63,0,frame);this.box(2.55,.07,.72,x,5.5,0,warm);
        this.addSign(`훈련 구역 0${i+1}`,x,4.1,.365,2.2);
        // Raised platforms retain their exact top surfaces; riser stripes sit on
        // the solids, with no floating railings that would imply false collision.
        const a=level.angles[i];if(a.position.y>0)this.addSign('상단 수비각',x,a.position.y+.02,a.position.z+2,1.8,true);
      }}
      const bounds=level?.bounds??[-24,-24,48,48];const x=bounds[0]+bounds[2]/2;
      this.addSign('VALOPRAC  /  전술 훈련 단지',x,5,bounds[1]+1.05,8);
    }
  }
  private batchStaticArchitecture(){
    this.scene.updateMatrixWorld(true);const groups=new Map<string,{material:THREE.Material;list:THREE.Mesh[];palette:boolean}>();
    for(const child of this.scene.children){if(!(child instanceof THREE.Mesh)||!child.userData.staticRange||Array.isArray(child.material))continue;const signature=colorBatchSignature(child.material),key=signature??child.material.uuid;const group=groups.get(key)??{material:child.material,list:[] as THREE.Mesh[],palette:signature!==null};group.list.push(child);groups.set(key,group);}
    for(const {material,list,palette} of groups.values()){if(list.length<2)continue;const merged=mergeStaticArchitecture(list,'world',palette);if(!merged)continue;let surface=material;if(palette){const family=material.userData.visualMaterialId as VisualMaterialId|undefined;const source=material as THREE.MeshStandardMaterial;const tinted=family?this.materialLibrary.material(family,{tint:0xffffff,vertexColors:true,roughness:source.roughness,metalness:source.metalness,normalStrength:source.normalScale.x,polygonOffset:source.polygonOffset,polygonOffsetFactor:source.polygonOffsetFactor,polygonOffsetUnits:source.polygonOffsetUnits}):material.clone() as THREE.MeshStandardMaterial;tinted.color.setHex(0xffffff);tinted.vertexColors=true;surface=tinted;this.materials.add(surface);}this.geometries.add(merged);merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,surface);mesh.name='batched structural palette';mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);for(const item of list){this.scene.remove(item);this.geometries.delete(item.geometry);item.geometry.dispose();}}
  }
  applySettings(settings:Settings){
    settings={...settings,...automaticGraphicsPatch(settings,this.capabilities.recommendLow,this.capabilities.kind)};
    const shaderKey=[settings.graphicsPreset,settings.shadowQuality,settings.textureQuality,settings.postProcessing,settings.ambientOcclusion,settings.antialias,settings.effectsQuality,settings.renderScale].join(':');
    if(shaderKey!==this.shaderKey){this.shaderKey=shaderKey;this.materialRevision++;}
    this.settings={...settings};this.materialLibrary.setQuality(settings.textureQuality);this.ensureEnvironment(settings.graphicsPreset);this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)*settings.renderScale);
    const shadows=settings.shadowQuality!=='off';this.renderer.shadowMap.enabled=shadows;this.sun.castShadow=shadows;
    for(const batch of [...this.targetBatches,...this.defenderWeapons.values()])batch.castShadow=shadows;
    const resolution={off:256,low:512,medium:1024,high:2048,ultra:2048}[settings.shadowQuality];
    if(this.sun.shadow.mapSize.x!==resolution){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(resolution,resolution);}
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
    this.surfaceImpacts.forEach((mesh,i)=>{if(i>={low:12,medium:24,high:48,ultra:96}[settings.effectsQuality])mesh.visible=false;});this.decalsDirty=true;
    for(const id of WEAPON_ORDER)this.visuals[id].accent.emissiveIntensity=settings.premiumTheme?0.65:0.08;
    this.resize();
  }
  private disposeComposer(){if(this.composer){
    // Three r180 SSAOPass.dispose omits its generated noise texture and the
    // main SSAO material. Release both when changing presets or leaving a map.
    this.ao?.noiseTexture.dispose();this.ao?.ssaoMaterial.dispose();
    for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();
  }this.composer=null;this.ao=null;this.bloom=null;this.fxaa=null;}
  private buildImpacts(){
    const geo=new THREE.SphereGeometry(0.022,6,4);this.geometries.add(geo);const mat=new THREE.MeshBasicMaterial({color:0xc0ff98});this.materials.add(mat);
    const decal=new THREE.CircleGeometry(.025,8);this.geometries.add(decal);for(let i=0;i<96;i++){const material=new THREE.MeshBasicMaterial({color:0x303530,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});this.materials.add(material);const mesh=new THREE.Mesh(decal,material);mesh.visible=false;this.surfaceImpacts.push(mesh);}
    const surfaceMaterial=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});this.materials.add(surfaceMaterial);this.decalBatch=new THREE.InstancedMesh(decal,surfaceMaterial,96);this.decalBatch.name='pooled surface decals';this.decalBatch.frustumCulled=false;this.decalBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.decalBatch.setColorAt(0,new THREE.Color(0xffffff));this.decalBatch.count=0;this.scene.add(this.decalBatch);
    for(let i=0;i<160;i++){const mesh=new THREE.Mesh(geo,mat);mesh.visible=false;this.scene.add(mesh);this.impacts.push({mesh,shot:null});}
    const tracerMat=new THREE.LineBasicMaterial({color:0xffddb1,transparent:true,opacity:0.23});this.materials.add(tracerMat);
    for(let i=0;i<8;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));this.geometries.add(g);const l=new THREE.Line(g,tracerMat);l.visible=false;l.frustumCulled=false;this.tracers.push(l);this.scene.add(l);}
  }
  private updateSurfaceDecals(){
    const batch=this.decalBatch;if(!batch||!this.decalsDirty)return;let count=0;
    for(const mesh of this.surfaceImpacts)if(mesh.visible){mesh.updateMatrix();batch.setMatrixAt(count,mesh.matrix);batch.setColorAt(count,(mesh.material as THREE.MeshBasicMaterial).color);count++;}
    batch.count=count;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;this.decalsDirty=false;
  }
  private placeSurfaceImpact(material:SurfaceId,p:Vec3,n:Vec3,exit:boolean,thickness=0,lift=.004){
    const definition=SURFACES[material],profile=SURFACE_PARTICLE_PROFILES[definition.particleProfile],budget={low:12,medium:24,high:48,ultra:96}[this.settings.effectsQuality],mesh=this.surfaceImpacts[this.surfaceImpactIndex++%budget];
    mesh.position.set(p.x+n.x*lift,p.y+n.y*lift,p.z+n.z*lift);this.effectNormal.set(n.x,n.y,n.z);mesh.quaternion.setFromUnitVectors(this.effectForward,this.effectNormal);
    (mesh.material as THREE.MeshBasicMaterial).color.setHex(profile.decalColor);mesh.scale.setScalar(exit?1.5:1);mesh.visible=true;this.decalsDirty=true;
    if(this.settings.effectsQuality!=='low'){
      const count=Math.min(profile.count,exit?4:3);
      for(let i=0;i<count;i++){const particle=this.sparks[this.sparkIndex++%this.sparks.length];particle.mesh.geometry=this.debrisGeometries[definition.particleProfile];particle.mesh.position.copy(mesh.position);(particle.mesh.material as THREE.MeshBasicMaterial).color.setHex(profile.color);particle.mesh.scale.setScalar(exit?1.15:1);particle.mesh.rotation.set(i*.7,thickness*.5,i*1.1);particle.velocity.set(n.x*(.4+i*.16)+(i-1)*.12,n.y*.7+.3+i*.12,n.z*(.4+i*.16)).multiplyScalar(profile.speed);particle.until=this.simulation.time+profile.lifetime;particle.mesh.visible=true;}
    }
  }
  private penetrationEffects(segments:PenetrationSegment[]){
    for(const segment of segments){
      if(segment.entrySurface!==false)this.placeSurfaceImpact(segment.material,segment.entry,segment.entryNormal,false,segment.thickness);
      if(segment.penetrated&&segment.exitSurface!==false)this.placeSurfaceImpact(segment.material,segment.exit,segment.exitNormal,true,segment.thickness);
    }
  }
  addDefenderShot(shot:{origin:Vec3;impact:Vec3;segments?:PenetrationSegment[]}){
    this.penetrationEffects(shot.segments??[]);const floor=floorImpactSurfaceAt(this.simulation.practiceMap,shot.impact,this.simulation.rules);if(floor)this.placeSurfaceImpact(floor,shot.impact,this.effectUp,false,0,.008);this.addTracer(shot.origin,shot.impact);
  }
  private addTracer(origin:Vec3,impact:Vec3){const tracer=this.tracers[this.tracerIndex++%this.tracers.length],a=tracer.geometry.getAttribute('position') as THREE.BufferAttribute;a.setXYZ(0,origin.x,origin.y,origin.z);a.setXYZ(1,impact.x,impact.y,impact.z);a.needsUpdate=true;tracer.visible=true;tracer.userData.expire=this.simulation.time+.045;}
  addShot(shot:ShotEvent){
    if(shot.lifeGeneration!==undefined&&shot.lifeGeneration!==this.simulation.lifeGeneration)return;
    this.penetrationEffects(shot.penetrationSegments??[]);const floor=floorImpactSurface(this.simulation.practiceMap,shot,this.simulation.rules);if(floor)this.placeSurfaceImpact(floor,shot.impact,this.effectUp,false,0,.008);
    this.lastShotAt=this.simulation.time;this.gunSlide=1;
    if(shot.weapon!=='sheriff'&&this.settings.effectsQuality!=='low'){
      const shell=this.shells[this.shellIndex++%this.shells.length];shell.mesh.position.set(0.16,-0.12,-0.2).applyMatrix4(this.camera.matrixWorld);shell.velocity.set(1.5,1.8,-0.3).applyQuaternion(this.camera.quaternion);shell.until=this.simulation.time+0.8;shell.mesh.visible=true;
    }
    if(!floor&&shot.hit!=='miss'&&(shot.hit!=='wall'||!shot.penetrationSegments?.length)&&this.settings.effectsQuality!=='low'){const count=this.settings.effectsQuality==='ultra'?6:this.settings.effectsQuality==='high'?4:2;for(let i=0;i<count;i++){const p=this.sparks[this.sparkIndex++%this.sparks.length];p.mesh.position.set(shot.impact.x,shot.impact.y,shot.impact.z+0.02);(p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xffd7a4);p.mesh.geometry=this.debrisGeometries['metal-sparks'];p.mesh.scale.setScalar(1);p.velocity.set(((shot.magazineShot+i*7)%9-4)*0.24,0.4+i*0.12,0.5+(i%3)*0.2);p.until=this.simulation.time+0.18;p.mesh.visible=true;}}
    if(shot.hit==='wall'&&!shot.penetrationSegments?.length&&!floor){const entry=this.impacts[this.impactIndex++%this.impacts.length];entry.shot=shot;entry.mesh.position.set(shot.impact.x,shot.impact.y,shot.impact.z+0.015);entry.mesh.visible=true;}
    const tracer=this.tracers[this.tracerIndex++%this.tracers.length];const a=tracer.geometry.getAttribute('position') as THREE.BufferAttribute;
    a.setXYZ(0,shot.position.x+0.2,shot.position.y+this.simulation.movement.eyeHeight-0.16,shot.position.z-0.35);a.setXYZ(1,shot.impact.x,shot.impact.y,shot.impact.z);a.needsUpdate=true;tracer.visible=true;tracer.userData.expire=this.simulation.time+0.045;
  }
  resize(){if(!this.mounted)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.weaponCamera.aspect=w/h;this.weaponCamera.fov=2*Math.atan(Math.tan(VIEWMODEL_HFOV*DEG/2)/this.weaponCamera.aspect)/DEG;this.weaponCamera.updateProjectionMatrix();this.updateFov();this.composer?.setPixelRatio(this.renderer.getPixelRatio());this.composer?.setSize(w,h);if(this.ao)this.ao.setSize(Math.ceil(w*this.renderer.getPixelRatio()*0.5),Math.ceil(h*this.renderer.getPixelRatio()*0.5));if(this.fxaa)this.fxaa.uniforms.resolution.value.set(1/(w*this.renderer.getPixelRatio()),1/(h*this.renderer.getPixelRatio()));}
  private updateFov(){this.camera.fov=cameraVerticalFov(this.settings.fov,1,this.camera.aspect);this.camera.updateProjectionMatrix();}
  private updateCharacters(alpha:number){
    const s=this.simulation;
    for(let i=0;i<s.targets.length;i++){
      const t=s.targets[i],death=THREE.MathUtils.clamp((s.time-t.deadAt)/0.4,0,1),dx=(t.previous.x+(t.position.x-t.previous.x)*alpha)-t.position.x,dz=(t.previous.z+(t.position.z-t.previous.z)*alpha)-t.position.z;
      for(let j=0;j<t.parts.length;j++){
        const p=t.parts[j],mesh=this.targetMeshes[i][j];mesh.visible=t.enabled&&(t.active||death<1);mesh.castShadow=this.settings.shadowQuality!=='off';mesh.matrix.copy(p.node.matrixWorld);
        mesh.matrix.elements[12]+=dx;mesh.matrix.elements[14]+=dz;
        mesh.matrix.scale(p.size);
        if(!t.active){mesh.matrix.elements[13]-=death*0.85;mesh.matrix.scale(this.size.setScalar(1-death*0.45));}
        if(!mesh.visible)mesh.matrix.scale(this.size.setScalar(0));this.characterBatches!.setPartMatrix(i,j,mesh.matrix,mesh.visible);
      }
      this.renderedTargetPositions[i].set(t.position.x+dx,t.position.y,t.position.z+dz);
    }
    this.groundContacts.update(s.targets,alpha,this.camera);
    this.updateDefenderWeapons(alpha);
    this.characterBatches?.commit();this.characterBatches?.setShadow(this.settings.shadowQuality!=='off');
  }
  render(alpha:number,elapsed:number,preview:boolean,_ads:boolean){
    this.renderer.info.reset();const s=this.simulation,m=s.movement;
    if(preview){if(s.practiceMap==='complex'){
      const zone=zoneForScenario(this.settings.peekScenario)??PEEK_ZONES[0],sign=Math.sign(zone.center.z);
      // Preview the selected real bay, including rear-facing zones. The old
      // fixed camera pointed into a gallery wall for half of the complex.
      this.camera.position.set(zone.entry.x+2,3.1,sign*10.4);this.camera.lookAt(zone.center.x+2,1.5+zone.vertical*.45,zone.center.z);
    }else if(s.level){this.camera.position.set(s.level.spawn.x,3.8,8);const focus=s.level.angles[1]?.position??s.level.route[Math.min(3,s.level.route.length-1)]??s.level.spawn;this.camera.lookAt(focus.x,focus.y+1.5,focus.z);}else if(s.practiceMap==='tactical'){this.camera.position.set(-7,3.8,18);this.camera.lookAt(-7,1.05,0);}else{this.camera.position.set(3.6,2.3,6.5);this.camera.lookAt(0,1.05,-16);}this.weapon.visible=false;}
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
    const inspection=this.inspectionCamera;
    if(inspection){this.camera.position.set(inspection.position.x,inspection.position.y,inspection.position.z);this.camera.lookAt(inspection.target.x,inspection.target.y,inspection.target.z);this.weapon.visible=false;}
    if(this.architecture)updateTacticalArchitecture(this.architecture,this.camera.position,this.settings.graphicsPreset);
    const zoom=preview?1:s.weaponId==='operator'?s.scopeZoom:1+(s.weapon.profile.adsZoom-1)*this.adsBlend;const vf=cameraVerticalFov(inspection?.fov??this.settings.fov,inspection?1:zoom,this.camera.aspect);if(Math.abs(this.camera.fov-vf)>0.001){this.camera.fov=vf;this.camera.updateProjectionMatrix();}
    this.updateCharacters(alpha);
    for(const tracer of this.tracers)if(tracer.visible&&s.time>tracer.userData.expire)tracer.visible=false;
    for(const shell of this.shells){if(!shell.mesh.visible)continue;if(s.time>=shell.until){shell.mesh.visible=false;continue;}const dt=s.running?Math.min(elapsed,0.05):0;shell.velocity.y-=9.8*dt;shell.mesh.position.addScaledVector(shell.velocity,dt);shell.mesh.rotation.x+=dt*12;shell.mesh.rotation.z+=dt*8;}
    for(const p of this.sparks){if(!p.mesh.visible)continue;if(s.time>=p.until){p.mesh.visible=false;continue;}const dt=s.running?Math.min(elapsed,0.05):0;p.velocity.y-=5*dt;p.mesh.position.addScaledVector(p.velocity,dt);}
    this.updateSurfaceDecals();
    if(this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
    if(!preview&&!this.composer&&!inspection){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);this.renderer.autoClear=true;}
    if(!preview&&this.recordFrames)s.renderedTargets.capture(s.targets,this.targetMatrices,performance.now(),this.renderedTargetPositions,{tick:s.ticks,alpha});
    if(this.canvasWarmHidden){this.canvas.style.visibility=this.canvasVisibility;this.canvasWarmHidden=false;}
  }
  get calls(){return this.renderer.info.render.calls;}
  dispose(){this.mounted=false;this.unsubscribeLocale?.();this.localizedSigns.length=0;this.observer.disconnect();this.disposeComposer();this.environmentTarget?.dispose();this.groundContacts.dispose();this.characterBatches?.dispose();this.characterBatches=null;this.decalBatch?.dispose();this.decalBatch=null;for(const batch of this.defenderWeapons.values())batch.dispose();this.sun.shadow.map?.dispose();for(const g of this.geometries)g.dispose();for(const m of this.materials)if(!m.userData.surfaceMaterialManaged)m.dispose();this.materialLibrary.dispose();for(const t of this.textures)t.dispose();const skeletons=new Set<THREE.Skeleton>();this.weaponScene.traverse(node=>{if(node instanceof THREE.SkinnedMesh)skeletons.add(node.skeleton);});for(const skeleton of skeletons)skeleton.dispose();this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.scene.clear();this.weaponScene.clear();this.geometries.clear();this.materials.clear();this.textures.clear();this.archMaterials.clear();this.targetMeshes.length=this.targetMatrices.length=this.renderedTargetPositions.length=0;this.targetBatches.length=this.surfaceImpacts.length=this.impacts.length=this.sparks.length=this.shells.length=this.tracers.length=this.surfaceMaterials.length=0;this.defenderWeapons.clear();}
}
