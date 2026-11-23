import type {MeshStandardMaterial} from 'three';

/** Keep cloth, molded armor, leather and coated lenses in the same opaque
 * character batch. The two normalized bytes alter the stock PBR inputs. */
export function useCharacterFinishes(material:MeshStandardMaterial){
  material.customProgramCacheKey=()=>'valoprac-character-finish-1';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec2 characterFinish;\nvarying vec2 vCharacterFinish;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCharacterFinish=characterFinish;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec2 vCharacterFinish;')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(vCharacterFinish.x*(0.80+0.32*roughnessFactor),0.04,1.0);')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vCharacterFinish.y;');
  };
  return material;
}
