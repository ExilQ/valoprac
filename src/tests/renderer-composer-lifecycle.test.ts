import {describe,it,expect,vi} from 'vitest';
import {PerspectiveCamera,Scene} from 'three';
import {SSAOPass} from 'three/examples/jsm/postprocessing/SSAOPass.js';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';

describe('Renderer post-processing ownership',()=>{
 it('releases SSAO generated noise and main material along with every pass exactly once',()=>{
  // r180 SSAOPass.dispose releases its targets and auxiliary materials, but
  // leaves noiseTexture and ssaoMaterial to the owner. Use the real pass so a
  // future library ownership change is caught instead of hidden by a stub.
  const ao=new SSAOPass(new Scene(),new PerspectiveCamera(),8,8),noise=vi.spyOn(ao.noiseTexture,'dispose'),main=vi.spyOn(ao.ssaoMaterial,'dispose'),aoDispose=vi.spyOn(ao,'dispose');
  const otherPass={dispose:vi.fn()},composer={passes:[ao,otherPass],dispose:vi.fn()},r=Object.create(RangeRenderer.prototype) as Record<string,any>;
  Object.assign(r,{composer,ao,bloom:{},fxaa:{}});
  r.disposeComposer();
  expect(noise).toHaveBeenCalledTimes(1);expect(main).toHaveBeenCalledTimes(1);expect(aoDispose).toHaveBeenCalledTimes(1);expect(otherPass.dispose).toHaveBeenCalledTimes(1);expect(composer.dispose).toHaveBeenCalledTimes(1);
  expect(r.composer).toBeNull();expect(r.ao).toBeNull();expect(r.bloom).toBeNull();expect(r.fxaa).toBeNull();
  r.disposeComposer();
  expect(noise).toHaveBeenCalledTimes(1);expect(main).toHaveBeenCalledTimes(1);expect(aoDispose).toHaveBeenCalledTimes(1);expect(otherPass.dispose).toHaveBeenCalledTimes(1);expect(composer.dispose).toHaveBeenCalledTimes(1);
 });
});
