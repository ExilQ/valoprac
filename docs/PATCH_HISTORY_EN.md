# VALOPRAC patch history through 12.14

VALOPRAC developed from a browser corner-peeking prototype into a tactical FPS trainer for movement, first-shot accuracy, angle clearing, sensitivity testing, and replay review. The latest release puts the Review Lab on the same domain as the trainer, where players can connect measured practice sessions to mistakes observed in their own matches. [VALOPRAC](https://valoprac.trade/) · [Review Lab](https://valoprac.trade/review/) · [Production release metadata](https://valoprac.trade/release.json)

The version labels and dates below follow the production application's patch history. For example, the application displays **12.14**, while the browser package uses **12.0.14**. The public GitHub repository's `main` currently identifies its package as **2.3.0**. This document describes the published web app through **12.14** and is formatted for a GitHub release post. [GitHub source migration](https://github.com/ExilQ/valoprac/pull/1) · [GitHub release process](https://github.com/ExilQ/valoprac/pull/5) · [GitHub package metadata](https://github.com/ExilQ/valoprac/blob/main/package.json)

## 12.14–12.08 · Review Lab integration and tactical practice

### 12.14 · The Review Lab moves to valoprac.trade · November 22, 2026

- The Review Lab now runs at `valoprac.trade/review/`. Links from Training History and Training Results open that address directly.
- Players with data at the previous address can export a JSON backup and restore it from **Import** on the new page. The backup can carry sessions, problem tags, the play profile, weekly goals, and problem-specific settings. If a session already exists on the new page, the edited copy there is kept.
- The production browser check exercised the record handoff, restoration from a legacy export, duplicate handling, and the mobile page. The release report records 1,498 application tests, 28 broker tests, and 30 hosting tests passing. [Review Lab](https://valoprac.trade/review/) · [Training History](https://valoprac.trade/statistics.html) · [12.14 validation](https://valoprac.trade/aim-validation.json)

### 12.13 · Connect measured training to match review · November 22, 2026

- A completed session can be sent from its result screen or a saved history entry. For several sessions, Training History exports a dedicated JSON file and the Review Lab lets the player select which rows to save.
- The transfer carries the session summary. For example, headshot share uses head hits divided by all hits, and a missing measurement appears blank. Players can attach a problem tag during import or after saving. A second import of the same session keeps the first copy and its edits.
- A tag such as “overexposure” can connect an early match review with later peeking practice and subsequent match observations. The lab shows the number of linked practices, before-and-after metrics, and weekly goal progress. Its comparisons use player-entered match reviews and browser-local training history. [Review Lab](https://valoprac.trade/review/)

### 12.12 · Head-height holds, crouch fights, and defender placement · November 22, 2026

- An original character kit adds a headset, chest plate, and shin guards. The rendered body surfaces are used for shot detection.
- Defenders can hold a standing head-height line. In the new route drills, players can rehearse clearing that hold and observe how crouching moves the target's head away from the original line of aim.
- Defenders and the starting position can be dragged in the overhead plan or 3D editor. The editor can compare the selected defender's standing and crouching postures.
- Compatible tactical practice and replay sessions can supply observed crouch and shot intervals to adjust defender timing in the browser. The source for this calibration is the player's compatible VALOPRAC records.

### 12.11 · Read the drill before starting and track the fight at a glance · November 22, 2026

- The start briefing and pause screen put the objective, map, weapon, and session duration together.
- The HUD shows a live magazine gauge, low-ammo and reload cues, health during live engagements, and the time limit when applicable.
- The control guide reflects the player's current key bindings. The HUD was rearranged for narrower viewports.

### 12.10 · Training arenas get distinct materials and clearer route cues · November 22, 2026

- Arena walls and cover use map-specific stone, plaster, and painted metal. Lower wall bands and cover edges help distinguish surfaces at a distance.
- Sky and shadow tones were revised, and diagonal floor markings were cleaned up in the playable arenas.
- openVaim Studio gained solid, tiled, and industrial panel patterns with separate controls for floor and wall repeat spacing.

### 12.09 · Edit scenarios in 3D and inspect weapon finishes · November 22, 2026

- The scenario editor gained floor-plan, 3D geometry, and 3D material views. A defender can be placed by clicking a surface.
- Scenarios can reveal defenders when the player crosses an entry line. Sequential fights and the activation settings are represented in scenario share codes.
- Desert Bronze and Indigo Carbon finishes were added, along with a 3D view of the equipped weapon and finer bump and roughness detail on painted metal.
- Sensitivity conversion expanded to CS2, Apex Legends, Overwatch 2, Call of Duty, and Destiny 2.

### 12.08 · Save a drill and inspect individual shots in replay · November 22, 2026

- Favorite and recent drills can be reopened with their original conditions, which makes comparisons between attempts more meaningful.
- Shot review exposes spread and braking timing for individual shots and can seek to the related moment in a compatible replay.
- Added a sniper doorway peek and an uphill ramp entry with defenders that appear in sequence.
- Added Polar Slate and Teal Ceramic weapon finishes and file import for sensitivity and the active crosshair.

## 12.07–12.00 · Characters, rendering, and interface refinements

### 12.07 · Refine the target's proportions and color separation · November 22, 2026

- Reworked the face and hair, raised the waist and knees to lengthen the leg silhouette, and added a bent-elbow pose. A teal jacket, dark trousers, and a coral armband make the target easier to read at different distances.
- Glove hit surfaces follow the new forearm position. Earlier recordings retain the model they were recorded with.
- The published surface-alignment check sampled 12,480 rays and reported zero false hits or misses in those samples. Matched captures kept the same draw-call counts, with a higher triangle count in the eight-target high-quality scene. [Character validation](https://valoprac.trade/agent-validation.json)

### 12.06 · Rebuild the target mesh and use it for shot detection · November 19, 2026

- Rebuilt the target's helmet, visor, jaw guard, shoulders, waist, gloves, and boots. Cloth, armor, rubber, and lenses respond differently to light.
- Head, torso, and limb hits use triangles from the displayed model. Indexed geometry reduced the character's vertex and material buffer size in the documented comparison, and target instancing was retained.
- Replay metadata selects the character geometry that was active when the session was recorded. [Character validation](https://valoprac.trade/character-validation.json)

### 12.05 · Render wall and cover details more efficiently · November 19, 2026

- Wall seams, vents, metal cover tops, and side plates were converted into thin surface details and drawn together to reduce unnecessary geometry and shadow work.
- Wallbang material samples, transparent glass, cover placement, collision, and projectile behavior retain their previous definitions. [Obstacle validation](https://valoprac.trade/obstacle-validation.json)

### 12.04 · Sharpen material detail and reduce graphics memory · November 19, 2026

- Concrete grain, stone texture, wood grain, and metal highlights were revised. Floors in the Peeking Lab now use the colors of their assigned materials.
- Low and Medium skip texture channels they do not use. Roughness uses two-channel storage and the existing shader path. Repeated map vertices were reduced while keeping the same cover positions. [Graphics validation](https://valoprac.trade/graphics-validation.json)

### 12.03 · Make settings and training-tool tabs keyboard friendly · November 19, 2026

- Wide settings use vertical arrow-key navigation, while narrow settings use horizontal keys and a scrollable tab row.
- Training-tool tabs activate on Enter or Space, at which point the relevant panel or replay loads.
- Opening defender placement from a tactical route moves keyboard focus to the editor tab.

### 12.02 · Make the Aim Lab easier to link to and use on touchscreens · November 18, 2026

- Sensitivity Explorer and aim analysis gained direct links. Reloading the page or going back restores the selected lab tab.
- Tabs support arrow keys, Home and End, and Enter or Space. Narrow layouts show the selected tab within a horizontally scrollable row.
- Training settings gained larger touch targets and clearer labels for the optional 3D preview.

### 12.01 · Preview on demand and navigate with ordinary links · November 15, 2026

- The training setup and the real map plan rearrange based on available panel width. The 3D preview starts on request and releases its graphics resources when closed.
- Navigation uses real URLs, so browser Back and opening new tabs work as expected. A skip link and focus updates support keyboard navigation when changing views.
- Deleting training history requires a confirmation dialog with Cancel as the default. Active selections remain readable in light, dark, high-contrast, and reduced-motion environments.
- The training category list can still be collapsed and remembers its setting. This patch changed presentation and navigation while using the existing gameplay and replay rules. [Web interface validation](https://valoprac.trade/modern-web-validation.json)

### 12.00 · Strengthen 120 Hz physics, material behavior, and replay stability · November 15, 2026

- The fixed 120 Hz simulation and three movement rule sets were retained. Collision fixes address fast wall and corner contact, low ceilings after a chained jump, repeated steps, steep slopes, and restoring a saved position.
- A library of 22 physical surface definitions ties collision, sight, penetration, footsteps, landings, and impact marks together. Fifteen original PBR finish families provide consistent surface scale across maps, weapons, and targets.
- Collision candidate queries and sightline and ballistic checks process less static geometry while preserving tested results and hit ordering. Hidden targets and defender weapons are excluded from batches, with impact marks batched separately.
- Shader preparation now includes the actual target and hit effects. Software rendering can select a lower preset with an enforced frame cap.
- Replay simulation version 3 records the updated physics. The 10.00 replay format can still be reconstructed with its earlier rules. Improves validation of imported recordings, seek cancellation, timeline bounds, and history transactions that save or delete sessions concurrently.
- Restarting drills clears old sound de-duplication state. The patch also filters impossible mouse and timing values and removes marks and impact sounds produced at internal overlap boundaries.
- The browser continued to use TypeScript after a WebAssembly comparison. The release evidence covers software tests and matched scenes. Physical-device frame rates and real input latency remain unmeasured in that report. [Physics and materials validation](https://valoprac.trade/physics-materials-validation.json)

## 11.00–07.00 · Interface, replays, and measured practice

### 11.00 · Precision Utility interface overhaul · November 6, 2026

- Introduced a warm, light-first color palette with teal accents. Light, Dark, and System theme preferences are stored independently of game settings.
- Reorganized the app into Training, Maps, Weapons, Aim Lab, History, and Settings. The training list can collapse, the setup prioritizes the selected drill and target count, and the armory offers a compact list of four weapons with expandable detail.
- Split settings into eight categories and made the combat HUD more compact. The pause screen exposes diagnostics and lets players review settings with Pointer Lock released.
- Improved results, sensitivity charts, replay controls, keyboard focus, reduced-motion behavior, and number legibility. Gameplay recordings and compatibility were preserved. [Interface validation](https://valoprac.trade/interface-validation.json)

### 10.00 · Deterministic replay and a broader training platform · November 4, 2026

- Air movement now starts from actual takeoff speed, stance, and weapon. The provisional VALORANT jump model targets a 1.15 m rise. CS2 and Classic retain separate movement rules. Expert defenders received a targeted first-shot timing change for pre-aimed holds.
- The common replay format records inputs, random seeds, submitted display poses, and checkpoints. It supports pause, playback speed, seeking, camera changes, highlight links, and local file export.
- Added a one-minute 3D warmup, a view-turning flash avoidance drill, position save and restore, return to takeoff, jump trajectories, a replay ghost, and third-person review.
- Added five routes on original tactical maps and a validated scenario editor with code and link sharing. Crosshair profiles support outlines, dots, inner and outer lines, and ADS choices.
- Refined jump diagnostics, training labels, shot audio cadence, spatial audio occlusion, defender footsteps, and graphics preparation. The release also added optional interface English while keeping Korean as the default and records in the browser.
- Movement values remain independent calibrations. Native traversal values, physical input latency, FPS, and listening performance are outside the verified scope of this release. [Roadmap validation](https://valoprac.trade/roadmap-validation.json)

### 09.01 · Correct air speed, scoped FOV, and delayed feedback · October 30, 2026

- Air acceleration uses the requested speed for walking, crouching, weapon, and ADS, while preserving momentum already in the air.
- Scoped horizontal FOV now uses base FOV divided by zoom. A 103° baseline yields 82.4° at 1.25×, 41.2° at 2.5×, and 20.6° at 5×. Rifle ADS and the two Operator zoom levels have independent sensitivity settings, and the readout shows delivered counts for a full rotation.
- Vandal and Phantom ADS first-shot spread was calibrated to 0.1575° and 0.11°. Pre-aimed defenders no longer wait through a duplicate first-shot delay.
- Added spatial enemy shots and footsteps, discarded stale automatic-fire sounds, and retained the cadence of future shots. Updated jump diagnostics and start labels.
- Added software and integrated graphics guidance, lower-preset recommendations, shader preparation, startup cancellation, and environment batching. Scope comparisons made under different FOV rules are separated. [Corrections validation](https://valoprac.trade/corrections-validation.json)

### 09.00 · Add separate VALORANT and Counter-Strike movement profiles · October 28, 2026

- Movement Settings gained VALORANT and Counter-Strike profiles. CS2-style projected acceleration, ground friction, landing input windows, and repeat restrictions are distinct from the Classic Source preset.
- WASD input and view direction affect actual acceleration and redirection in the air. Jump input is timestamped at 120 Hz, and wheel jump is optional.
- Landing sounds depend on impact and surface. Airborne movement uses its own diagnostics, including speed, acceleration, airborne direction, jumps, and landings.
- Profile switches retain position, vertical momentum, weapon recovery, and sensitivity while clearing stale horizontal input. Histories with different movement models are separated in comparisons. The report compares 60, 144, and 240 Hz render schedules and treats the profiles as independent calibrations. [Movement validation](https://valoprac.trade/movement-validation.json)

### 08.00 · Make defender fights, movement, and wallbangs interact · October 28, 2026

- Defender AI separates visibility, recognition, aim motion, and firing. Aim has speed and acceleration limits. Defenders use weapon recoil, ammunition, reloading, and distance-dependent taps, bursts, or sustained fire.
- Angle learning, live gunfights, and exposure limits are separate settings. Added four difficulties and reset handling for ammunition, scopes, recoil, input, and hearing after a death.
- Footstep buildup recovers under real deceleration. Rapid alternating input at high speed can still make noise. Jump buffering, airborne momentum, and chained jumps support courses with ramps, steps, and low ceilings.
- All weapons use a common penetration calculation based on material, thickness, angle, remaining budget, and the surfaces crossed. A wallbang range provides wood, steel, and reinforced walls, with material-specific impact effects and analysis.
- A defender can attempt limited wallbangs using earlier observations or audible cues. Replay and analysis expose braking, landing timing, aim, bursts, and reaction timing. [Combat validation](https://valoprac.trade/combat-validation.json)

### 07.00 · Turn sensitivity comparisons into repeatable experiments · October 27, 2026

- Added Quick, Precision, and Long protocols spanning baseline, range finding, fine comparison, held-out trials, and retention checks. Seven neutral tasks cover small targets, large turns, micro-corrections, movement clicks, tracking, and target switching.
- Reports explain flick, deceleration, correction, stabilization, and click timing. Comparisons account for the input profile, DPI, FOV, screen, ADS, and uncertainty. Paired results can classify candidate sensitivities as practically equivalent or inconclusive.
- A different seed can test a candidate on a held-out task. Sessions can resume after interruption and compare compatible results across dates. Added separate evaluations for rifle ADS and both Operator zoom levels.
- The lab compared four search methods on nine synthetic conditions at the same budget. Players choose whether to apply the suggested sensitivity. Human-subject validation and improvement in live matches remain unverified. [Precision Lab validation](https://valoprac.trade/precision-validation.json)

## 06.01–2.2.0 · Tactical training foundations

### 06.01 · Align visible targets with click-time hit detection · October 27, 2026

- The visible head and body mesh, including the neck and hands, became the hit surface. A click against a moving target uses the pose presented with that click, removing the need to lead the next simulation tick.
- The old default Ctrl crouch and hold ADS are migrated once to C and toggle ADS. Custom bindings are preserved. Crouch-movement spread was calibrated to 0.8° for rifles and 0.5° for the Sheriff.
- The peeking entry opens the exposure-enabled tactical lab, the six prior maps are reachable directly, and selected-mode highlights were corrected for braking and vertical drills.
- Improved Korean title wrapping and guide discoverability. HTML uses `no-transform` to protect the strict content security policy, and unknown routes return a real 404. [Hit registration and correctness validation](https://valoprac.trade/correctness-validation.json)

### 06.00 · Open the Tactical Peeking Lab and add the Operator · October 25, 2026

- The Peeking Lab connects eight zones and 11 defensive angles with flanks, stairs, and ramps. Players can practice wide, shoulder, jiggle, crouch, jump, sliced-angle, elevation, and mixed peeks.
- The Operator has a five-round magazine, a bolt recovery cycle, 2.5× and 5× scopes, and independent toggle or hold controls. Movement, landing, and hip-fire affect its accuracy.
- Defenders react to what they see and hear and can relocate. Review tracks exposure, baiting shots, using recovery windows, and death sightlines. Players can retry on the same map or choose timed or unlimited sessions.
- The six previous maps also received cover, flanking, and architectural improvements. The calibration report distinguishes PC reference values from provisional trainer measurements. [Peeking validation](https://valoprac.trade/peeking-validation.json)

### 05.00 · Rebuild the visual presentation for browser tactical training · October 25, 2026

- Refined weapon-specific receivers, barrels, stocks, and sight profiles. Linked first-person hands and forearms to the weapon and added support-hand reload motion.
- Added human-proportioned tactical targets tied to the hit rig, revised map finishes and visibility-focused lighting, and redesigned training entry points, the armory, settings, and analytics.
- Rifle ADS offered 1.25× with toggle and hold options. Models, textures, and sounds used original production assets. [Tactical guide](https://valoprac.trade/tactical-guide.html)

### 04.01 · Clean up the HUD and pointer-lock failure handling · October 24, 2026

- Revised the HUD so footstep and braking information can be read together. Fixed a misleading error when the browser fell back from raw input to standard Pointer Lock.
- Separated walking and running spread references by weapon, improved target-speed and sensitivity guidance, and clarified help, sound credits, and the unofficial-service notice.
- Updated production response headers, asset caching, and address recovery, and provided a complete buildable source export.

### 04.00 · Teach stopping accuracy and clearing real angles · October 24, 2026

- Rifle spread follows actual speed and uses conical shot deviation. Two-direction tap-braking drills measure the interval around the accuracy threshold.
- Added toggle ADS by default, an independent weapon camera, and a compact reticle. Footstep buildup recovers 2.5 times faster after a genuine stop and retains the accumulated amount while walking.
- Added C crouch, optional fullscreen key lock, and raw-input diagnostics.
- Six original tactical areas support fast strafes, stairs, ramps, high and low holds, sequential angle clears, and line-of-sight exposure deaths. A player can retry in the same area immediately. [Tactical validation](https://valoprac.trade/tactical-validation.json)

### 03.00 · Add Aim Science and sensitivity comparisons · October 24, 2026

- Shared input instrumentation added six neutral tasks with no recoil or spread. Analysis covers initial flicks, correction, click timing, tracking, and eight aiming directions.
- Sensitivity trials alternate candidates and offer optional Gaussian-process search. Held-out tasks and evidence-based drill recommendations help separate exploratory results from follow-up measurements.
- The player can replay, export, or delete locally stored trajectories. The work focuses on measuring player input. [Aim methodology](https://valoprac.trade/aim-methodology.html)

### 2.3.0 · Make footstep buildup matter in corner peeks · October 24, 2026

- Footstep buildup depends on actual speed and distance. Walking preserves the accumulated amount, while coming to a genuine stop allows it to recover.
- Zone defenders listen for emitted footstep events. The practice view shows a buildup gauge and the hearing radius around the source of a sound.
- The corner-peeking prototype map was connected to the browser's 3D weapon and headshot system. [Footstep guide](https://valoprac.trade/footsteps.html) · [GitHub source snapshot](https://github.com/ExilQ/valoprac/pull/1)

### 2.2.0 · Prepare Unreal integration and strengthen session cleanup · October 23, 2026

- Added staging integration code for shot records, statistics, and recoil.
- Improved reconnect behavior, input confirmation, and server process cleanup. The Unreal 5.7 project is documented as staging, with native build and play verification outstanding. [GitHub source and handoff](https://github.com/ExilQ/valoprac/pull/1)

## Early prototype history · October 20, 2026

- **01.00 · Corner-peeking prototype.** Placed randomized defenders in zones, let them investigate footsteps, and added an information button with major and minor patch entries.
- **00.02 · Footstep simulation.** Added footstep practice information and a visual hearing range.
- **00.01 · Patch-history interface.** Added an information button and version display.

These three entries come from the prototype history. The production patch timeline above starts at 2.2.0.
