# Scoped projection and sensitivity record compatibility

09.01 changes scoped drawing from tangent-space zoom to horizontal FOV divided
by magnification. Stored scoped observations from those two camera models are
separate conditions, even when sensitivity, nominal FOV and zoom are equal.
Unscoped neutral tasks retain their original input fingerprint bytes.

New scoped calibration adds an optional `projectionModel` identity to the existing
schema. Old imported profiles and records remain available without rewriting or
deleting their calibration. The versioned optional identity is preserved during
profile validation/export/import. Compatibility keys, complete tactical block
counts, result averages and paired comparisons separate camera models. A partial
old block cannot combine with new-camera trials to count as a complete block.

Calibration and shot metadata store the multiplier actually selected for rifle
ADS, Operator2.5x or Operator5x. Scoped neutral plans default to that selected
multiplier. An explicit experiment factor is applied once to its intended zoom
in a private settings copy, leaving global controls and the other scope setting
intact. Existing saved explicit factors remain explicit; ordinary unscoped plan
progress remains valid. Saved scoped plans can be repeated with the current
camera; old projection trials cannot silently complete the repeated block.

The new focused suite exercises an actual scoped neutral Runtime look path and
an actual simulated Operator5x firing/capture event, alongside legacy/profile
round trips, mixed-camera block completion and comparison isolation. These are
software behavior checks, not native-game or physical-sensor measurements.
