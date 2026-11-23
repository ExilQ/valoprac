# Shared visible surface and hit registration

The 05.00 character artwork was smaller than its historical analytic hit shapes. In particular, the rendered head used an ellipsoid with 83% of the old sphere's horizontal radius, sleeves were shifted inward by approximately 5.1 cm, and the merged gloves and neckline extended outside the boxes/sphere used for damage. Keeping those old primitives as the final narrow phase produced both invisible hits and visible misses.

The shooting surface is now the same authored triangular surface as the rendered body. `characterPartSourceGeometry(index)` owns one immutable normalized source for each of the eleven articulated parts. Renderers receive clones through `characterPartGeometry(index)`; `CharacterShape` builds a single static CPU hierarchy from that same source. The head, face covering, sleeves, gloves, vest details, boots and neckline therefore share their actual silhouettes with shooting. There is no larger fallback head sphere or enlarged arm box in the narrow phase.

The visible neck triangles classify as torso damage, gloves as arm damage, and the visible head/face triangles as head damage. Existing legacy primitive fields remain available for compatibility but are not used to determine bullet hits. `headPosition()` still supplies the articulated head center for aim tasks.

`Target.intersect(ray, out, matrices?)` accepts optional completed-render model matrices. Each supplied matrix must already include the part size: `part.node.matrixWorld.clone().scale(part.size)`. The method reads the supplied matrices without mutating them. It otherwise uses the current articulated matrices. The renderer/input integration owns the selection of the correct displayed frame, generation checks and the active/enabled target checks; this optional pose argument does not rewind gameplay state or resurrect an eliminated target.

## Validation

- Independent `Three.Mesh.raycast` on renderer-owned clones is compared with the optimized shooting implementation. The reference does not call the shooting BVH or the old sphere/box code.
- 12,480 full-body rays across standing, crouched, strafing, 90°/45° rotations and 0.5×/2× target scales recorded zero false positives and zero false negatives, with 4,388 visible-surface hits.
- Front and side head silhouettes are additionally sampled at 5 mm spacing. The old invisible ±16 cm horizontal head margin is rejected, while the visible neckline and glove tips receive their intended body/arm classifications.
- Three old scaled-head assertions now compare against the independently rendered surface instead of asserting the obsolete 17 cm sphere radius.
- A captured-model-matrix regression verifies that a later target movement does not move the explicitly supplied shooting pose.

The canonical character has 1,568 triangles and 469 hierarchy nodes. The hierarchy is built once and shared between bot instances. A bounded 20,000-cast CPU workload with result assertions took approximately 399 ms on the execution host (approximately 19.95 μs per whole-target cast). This includes test assertions and is not a physical input-latency, GPU or hardware-FPS measurement.

The new alignment and adapted scaled-collision suites passed 15 tests; the existing visual suite also passed 18 tests. TypeScript checking passed. Full application and browser integration checks belong to the parent release workflow.

These checks establish triangle-surface agreement and sampled pose agreement. They do not treat an anti-aliased fringe, a shadow, a ground indicator or a separately equipped weapon as damageable human tissue, and they do not establish every possible animation or display condition.

## Input-time submitted pose (06.01)

The renderer copies the exact eleven part instance matrices after the gameplay draw into a fixed 32-frame ring. It records the monotonic DOM clock at submission. `BrowserInput` uses the normalized original mouse event timestamp to copy the latest submitted pose at or before that timestamp. The first firing event uses that private snapshot; subsequent automatic shots use the latest submitted pose. Rejected clicks during equip/bolt recovery are discarded normally. The snapshot does not change target simulation, movement, damage, firing cadence or wall collision.

Each pose carries the spawn generation and active/enabled status. A target eliminated since that frame cannot receive another kill, and a respawn cannot inherit a previous model's hit. Clearing a renderer-attached history suppresses target hits until a new pose has actually been drawn. Headless deterministic tests retain the current-simulation fallback because no renderer is attached.

Independent tests cover 30/60/144/240 Hz render schedules with 120 Hz physics and five click phases. At 5.4 m/s, the old path required approximately 4.5–9 cm lead (mean approximately 6.8 cm). The submitted-pose path has zero sampled visible-edge misses and zero blank-space hits. Queued DOM timestamp, frame-ring wrap, crouch/yaw/scale, blocked fire, automatic fire and Operator penetration cases are covered separately.

This fixes target-pose disagreement with the submitted frame. It does not measure physical monitor scanout or input-to-photon latency, and it does not rewind the player's camera or change existing aim/recoil input behavior. The CPU draw-submission clock is an explicit limit of the measurement.

## Before/after front probe

`HIT_ALIGNMENT_BASELINE.json` preserves the independently executed 78,000-ray full-body and 27,968-ray head zoom probe, including denominators and grid resolution. The old 06.00 analytic primitives are compared with independent renderer-owned `Mesh.raycast` surfaces; the new BVH is compared with the same reference.

- Empty-space hits: 19.499% → 0% of hit samples.
- Visible surface without a hit: 5.266% → 0% of visible samples.
- Headshots in empty space, 2.5 mm head grid: 155.625 cm² → 0 cm².

These are grid-sampled CPU geometry measurements, not a rasterized anti-aliasing or arbitrary-camera coverage guarantee. The shareable comparison is `/hit-alignment.svg`, and `/correctness-validation.json` is regenerated from the executed release tests.
