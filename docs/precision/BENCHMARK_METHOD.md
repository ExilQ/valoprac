# Equal-budget precision optimizer stress test

`src/aim/precision/benchmarks.ts` defines nine artificial response surfaces and executes the public `proposeSensitivity` / `gpPredict` implementation for the coarse and GP-UCB strategies. Grid and random search use the same sensitivity domain and measurement cost. No participant results are generated.

## Budget and order

Each normal case permits 48 synthetic block measurements: 24 adjacent baseline/candidate pairs. The insufficient-data case permits eight measurements. All four algorithms receive exactly the same budget **within a case**. Both baseline retests and held-out observations count toward the budget.

The first half of pairs is used for selection. All methods start with the same seeded permutation of the baseline and domain edges; later proposals follow the selected strategy. The two observed leaders are then frozen. The remaining pairs independently compare those leaders with baseline. Validation noise seeds are disjoint from selection seeds. Leader order reverses each validation round. AB and BA alternate, balancing within-pair time effects as well as candidate order.

Responses are arbitrary normalized benchmark units. All methods receive the same event-index noise realization for a seed, allowing reproducible comparisons under common random numbers. Each pair has shared session variation plus independent measurement noise. Learning/fatigue cases add a linear chronological trend. The measured candidate-minus-baseline difference removes shared pair variation; reversed order reduces linear drift bias. The optimizer receives measured differences around a fixed 0.5 reference, never the surface's hidden true baseline, optimum or noise parameter. This is not a guarantee against nonlinear real-player fatigue or carryover.

## Stress cases

| Case | Intended failure mode |
| --- | --- |
| Low-sensitivity precision | A speed-oriented recommendation should not override a true lower-sensitivity response. |
| High-sensitivity tracking | A precision prior should not force every task toward low sensitivity. |
| Broad plateau | Several sensitivities have negligible true differences. Avoid manufactured precision. |
| Narrow optimum | Limited exploration can miss a sharp peak; report the failure instead of tuning the test afterward. |
| Multiple equivalent regions | A single smooth GP may poorly represent separated good regions. Do not infer an untested continuous plateau. |
| High noise | Noisy maxima may fail held-out verification. |
| Learning | Later blocks improve independently of sensitivity. |
| Fatigue | Later blocks deteriorate independently of sensitivity. |
| Insufficient data | There is a planted optimum but too little evidence for a positive recommendation. |

## Reported quantities

- **Regret:** best latent response on a 1,001-point domain grid minus the latent response at the selected sensitivity. This truth exists only because the surface is artificial.
- **Practical-region rate:** fraction of runs whose latent regret is at most the predeclared `0.02` benchmark-unit margin.
- **Stability:** standard deviation of the log selected sensitivity across independent seeded runs.
- **Inconclusive rate:** held-out winner lacks six paired observations or its adjusted interval does not support an improvement, deterioration or equivalence decision.
- **False-improvement rate:** the algorithm says improved although the surface's candidate-minus-baseline effect does not exceed the margin.
- **Held-out interval coverage:** observed coverage of the true paired difference. Intervals use Student-t, with alpha divided across the two frozen candidates. The guarantee depends on the sampling assumptions; empirical coverage is reported, not assumed.
- **GP latent interval coverage:** how often the fixed GP's model-based mean ±1.96 SD covers the artificial latent response at domain probe points. This may be poor. It is not relabeled as a frequentist confidence probability.
- **Failure rate:** nonfinite or out-of-bounds recommendations. Poor regret is reported separately, not hidden by a zero numerical failure rate.
- **Cost:** measured host CPU milliseconds for complete synthetic runs. This is not a mouse callback, hardware FPS or physical latency benchmark.

The benchmark summary is emitted as JSON with `benchmark: "precision-optimizer-comparison"` by an executed Vitest test. The report deliberately does not set GP as the default. A method can win one artificial surface and lose another. Changing the default for real users would require compatible repeated human evidence and operational cost checks.

A separate 800-replication check exercises 95% Student-t paired-mean intervals under a declared independent Gaussian model. The count and actual empirical coverage are emitted as `precision-interval-coverage`; this checks implementation under that model rather than proving general validity.
