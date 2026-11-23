import {DEFAULT_SETTINGS,GRAPHICS_PRESETS} from '../config/settings';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {Simulation} from '../engine/simulation/Simulation';
import type {Quality,Vec3} from '../engine/types';

type Pose='front'|'rear'|'portrait'|'crouch'|'lane';
const host=document.querySelector<HTMLElement>('#stage')!;
const origin={x:0,y:0,z:-12};
const cameras:Record<Pose,{position:Vec3;target:Vec3;fov:number}>={
  front:{position:{x:.7,y:1.24,z:-8.4},target:{x:0,y:.95,z:-12},fov:48},
  rear:{position:{x:2,y:1.25,z:-15.4},target:{x:0,y:.95,z:-12},fov:48},
  portrait:{position:{x:.38,y:1.65,z:-10.47},target:{x:0,y:1.55,z:-12},fov:35},
  crouch:{position:{x:1.7,y:1.14,z:-9},target:{x:0,y:.74,z:-12},fov:45},
  lane:{position:{x:0,y:1.64,z:3},target:{x:0,y:1.64,z:-12},fov:82},
};
let renderer:RangeRenderer|null=null;

async function run(quality:Quality,poses:Pose[]){
  dispose();
  const settings={...structuredClone(DEFAULT_SETTINGS),...GRAPHICS_PRESETS[quality],graphicsPreset:quality,
    practiceMap:'range' as const,autoGraphics:false,renderScale:1,targetCount:8,
    postProcessing:false,ambientOcclusion:false,antialias:false};
  const simulation=new Simulation('free','rifleA',settings);
  const view=renderer=new RangeRenderer(host,simulation,settings,{recordFrames:false});
  await view.prepare();
  const programs=view.renderer.info.programs?.length??0;
  const rows=[];
  for(const pose of poses){
    for(const target of simulation.targets){
      target.enabled=target.active=pose==='lane'?target.id<8:target.id===0;
      if(!target.active)continue;
      target.spawn(origin.x+(pose==='lane'?(target.id-3.5)*1.3:0),origin.z-(pose==='lane'?target.id%2*3:0),0,origin.y);
      target.crouch=pose==='crouch'?1:0;
      target.velocity.x=pose==='crouch'?1.6:0;
      target.updatePose(.35);
    }
    view.inspectionCamera=cameras[pose];
    await new Promise(requestAnimationFrame);
    view.render(1,1/60,false,false);
    const info=view.renderer.info.render;
    rows.push({pose,camera:cameras[pose],drawCalls:info.calls,triangles:info.triangles,programs:(view.renderer.info.programs?.length??0)-programs});
  }
  const arrays=new Set<ArrayBufferView>();
  let meshCount=0;
  for(const mesh of view.scene.children){
    if(!mesh.name.includes('character part')||!('geometry' in mesh))continue;
    const geometry=mesh.geometry as import('three').BufferGeometry;
    for(const attr of Object.values(geometry.attributes))arrays.add(attr.array);
    if(geometry.index)arrays.add(geometry.index.array);
    meshCount++;
  }
  return {quality,viewport:[host.clientWidth,host.clientHeight],rows,meshCount,
    geometryBytes:[...arrays].reduce((sum,array)=>sum+array.byteLength,0),
    batching:view.characterRendering,renderer:view.capabilities.renderer};
}
function dispose(){renderer?.dispose();renderer=null;return host.childElementCount;}
Object.assign(window,{characterAudit:{run,dispose}});
