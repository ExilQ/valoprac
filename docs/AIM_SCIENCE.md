> Historical 03.00 / aim-1.0.0 design record. For current 07.00 / aim-2.0.0 protocols, statistics, sources and executed validation, see [precision research](precision/RESEARCH.md), [benchmark method](precision/BENCHMARK_METHOD.md), and `/aim-methodology.html`. Earlier six-task/bootstrap/storage descriptions below apply to the archived implementation.

# VALOPRAC aim measurement system

Release: 3.0.0, displayed as major patch **03.00**. Algorithm: `aim-1.0.0`.
Date: 2026-10-24. This release extends the existing browser application.
It does not replace the range, weapons, movement, footsteps, bots or history.

## Architecture and input contract

Five modules share `BrowserInput` and `engine/input/sensitivity.ts`:

1. `aim/Telemetry.ts`: fixed-capacity numeric input/context buffers.
2. `aim/analyzer.ts`: independent, versioned motion segmentation and metrics.
3. `aim/experiments.ts`, `optimizer.ts`: controlled candidate schedules and optional GP-UCB.
4. `aim/coaching.ts`: deterministic, evidence-linked drill selection and bounded difficulty.
5. `aim/statistics.ts`: matched comparisons, uncertainty and longitudinal grouping.

Completed trajectories are analyzed in one lazy shared Web Worker. Its pending queue
is limited to eight jobs. Neither inference nor smoothing occurs in mouse handlers.
The observer runs after the original camera rotation and records its actual angular
change. The existing 120 Hz gameplay simulation and recoil compensation are preserved.
Neutral tasks use monotonic elapsed time and analytic target paths, independently of
render rate. Analysis resamples observations at 120 Hz; this is offline analysis, not
an input filter. Canvas rendering uses horizontal-FOV perspective projection.

The neutral environment is an intentionally plain angular Canvas 2D projection,
not a new 3D engine or Unreal rendering. It isolates pointing from weapon recoil,
spread, movement, ADS and target rig animations. Existing WebGL combat remains the
separate realistic validation environment.

### Units and limitations

`gain = degreesPerCount * sensitivity * (ADS ? adsMultiplier / zoom : 1)`.
`eDPI = declaredDPI * sensitivity`.
`estimatedCm360 = 360 * 2.54 / (declaredDPI * coefficient * sensitivity)`.
FOV changes projection, not hip-fire angular gain. ADS changes the projection tangent
and the documented angular gain separately. At 800 DPI, 0.35 sensitivity and 0.07
degrees per delivered unit, the calculation gives 280 eDPI and 46.653 cm/360.

The project's existing 0.07 reference coefficient is conventional, not independently
confirmed by a Riot primary source. DPI is user-declared. Browser deltas are not
independently measured sensor counts. `unadjustedMovement:true` is requested when
available and fallback status is retained; OS acceleration and mouse firmware are
never modified. Successful capture does not prove a physical input calibration.

Trace columns (Float64, 22 per sample):

| Index | Meaning | Unit |
|---|---|---|
| 0 | Received/observed time relative to trial | seconds |
| 1–2 | Browser-delivered relative X/Y | browser units |
| 3–4 | Right-positive heading and up-positive pitch | degrees |
| 5–6 | Selected target heading/pitch | degrees |
| 7 | Target angular radius | degrees |
| 8 | Input=0, click=1, render observation=2, target change=3, weapon shot=4 | enum |
| 9 | Receive time minus normalized browser event timestamp | milliseconds |
| 10–11 | Actual event camera heading/pitch changes | degrees |
| 12 | Monotonic delivered sample sequence | integer |
| 13–15 | Player position | configured world meters |
| 16–18 | Target world position | configured world meters |
| 19 | Player speed | meters/second |
| 20 | Weapon recoil | degrees |
| 21 | ADS state | boolean |

Metadata includes software/algorithm versions, phase, task, seed, candidate, FOV,
declared DPI/source, input mode, pair/order, difficulty, warm-up, timestamps, renderer,
viewport and validity. Neutral world positions are reconstructed on a 20-meter
angular surface. The first target canvas submission is recorded separately from
trial setup. This is not measured display/photon onset. Event receipt delay is not
sensor-to-photon latency. Browser batching and hardware polling are not inferred.

## Motion analysis

The 2022/2023 FPS studies inform decomposition, not a copied implementation.
Published proprietary thresholds are not reproduced. Parameters are explicit in
`SEGMENTATION`: onset >2.5 degrees/second and >0.04 degrees displacement; primary
completion after speed falls below 22% of the observed peak or reverses; meaningful
correction distance 0.08 degrees; low-speed stabilization under 4 degrees/second
for 60 ms; late-click dwell above 180 ms. These are provisional engineering heuristics.

Missing phases remain null. A click before first movement completion is not forced
into a flick-and-land interpretation. Static analysis stops at the click, avoiding
future movement leakage. Overshoot/undershoot project the initial endpoint error
onto the target direction; perpendicular error is reported separately. Correction
travel, reversals, dwell, final error and path efficiency remain distinct.

Path efficiency is direct angular distance divided by actual travel, bounded to
[0,1], with safe zero handling. It is omitted for tracking. Smooth and reactive
tracking use angular RMS, time on target and velocity mismatch. A bounded velocity
cross-correlation estimates behavioral lag only when the trajectory has sufficient
duration and variation. Direction-change recovery and maximum subsequent error are
observational proxies, not identified biomechanical causes.

Eight-direction summaries use compatible selected task/sensitivity/FOV/size/input
conditions and show sample counts. Sparse sectors withhold intervals. Trial-level
sector intervals are explicitly exploratory, not independent-subject confidence.
No directional gain, input steering, automatic aiming or firmware control exists.

## Experiments and scoring

Coarse exploration uses current sensitivity and bounded nearby candidates. Each
candidate receives all six tasks: large/small flicks, micro-adjustments, predictable
tracking, reactive tracking and switching among four angular targets. Eight click
trials or one eight-second tracking trial form a block. Every block has two seconds
of excluded warm-up. Candidate order reverses/rotates across rounds; target seeds,
target size, amplitude, exposure and FOV are matched within each comparison.
The target layouts include eight directions and controlled amplitude variation.
Block breaks permit rest; fatigue is not directly measured. Sensitivity is frozen
inside a block, and lab configuration is cloned rather than modifying game settings.
Applying or restoring an ordinary gameplay sensitivity always requires a UI action.

Static trial score: 0.55 hit + 0.20 exp(-clickSeconds) +
0.15 exp(-initialError/radius) + 0.10 exp(-correctionSeconds/0.5).
Unavailable phase terms are omitted and remaining weights renormalized. A timeout
is a miss with no speed credit. Tracking: 0.5 timeOnTarget + 0.5 exp(-RMS/radius).
Task aggregates are equally weighted by default. Precision weighting is
[1,2,2,0.5,0.5,1]; tracking weighting is [0.5,0.5,0.5,2,2,1].
This 0–1 comparison objective is a provisional design, not a validated skill percentage.

Recommendations require all six tasks, at least two complete repeated rounds and
70% click precision. They remain provisional ranges when data cannot separate
candidates; overlapping/insufficient uncertainty never creates an exact optimum.

GP-UCB is optional and nondefault. The one-dimensional RBF model operates on log
sensitivity with fixed length scale 0.22, prior mean 0.5, prior SD 0.3, minimum
observation variance 0.0025, and acquisition mean + 1.5 SD. Model uncertainty is
conditional on these assumptions; hyperparameters are not learned from sparse data.
The baseline benchmark evaluates grid, random, coarse-to-fine, local and GP search
under 12 observations per run, 24 seeds and four synthetic response families.
Published JSON contains actual executed synthetic results and CPU timings. These
are not human sample-efficiency or training-effectiveness measurements.

## Verification and learning

Held-out A/B changes target scale, spacing and seed relative to exploration, while
matching A and B within the held-out experiment. Paired block differences are first
averaged over complete six-task rounds, then bootstrapped (1,200 seeded resamples).
At least six complete round clusters and two separate sessions are required for a
conclusion. A 95% interval entirely above +0.02 supports provisional improvement;
below -0.02 supports worsening; entirely inside ±0.02 supports practical equivalence;
otherwise the conclusion is inconclusive. The 0.02 margin is provisional. A loss of
more than three percentage points in click precision or precision below 70% prevents
a faster score from being reported as an improvement. Paired SD effect sizes are
omitted when zero variance prevents a meaningful denominator. No p-values are invented.

Baseline, training, immediate post, delayed retention, held-out sensitivity validation,
transfer and combat are separately tagged. Retention comparison requires a matched
baseline at least 24 hours earlier. Baseline/post comparisons are observational;
practice and fatigue remain possible explanations. Transfer uses untrained size/spacing
and is not merged with practiced conditions. Existing weapon/braking/corner exercises
are directly accessible for separate combat transfer observations.

Coaching needs repeated valid features, not one miss. Late/early clicks, extent errors,
inefficient corrections and tracking recovery map to explicit drills. Twenty combat
samples can instead identify movement-related misses without blaming sensitivity.
Task size/spacing difficulty changes only at new training boundaries, after sufficient
new data, by at most 8%; the useful middle performance band remains unchanged. Automatic
adaptation of every target parameter and real-player efficacy calibration remain future
work. Blocked/mixed practice are selectable, without claiming a universal advantage.

## Persistence, privacy and failure handling

IndexedDB `valoprac-aim-v1`, schema 2, stores summaries, traces and plans separately.
Limits: 1,500 summaries, 64 compact trajectories (about 600 samples plus at most 64 event markers),
30 plans. A 16,384-sample input buffer uses 2,883,584 bytes; combat uses 8,192 samples.
Combat capture is explicitly sampled (at most twice/second and 50 records/session),
with the original complete shot statistics unchanged. Closest-target intent in combat
is an estimate and never enters sensitivity optimization. No-target intervals are skipped.
Source timestamps, actual shot state, movement, recoil and spread remain labeled.

Analysis queues and storage failures produce missing records rather than fabricated
results. Overflow, timestamp inversion, interruption, long frame gaps and clicks before
target submission exclude trials. A deletion epoch prevents queued old analyses from
resurrecting deleted data. Exports contain metadata, actual summaries and retained traces;
local deletion affects only aim science records, preserving legacy shooting history.
No account, external AI API, telemetry upload or unrelated personal information is used.

## Evidence and remaining validation

Executed unit tests cover ten synthetic trajectory classes, shared input events and
cleanup, neutral task/controller flows at 60/144/240 schedules, conversion, projection,
bounded memory/queues/storage, candidate matching, uncertainty, all conclusion outcomes,
coaching, difficulty bounds and regression of the existing game. DOM/canvas adapters and
synthetic paths verify software behavior, not human diagnostic validity or physical FPS.

The remote Chrome used for QA rendered the menu/canvas setup but denied Pointer Lock;
it also disables WebGL. Actual public-origin capture must be reported separately after
deployment. Physical mouse precision, human recommendations, delayed learning, actual
input-to-photon latency, extended GPU/audio play and UE porting are not verified here.
There are zero recruited human participants. No personal improvement percentage exists.

## Primary references

- Donovan et al., 2022, *Assessment of human expertise and movement kinematics in FPS games*: https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2022.979293/full
- Warburton et al., 2023, *Kinematic markers of skill in FPS video games*: https://pmc.ncbi.nlm.nih.gov/articles/PMC10411933/
- Czyż et al., 2024, contextual-interference transfer meta-analysis: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1377122/full
- Ammar et al., 2024, critical contextual-interference meta-analysis: https://link.springer.com/article/10.1007/s10648-024-09892-z
- Aimlabs, 2025, Mouselabs first-party product description (not efficacy evidence): https://aimlabs.com/articles/aimlabs/aimlabs-mouselabs-explained-smarter-sensitivity-finder-better-results/
- W3C Pointer Lock 2.0: https://www.w3.org/TR/pointerlock-2/
- MDN movementX units and browser limitations: https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX
- Snoek et al., 2012, GP Bayesian optimization: https://papers.nips.cc/paper_files/paper/2012/hash/05311655a15b75fab86956663e1819cd-Abstract.html

The research informs design. It does not validate this implementation's human outcomes.
