import * as THREE from 'three';
import type {GraphicsCapabilities} from './GraphicsCapabilities';

/** Vertex-texture batching regressed SwiftShader in the matched scene probe.
 * Unqualified or integrated devices retain compact conventional instancing. */
export function useMultiDrawCharacters(capabilities:Pick<GraphicsCapabilities,'kind'>,supported:boolean){return supported&&capabilities.kind==='hardware';}

export type CharacterBatchObject=THREE.BatchedMesh|THREE.InstancedMesh;
export interface CharacterBatchStats {
  backend:'batched'|'instanced';
  targetCount:number;
  partCount:number;
  batchCount:number;
  instanceCount:number;
  instanceCapacity:number;
}
export interface CharacterBatches {
  readonly objects:readonly CharacterBatchObject[];
  readonly backend:CharacterBatchStats['backend'];
  setPartMatrix(targetId:number,partId:number,matrix:THREE.Matrix4,visible:boolean):void;
  /** Stored transform by stable target ID, including hidden or uncommitted parts. */
  getPartMatrix(targetId:number,partId:number,output:THREE.Matrix4):THREE.Matrix4;
  /** Upload changed transforms; true when anything moved or changed visibility. */
  commit():boolean;
  setShadow(enabled:boolean):void;
  getStats():CharacterBatchStats;
  dispose():void;
}
interface BatchedPartSlot {object:THREE.BatchedMesh;offset:number;stride:number;}
interface InstancedPartSlot {object:THREE.InstancedMesh;matrices:Float32Array;visible:Uint8Array;}
type PartSlot=BatchedPartSlot|InstancedPartSlot;

/** Articulated parts share only GPU storage, never their authored transforms.
 * With WEBGL_multi_draw each material identity gets one BatchedMesh. Without
 * that extension, one InstancedMesh per part avoids Three's per-instance draw
 * fallback. Input geometry and materials remain owned by the caller. */
export function createCharacterBatches(
  geometries:readonly THREE.BufferGeometry[],
  materialsPerPart:readonly THREE.Material[],
  targetCount:number,
  multiDrawSupported:boolean,
):CharacterBatches {
  if(!Number.isSafeInteger(targetCount)||targetCount<0)throw new RangeError('Invalid character target count');
  if(geometries.length!==materialsPerPart.length)throw new RangeError('Character parts require one material per geometry');
  if(!Number.isSafeInteger(targetCount*geometries.length))throw new RangeError('Character instance capacity is too large');
  const backend=multiDrawSupported?'batched':'instanced',objects:CharacterBatchObject[]=[],slots:PartSlot[]=[];
  const dirty=new Set<InstancedPartSlot>(),identity=new THREE.Matrix4();
  // Last written transform and visibility per (part, target): unchanged parts
  // are skipped, so still characters cost no upload and no shadow pass.
  const written=new Float32Array(Math.max(1,targetCount*geometries.length*16)),shown=new Uint8Array(Math.max(1,targetCount*geometries.length));
  let changed=true;
  let disposed=false;

  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    dirty.clear();
    // BatchedMesh owns its combined geometry and matrix/indirect textures.
    // InstancedMesh.dispose releases instance resources, not input geometry.
    for(const object of objects)object.dispose();
  };
  try{
    // Avoid creating zero-capacity textures or unused GPU geometry for no bots.
    if(targetCount>0){
      if(multiDrawSupported){
        const groups=new Map<THREE.Material,number[]>();
        for(let partId=0;partId<geometries.length;partId++){
          const material=materialsPerPart[partId],parts=groups.get(material);
          if(parts)parts.push(partId);else groups.set(material,[partId]);
        }
        for(const [material,parts] of groups){
          let vertices=0,indices=0;
          for(const partId of parts){const geometry=geometries[partId];vertices+=geometry.getAttribute('position').count;indices+=geometry.index?.count??0;}
          const batch=new THREE.BatchedMesh(targetCount*parts.length,vertices,indices,material);
          objects.push(batch);
          batch.name='batched character parts';batch.frustumCulled=false;
          batch.perObjectFrustumCulled=false;batch.sortObjects=false;
          const geometryIds=parts.map(partId=>batch.addGeometry(geometries[partId]));
          for(let localPart=0;localPart<parts.length;localPart++)slots[parts[localPart]]={object:batch,offset:localPart,stride:parts.length};
          for(let targetId=0;targetId<targetCount;targetId++)for(const geometryId of geometryIds)batch.setVisibleAt(batch.addInstance(geometryId),false);
        }
      }else{
        for(let partId=0;partId<geometries.length;partId++){
          const batch=new THREE.InstancedMesh(geometries[partId],materialsPerPart[partId],targetCount);
          const slot:InstancedPartSlot={object:batch,matrices:new Float32Array(targetCount*16),visible:new Uint8Array(targetCount)};
          objects.push(batch);slots[partId]=slot;batch.count=0;
          batch.name='instanced character part';batch.frustumCulled=false;
          batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          for(let targetId=0;targetId<targetCount;targetId++)identity.toArray(slot.matrices,targetId*16);
        }
      }
    }
  }catch(error){dispose();throw error;}

  const partSlot=(targetId:number,partId:number)=>{
    if(disposed)throw new Error('Character batches are disposed');
    if(!Number.isInteger(targetId)||targetId<0||targetId>=targetCount)throw new RangeError('Invalid character target');
    if(!Number.isInteger(partId)||partId<0||partId>=geometries.length)throw new RangeError('Invalid character part');
    return slots[partId];
  };
  return{
    objects,backend,
    setPartMatrix(targetId,partId,matrix,visible){
      const slot=partSlot(targetId,partId),index=partId*targetCount+targetId,base=index*16,e=matrix.elements;
      let same=shown[index]===(visible?1:0);
      for(let i=0;same&&i<16;i++)if(written[base+i]!==Math.fround(e[i]))same=false;
      if(same)return;
      for(let i=0;i<16;i++)written[base+i]=e[i];shown[index]=visible?1:0;changed=true;
      if('matrices' in slot){matrix.toArray(slot.matrices,targetId*16);slot.visible[targetId]=visible?1:0;dirty.add(slot);}
      else{const instanceId=targetId*slot.stride+slot.offset;slot.object.setMatrixAt(instanceId,matrix);slot.object.setVisibleAt(instanceId,visible);}
    },
    getPartMatrix(targetId,partId,output){
      const slot=partSlot(targetId,partId);
      return 'matrices' in slot?output.fromArray(slot.matrices,targetId*16):slot.object.getMatrixAt(targetId*slot.stride+slot.offset,output);
    },
    commit(){
      const moved=changed;changed=false;
      for(const slot of dirty){
        const array=slot.object.instanceMatrix.array;
        let count=0;
        // Compact visible targets so hidden instances consume no vertex work.
        // The separate pending buffer keeps the API's target IDs stable.
        for(let targetId=0;targetId<targetCount;targetId++)if(slot.visible[targetId]){
          const source=targetId*16,destination=count++*16;
          for(let component=0;component<16;component++)array[destination+component]=slot.matrices[source+component];
        }
        slot.object.count=count;slot.object.instanceMatrix.needsUpdate=true;
      }
      dirty.clear();return moved;
    },
    setShadow(enabled){for(const object of objects)object.castShadow=enabled;},
    getStats(){return{backend,targetCount,partCount:geometries.length,batchCount:objects.length,instanceCount:targetCount*geometries.length,instanceCapacity:objects.reduce((count,object)=>count+(object instanceof THREE.BatchedMesh?object.maxInstanceCount:object.instanceMatrix.count),0)};},
    dispose,
  };
}
