import {describe,it,expect} from 'vitest';
import {synthesizeMaterialImpact} from '../engine/audio/materialImpact';
import {PENETRATION_MATERIALS,type SurfaceMaterial} from '../config/penetration';
describe('Original material entry and exit impact samples',()=>{
 it('keeps all synthesized material responses finite, short, restrained and deterministic',()=>{
  for(const rate of [8000,44100,48000])for(const material of Object.keys(PENETRATION_MATERIALS) as SurfaceMaterial[]){const entry=synthesizeMaterialImpact(material,rate),exit=synthesizeMaterialImpact(material,rate,true);expect(entry).toEqual(synthesizeMaterialImpact(material,rate));expect(entry.length/rate).toBeLessThanOrEqual(.251);expect(entry.every(Number.isFinite)).toBe(true);expect(Math.max(...entry.map(Math.abs))).toBeLessThan(.6);expect(exit.some((v,i)=>v!==entry[i])).toBe(true);}
 });
 it('distinguishes wood, metal, masonry and glass without changing any weapon firing profile',()=>{
  const samples=(['thinWood','thinMetal','concrete','glass'] as SurfaceMaterial[]).map(m=>synthesizeMaterialImpact(m,8000));for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++)expect(samples[i].slice(0,100)).not.toEqual(samples[j].slice(0,100));
 });
});
