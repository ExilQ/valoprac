# 09.01 air speed, scoped FOV and ADS cone corrections

The frozen09.00 source commit `bbdfa88ebd4a434e11aecefede0b21f1a17a24cb`
is the measured baseline. The same120Hz empty-scene schedule settles movement
for one second, then manually jumps while keeping the input. This reproduces
unwanted acceleration from slow movement toward5.4m/s in the old tactical air
solver. The corrected solver bounds the desired directional projection by the
actual wish speed after weapon, ADS, walking, crouching and pulse-fraction rules.
It preserves existing inertia; selecting walk mid-flight does not instantly
replace the whole velocity vector with a slow vector.

| Held-forward condition | Ground speed | Old peak airborne | Corrected peak airborne |
| --- | ---: | ---: | ---: |
| Walk rifle |2.592m/s |5.4m/s |2.592m/s |
| Crouch rifle |1.944m/s |5.4m/s |1.944m/s |
| Operator |5.13m/s |5.4m/s |5.13m/s |
| Rifle ADS |4.104m/s |5.4m/s |4.104m/s |
| Operator scoped |3.6936m/s |5.4m/s |3.6936m/s |

`wish.speed` already includes the fraction of the fixed tick during which a short
input is held. The tactical limit is `min(airMaxSpeed*amount,wish.speed)`; applying
`amount` once more to `wish.speed` would incorrectly square the pulse fraction.
The CS2 projection branch is unchanged, including its lack of a global air-speed
clamp. The movement model identity is bumped to `dual-movement-1.0.1`.

Camera zoom now divides horizontal degrees and then converts the resulting
horizontal FOV to vertical FOV for the current aspect ratio. Base103° therefore
produces82.4° at1.25x,41.2° at2.5x and20.6° at5x. Both weapon/input helper exports
share this pure camera function; the separate viewmodel FOV remains separate.
This is the requested community-reference convention, not a native-game capture.

Standing no-bloom ADS first-shot cones are0.1575° Vandal and0.11° Phantom, obtained
with the requested0.63/0.55 multipliers. Hip-fire, recoil, crouch, movement and
bloom modifiers remain separate. Exact native spread conventions/distributions
are not independently verified. The measurement JSON retains both peak and mean
air speeds, old/new FOV and old/new ADS cones.
