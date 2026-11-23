# Original movement and material training maps

The `bunny` and `wallbang` maps extend the existing Three.js/TacticalLevel architecture. They are original VALOPRAC geometry. Their dimensions and materials are provisional training choices; neither map reconstructs a Riot map, assets, or undisclosed native physics.

## Movement research hall

The 24.8 × 52.6 metre hall connects a ground-level return circuit, a raised central jump route, and a separate stair/ramp route. A failed landing drops onto the same ordinary ground floor. Retry is not required to re-enter a route.

- A 6 metre ramp rises 0.8 metres to a 5.6 metre-wide central deck. Two 2 metre gaps permit manually timed forward jumps at the existing capped movement speed. No trigger launches or accelerates the player.
- The right route uses eight actual 0.15 metre risers, a 1.2 metre landing, and an 8 metre return ramp.
- A physical 1.45 metre ceiling requires crouching. A 1.75 metre parapet hides a level head-height sightline until the player's actual eye height rises during a jump.
- The side return galleries remain unobstructed, so walking around the obstacles is always possible. These routes do not count as successful hops; success comes from actual movement telemetry.

The hall supplies space for manual jump timing, finite air steering, landing recovery, momentum measurement, and airborne shooting penalties. Its geometry does not alter the movement profile or grant a protected state.

## Material ballistics hall

Three separated defensive cells connect through the same front gallery. Each contains a grounded target position 16 metres behind its entry, a 3.6 metre-wide sample at depth 8 metres, and an accessible side-confirmation position. `WALLBANG_APPROACH_ROUTES` defines continuous doorway-to-side approaches; the level's `route` array contains visibility/label checkpoints, as in the existing tactical levels.

| Bay | Sample | Thickness | Purpose |
| --- | --- | --- | --- |
| 1 | Thin wood | 0.16 m | Low-resistance traversal and reduced damage |
| 2 | Thin metal | 0.16 m | Greater power expenditure and damage loss |
| 3 | Reinforced material | 0.28 m | Explicit non-penetrable comparison |

Every sample blocks ordinary perception. Firing uses the shared ballistic tracer and the actual collision interval. A side peek reveals a defender normally; retreating behind a sample does not grant the AI continuous concealed-player coordinates. Defenders have bounded alternative positions that remain in the same cell. Changing approach position changes real incidence angle and traversal length.

The map demonstrates these three specific materials. The engine's remaining material definitions have separate ballistic tests. The term `breakable` in the material table is a penetration category, not a claim that this release implements destructible architecture.

## Art and collision agreement

Original batched architecture adds shaped portal crowns, supported overhead ribs, high service glazing, recessed upper wall layers, and restrained floor markings. Shootable sample surfaces retain their distinct material identity. Art does not change collision, navigation support, or material thickness. Decorative supports follow existing wall volumes; overhead details stay above the movement and head-height band. Detail culling never removes the physical training obstacle.

## Executable validation

`src/tests/mechanics-maps.test.ts` verifies map registration, safe spawn and return routes, actual ramp/stair traversal, a manually executed platform jump, physical low headroom, jump-height visibility, repeated valid defender placement, side-peek visibility, distinct shared-tracer penetration outcomes, and finite UV/geometry data with unchanged collision.

These CPU tests establish geometric and mechanical behavior. They are not a GPU quality approval, real-player usability study, hardware latency measurement, or proof of native VALORANT parity. Browser screenshots and release-level performance evidence must be reviewed separately.
