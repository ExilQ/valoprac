import {afterEach,describe,expect,it,vi} from 'vitest';
import {MeshStandardMaterial} from 'three';
import {ENEMY_HIGHLIGHT_COLORS,createEnemyRim,setEnemyRim,useCharacterFinishes,useEnemyRim} from '../engine/rendering/CharacterMaterial';
import {loadEnemyHighlight,storeEnemyHighlight} from '../config/enemyHighlight';
import {DEFAULT_SETTINGS} from '../config/settings';

afterEach(()=>vi.unstubAllGlobals());

describe('enemy rim highlight (12.21)',()=>{
 it('maps each choice to a colour and turns off without recompiling',()=>{
  const rim=createEnemyRim('red');
  expect(rim.color.value.getHex()).toBe(ENEMY_HIGHLIGHT_COLORS.red);expect(rim.strength.value).toBeGreaterThan(0);
  setEnemyRim(rim,'purple');expect(rim.color.value.getHex()).toBe(ENEMY_HIGHLIGHT_COLORS.purple);
  setEnemyRim(rim,'off');expect(rim.strength.value).toBe(0);
 });
 it('composes with the character finish patch and injects the rim after emissive',()=>{
  const material=useEnemyRim(useCharacterFinishes(new MeshStandardMaterial()),createEnemyRim('yellow'));
  expect(material.customProgramCacheKey()).toBe('valoprac-character-finish-1+enemy-rim-1');
  const shader={uniforms:{} as Record<string,unknown>,vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <emissivemap_fragment>'};
  material.onBeforeCompile(shader as never,undefined as never);
  expect(shader.vertexShader).toContain('attribute vec2 characterFinish');
  expect(shader.fragmentShader).toContain('uniform vec3 enemyRimColor');
  expect(shader.fragmentShader.indexOf('totalEmissiveRadiance+=enemyRimColor')).toBeGreaterThan(shader.fragmentShader.indexOf('#include <emissivemap_fragment>'));
  expect(shader.uniforms.enemyRimColor).toBe(material.userData.enemyRim.color);
 });
 it('is a display preference outside replayed settings',()=>{
  let stored:string|null=null;
  vi.stubGlobal('localStorage',{getItem:()=>stored,setItem:(_k:string,v:string)=>{stored=v;}});
  expect(loadEnemyHighlight()).toBe('red');
  storeEnemyHighlight('yellow');expect(loadEnemyHighlight()).toBe('yellow');
  stored='green';expect(loadEnemyHighlight()).toBe('red');
  expect(Object.hasOwn(DEFAULT_SETTINGS,'enemyHighlight')).toBe(false);
 });
});
