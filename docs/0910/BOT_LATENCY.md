# Held-angle first-shot calibration

The frozen09.00 commit bbdfa88ebd4a434e11aecefede0b21f1a17a24cb and corrected
controller were measured with64 seeds per skill, default and minimum configured
reaction,20m stationary player, level ground and an already-held yaw. The JSON
retains every sample and original capture time. Native-game player reaction and
rank distributions were not measured.

Default medians (seconds), beginner / normal / advanced / expert:

- Before:0.9875 /0.7167 /0.6083 /0.5583
- After:0.6333 /0.3917 /0.3417 /0.3167

The old450ms universal firing floor and extra fixed150–400ms acquisition delay
were removed. Recognition and configurable skill-scaled response remain. Angular
confirmation scales with the actual visible correction, followed by8–20ms trigger
confirmation. The finite angular motor, fresh line-of-sight, movement accuracy,
weapon cadence, bolt recovery, ammunition, recoil and reload still gate firing.
Large surprise angles take longer to acquire. Concealed movement remains unknown.

Minimum configured reaction is150ms; first shots in the same sample have medians
0.2833 /0.2333 /0.2333 /0.2333s after all remaining recognition/confirmation/motor
constraints. These are explicit independent trainer calibrations, not claims of
verified human equivalence.
