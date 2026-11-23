import { useEffect, useRef, useState } from 'react';
import { BoxGeometry, BufferGeometry, Color, DirectionalLight, Group, HemisphereLight, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Scene, SphereGeometry, Vector3 } from 'three';
import { VISUAL_MATERIALS } from '../config/materials';
import { architecturalBox } from '../engine/rendering/ArchitecturalBox';
import { createOrbitPreview, disposePreviewGeometry } from '../engine/rendering/OrbitPreview';
import { SurfaceMaterialLibrary, writeWorldScaleUV } from '../engine/rendering/SurfaceMaterials';
import { tacticalRampGeometry, tacticalSurfaceStyle } from '../engine/rendering/TacticalSurface';
import { gateEndpoints, scenarioEntryGate } from '../training/scenarios/entryGate';
import { scenarioApproach, scenarioLevel } from '../training/scenarios/validation';
import type { ScenarioDefinition } from '../training/scenarios/types';
import type { Vec3 } from '../engine/types';
import './orbitPreview.css';

type Selection = number|'player';
interface Props {
  definition:ScenarioDefinition;
  selected:Selection;
  detailed:boolean;
  onPlace:(point:Vec3)=>void;
}
export default function ScenarioMapPreview({definition,selected,detailed,onPlace}:Props) {
  const host=useRef<HTMLDivElement>(null);
  const level=scenarioLevel(definition);
  const preview=useRef<ReturnType<typeof createOrbitPreview>|null>(null);
  const markers=useRef<((scenario:ScenarioDefinition,selection:Selection)=>void)|null>(null);
  const placement=useRef(onPlace);
  const [failed,setFailed]=useState(false);
  const activePoint=selected==='player'?definition.player.position:definition.bots[selected]?.position??definition.player.position;
  useEffect(()=>{placement.current=onPlace;},[onPlace]);

  useEffect(()=>{
    if(!host.current)return;
    const scene=new Scene();
    const [left,top,width,depth]=level.bounds;
    const center=new Vector3(left+width/2,0,top+depth/2);
    scene.background=new Color(detailed?0x15262b:0x182e35);
    scene.add(new HemisphereLight(0xf0f7ef,0x87958d,2.35));
    const sun=new DirectionalLight(0xffe7cb,2.05);
    sun.position.set(center.x-25,40,center.z+18);
    scene.add(sun);
    const available:Mesh[]=[];
    let orbit:ReturnType<typeof createOrbitPreview>;
    try {
      orbit=createOrbitPreview(host.current,scene,'전술 시나리오 3D 배치',center,Math.max(width,depth)*1.45,ray=>{
        const hit=ray.intersectObjects(available,false)[0];
        if(hit?.face&&hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>.65)placement.current({x:hit.point.x,y:hit.point.y,z:hit.point.z});
      });
    } catch {setFailed(true);return;}
    setFailed(false);
    preview.current=orbit;
    const surfaces=new SurfaceMaterialLibrary({quality:'high',anisotropy:orbit.renderer.capabilities.getMaxAnisotropy()});
    const blocked=new MeshStandardMaterial({color:0x789094,roughness:.92});
    const cover=new MeshStandardMaterial({color:0x427b76,roughness:.74});
    const ground=new MeshStandardMaterial({color:0x506861,roughness:.96});
    const floor=new Mesh(new PlaneGeometry(width,depth),detailed?surfaces.material('raw-concrete',0x7a8277):ground);
    floor.rotation.x=-Math.PI/2;floor.position.copy(center);floor.updateMatrix();
    if(detailed)writeWorldScaleUV(floor.geometry,VISUAL_MATERIALS['raw-concrete'].metersPerTile,floor.matrix);
    scene.add(floor);available.push(floor);
    for(const obstacle of level.obstacles){
      const {x:w,y:h,z:d}=obstacle.box.getSize(new Vector3());
      const style=tacticalSurfaceStyle(obstacle,level.id);
      const material=detailed?surfaces.material(style.family,{tint:style.tint,metalness:style.glass?.1:undefined}):obstacle.kind==='cover'?cover:blocked;
      const geometry=obstacle.ramp?tacticalRampGeometry(obstacle):detailed?architecturalBox(w,h,d):new BoxGeometry(w,h,d);
      const mesh=new Mesh(geometry,material);
      if(!obstacle.ramp)obstacle.box.getCenter(mesh.position);
      mesh.updateMatrix();
      if(detailed)writeWorldScaleUV(geometry,VISUAL_MATERIALS[style.family].metersPerTile,mesh.matrix);
      scene.add(mesh);available.push(mesh);
    }

    const overlay=new Group();
    scene.add(overlay);
    const dotGeometry=new SphereGeometry(.29,12,8);
    const playerMaterial=new MeshBasicMaterial({color:0x64ffdb,depthTest:false});
    const defenderMaterial=new MeshBasicMaterial({color:0xff8b74,depthTest:false});
    const selectedMaterial=new MeshBasicMaterial({color:0xffdb82,depthTest:false});
    const alternateMaterial=new MeshBasicMaterial({color:0xf4a6a0,depthTest:false});
    const dots=Array.from({length:61},()=>new Mesh(dotGeometry,defenderMaterial));
    const pathMaterial=new LineBasicMaterial({color:0x7ee8d8,transparent:true,opacity:.88,depthTest:false});
    const path=new Line(new BufferGeometry(),pathMaterial);
    const gateMaterial=new LineBasicMaterial({color:0xc17cf4,depthTest:false});
    const gateLine=new Line(new BufferGeometry(),gateMaterial);
    gateLine.renderOrder=2;
    path.renderOrder=1;overlay.add(path,gateLine,...dots);
    for(const dot of dots)dot.renderOrder=2;
    markers.current=(scenario,selection)=>{
      const entries=[{point:scenario.player.position,material:selection==='player'?selectedMaterial:playerMaterial,scale:1.3},
        ...scenario.bots.flatMap((bot,index)=>[
          {point:bot.position,material:selection===index?selectedMaterial:defenderMaterial,scale:selection===index?1.3:1},
          ...bot.alternatives.map(point=>({point,material:alternateMaterial,scale:.52})),
        ])];
      dots.forEach((dot,index)=>{
        const entry=entries[index];
        dot.visible=!!entry;
        if(entry){dot.position.set(entry.point.x,entry.point.y+.32,entry.point.z);dot.material=entry.material;dot.scale.setScalar(entry.scale);}
      });
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
      path.geometry.dispose();gateLine.geometry.dispose();dotGeometry.dispose();surfaces.dispose();
      for(const material of [blocked,cover,ground,playerMaterial,defenderMaterial,selectedMaterial,alternateMaterial,pathMaterial,gateMaterial])material.dispose();
    };
  },[level,detailed]);
  useEffect(()=>{markers.current?.(definition,selected);},[definition,selected,level,detailed]);

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
      <p className="field-note">드래그로 회전하고 바닥이나 경사로를 눌러 배치합니다.</p>
    </>}
  </div>;
}
