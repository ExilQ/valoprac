# Combat, movement and material training — 08.00 / 8.0.0

This update extends the existing browser architecture. There is no engine rewrite,
proprietary Riot content, learned aiming policy, external trace upload or new paid service.

- [AI calibration and controller](AI_CALIBRATION.md)
- [Movement, sound and buffered hop calibration](MOVEMENT_CALIBRATION.md)
- [Material penetration model](PENETRATION_MODEL.md)
- [Original mechanics map design and collision checks](MECHANICS_MAPS.md)
- [Seeded encounter and browser measurements](BENCHMARK.md)

## Encounter ownership

A retry increments `Simulation.lifeGeneration` and replaces the bot encounter
memories/weapon objects. Weapon reload, bolt, scope and equip timers are synchronous
simulation state; there are no delayed reload callbacks. Input edges, buffered jump,
rendered-frame shot captures, velocity, crouch, temporary hit feedback, recoil and
exposure are reset. Every player inventory slot regains its configured magazine
and reserve; the selected weapon then observes its actual equip interval.

The actual input object from the death tick is retained before any early return,
so a direct simulation retry also clears that input. Browser retry additionally
resets pointer/keyboard input, clock debt, audio voices, render impacts and mouse
latency probes. Repeated retry requests in the same paused tick and selected
scenario/weapon are idempotent. A scenario change still permits a new placement.

Session time, sensitivity, selected weapon, preferences and cumulative training
statistics remain. The current-life footstep ring is isolated by an event cursor,
while session totals and the bounded historical event journal remain available.

## Rendering and audio

Exact ballistic entry/exit positions and normals drive pooled material-colored
impact decals. Successful exits use a larger mark. Wood, metal, masonry and glass
have separate color/particle treatments and independently synthesized short
impact sounds. The original weapon firing and handling assets are unchanged.
All effects are bounded and do not participate in hit detection.

The renderer uses the same controlled bot aim motor and actual recoil for held
weapon pitch. It remains Three.js/WebGL; `UnrealBloomPass` is only the name of a
Three.js postprocessing helper and does not represent an Unreal Engine runtime.

## Release and rollback

The previous source state is protected by branch `checkpoint/07.00-before-combat`
and commit `59295203ddd2d54ffb1495b7b456508b81d0f7c9`. The previous production
Sites version remains saved. Build from the pushed source, save a new Site version,
deploy that version, and verify the custom domain and compiled asset hashes.
Rollback uses the saved 07.00 production version through the same Sites workflow.

## Limits

All bot skill parameters, footstep accumulation recovery, air-control constants
and material resistance budgets are explicit provisional VALOPRAC training
calibrations. Software tests do not establish native-game equivalence, human
fairness, high-refresh hardware FPS or physical input-to-photon latency.
