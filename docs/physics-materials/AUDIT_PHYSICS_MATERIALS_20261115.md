# Physics and physical-material audit — 2026-11-15

This is the focused completion report for the unreleased 12.00 movement and
material changes. The pre-audit checkpoint is
`6dcb6e07089ab6a2fad50f27f14206458e9d6761`
(`checkpoint/12.00-before-comprehensive-audit-20261110`). The working tree is
still uncommitted at this report's capture; the release receipt must identify
the final source commit separately.

## Scope reviewed

- `src/engine/movement/Movement.ts`, `CollisionController.ts`,
  `MovementSolvers.ts`, `JumpController.ts` and `src/config/movement.ts`.
- `src/engine/collision/Ballistics.ts`, `StaticBroadphase.ts`, `environment.ts`
  and `shoot.ts`.
- `src/config/surfaces.ts`, `penetration.ts` and
  `src/engine/footsteps/surfaceSelection.ts`.
- The contact, ballistic-boundary, static-query, surface, movement-integration
  and replay-version regression tests listed below.

The review covers the owned simulation/query/material boundaries, not a formal
proof that the entire application has no bugs. Rendering and playback of sound
are verified by their respective owners. No new movement constants, penetration
coefficients, dependencies, maps or simulation versions were introduced here.
The report-derived F1/F2 calibration and F9/F10 measurement limitations remain
unchanged.

## Reproduced defects and final behavior

### Buffered landing jump under a low ceiling

A real 120 Hz CS2-inspired tick starts at foot height 0.01 m and vertical
velocity -2 m/s. A buffered jump was requested at 0.001 s; the roof underside is
1.86 m. Landing occurs at 0.004609711124769515 s, so the new upward remainder
starts after the preceding falling sweep has already finished.

The pre-audit `materials-v3` path allowed the head to reach
1.8772730601803775 m. The existing `legacy-v2` final vertical pass already caught
this particular case. Current rules now resolve the new remainder against the
ceiling: head height is 1.86 m, vertical velocity is zero, and the body remains
airborne until its genuine subsequent landing. There is one jump, not an
invented extra jump. The unblocked current and legacy trajectories, velocity,
hop statistics and landing time remain identical in the regression fixture.

Only the current-rule remainder receives the extra ceiling query. The legacy
integration path is retained.

### Restoring a pose into a steep ramp

The airborne sweep uses the high footprint edge for a non-walkable wedge, but
saved-pose occupancy used only its center plane. On the test wedge, the center
is 1.5 m and the high edge under a 0.28 m footprint is 1.92 m. A foot height of
1.6 m was therefore incorrectly accepted inside the actual collision volume.

Current occupancy uses the same high edge and selected slope threshold as
traversal. The invalid pose is rejected without mutating the live movement
state; the 1.92 m clear pose is accepted. Tests exercise both ramp axes and both
ascending directions, and preserve the documented center anchor when a custom
slope threshold intentionally makes the ramp walkable. Legacy occupancy keeps
its historical behavior.

### Fabricated penetration surface effects

Resistance charging partitions one physical solid into intervals. Those charge
boundaries are not necessarily physical entry or exit faces. Target, range and
floor clipping can also end an interval inside a solid. Current traces now mark
`entrySurface: false` or `exitSurface: false` where a surface event would be
fabricated. An origin-inside trace emits only a genuine exit, and a stopped or
clipped trace does not claim to have exited the material.

The final review found one additional case: overlapping or touching modular
boxes with the same surface ID. For wood A at ray parameters [3, 3.4] and wood B
at [3.2, 3.6], the intermediate exit at 3.4 lies inside B. A current-rule
same-material continuation check suppresses this internal face. The exterior
events are entry at 3 and exit at 3.6. Touching and duplicate boxes, reversed
author order and indexed candidate selection are covered as well.

This continuation check applies only to the same stable surface ID. Genuine
metal insert faces inside wood remain distinct. It short-circuits after the
existing origin/partition/clipping checks, and allocates no temporary collections.
It is an effects correction, not a new material-resistance or damage formula.

All pre-existing damage, remaining power, layer accounting, impact stop points,
closest targets and interval ordering are unchanged. Tests strip only the new
optional surface flags before comparing complete current and legacy traces for
all four weapons. Legacy traces do not acquire these fields. The renderer and
sound consumer must skip a face explicitly marked false; omitted fields retain
the historical effect behavior.

## Executed validation

Executed on Linux/x64 with Node **v24.22.1**, Vitest **3.2.7**, fixed simulation
step **1/120 s**. Final command completed at 2026-11-15 05:48 UTC:

```sh
env PATH="/workspace/operator-qa/npm-cache/_npx/ef8b185be06dfeb4/node_modules/node/bin:$PATH" \
  node_modules/.bin/vitest run \
  src/tests/audit-physics-contact.test.ts \
  src/tests/ballistic-surface-boundaries.test.ts \
  src/tests/physics-materials-collision.test.ts \
  src/tests/physical-surfaces.test.ts \
  src/tests/static-broadphase.test.ts \
  src/tests/surface-contact-integration.test.ts \
  src/tests/surface-vision.test.ts \
  src/tests/replay-physics-versions.test.ts \
  src/tests/operator-penetration.test.ts \
  src/tests/movement-integration.test.ts \
  src/tests/roadmap-stage1-movement.test.ts
```

Result: **161 passed, 0 failed, 11 files passed**, 5.62 seconds reported wall time.
The complete log is
`/workspace/full-audit-20261110/final-physics-materials-20261115.log`.
`git diff --check` also passed after the owned changes.

The focused regressions include 8 contact cases and 12 material-boundary cases.
The broader selection checks original map/broadphase parity, physical surface
metadata and contact audio events, old Operator penetration behavior, and the
independent historical 10.00 replay fixtures. Historical final checksums remain
`144b56481234c538`, `d9a482b7fceefe17`, `8258a72b4893789f`,
`e057e8ff19a698a7` and scenario `0504b121cca31227`. Current replay fixtures also
exercise all three profiles and four graphics presets at 60/144/240 Hz render
schedules over the fixed 120 Hz simulation.

## Limits

These are deterministic software tests and geometric reproductions. They do not
establish native VALORANT/CS2 parity, physical hardware FPS, input-to-photon
latency or subjective material/audio quality. No new performance ratio is
claimed for the final continuation check: the final query benchmark must measure
this source state. Full application tests, TypeScript, build, browser integration
and production deployment remain the release owner's separate gates.
