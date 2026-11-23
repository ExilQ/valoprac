# Dual movement implementation, 09.00

Every existing browser Simulation uses the selected movement profile; no map or
training mode was added for this update. Default VALORANT and CS2-inspired rules
share collision and input ownership, with independently authored acceleration,
friction, contact and jump solvers. The optional Source Classic preset is labeled
separately. No automatic bunny hopping is enabled in any shipped preset.

## Calibration and units

Version: `dual-movement-1.0.0`. Metres, seconds and radians. All constants below
are provisional trainer calibrations; native-game trajectory parity is unmeasured.
See [REFERENCES.md](REFERENCES.md) for current official CS2 update research and
Source SDK license boundaries. No SDK source or proprietary assets were copied.

| Rule | VALORANT | CS2-inspired | Source Classic |
| --- | --- | --- | --- |
| Base trainer speed | 5.4m/s | 5.4m/s | 5.4m/s |
| Ground solver | target velocity + bounded acceleration | friction then projected acceleration | same Source-style solver |
| Ground acceleration | 38m/s², reverse 45m/s² | coefficient 5.5/s | coefficient 5.5/s |
| Neutral friction | speed ×3.5/s +20m/s² | max(speed,2m/s) ×5.2/s | same |
| Air solver | bounded directional acceleration | projected wish component | projected wish component |
| Air acceleration | 10m/s² | coefficient 12/s | coefficient 20/s |
| Wish projection allowance | 5.4m/s | 0.8m/s | 1.2m/s |
| Global air speed cap | 5.5m/s | none | none |
| Contact/takeoff limit | 5.5m/s | 5.94m/s | 20m/s |
| Jump impulse / gravity | 5.2m/s /18m/s² | 7.4m/s /20.32m/s² | same as CS2-inspired |
| Early landing buffer | selected 0–140ms | min(selected,40ms) | selected 0–140ms |
| Landing window | 80ms | 80ms centered, ±40ms | 140ms |
| Spam policy | manual edges | requests <80ms apart block for80ms | manual edges |
| Missed landing retention | ordinary ground braking | max(0.5,1−0.08−impactSpeed×0.008) | no extra landing penalty |

The existing weapon movement speed is divided by the shared 5.4m/s reference;
ADS, crouch and walk apply their own modifiers. In Source-style ground movement,
stop-speed is scaled by requested speed while input is present so minimum friction
cannot immobilize crouched/walking movement; neutral stopping retains the full
stop-speed. This is an explicit independent calibration, not a published CS2 formula.
CS2-inspired landing friction is deferred through the late half-window, allowing
valid manual re-jumps to preserve momentum. Air velocity is never globally clamped
in the Source presets; contact/takeoff caps prevent repeated unlimited accumulation.

## Input and contact ownership

Browser commands retain monotonic event time and base camera yaw. Camera look and
shot aim remain immediate. Fixed ticks replay movement yaw at the matching endpoint,
without replaying weapon recoil yaw as movement input. Short directional pulse area
is integrated once. Opposing changes inside one8.33ms tick are averaged, not simulated
as native CS2 subtick events. Walk/crouch state uses the tick endpoint. The512-command
buffer fails closed to neutral movement on overload and reports discarded commands.

Space uses physical edges; key repeat does not generate requests. Optional selected
wheel direction creates a single request per event, with20ms wheel debouncing and
the active profile's jump-spam rules. Scroll distance does not multiply impulses.
A zero early buffer still accepts a fresh grounded request inside its actual tick;
stale requests cannot become newly buffered after a frame delay. Lock loss, blur,
weapon switch, death/retry and physics changes clear transient browser commands.

Collision uses swept, subdivided horizontal axes, walkable ramp normals, real
support heights, headroom checks and crossed ceiling planes. Adjacent ramp/platform
headroom is evaluated above the combined reachable step, preventing a ramp bounding
box from pushing the player back to its distant edge. An apex is not ground contact.
CS2-inspired landing time is interpolated within the fixed collision tick; the
remaining upward fraction after a buffered re-jump is integrated without a second
landing. This is local browser physics, not network prediction or server subtick.

## Gameplay and data

Shooting consumes resolved speed, airborne/landing state and weapon rules. Recoil,
ADS, Operator bolt/reload recovery, hit surfaces and manual peeking remain separate.
Footsteps retain their distance accumulator and real braking rules; airborne motion
adds no walking steps. A separate real-contact landing stream uses impact speed,
surface material and independently synthesized thuds, and is audible to fair bots.

Changing the profile preserves position, airborne vertical velocity, crouch headroom,
sensitivity, weapon state and AI knowledge. Horizontal velocity and pending movement
are cleared, without granting a new life or extra ammunition. Snapshots retain the
active physics and up to32 transitions. Browser combat/tactical records include a
versioned movement identity (profile, preset, effective buffer); historical groups
remain intact and are never averaged or paired across incompatible identities.
Neutral angular sensitivity tasks keep their existing comparison rules.

## Evidence and limits

Tests A–I cover mirrored input, coordinated yaw, reversal, momentum, manual chains,
profile differences, real collisions and gameplay integration. Exact120Hz trajectory
samples are compared under60/144/240 render schedules. Frozen08.00 source is the
before baseline, not a reconstructed approximation. Browser QA uses actual Chromium
WebGL, trusted fullscreen and pointer lock where stated. Software rendering does
not establish high-refresh hardware FPS or physical mouse-to-photon latency.

Trusted command QA used real PointerLock and Playwright keyboard/mouse through
the normal Runtime. WebGL drawing was suspended only during those command
sequences to isolate input processing from software-GPU safety pauses; separate
scene screenshots and32 window/fullscreen HUD audits used actual WebGL draws.
This does not establish physical device, input-to-photon or high-refresh performance.
