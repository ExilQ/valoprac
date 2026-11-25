import {Color,type MeshStandardMaterial} from 'three';

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

/**
 * Enemy rim highlight (12.21). A grazing-angle emissive rim, biased toward
 * upward-facing surfaces and slightly stronger at range, keeps opponents
 * readable against bright walls — the same idea as the selectable enemy
 * highlight colour in tactical shooters. Appearance only: hit zones, poses and
 * simulation state never read it.
 */
export type EnemyHighlight='red'|'yellow'|'purple'|'off';
export const ENEMY_HIGHLIGHTS:readonly EnemyHighlight[]=['red','yellow','purple','off'];
export const ENEMY_HIGHLIGHT_COLORS:Readonly<Record<Exclude<EnemyHighlight,'off'>,number>>={red:0xff4b5c,yellow:0xf2d64b,purple:0xc35cff};
const RIM_STRENGTH=.85;
export interface EnemyRimUniforms {color:{value:Color};strength:{value:number}}
export function createEnemyRim(highlight:EnemyHighlight='red'):EnemyRimUniforms {
  const uniforms={color:{value:new Color()},strength:{value:0}};setEnemyRim(uniforms,highlight);return uniforms;
}
export function setEnemyRim(uniforms:EnemyRimUniforms,highlight:EnemyHighlight){
  if(highlight==='off'){uniforms.strength.value=0;return;}
  uniforms.color.value.setHex(ENEMY_HIGHLIGHT_COLORS[highlight]??ENEMY_HIGHLIGHT_COLORS.red);uniforms.strength.value=RIM_STRENGTH;
}
export const ENEMY_RIM_CHUNK=`
float enemyRimFacing=clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);
float enemyRim=pow(1.0-enemyRimFacing,2.4)*smoothstep(-0.55,0.45,normal.y+0.2);
float enemyRimRange=mix(1.0,1.8,smoothstep(10.0,40.0,length(vViewPosition)));
totalEmissiveRadiance+=enemyRimColor*(enemyRim*enemyRimStrength*enemyRimRange);`;
/** Chains after any existing shader patch, so it composes with useCharacterFinishes. */
export function useEnemyRim(material:MeshStandardMaterial,uniforms:EnemyRimUniforms){
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>`${previousKey()}+enemy-rim-1`;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.uniforms.enemyRimColor=uniforms.color;shader.uniforms.enemyRimStrength=uniforms.strength;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform vec3 enemyRimColor;\nuniform float enemyRimStrength;')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>'+ENEMY_RIM_CHUNK);
  };
  material.userData.enemyRim=uniforms;
  return material;
}
