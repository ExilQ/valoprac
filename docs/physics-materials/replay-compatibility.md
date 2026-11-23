Replay compatibility in 12.00
============================

The schema-1 gzip command format and 120 Hz authoritative input stream remain
unchanged. New recordings identify game `12.0.0`, simulation
`valoprac-replay-simulation-3`, rules `materials-v3`, movement
`dual-movement-1.2.0`, and physical materials `physical-surfaces-1.0.0`.
They also record the ordered input codec and unchanged weapon calibration
versions. Initial profile/preset, settings, weapon, seed, map, rendered poses,
weapon switches, and setting changes remain part of the recording.

`ReplayPlayer` checks a complete registered compatibility identity before it
constructs `Simulation`. Historical game `10.0.0` / simulation-2 recordings
select `legacy-v2`; they use retained collision/support, penetration defaults,
and ground-sound rules in the same engine. The original state serialization
omits only the newly introduced rules selector strings and step-width calibration.
Pre-existing scenario rule objects remain part of historical checksums.
Every original checkpoint and final outcome is still recomputed. Import does
not rewrite the recording or upgrade it to current mechanics.

The current calibration fingerprint covers movement and weapons, penetration
power, bot timing, footstep calibration, physical surface coefficients, sound
profiles, sight-blocking flags, authored obstacle geometry and physical surface
assignments, and ground finish regions. PBR colors, roughness, material names, particle appearance, and graphics
presets do not enter that calibration fingerprint. Recorded graphics settings
remain in the full deterministic state as before.

The existing `src/tests/fixtures/replay-10.0.0.json` is unchanged. The additional
`replay-10.0.0-physics.json` was recorded independently by the unmodified
`Simulation` and `ReplayRecorder` from the detached pre-12 baseline `0029c16`,
using sanitized settings. Three 480-tick recordings cover VALORANT and CS2
movement on the bunny course and Source Classic in the complex, including
weapon switches, jumps, footsteps, landings, and shots. A fourth 181-tick
recording independently captures a displayed-frame headshot and elimination.
Their final checksums are `144b56481234c538`, `d9a482b7fceefe17`,
`8258a72b4893789f`, and `e057e8ff19a698a7`.

`replay-10.0.0-scenario.json` independently records the original close-corner
scenario for 360 ticks, including a jump, landing, weapon switch, retry and shot.
It was generated and verified by the same unmodified frozen baseline, with
source hashes and the recording protocol embedded in the fixture. Its final
checksum is `0504b121cca31227`. This catches accidental removal of the existing
scenario `rules` object when excluding the new engine selector.

`replay-physics-versions.test.ts` verifies these fixtures, rejects mixed version
identities, checks physical-vs-appearance fingerprint separation, and replays
current recordings at 60, 144, and 240 Hz for all three movement presets and
four graphics presets. The existing replay suite covers actual headshot kills,
defender deaths/retries, seeking, input ordering, and bounded file import.
