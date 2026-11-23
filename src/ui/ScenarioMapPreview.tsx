import {arenaPattern,loadArenaPatterns} from '../config/arenaPatterns';
import {arenaLight,arenaPalette} from '../config/arenaAppearance';
import { useEffect, useRef, useState } from 'react';
import { BoxGeometry, BufferGeometry, Color, DirectionalLight, Group, HemisphereLight, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry, Scene, SphereGeometry, Vector3, type Raycaster } from 'three';
import { VISUAL_MATERIALS } from '../config/materials';
import { characterPartGeometry } from '../engine/rendering/CharacterGeometry';
import { useCharacterFinishes } from '../engine/rendering/CharacterMaterial';
import { SeededRandom } from '../engine/simulation/random';
import { Target } from '../engine/targets/Target';
import { MAX_SCENARIO_BOTS } from '../training/scenarios/types';
import type {ScenarioSelection} from './ScenarioPlan';
import { architecturalBox } from '../engine/rendering/ArchitecturalBox';
import { createOrbitPreview, disposePreviewGeometry } from '../engine/rendering/OrbitPreview';
import { SurfaceMaterialLibrary, writeWorldScaleUV } from '../engine/rendering/SurfaceMaterials';
import { tacticalBands, tacticalRampGeometry, tacticalSurfaceStyle } from '../engine/rendering/TacticalSurface';
import { gateEndpoints, scenarioEntryGate } from '../training/scenarios/entryGate';
import { scenarioApproach, scenarioLevel } from '../training/scenarios/validation';
import type { ScenarioDefinition } from '../training/scenarios/types';
import type { Vec3 } from '../engine/types';
import './orbitPreview.css';

type Selection = ScenarioSelection;
interface Props {
  definition:ScenarioDefinition;
  selected:Selection;
  detailed:boolean;
  onPlace:(point:Vec3,selection?:Selection)=>void;
  onSelect:(selection:Selection)=>void;
}
export default function ScenarioMapPreview({definition,selected,detailed,onPlace,onSelect}:Props) {
  const host=useRef<HTMLDivElement>(null);
  const level=scenarioLevel(definition);
  const preview=useRef<ReturnType<typeof createOrbitPreview>|null>(null);
  const markers=useRef<((scenario:ScenarioDefinition,selection:Selection,crouched:boolean)=>void)|null>(null);
  const actions=useRef({onPlace,onSelect});
  const [crouched,setCrouched]=useState(false);
  const [failed,setFailed]=useState(false);
  const activePoint=selected==='player'?definition.player.position:definition.bots[selected]?.position??definition.player.position;
  useEffect(()=>{actions.current={onPlace,onSelect};},[onPlace,onSelect]);

  useEffect(()=>{
    if(!host.current)return;
    const scene=new Scene();
    const [left,top,width,depth]=level.bounds;
    const center=new Vector3(left+width/2,0,top+depth/2);
    const style=arenaPalette(level.id),sky=arenaLight(level.id);
    scene.background=new Color(detailed?sky.horizon:0x182e35);
    scene.add(new HemisphereLight(0xf0f7ef,0x87958d,2.35));
    const sun=new DirectionalLight(sky.sun,2.05);
    sun.position.set(center.x-25,40,center.z+18);
    scene.add(sun);
    const available:Mesh[]=[];
    const interactive:Mesh[]=[];
    const floorPoint=(ray:Raycaster)=>{
      const hit=ray.intersectObjects(available,false)[0];
      return hit?.face&&hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>.65?hit.point:null;
    };
    let orbit:ReturnType<typeof createOrbitPreview>;
    try {
      orbit=createOrbitPreview(host.current,scene,'전술 시나리오 3D 배치',center,Math.max(width,depth)*1.45,ray=>{
        const point=floorPoint(ray);
        if(point)actions.current.onPlace({x:point.x,y:point.y,z:point.z});
      },ray=>{
        const mesh=ray.intersectObjects(interactive,false).find(hit=>hit.object.visible&&hit.object.parent?.visible)?.object;
        if(!mesh)return;
        const selection=mesh.userData.selection as Selection;
        const object=selection==='player'?player:actors[selection].target.root;
        const origin=object.position.clone();
        const first=floorPoint(ray);
        const dx=first?origin.x-first.x:0,dz=first?origin.z-first.z:0;
        const translated=(liveRay:Raycaster)=>{
          const point=floorPoint(liveRay);
          return point&&{x:Math.round((point.x+dx)*100)/100,y:point.y,z:Math.round((point.z+dz)*100)/100};
        };
        actions.current.onSelect(selection);
        return {
          preview(liveRay){
            const point=translated(liveRay);
            if(point){
              object.position.set(point.x,point.y+(selection==='player'?.32:0),point.z);
              object.updateMatrixWorld(true);
              if(selection!=='player')updateHeadGuide(actors[selection].target);
              orbit.draw();
            }
          },
          finish(liveRay,moved){
            object.position.copy(origin);object.updateMatrixWorld(true);
            if(selection!=='player')updateHeadGuide(actors[selection].target);
            orbit.draw();
            const point=liveRay&&moved?translated(liveRay):null;
            if(point)actions.current.onPlace(point,selection);
          }
        };
      });
    } catch {setFailed(true);return;}
    setFailed(false);
    preview.current=orbit;
    const patterns=loadArenaPatterns();
    const surfaces=new SurfaceMaterialLibrary({quality:'high',anisotropy:orbit.renderer.capabilities.getMaxAnisotropy()});
    const blocked=new MeshStandardMaterial({color:0x789094,roughness:.92});
    const cover=new MeshStandardMaterial({color:0x427b76,roughness:.74});
    const ground=new MeshStandardMaterial({color:0x506861,roughness:.96});
    const floor=new Mesh(new PlaneGeometry(width,depth),detailed?surfaces.material(style.floorFamily,{tint:style.floor,...arenaPattern(level.id,true,patterns)}):ground);
    floor.rotation.x=-Math.PI/2;floor.position.copy(center);floor.updateMatrix();
    if(detailed)writeWorldScaleUV(floor.geometry,floor.material.userData.surfaceMetersPerTile??VISUAL_MATERIALS[style.floorFamily].metersPerTile,floor.matrix);
    scene.add(floor);available.push(floor);
    for(const obstacle of level.obstacles){
      const {x:w,y:h,z:d}=obstacle.box.getSize(new Vector3());
      const style=tacticalSurfaceStyle(obstacle,level.id);
      const bands=detailed?tacticalBands(obstacle,level.id):undefined;
      const pattern=obstacle.material||style.glass||obstacle.ramp||obstacle.kind==='cover'?{}:arenaPattern(level.id,false,patterns);
      const material=detailed?surfaces.material(style.family,{tint:bands?0xffffff:style.tint,vertexColors:!!bands,metalness:style.glass?.1:undefined,...pattern}):obstacle.kind==='cover'?cover:blocked;
      const geometry=obstacle.ramp?tacticalRampGeometry(obstacle):detailed?architecturalBox(w,h,d,.035,bands):new BoxGeometry(w,h,d);
      const mesh=new Mesh(geometry,material);
      if(!obstacle.ramp)obstacle.box.getCenter(mesh.position);
      mesh.updateMatrix();
      if(detailed)writeWorldScaleUV(geometry,material.userData.surfaceMetersPerTile??VISUAL_MATERIALS[style.family].metersPerTile,mesh.matrix);
      scene.add(mesh);available.push(mesh);
    }

    const overlay=new Group();
    scene.add(overlay);
    const dotGeometry=new SphereGeometry(.27,12,8);
    const ringGeometry=new RingGeometry(.41,.57,24);
    const playerMaterial=new MeshBasicMaterial({color:0x64ffdb});
    const defenderMaterial=new MeshBasicMaterial({color:0xff8b74,depthTest:false});
    const selectedMaterial=new MeshBasicMaterial({color:0xffdb82,depthTest:false});
    const alternateMaterial=new MeshBasicMaterial({color:0xf4a6a0,depthTest:false});
    const uniform=useCharacterFinishes(new MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.8}));
    const partGeometry=Array.from({length:11},(_,index)=>characterPartGeometry(index));
    const player=new Mesh(dotGeometry,playerMaterial);
    player.userData.selection='player';
    interactive.push(player);
    const dots=Array.from({length:MAX_SCENARIO_BOTS*4},()=>new Mesh(dotGeometry,alternateMaterial));
    const actors=Array.from({length:MAX_SCENARIO_BOTS},(_,index)=>{
      const target=new Target(index,'stationary',new SeededRandom(index+1));
      target.parts.forEach(({node,size},part)=>{
        const mesh=new Mesh(partGeometry[part],uniform);
        mesh.scale.copy(size);mesh.userData.selection=index;node.add(mesh);interactive.push(mesh);
      });
      const ring=new Mesh(ringGeometry,defenderMaterial);
      ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.renderOrder=2;
      ring.userData.selection=index;interactive.push(ring);target.root.add(ring);overlay.add(target.root);
      return {target,ring};
    });
    const pathMaterial=new LineBasicMaterial({color:0x7ee8d8,transparent:true,opacity:.88,depthTest:false});
    const path=new Line(new BufferGeometry(),pathMaterial);
    const gateMaterial=new LineBasicMaterial({color:0xc17cf4,depthTest:false});
    const gateLine=new Line(new BufferGeometry(),gateMaterial);
    const guideMaterial=new LineBasicMaterial({color:0xffd098,depthTest:false});
    const headGuide=new Line(new BufferGeometry(),guideMaterial);
    const guideHead=new Vector3();
    const guidePoints=[new Vector3(),new Vector3()];
    headGuide.geometry.setFromPoints(guidePoints);
    const updateHeadGuide=(target:Target)=>{
      const head=target.headPosition(guideHead),positions=headGuide.geometry.getAttribute('position');
      positions.setXYZ(0,head.x-.7,head.y,head.z);
      positions.setXYZ(1,head.x-.18,head.y,head.z);
      positions.needsUpdate=true;
      headGuide.frustumCulled=false;
    };
    gateLine.renderOrder=2;headGuide.renderOrder=3;
    path.renderOrder=1;overlay.add(path,gateLine,headGuide,player,...dots);
    for(const dot of dots)dot.renderOrder=2;
    markers.current=(scenario,selection,ducked)=>{
      const spawn=scenario.player.position;
      player.position.set(spawn.x,spawn.y+.32,spawn.z);
      player.material=selection==='player'?selectedMaterial:playerMaterial;
      player.scale.setScalar(selection==='player'?1.4:1.1);
      actors.forEach(({target,ring},index)=>{
        const bot=scenario.bots[index];
        target.root.visible=!!bot;
        for(const part of target.parts)part.node.visible=!!bot;
        if(!bot)return;
        target.position.set(bot.position.x,bot.position.y,bot.position.z);
        target.crouch=ducked?1:0;target.updatePose(0);
        target.root.rotation.y=Math.atan2(spawn.x-bot.position.x,spawn.z-bot.position.z);
        target.root.updateMatrixWorld(true);
        ring.material=selection===index?selectedMaterial:defenderMaterial;
      });
      const alternate=scenario.bots.flatMap(bot=>bot.alternatives);
      dots.forEach((dot,index)=>{
        const point=alternate[index];
        dot.visible=!!point;
        if(point){dot.position.set(point.x,point.y+.2,point.z);dot.scale.setScalar(.52);}
      });
      const selectedActor=selection==='player'?undefined:actors[selection];
      headGuide.visible=!!selectedActor;
      if(selectedActor)updateHeadGuide(selectedActor.target);
      path.geometry.dispose();
      path.geometry=new BufferGeometry().setFromPoints(scenarioApproach(scenario).map(p=>new Vector3(p.x,p.y+.08,p.z)));
      const gate=scenario.rules.startOnEntry?scenarioEntryGate(scenario):null;
      gateLine.visible=!!gate;
      if(gate){gateLine.geometry.dispose();gateLine.geometry=new BufferGeometry().setFromPoints(gateEndpoints(gate).map(p=>new Vector3(p.x,p.y+.1,p.z)));}
      orbit.draw();
    };
    return ()=>{
      preview.current=null;
      markers.current=null;
      orbit.dispose();
      scene.remove(overlay);
      disposePreviewGeometry(scene);
      path.geometry.dispose();gateLine.geometry.dispose();headGuide.geometry.dispose();dotGeometry.dispose();ringGeometry.dispose();partGeometry.forEach(geometry=>geometry.dispose());surfaces.dispose();
      for(const material of [blocked,cover,ground,playerMaterial,defenderMaterial,selectedMaterial,alternateMaterial,pathMaterial,gateMaterial,guideMaterial,uniform])material.dispose();
    };
  },[level,detailed]);
  useEffect(()=>{markers.current?.(definition,selected,crouched);},[definition,selected,level,detailed,crouched]);

  return <div className="orbit-preview">
    <div ref={host} className="orbit-preview-viewport" />
    {failed?<p className="field-note" role="status">3D 보기를 열 수 없습니다. 평면도나 좌표 입력을 사용하세요.</p>:<>
      <div className="orbit-preview-actions" role="group" aria-label="3D 카메라 조작">
        <button type="button" onClick={()=>preview.current?.turn(70,0)}>왼쪽 회전</button>
        <button type="button" onClick={()=>preview.current?.turn(-70,0)}>오른쪽 회전</button>
        <button type="button" onClick={()=>preview.current?.zoom(.8)}>확대</button>
        <button type="button" onClick={()=>preview.current?.zoom(1.25)}>축소</button>
        <button type="button" onClick={()=>preview.current?.focus(new Vector3(activePoint.x,activePoint.y,activePoint.z),12)}>선택 위치 보기</button><button type="button" onClick={()=>preview.current?.reset()}>전체 보기</button>
      </div>
      <div className="orbit-preview-actions">
        <button type="button" aria-pressed={crouched} onClick={()=>setCrouched(value=>!value)}>앉은 자세 보기</button>
      </div>
      <p className="field-note">캐릭터를 잡아 배치하고 빈 곳을 드래그해 회전하세요. 주황색 선은 선택한 수비수의 머리 높이입니다.</p>
    </>}
  </div>;
}
