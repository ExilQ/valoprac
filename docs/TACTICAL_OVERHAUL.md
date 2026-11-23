# VALOPRAC 4.0.0 / patch 04.00

This extends the 3.0 browser implementation in place. It does not ship a built Unreal game, exact Riot map assets, native Raw Input Buffer, proprietary directional gains or verified Riot audio. The previous weapons, sound profiles, timed modes, local aim science and history remain.

## Movement, accuracy and braking

Simulation stays at 120 Hz. `Movement` integrates velocity with acceleration38m/s², opposing acceleration45m/s² and neutral deceleration20+3.5*speed m/s². Maximum rifle speed5.4m/s, walk multiplier.48, ADS modifier.76 and accuracy threshold.65m/s remain provisional. The neutral and opposing stopping durations are measured independently in the release report. Neither is universally superior by assumption.

`Weapon.calculateSpread` samples the actual collision-resolved velocity at each simulation shot, never keys. Components are angular half-cone radii in degrees: weapon base, movement, bloom, airborne and landing. Crouch and ADS multiply applicable components. The provisional velocity curve is zero below.65m/s, ramps to half running movement error at walk speed, then to the full running error at5.4m/s. Rifle movement radius6 degrees references the historical9.10 running value; the angular-unit interpretation and interpolation are our model, not an exposed Riot formula. Walking is3 degrees at nominal walk speed. Landing adds.35 degrees for90ms; air adds8/8.5 degrees. Recoil is separate.

A seeded tangent-disc sample is transformed into an orthonormal forward/right/up camera basis and normalized. Euler pitch/yaw offsets no longer distort the cone near steep aiming angles. Hitscan and actual hit classification use that direction. First-shot direction uses the pre-kick recoil center; the new kick affects subsequent shots.

The braking recorder now measures the beginning and end of the actual low-velocity accuracy window. Tap drills validate initial direction, a real braking episode, neutral/opposite input, shot velocity and head intersection separately. They never set velocity to zero. Existing neutral/opposite comparison remains in results. Moving-shot wall practice records actual impact width/height/diameter, angular sample RMS, firing velocity and stationary duration. Grouping includes recoil and movement; it cannot identify randomness from impacts alone. UI labels mark recent-detail subsets rather than implying lifetime grouping.

## ADS presentation

Default for new profiles is Toggle; an explicitly saved Hold preference is retained. A right-down latch toggles once per press. Hold is available; Sheriff has no zoom or ADS cadence. Reload and equip suppress active ADS without permitting firing through those states. Mouse gain uses the existing shared coefficient and ADS multiplier; no smoothing is added.

Gameplay FOV uses tan(hipHFOV/2)/1.25, then converts horizontal to vertical for the viewport aspect. Simulation controls a short exponential transition with90%response.14s Vandal/.12s Phantom (provisional), interpolated at render time. These are not claimed measured native animation durations.

A dedicated weapon camera with fixed72-degree horizontal FOV renders original compact models after the world depth is cleared. It shares the original environment probe and uses lightweight lights. Hip/ADS positions are in `viewmodel.ts`; ADS is(0,-.16,-.80)m. Open sight posts are outside the central aiming region. Receiver, stock and hands stay below the sight line. A customizable high-contrast center dot replaces the four hip-fire bars. No scope mask, blur, black border, artificial aim displacement or bullet bending is added. Visual kick is reduced independently of actual camera/bullet recoil. Rifle muzzle flashes shrink during ADS and remain below the aim point.

CPU ray checks use the actual weapon meshes at16:9,16:10,21:9, three kick phases, and5/20/35m centered head samples. They are controlled geometry tests, not GPU screenshots, peripheral-vision approval, or real-player visual validation. Read `tactical-validation.json` for executed results. Actual low/high camera angles, transitions, post-processing, material quality and rapid mouse motion still require GPU desktop QA.

## Footstep recovery

The default stationary decay is3.5/s,2.5times the former1.4/s. Delay.12s and stationary speed.035m/s are unchanged. At exactly85% phase with no movement, the selected profile reaches zero in about.367s versus.733s previously, including delay. This is a deterministic simulation comparison, not VALORANT measurement. Walking decay remains.02/s; running/walking transitions retain phase and actual residual velocity still counts. Only collision-resolved eligible distance produces real sound events. The minimap shows event hearing radius, not accumulator progress.

`gameplayRevision` migrates only legacy default1.4 recovery once; explicit current custom rates remain configurable. Short pauses retain some progress. A fresh grace distance returns only after full stationary recovery. Bots only hear emitted events. Hearing alert state and visual exposure are independent.

## Input and browser limitations

The shared `BrowserInput` is still the only camera-input capture path for gameplay and aim science. It applies every delivered delta immediately, once, with no directional gains, steering, smoothing or firmware changes. A bounded2048-entry diagnostic ring measures callback CPU time, event receipt delay and delivered event frequency. It never queues camera movement. These are not physical polling, sensor counts or end-to-end photon latency. Synthetic125/500/1000/4000Hz tests assess event handling and invariant rotation only.

Pointer Lock requests `unadjustedMovement:true`. A supported promise that resolves while actually locked is labeled browser accepted, with sensor path explicitly unverified. Legacy void-return implementations remain unverified. Unsupported requests fall back; denials are handled. No global OS acceleration setting is changed.

Default crouch is C. Both Control keys remain aliases, with explicit Ctrl+W limitations. User bindings, Hold/Toggle crouch and Hold/Toggle ADS persist. The optional fullscreen start button requests script fullscreen then Keyboard Lock for physical gameplay codes including KeyW. Ctrl+W can only be intercepted where browser/OS support permits it. Escape is deliberately not locked. Exiting fullscreen, blur, pause and disposal reset input and release capture; late async lock completion is cleaned up. Browser permission-descriptor probing is not required.

## Original tactical maps

Six original sections in `levels.ts` use separated defensive bays and a sampled approach route:

| Section | Principle | Ground/elevation |
| --- | --- | --- |
| Long corridor | long sightlines, separated entry angles, deep defense | 0m |
| Garage entry | narrow door, close off-angle | 0m |
| Multi-entry site | three separate attack doors, rear connector | 0m |
| Vertical mid | upper/lower sightlines, ramp | 0/2.4/0m |
| Tower entry | six physical steps, ramps and upper landings |1.2/2.4/2.4m |
| Multi-level site | different head heights, upper cover |0/2.4/1.2m |

They are training layouts inspired by Haven/Split principles, not replicas, official maps or extracted assets. Room width, engagement depth, entrances and materials are original. Authored samples reveal at most one primary defender; every sector is revealed somewhere. Each angle has exactly one bot; spawn jitter is constrained to a validated patch. Sequential defenders stay eliminated until explicit reset, preserving route completion. Existing grid corner map remains available.

Player collision, projectile collision, AI line of sight and rendered geometry share AABBs and ramp definitions. Sloped tops and solid ramp side faces block shots; physical steps are.2m high. The movement support resolver permits.3m steps, respects elevated landings, gravity, jump and ceilings. Bot defense stays on a bounded supported patch; this is local tactical navigation, not a general navmesh pathfinder. Existing grid bots retain their occupancy-based local investigation. New sound-driven peeks never read the live player through walls.

Range patterns include short/long strafes, seeded reactive direction changes, stop-and-shoot windows, wide movement, crouch and mixed behavior. Acceleration/reversal use player values. Nominal speed caps at5.4m/s, with a0–1training speed factor; difficulty changes reaction and bounded repositioning, not maximum speed. Movement/animation collider transforms stay synchronized. Difficulty does not pretend to implement a full combat shooting AI; exposure death is its stated training rule.

## Exposure and retry

New maps support2.0s default exposure, configurable.5–5s. Each active bot must be reaction-ready, within42m, within a140-degree corridor-facing detection cone and have a clear ray to player head or torso. Sound alone does not count. Repeated footsteps cannot indefinitely defer visual readiness. Continuous mode resets when fully covered; Persistent mode decays at.65seconds per covered second. Eliminated/inactive bots cannot add exposure.

A death freezes simulation and releases mouse/audio. The overlay reports responsible defender, designed angle, duration and both positions, plus a concrete angle-slicing correction. Retry respawns the same map without leaving training, retaining lifetime shots and elapsed time. All targets cleared also allows explicit target reset. Free Practice never ends on a countdown.

## Verification and remaining limits

The release prebuild runs all application and infrastructure tests, then writes actual benchmark results. Synthetic input, CPU ray geometry, accelerated simulation, IDB mocks and DOM adapters are clearly separated from hardware tests. UI menus and preference persistence are verified in managed Chrome; WebGL is disabled there, so real3Dplay, GPU screenshots, perceived audio, fullscreen Ctrl+W interception, raw sensor behavior, high-refresh GPU FPS and mouse-to-photon latency remain unverified. No human skill improvement or exact VALORANT equivalence is claimed. UE has not been ported for these browser additions and remains disabled behind an additional migration gate.

Manual desktop QA: test each rifle at all three aspect ratios, near/far/high/low targets, recoil, rapid ADS toggles, reload and weapon switching. Compare full stationary/walking/running/reversal magazines on the wall. Traverse every staircase/ramp crouched and standing, peek every authored angle, break line of sight in both exposure modes, retry after death, test silent bursts and bot hearing. Test C+W on every browser; test Ctrl+W only in a disposable fullscreen test tab after keyboard lock indicates success. Inspect optional input diagnostics and export the existing render-submission proxy. Record GPU, browser, mouse, display, frame-time and network metadata; never infer native latency from CPU tests.

Rollback: previous production Site version7, sourceb79b2936a5d6f8e1651429c59460c474ae94f46b. Keep custom-domain DNS and public audience unchanged.

## Primary references

- Riot9.10 movement accuracy: https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/
- Riot3.0 historical deadzone: https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-3-0/
- Riot1.07 Vandal cadence: https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-07/
- Riot map principles: https://playvalorant.com/en-us/maps/
- Riot Split design: https://playvalorant.com/en-us/news/dev/the-creation-of-split/
- Chrome Keyboard Lock: https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock
- Chrome permission-UI cancellation update2026-03-17: https://developer.chrome.com/blog/keyboard-lock-pointer-lock-permission
- Pointer Lock options and limitations: https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock
