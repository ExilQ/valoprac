# Executed synthetic comparison

Executed 2026-10-27 with the five tests in `src/tests/precision-benchmark.test.ts`. Full structured output is in `SYNTHETIC_RESULTS.json`. Re-running can change measured CPU cost; seeded response/noise results are deterministic for unchanged algorithms. The release build emits a fresh benchmark for its public validation report.

There were **432 synthetic runs**, comprising nine response profiles × four methods × 12 fixed seeds. Each regular profile used 48 charged observations; the insufficient-data profile used eight. There were **zero human participants**.

Across the eight full-budget profiles, with equal profile weighting:

| Method | Mean latent regret | Within practical region | Measured aggregate CPU |
| --- | ---: | ---: | ---: |
| Grid | 0.0203 | 62.5% | 102 ms |
| Random | 0.0323 | 64.6% | 49 ms |
| Coarse | 0.0279 | 75.0% | 52 ms |
| GP-UCB | 0.0146 | 81.3% | 1,127 ms |

These are arbitrary benchmark units and finite-seed observations, not a prediction of user gains. GP-UCB had lower average regret in this fixture but required substantially more CPU. It was not uniformly better: coarse search selected a point in the practical region in all 12 separated-region runs, compared with 11/12 for GP. Neither result justifies replacing the default for all players.

The fixed GP's nominal ±1.96-SD latent intervals covered the response at only approximately **73.8%** of narrow-optimum probes, **62.7%** of separated-region probes and **66.3%** of high-noise probes. Model uncertainty is therefore explicitly labeled as model-dependent. A smooth posterior is not empirical proof of a sensitivity interval.

Every sparse-data run remained inconclusive. All high-noise GP, grid and random runs, and 11/12 high-noise coarse runs, remained inconclusive. All broad-plateau runs remained inconclusive at the available validation budget: a genuinely flat response did not by itself provide enough precision to establish equivalence. No false improvement declarations occurred in these particular fixed-seed runs; that is not a zero-risk guarantee.

A separate **800-replication** independent Gaussian paired-difference test produced **762/800 = 95.25%** coverage for a nominal 95% Student-t mean interval with 12 pairs per replication. This tests the numerical interval implementation under a specified model. It does not validate correlated real-player data, physiological phase labels or human benefit.

Numerical failure/out-of-domain rate was zero for every method. This is separate from recommendation quality: for example, the grid missed the narrow practical region in every run despite remaining numerically valid. Such regressions are retained in the report.
