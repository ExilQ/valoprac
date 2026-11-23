# Static collision query measurements

The frozen application at `0029c162de2756aa11092748514efe726e1ee217` is the
reference. The final capture is [QUERY_BENCHMARK.json](QUERY_BENCHMARK.json),
produced with `scripts/benchmark-physics-queries.mjs`. It records both source
manifests, the benchmark hash, each original geometry hash, and separate original
and current collider/material hashes. Source hashes are checked again after the
run. Geometry and author order are exactly equal; V12 surface metadata changes
are recorded separately.

## Retained behavior and changes

Complete `nearestEnvironmentHit` uses the original linear loop verbatim. BVH
traversal and author-order sorting were not consistently faster for these map
sizes, so nearest-hit acceleration was rejected. Its measured final ratios span
0.963–1.100×; this variation is not claimed as a gain.

Sight perception uses the same exact box, ramp and floor tests but returns as
soon as one sight-blocking hit below the requested limit is proven. Current
rules honor `SurfaceDefinition.blocksSight`: glass is transparent to vision
while collision and penetration remain physical. Public visibility and ballistic
helpers default to legacy semantics; current simulations pass their rules
explicitly. Footstep hearing keeps geometric barrier attenuation, including
glass. `visibleBetween` keeps its original endpoint tolerance and degenerate/nonfinite behavior. Defender
perception still samples nine yawed body points at its existing cadence, in the
same order; only the sample objects are reused. RNG calls and aiming selection
are unchanged.

Ballistics uses a static BVH to select conservative candidates, sorts their
author indices, and runs the original convex clipping arithmetic in the original
plane order. Normals are allocated only for a valid interval. The overlapping
material selection scans intervals directly instead of allocating an active
array for every boundary. Equal-resistance ties retain the first authored solid.
Legacy traces retain their original materials; V12 traces resolve the new
physical surfaces.

The same index narrows standing-space, defender ground and route candidates.
Route filtering still takes the first ten authored qualifying obstacles. These
navigation changes have correctness coverage, but the query-kernel speedups
below do not establish complete AI-update speedups.

Only immutable authored arrays are registered. A mutable/custom array keeps its
linear fallback until explicitly registered, and changing its length invalidates
the index. Callers must register again after editing box geometry. Reusable
stacks/candidate arrays are bounded by the authored obstacle count. Invalid or
unbounded boxes remain candidates for the exact narrow phase.

## Controlled CPU capture

This capture ran on Node 24.19.0, Linux x64, an AMD EPYC 9V74 executor exposing
three logical CPUs. Concurrent browser/GPU and full-suite workloads were paused.
Each of the eleven original maps contributes real route-to-defender body lines
and seeded map-wide rays, with no synthetic scene scaling. An additional set of
inside, face-grazing, near-parallel, downward and ramp cases checks correctness.

The benchmark checks **3,880 rays, 180,989 obstacle intervals, and 15,520 complete
weapon traces**, plus **3,880 current-vision oracle checks**, with zero
mismatches. It compares all four weapons against the actual frozen application modules, including exact distances, points, normals,
materials, thicknesses, segments and order. `assert.deepStrictEqual` retains
signed-zero distinctions. Current material semantics also compare indexed and
unregistered linear paths in the focused tests.

Timings use the same query objects and original obstacle arrays, warmup,
alternating baseline/current order, and fifteen repeated calibrated batches per
map and query kind. Calibration targets 20 ms of baseline work per sample and
caps repetition at 256 passes. The report retains every sample and median/p90;
there is no timing threshold in tests or CI. Legacy columns below are ratios
of measured medians; the current-vision column records raw current timings, not a speedup ratio or an FPS estimate.
The six-box range has a small legacy-visibility regression (0.94×), so the
early-exit benefit is not universal. Independent processes show JIT variation;
the final capture retains every sample instead of selecting a timing threshold.

Current visibility is timed on the actual current obstacle arrays, with the
original exact nearest tests over sight-blocking obstacles as a correctness
oracle. Separate module instances keep this oracle and current-vision feedback
from warming the legacy timing functions on a different obstacle metadata shape.
All eleven authored maps currently have zero glass colliders, so this map
workload checks opaque equivalence. Explicit glass, overlapping solid barriers,
legacy vision, defender acquisition, exposure and sound attenuation are covered
by the focused `surface-vision.test.ts` suite; no synthetic glass scene was
inserted into the performance workload.

| Map | Boxes | Mean candidates | Ballistic speedup | Legacy visibility speedup | Current vision ms/1,000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| range | 6 | 5.16 | 2.70× | 0.94× | 0.278 |
| tactical | 84 | 13.42 | 3.14× | 2.20× | 1.905 |
| long | 18 | 10.96 | 2.71× | 1.50× | 0.487 |
| garage | 18 | 11.37 | 2.73× | 1.61× | 0.488 |
| site | 18 | 11.05 | 2.68× | 1.61× | 0.507 |
| mid | 20 | 10.31 | 2.52× | 1.83× | 0.540 |
| tower | 29 | 14.52 | 2.77× | 2.08× | 0.776 |
| multi | 22 | 11.39 | 2.39× | 1.95× | 0.616 |
| complex | 108 | 26.23 | 3.26× | 2.67× | 2.289 |
| bunny | 24 | 7.72 | 3.44× | 1.14× | 1.366 |
| wallbang | 18 | 9.82 | 2.16× | 1.63× | 0.808 |

The ballistic candidate scan reduction ranges from 14.1% on the six-box range
to 84.0% on tactical. Across the 2,785 timing queries, source-derived explicit
convex-clip normal allocations fall from 228,118 `Vector3` objects to 16,520;
801,460 explicit plane arrays are removed. These counts follow the executed
candidate/inside results and source allocation sites; they are not a heap or GC
profile and exclude required trace/result objects and engine internals.

The measurements cover CPU query kernels. They do not measure GPU time, physical
input latency, complete-frame FPS, or AI-update cost. See the separate
[bounded step profile](STEP_PROFILE.md) for whole-simulation and component observations.

## WASM evaluation

The query capture found no `rustc`, `cargo`, `clang` or `wasm-opt`, so it did not
compile a Rust implementation. A subsequent independent, original192-byte
WebAssembly kernel was compiled by V8 and measured in
[WASM_EVALUATION.md](WASM_EVALUATION.md). Exact scalar and copying-batch results
are reported there: scalar calls are slower; packed batches16–1024 show a narrow
benefit. Velocity-object packing, complete simulation integration, Rust codegen
and browser hardware remain unmeasured. The production engine therefore retains
TypeScript and its existing CSP; no runtime WASM loader or wasm-eval permission
was added. A future full port must preserve ordered intervals, material rules
and deterministic outcomes in an end-to-end benchmark.

## Reproduce

```sh
node scripts/benchmark-physics-queries.mjs --baseline /workspace/physics-materials-baseline --out docs/physics-materials/QUERY_BENCHMARK.json
./node_modules/.bin/vitest run src/tests/static-broadphase.test.ts --maxWorkers=1
```

The focused file passes **18 tests**, covering every original map, legacy and
current material traces, conservative candidate inclusion, mutable fallback,
standing-space parity, body-sample coordinates, nonfinite inputs and exact
visibility range/floor/ramp boundaries and legacy public-helper defaults. The
combined affected suite passes **223 tests in 13 files**, including glass vision,
penetration, sound attenuation, defender behavior and frozen replay fixtures.
These are deterministic software checks, not native-game calibration measurements.
