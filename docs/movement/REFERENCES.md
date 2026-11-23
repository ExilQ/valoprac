# Movement references and calibration boundaries

Research date: **2026-10-28 Asia/Seoul**. HTTP retrievals below completed on
2026-10-27 at approximately 18:40 UTC. These references establish behavioral
principles and version distinctions, not complete native-engine equivalence.

## Contemporary Counter-Strike 2

The official Steam news API for app **730**, restricted to
`steam_community_announcements`, returned 100 announcements spanning
2025-09-10 through **2026-10-22 22:56:10 UTC**:

<https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=100&maxlength=0&feeds=steam_community_announcements&format=json>

The returned records and their movement-related text were searched for jump,
bunnyhop, subtick, air acceleration, movement, landing and friction. This bounded
feed retrieval is not a guarantee that every rule or later server configuration
is documented publicly. The official updates landing page was also retrieved:
<https://www.counter-strike.net/news/updates>.

### Rules relevant to the current preset

- **2026-01-21** — landing time became subtick-precise. The announcement replaced
  jump/landing stamina with a landing-time penalty and described successful
  bunnyhops using a landing-centered input window and a jump-spam penalty. Its
  exact wording includes “sv_bhop_time_window centered on the landing time”.
  Private servers can select legacy behavior with `sv_legacy_jump`.
  [Official Steam announcement](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1822556746157780).
- **2026-01-22** — landing vertical velocity again influences the landing speed
  penalty. This follow-up must be considered alongside the previous day's
  removal of jump stamina; the default is not simply unrestricted legacy hopping.
  [Official Steam announcement](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1822556746160428).
- **2025-11-04** — fixed an incorrectly clamped air-acceleration case while
  surfing, and a ramp ascent incorrectly classified as a jump apex. This supports
  separating contact tests from vertical-velocity-zero tests and avoiding an
  indiscriminate horizontal clamp as the entire air solver.
  [Official Steam announcement](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1815580768210747).
- **2025-09-17** — improved timestep-independence of subtick movement acceleration.
  [Official Steam announcement](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1811138915373173).
- **2025-09-26** — subtick movement view angles are sent with other subtick events,
  rather than every frame they change.
  [Official Steam announcement](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1811772772259703).
- **2026-03-04** — fixed `WasInputJustPressed` / `WasInputJustReleased` handling for
  a jump press that did not cross a tick boundary in the scripting API. This is
  additional evidence that short input edges matter, not permission to label a
  browser's buffered input as the native CS2 implementation.
  [Official Steam announcement](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1826362059919569).

The fetched notes do **not** publish all current default window widths, spam
intervals, acceleration coefficients, landing-penalty functions or their full
weapon-dependent interactions. VALOPRAC's SI-unit coefficients and finite timing
policies are therefore explicit independent calibrations. A 120 Hz browser fixed
step, even with timestamped input and interpolated contact times, is not a replica
of CS2's complete client/server subtick prediction and networking.

## Historical Source movement principles

Valve's publicly published Source SDK was consulted for the algorithmic
separation of `AirMove`, `AirAccelerate`, ground `Friction`, jumping and ground
categorization. The latest movement-file commit returned by the public GitHub API
was **7191ecc418e28974de8be3a863eebb16b974a7ef**, committed on 2025-12-16:

- [Pinned movement-file reference](https://github.com/ValveSoftware/source-sdk-2013/blob/7191ecc418e28974de8be3a863eebb16b974a7ef/src/game/shared/gamemovement.cpp)
- [Repository license](https://github.com/ValveSoftware/source-sdk-2013/blob/master/LICENSE)

The mathematical ideas relevant to the independent implementation are:

1. Project horizontal velocity onto a camera-yaw-relative desired direction.
2. Bound the additional component along that direction, rather than replacing or
   instantly rotating the full velocity vector.
3. Distinguish the allowed wish projection from the speed used to scale requested
   acceleration. Historical variants differ in this detail.
4. Apply ground friction using both speed and a stop-speed scale; ordinary ground
   acceleration and airborne acceleration are separate operations.
5. Establish support using actual collision/contact information. A jump apex is
   not sufficient evidence of a landing.

**License boundary:** this SDK is published under Valve's Source 1 SDK license,
with restrictions for free Source-engine mods and redistribution. It is not a
permissive generic commercial-code license. No SDK routine, source file, game
asset or proprietary CS2 code is copied into VALOPRAC. The browser solvers are
independently authored from the requested mathematical behavior. The historical
SDK does not establish contemporary CS2 constants or exact Counter-Strike rules.
`sourceClassic` is a separately labeled optional trainer preset, not the ordinary
competitive CS2 mode.

## VALORANT references

- [Riot: Peeking into VALORANT's Netcode, 2020-07-28](https://technology.riotgames.com/news/peeking-valorants-netcode)
  describes local movement prediction, authoritative server simulation, smooth
  responsive motion and 128-tick server goals. It does not disclose a complete
  acceleration, friction, air-control or bunnyhop coefficient table.
- [Official patch 2.02, 2021-02-02](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-2-02/)
  separately changed rifle running, walking and crouch-moving shooting error.
  Weapon inaccuracy therefore remains its own calibrated system driven by actual
  velocity, grounded state and landing state; changing the character controller
  does not silently replace weapon recoil, ADS or weapon data.

VALOPRAC's stronger but bounded tactical air steering is an independent training
calibration, not a statement that Riot uses the same numerical constants. No
licensed native-game recording or human movement dataset was collected in this
work. Native trajectory error bars and native-game parity remain unmeasured.

## Units and reproducible evidence

The trainer uses metres, seconds, metres/second and metres/second squared. Source
reference units and gameplay maximum speeds must not be mixed directly into these
SI values. A historical units-to-metres convention alone does not calibrate a
modern weapon's speed, player hull, gravity or jump timing.

The frozen 08.00 controller is measured from commit
`a2d5d97b93d15363b2d182fd775f1bebabfbb0bc`. Before/after trajectories are software
experiments in an empty collision scene with a declared fixed timestep and shared
input schedule. Existing-map integration uses the actual pre-existing collision
volumes. These measurements can demonstrate steering, timing and collision
behavior; they are not native-game reference recordings, hardware FPS benchmarks
or physical input-latency measurements.

Retrieval metadata and concise source findings are recorded in
[REFERENCE_EVIDENCE.json](./REFERENCE_EVIDENCE.json). Raw HTTP bodies are kept in the
external QA workspace rather than redistributed as application assets.
