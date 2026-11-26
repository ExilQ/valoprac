import {describe,it,expect,vi} from 'vitest';
import {PerspectiveCamera,Scene} from 'three';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';

describe('Renderer post-processing ownership',()=>{
 it('releases the optional GTAO pass, the materials and depth texture it leaves behind, and every pass exactly once',()=>{
  // r180 GTAOPass.dispose releases its targets, noise and most materials but
  // leaves gtaoMaterial, blendMaterial and the depth texture it created to the
  // owner. Use the real pass so a library ownership change is caught.
  const ao=new GTAOPass(new Scene(),new PerspectiveCamera(),8,8),gtao=vi.spyOn(ao.gtaoMaterial,'dispose'),blend=vi.spyOn(ao.blendMaterial,'dispose'),depth=vi.spyOn(ao.depthTexture,'dispose'),aoDispose=vi.spyOn(ao,'dispose');
  const otherPass={dispose:vi.fn()},composer={passes:[ao,otherPass],dispose:vi.fn()},r=Object.create(RangeRenderer.prototype) as Record<string,any>;
  Object.assign(r,{composer,ao,bloom:{}});
  r.disposeComposer();
  for(const spy of [gtao,blend,depth,aoDispose,otherPass.dispose,composer.dispose])expect(spy).toHaveBeenCalledTimes(1);
  expect(r.composer).toBeNull();expect(r.ao).toBeNull();expect(r.bloom).toBeNull();
  r.disposeComposer();
  for(const spy of [gtao,blend,depth,aoDispose,otherPass.dispose,composer.dispose])expect(spy).toHaveBeenCalledTimes(1);
 });
});
