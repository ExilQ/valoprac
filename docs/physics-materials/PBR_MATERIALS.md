# Original surface material library

`src/config/materials.ts` defines fifteen visual finishes. Their colors,
roughness, metalness, grain and repeat sizes describe appearance only. Physical
collision, penetration, friction and audio profiles remain in the surface registry.

All base, roughness and normal data is independently authored by the procedural
functions in `ProceduralSurfaces.ts`. Periodic value noise, restrained mineral
relief, brick joints, directional brushing, wood grain and woven threads produce
the maps locally. There are no downloaded textures, external image URLs, image
decoders, canvas assets, generated image dependencies or calls to `Math.random`.
The same family and resolution always produce the same bytes.

`SurfaceMaterialLibrary` uses standard Three.js PBR materials. Family maps are
shared by all tint variants. Base data is sRGB; dedicated roughness and normal
data remain linear. Maps repeat, use mipmaps and cap anisotropy at the renderer's
configured budget. Default glass is an opaque optical coating. Only explicitly
requested sheet-glass variants use alpha blending; they use no physical
transmission, refraction or additional scene-render passes.

| Quality | Resolution | Shared maps per family | Complete 15-family GPU estimate |
| --- | --- | --- | --- |
| Low | 32 | Base | 80 KiB |
| Medium | 64 | Base, roughness | 640 KiB |
| High | 256 | Base, roughness, normal | 15 MiB |
| Ultra | 256 (16× anisotropy) | Base, roughness, normal | 15 MiB |

The estimates include the full mip chain and exclude small material objects and
GPU-driver overhead. Families are allocated on demand, with at most 256 cached
material variants by default. Preset changes update existing material objects,
then dispose the previous texture set. No historical preset texture cache is
retained. Software-renderer Low uses scalar PBR color/roughness/metalness without texture maps after same-scene SwiftShader measurement showed a material-map cost. Hardware Low retains the32px base maps. Low keeps each finish's color, metallic response and roughness, so
readability does not depend on fine normal detail.

`writeWorldScaleUV` applies deterministic dominant-axis meter-scale projection to
renderer-owned geometry. `applyWorldScaleUV` clones its input for callers using
immutable canonical meshes. Both preserve all positions, normals and indices.
Texture repeats are set by each definition's `metersPerTile`; no per-object shader
or per-object texture is needed. Material metadata retains a family identifier
and a tint-independent render-state signature for conservative static batching.
Palette batches must be created through `library.material`, rather than cloning
managed materials, so preset changes update their maps as well.

Weapon receivers, brushed edges, polymer furniture, rubber grips and woven
sleeves use separate shared finishes. Only material assignments and UVs change;
geometry, sights, articulated magazines, bolt actions, skinning and camera
placement are preserved. `createSurfaceShowcase` builds an isolated reference
gallery with the same flat, curved and cylindrical forms for each finish. It is a
development aid and is not part of the live collision world.

Verification is in `src/tests/surface-materials.test.ts`: byte determinism,
separate map channels, texture settings, cache reuse, alpha-glass independence,
quality rebinding, exact disposal, bounded memory, meter-scale density, unchanged
canonical hit surfaces and live architectural palette batches. Existing weapon
and tactical tests cover the original rig, open door apertures and ADS head rays.
