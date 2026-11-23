import { useEffect, useRef, useState } from 'react';
import { Box3, Color, DirectionalLight, HemisphereLight, PMREMGenerator, Scene, Vector3, type Material, type WebGLRenderTarget } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WEAPON_FINISHES, type FinishId } from '../config/weaponFinishes';
import { createOrbitPreview, disposePreviewGeometry } from '../engine/rendering/OrbitPreview';
import { SurfaceMaterialLibrary } from '../engine/rendering/SurfaceMaterials';
import { createWeaponView } from '../engine/rendering/WeaponView';
import type { WeaponId } from '../engine/types';
import './orbitPreview.css';

export default function WeaponInspect({weapon,finish}:{weapon:WeaponId;finish:FinishId}) {
  const host=useRef<HTMLDivElement>(null);
  const preview=useRef<ReturnType<typeof createOrbitPreview>|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!host.current)return;
    const scene=new Scene();
    scene.background=new Color(0x17292e);
    scene.add(new HemisphereLight(0xe8fff1,0x8b7764,2.4));
    const light=new DirectionalLight(0xffe8cb,3.2);light.position.set(-1,2,2);scene.add(light);
    const surfaces=new SurfaceMaterialLibrary({quality:'high'});
    const materials=new Set<Material>();
    const model=createWeaponView(weapon,g=>g,m=>{materials.add(m);return m;},surfaces,finish==='original'?undefined:WEAPON_FINISHES[finish]);
    scene.add(model.root);
    model.root.traverse(object=>{if(object.name.endsWith('articulated glove'))object.visible=false;});
    const bounds=new Box3().setFromObject(model.root),target=bounds.getCenter(new Vector3());
    let orbit:ReturnType<typeof createOrbitPreview>;
    try {
      orbit=createOrbitPreview(host.current,scene,'장착 무기 3D 보기',target,Math.max(1.15,bounds.getSize(new Vector3()).length()*1.5));
    } catch {
      model.dispose?.();surfaces.dispose();disposePreviewGeometry(scene);
      materials.forEach(material=>{if(!material.userData.surfaceMaterialManaged)material.dispose();});
      setFailed(true);
      return;
    }
    preview.current=orbit;
    setFailed(false);
    const room=new RoomEnvironment(),pmrem=new PMREMGenerator(orbit.renderer);
    let reflection:WebGLRenderTarget|undefined;
    try {
      reflection=pmrem.fromScene(room,.04,.1,30,{size:64});
      scene.environment=reflection.texture;
    } catch {
      // The direct lights still render the model if reflection preparation fails.
    } finally {
      room.dispose();pmrem.dispose();
    }
    orbit.turn(-80,-65);
    return ()=>{
      preview.current=null;
      orbit.dispose();reflection?.dispose();model.dispose?.();surfaces.dispose();disposePreviewGeometry(scene);
      materials.forEach(material=>{if(!material.userData.surfaceMaterialManaged)material.dispose();});
    };
  },[weapon,finish]);
  return <div className="orbit-preview weapon-inspect">
    <div ref={host} className="orbit-preview-viewport"/>
    {failed?<p role="status">3D 보기를 열 수 없습니다. 무기 도식에서 스킨을 계속 미리 볼 수 있습니다.</p>:
      <div className="orbit-preview-actions" role="group" aria-label="무기 카메라 조작">
        <button type="button" onClick={()=>preview.current?.turn(85,0)}>왼쪽 회전</button>
        <button type="button" onClick={()=>preview.current?.turn(-85,0)}>오른쪽 회전</button>
        <button type="button" onClick={()=>preview.current?.zoom(.8)}>확대</button>
        <button type="button" onClick={()=>preview.current?.zoom(1.25)}>축소</button>
      </div>}
  </div>;
}
