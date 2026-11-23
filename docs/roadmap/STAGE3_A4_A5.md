# Stage3 A4/A5: original tactical routes and safe scenario editing

Status2026-11-04: implemented and validated on the unreleased Stage3 tree after checkpoint `892fe4c`. This is not a deployment receipt or a completed platform release. Production publication is performed and verified by the owning release workflow. Korean remains the default UI.

## Implemented behavior

**A4** exposes five usable routes through VALOPRAC's existing original environments. It adds purposeful approach/defender data and validation rather than replacing those maps or presenting a new blockout as finished art.

| Route | Original map | Tactical purpose | Defender sectors | Sampled maximum simultaneous threats |
| --- | --- | --- | --- | --- |
| long-lane | long | Deep corridor and sniper hold |1|1|
| close-corner | garage | Close doorway and retreat |1|1|
| off-angle | site | Clear the side of cover, outside the expected line |1|1|
| vertical | tower | Physical stairs and1.2m upper ground |1|1|
| sequential | complex G | Three progressively revealed angles |3|1|

The route menu shows purpose, recommended weapon, difficulty, sector count, vertical difference, actual map plan and per-route local results. Comparison tables explicitly disclose that different layouts, weapons and difficulties can be mixed; empty history shows no fabricated metrics. Movement remains manual. Existing authored architecture, materials, collision, cover and navigation boundaries remain unchanged.

**A5** adds a browser editor for player origin/orientation/weapon, bot positions/weapons, held or validated reposition anchors, difficulty, time/free-practice, actual gunfight versus exposure rules, random valid anchors, reserve ammunition and automatic reload. The editable map plan converts the real click event through the SVG inverse screen matrix; coordinate fields remain available for precise placement. Small floating-point display artifacts are cleaned without changing authoritative coordinates.

Sharing is version1 UTF-8 JSON in bounded unpadded base64url `VP-S1.` codes, optional fragment URLs and local JSON files. Default links open `/tools.html#scenario=…`, prefill validated data and wait for an explicit start. Same-document fragment/back navigation revalidates the new payload. Malformed links show an error and an editable safe default. Links do not automatically run a session, navigate to imported external hosts or upload the data. A validated local draft can be saved without an account.

## Validation algorithms and limits

Schema checks precede geometry: exact known keys, version, primitive types, finite values, no dangerous prototype keys, depth≤10, tree nodes≤6000,24,000UTF-8 bytes, at most12bots and4alternative anchors per bot. Unknown executable fields, forged weapons/maps, noncanonical base64, malformed UTF-8, duplicate/ambiguous URL payloads and oversized files fail safely.

Coordinates must satisfy the selected original map's bounds, actual CollisionController support and full standing body clearance. Every possible defender anchor is checked; overlapping bots and already-exposed player spawns are rejected. Reposition paths are sampled against real support/body space. Approach positions are sampled at10cm and actual line-of-sight rays record newly exposed sectors. Sequential scenarios reject simultaneous threats; deliberate crossfire is a separately selected rule. Randomization chooses explicit validated anchors with zero unconstrained jitter. Held bots receive a single navigation anchor; reposition bots use only their validated paths.

Compilation preserves the original `level` for rendering and supplies separate defender sectors to the same Simulation/DefenderAI. Reset and retry choose positions deterministically from seed and life generation and restore the custom player origin/orientation. Initial options, changes and resulting states use the common A2 replay authority, not a second scenario replay implementation.

## Measured evidence

- **46/46 tests in4files pass**:15codec,10geometry,8UI/initial-link and13full Simulation/replay integration cases. The final validation added15 tests and removed none. TypeScript and whitespace checks pass.
- All five routes have protected standing/crouching spawn samples, traversable approaches and visible valid defender positions. Actual player Movement walks the route and stairs; no automatic peek or camera movement performs the task.
- Ten primary/random route fixtures perform the full approach, a legitimate headshot/elimination, target reset, same-map retry, gzip export/import and two identical re-executions. Each reconstructs score1/hit1 and the same complete state checksum. A separate actual Operator death/retry case passes. Imported15-second completion and exposure-only elimination are also reproduced; exposure mode preserves150HP and is not mislabeled ballistic damage.
- Actual Chromium154.0.8037.57 passes **12 browser checks** and four layouts:390×844,768×1024,1366×900 and3440×1440. This covers edited rules executing in the real Simulation, clipboard codes, safe rejected data, unsupported-spawn blocking, map clicks, local reload, file export/import, independent-context shared links, malformed-link recovery and no external/upload requests. All four layouts have no horizontal overflow or oversized editor buttons.
- Exact fixture code/file sizes, state checksums, source hashes, raw browser requests and measurements are retained in [STAGE3_A4_A5.json](STAGE3_A4_A5.json) and [STAGE3_A4_A5_BROWSER.json](STAGE3_A4_A5_BROWSER.json). The actual editor screenshot is [editor-desktop.png](scenarios/editor-desktop.png). The repeatable browser harness is `measure-scenario-editor.mjs`.

The click harness originally compared an ideal fractional CDP coordinate with an integer-quantized browser MouseEvent. It now compares the actual event's inverse transform and100th-metre rounding; the intended .5m click was delivered as .47m in that viewport. This is recorded rather than falsely claiming subpixel pointer precision. The UI supports direct coordinate input when exact positioning is needed.

## Files, performance and publication boundaries

Core data/validation: `training/scenarios/{types,templates,validation,compile,codec}.ts`. Interface: `ScenarioRoutes.tsx`, `ScenarioEditor.tsx`, `ScenarioPlan.tsx`, `scenarios.css`. Tests: `scenario-{codec,geometry,ui,replay-integration}.test.*`. The owning integration supplies Simulation options/reset/retry, app navigation and the tools entry; this report verifies those real hooks.

No new package, network service, account, advertisement, telemetry upload or Riot asset was introduced. Rendering uses the existing original map geometry. Editor validation and replay import run locally; their measured test times are not hardware FPS or physical input-latency measurements. The browser editor probe does not draw WebGL, so it does not certify3D visual quality or high-refresh performance. Whole-release transfer size, frame timing, final patch number and production verification remain part of the parent release gate. Independent contexts of Chromium and Node/Chromium codec execution are covered; native Firefox/Safari and physical-device measurements remain unverified.
