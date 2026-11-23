# Material-aware bullet traversal

## Calibration status

`src/config/penetration.ts` defines VALOPRAC's original, provisional resistance-metre model. These coefficients, layer limits and damage-retention curves are authored training values. They are not a verified reproduction of VALORANT's proprietary penetration calculation. In particular, a wall's colour or its weapon's high/medium category does not establish native-game equivalence. No additional official reference was successfully retrieved for this change.

The current authored weapon profiles use medium penetration for Vandal and Phantom, and high penetration for Sheriff and Operator. All four weapons use the same traversal algorithm; Operator no longer has an exclusive fixed `0.65` attenuation per cover box. Weapon damage and its existing distance bands remain separate from material attenuation.

## Geometry and stop order

`traceBallisticRay` requires a normalized ray and a non-negative physical body intersection candidate. It accepts no targeting, perception or hit-probability shortcut. The closest candidate is determined independently by player rendered-mesh intersection or defender physical player-body intersection. The tracer decides whether that intersection can actually be reached.

Each collision AABB is clipped against six outward planes. A ramp adds its inclined top plane, so traversal follows the occupied wedge rather than the entire bounding box. Entry/exit positions, normals and true distance along the ray determine material cost. Starting inside a surface charges only the remaining distance. Oblique shots traverse more material than perpendicular shots. Tangential contacts of zero length do not consume a layer.

The effective trace range ends at the nearest valid body candidate, maximum range, or floor. A farther body is not awarded as a hit, and a floor inside a wall clips the traversed interval before material cost is calculated. Objects behind the terminal point are ignored.

Overlapping volumes are split into disjoint intervals and use the highest resistance active material in each interval. Duplicate construction boxes therefore do not double-charge the same occupied space. An opaque insert remains authoritative even when enclosed by penetrable wood. Contiguous intervals of the same material count as one layer; an air gap or material transition starts another layer. A composite wood/metal/wood traversal therefore has three material layers. Visual-only architectural trim does not introduce hidden ballistic surfaces.

## Authored coefficients

Resistance is dimensionless cost per metre of actual ray travel. Retention is a one-time multiplier when entering a new material layer.

| Material | Resistance per metre | Layer retention | Impact family |
| --- | ---: | ---: | --- |
| Thin wood | 0.8 | 0.96 | Wood |
| Thick wood | 1.5 | 0.94 | Wood |
| Drywall | 1.1 | 0.95 | Masonry |
| Thin metal | 4 | 0.89 | Metal |
| Thick metal | 7 | 0.85 | Metal |
| Concrete | 9 | 0.86 | Masonry |
| Stone | 11 | 0.84 | Masonry |
| Reinforced structure | Opaque | 0 | Metal |
| Glass | 0.25 | 0.98 | Glass |
| Lightweight breakable panel | 0.6 | 0.95 | Wood |

The panel material describes penetration and impact response. It does not imply runtime mesh destruction. Explicit material assignments take precedence. Unassigned legacy cover defaults to thick wood, walls to concrete, and ramps to reinforced structure.

| Weapon category | Initial budget | Maximum material layers | Distance-loss coefficient |
| --- | ---: | ---: | ---: |
| Low | 0.65 | 2 | 0.9 |
| Medium | 1.6 | 3 | 0.8 |
| High | 3.3 | 4 | 0.72 |

For an interval of thickness `t` and material resistance `r`:

```text
cost = r * t
remainingBudget -= cost
damageMultiplier *= (newLayer ? retention : 1)
                    * exp(-cost / initialBudget * distanceLoss)
finalDamage = existingWeaponDamage(hitRegion, shotDistance) * damageMultiplier
```

An opaque material, excessive interval cost or exhausted layer allowance stops the bullet. A rejected interval reports its entry as the stopping impact; the model does not simulate a projectile's sub-surface stopping depth or energy over time. It is instantaneous hitscan, not a physical bullet-flight solver. Previously traversed attenuation is preserved, but no body damage is awarded beyond the stop. Existing health processing remains downstream of this calculation.

## Shared use and information limits

`castWeaponShot` adapts the player's exact target geometry, including the submitted pose at click time, to the common tracer. Defender bullets use the same tracer after intersecting the current explicit player-body proxy. Their body representations differ by purpose; their wall cost and weapon damage calculation do not.

Perception continues using opaque geometry visibility tests. The ability to penetrate a wall never grants sight through it. Defender firing admission must come from visible acquisition or a separately bounded, uncertain remembered visual/sound observation. A ballistic candidate represents physical collision only and must never update hidden-target knowledge. The AI's acquisition and memory tests are maintained separately from the traversal tests.

Every trace returns material segments, entry/exit points, traversed thickness, cost, attenuation, remaining budget and stop reason. Player and defender render/audio consumers can use these segments for material-specific impacts and successful entry/exit effects. Diagnostic controls are optional and disabled by default; rendering effects do not alter collision.

## Verification

`src/tests/ballistics.test.ts` adds 43 deterministic tests covering:

- Exact AABB/ramp entry and exit, both ramp directions and both ramp axes.
- Oblique thickness, inside origins, parallel misses and corner tangency.
- Every authored material and all four current weapon categories, plus the low category.
- Budget exhaustion, exact affordability, layer caps and deterministic obstacle ordering.
- Duplicated/overlapping volumes, composite resistance and concealed opaque inserts.
- Target/range/floor stop order, including the floor inside a volume.
- The common tracer and player adapter producing identical material attenuation and damage.
- Opaque perception despite ballistic reach, and hit-result metadata reset.

The Operator and rendered-pose tests retain their physical-cover checks and now assert the resistance-based formula instead of the retired fixed coefficient. The focused ballistics, Operator-penetration and rendered-pose run passed **63/63 tests**. This is deterministic software verification. It does not establish native-game penetration parity, physical material accuracy, GPU performance or real player fairness.
