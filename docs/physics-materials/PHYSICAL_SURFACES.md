# Physical surfaces

`src/config/surfaces.ts` is the physical calibration source. Stable surface IDs
select a visual material ID, penetration resistance/retention, a neutral contact
friction multiplier, a footstep profile, an impact sound family and a particle
family. `src/config/materials.ts` owns appearance: color, roughness, metalness,
normal strength and texture scale. Neither file derives physical properties from
visual values. Graphics quality cannot affect penetration, friction or hearing.

The calibration version is `physical-surfaces-1.0.0`. These are original training
approximations. There is no claim of native VALORANT or Counter-Strike material
measurement. Every collision friction multiplier is explicitly **1** because
material-specific traction has not been calibrated; acceleration and braking
remain controlled by the selected movement profile. Renderer roughness never
enters the contact solver.

## Preserved calibration

The ten original IDs retain all V11 coefficients. Resistance is the existing
resistance-metre model and retention is applied per penetrated layer.

| ID | Resistance | Retention | Footstep | Impact / particles |
| --- | ---: | ---: | --- | --- |
| thinWood | 0.8 | 0.96 | wood | wood / chips |
| thickWood | 1.5 | 0.94 | wood | wood / chips |
| drywall | 1.1 | 0.95 | concrete | masonry / dust |
| thinMetal | 4 | 0.89 | steel | metal / sparks |
| thickMetal | 7 | 0.85 | steel | metal / sparks |
| concrete | 9 | 0.86 | concrete | masonry / dust |
| stone | 11 | 0.84 | tile | masonry / dust |
| reinforced | Infinity, opaque | 0 | steel | metal / sparks |
| glass | 0.25 | 0.98 | glass | glass / shards |
| breakable | 0.6 | 0.95 | wood | wood / chips |

The extra authored surfaces cover all fifteen visual families: painted and raw
concrete, plaster, stone, brick, painted and brushed metal, steel, aluminum, wood,
rubber, glass, plastic, fabric and composite. Their resistance/retention borrow
an existing physical family: raw concrete, plastered concrete and brick borrow
concrete; plaster borrows drywall; painted/brushed metal, steel and composite
borrow thick metal; aluminum borrows thin metal; rubber borrows thick wood;
plastic and fabric borrow the light breakable panel. Those substitutions are
explicit approximations, with no new unmeasured penetration coefficients.
`plasteredConcrete` represents a plaster finish over a structural concrete core;
the finish does not turn an entire solid wall into gypsum board.

## Versioned resolver audit

The V11 resolver used geometry labels: every untagged cover, stair and platform
was `thickWood`; every untagged ramp was opaque `reinforced`; walls were
`concrete`. For example, the complex F bay's continuous concrete incline could
never be penetrated while its adjoining platform used wood resistance. Meanwhile
the renderer used generic plaster/painted architectural finishes. Complex
footstep audio selected only the bay's floor theme, so the raised concrete F
ramp played tile and the H platform played wood. The visible range rubber mat
always played concrete.

All built map obstacles now author `surfaceId`. Concrete ramps, stairs and
platforms share a concrete core; other covers use painted metal and generic
walls use plaster over concrete. Mechanics maps preserve their explicit wood,
metal, reinforced and concrete sample IDs. `groundSurfaceId` optionally describes
walkable cladding independently from the ballistic core.

`materialFor(obstacle)` and the existing direct shooting helpers default to
**legacy-v2**, ignoring new metadata and preserving existing shot outcomes.
Explicit `material` author/editor assignments remain authoritative in both
rulesets. The **materials-v3** rules use `surfaceId` when no explicit material is
assigned. Production player and defender shots pass their simulation rules
explicitly. Replays choose their recorded semantics; new resistance outcomes
are never silently applied to old recordings. Geometry, dimensions and movement
profiles are unchanged by surface authoring.

## Sight transmission

`blocksSight` is an explicit physical property, independent of shader opacity
or graphics quality. Glass sets it to `false`; all other registered solids set
it to `true`. Current defender acquisition, cover checks, angle spawn checks and
exposure use this flag. Legacy replay sightlines and default public visibility
helpers retain their original geometric blocking behavior.

Transparent glass remains a solid collision barrier and retains its original
penetration resistance, retention and budget cost. Hearing and Runtime audio
occlusion continue to use geometric barriers, so sight transmission does not
remove a pane's sound attenuation. Existing static route/import validation keeps
its geometric contract; current scenario templates do not contain glass panels.

## Contact audio and impacts

`resolveGroundSurface` selects the actual support plane at the resolved foot or
landing contact position, by calling the same footprint support solver as movement, with the selected
profile radius and slope limit. Source-order ties also match collision support. A raised support takes priority over the surrounding bay
floor. The 5 cm matching tolerance handles sub-tick event positions on slopes;
it does not search below a different floor. The range mat has the same explicit
23.8 by 9.4 metre footprint used by rendering. Other uncoated base floors use
`rawConcrete`, with exactly the original concrete resistance and acoustic profile.
Base complex floors retain each
bay's concrete, steel, tile or wood theme within its exact authored `bounds`.
The 1 m approach strip that the legacy `zoneAt` heuristic included remains raw
concrete, matching the visible floor overlay boundary.

Step cadence still comes from resolved distance and grounded movement. Surface
selection does not read key presses or reset the footstep meter. Landings retain
their independent contact-transition stream and hearing radius. Surface-specific
sound changes affect timbre; they do not increase bot hearing distance.

Audio buffers are shared by eight original acoustic profiles and four physical
impact families. Existing concrete/steel/tile/wood synthesis remains unchanged;
rubber, glass, plastic and fabric have original deterministic transients.
Impact entry and exit sounds use the actual collision material and position.
The renderer selects chips, sparks, dust or shards from the same surface record.
No proprietary game recordings are used.

`src/tests/surface-contact-integration.test.ts` exercises resolved walking and
real jump/landing transitions in both rulesets and checks their actual event fields.
`src/tests/surface-audio-selection.test.ts` checks that playback consumes physical
surface IDs, keeps legacy fallback and shares buffers by physical impact family.
`src/tests/physical-surfaces.test.ts` checks registry coverage, V11 golden
coefficients, every built map's metadata, versioned ramp/platform corrections,
contact surface priority, an actual travelled footstep boundary, finite distinct
sound profiles and coherent impact/particle families.
