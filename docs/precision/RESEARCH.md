# Precision Sensitivity Laboratory: evidence and implementation boundaries

Sources reviewed on 2026-10-27. This is an independently implemented measurement workflow. Public product descriptions inform task coverage; no Aimlabs, KovaaK's or PureVector proprietary optimizer, correction algorithm, scenario file or asset is included.

## What the sources support

| Primary source | Independently usable principle | Boundary |
| --- | --- | --- |
| [Aimlabs 1.3.2 developer notes, 2023](https://www.aimlabs.com/articles/aimlabs/aimlabs-1-3-2-patch-notes/) | The developer describes sensitivity as dependent on the task and on target size/speed. VALOPRAC reports task-specific results rather than a universal optimum. | Product description, not validation of VALOPRAC's scoring or an algorithm specification. |
| [Aimlabs Mouselabs developer article, 2025](https://aimlabs.com/articles/aimlabs/aimlabs-mouselabs-explained-smarter-sensitivity-finder-better-results/) | Performance patterns can be accumulated over time and recommendations can be presented separately from ordinary practice. | VALOPRAC does not copy an undisclosed method or automatically change ordinary gameplay sensitivity. No marketing confidence claim is imported. |
| [Voltaic's own KovaaK's Season 5 scenario specification](https://app.voltaic.gg/blog/announcing-the-voltaic-season-5-aiming-benchmarks-beta-for-kovaaks/) | Clicking, tracking and switching are distinct skills; predictable and reactive movement need separate tests. Unnecessary spawn randomness can undermine comparisons. | This is the benchmark author's description, not a controlled demonstration that its scores predict tactical match results. VALOPRAC uses original seeded paths and geometry. |
| [Boudaoud, Spjut and Kim, IEEE Transactions on Games, 2023](https://research.nvidia.com/publication/2023-07_mouse-sensitivity-first-person-targeting-tasks) | FPS sensitivity can have a useful range; physical displacement-to-rotation differs from pointer control/display gain. Completion time can be decomposed into movement and other phases. | The authors' study used a restricted first-person task and 13 analyzed participants. Its reported group range is not assigned to VALOPRAC users. A browser cannot infer physical displacement from undeclared hardware properties. |
| [Fitts, 1954, original paper DOI](https://doi.org/10.1037/h0055392) | Target amplitude and width jointly affect the speed/accuracy task. Compare like-sized targets and angular transitions across candidates. | Classical pointing results do not establish one FPS sensitivity, task weights or a causal benefit of this trainer. |
| [Meyer et al., 1988, original article DOI](https://doi.org/10.1037/0033-295X.95.3.340) | Separate initial movement and later corrections; a successful final click can conceal an inaccurate first movement. | The browser's segmentation thresholds are documented engineering criteria, not a direct physiological measurement or replication of the original experiment. |
| [Czyż, Wójcik and Solarská, 2024 systematic review](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1377122/full) | Acquisition performance, delayed retention and transfer are distinct outcomes. Practice order matters and effects depend on setting. | The review reports weaker applied-setting evidence than laboratory evidence. It does not prove that changing sensitivity or randomizing VALOPRAC tasks improves match performance. |

The [2023 paper's author-hosted version](https://d1qx31qr3h6wln.cloudfront.net/publications/IEEE_T_Games__Mouse_Sensitivity.pdf?VersionId=dgFWwRKSaHqyCoJyPI1pI5aRzqkm9LmS) was also inspected. Its authors use smoothed angular velocity and separate start/end thresholds with a minimum movement duration. VALOPRAC borrows the principle of explicit, inspectable segmentation criteria. It does not imply that browser-derived acceleration identifies a neurological phase. Phases that cannot be identified remain unavailable.

## Sensitivity conversion provenance

The [KovaaK's developer's 2020-05-08 announcement, as published in the official Steam news feed](https://store.steampowered.com/news/posts/?appids=824270&enddate=1595643090&feed=steam_community_announcements) states that its VALORANT sensitivity scale uses yaw **0.07**. The [individual developer announcement](https://steamcommunity.com/games/824270/announcements/detail/2201641989738342680) is the corresponding release entry. This is primary evidence from an independent implementer, not a Riot certification or a new hardware measurement. No public Riot engine specification for this constant was located in this review.

Given a linear yaw coefficient in degrees per delivered count, the conversions follow from units:

- `eDPI = declared DPI × sensitivity`.
- `degrees = delivered relative delta × sensitivity × coefficient`.
- `cm/360 = 360 × 2.54 / (declared DPI × sensitivity × coefficient)`.
- At coefficient `0.07`, this is `914.4 / (DPI × sensitivity × 0.07)`.

An ADS multiplier scales the input gain. Magnified FOV is a separate camera quantity. Equal cm/360 at different FOV or zoom does not imply equal perceived screen motion. The system records these conditions separately. It cannot read physical DPI, prove unadjusted hardware counts, change operating-system acceleration or equate JavaScript event frequency with polling rate.

## VALOPRAC experimental choices

The following are explicit engineering choices to be evaluated, not constants established by the cited studies:

- A quick protocol provides preliminary evidence; a longer protocol adds repeated baseline comparisons, fine candidates and fresh held-out tasks. A duration target is an estimate, not a guarantee of an optimum.
- Task scores are normalized within their own matched conditions before aggregation. Tactical or precision priorities are declared policies; they are not universal scientific weights.
- Candidate order is counterbalanced, and candidate measurements share target difficulty/seed distributions. Learning and fatigue can still be nonlinear and sensitivity-dependent. Adjacent baseline retests and order diagnostics reduce confounding; they do not remove all of it.
- Selection data and held-out verification data have separate roles. Selecting the largest observed mean and then calling its selection interval a confirmation would be circular.
- A practical equivalence claim requires the whole relevant paired interval to lie inside the declared margin. Overlapping confidence intervals merely leave the ranking unresolved.
- Tested candidate points can support a range of plausible values. Gaps between them are unmeasured; an interpolated smooth curve or an equivalence claim across an untested gap requires additional evidence.
- Independent repeated blocks/sessions, not thousands of correlated mouse events, determine inferential sample size. Configuration changes and older algorithm versions are shown as compatibility exclusions.

## Human evaluation status

No real participants were recruited in this implementation task. Human improvement, native VALORANT match transfer, hardware sensor fidelity and physical input-to-photon latency are **unverified**. The automated stress cases are useful software checks. Their planted response functions are never displayed as a real user's history or recommendation.

With available participants, use consented within-player baseline/alternative comparisons with counterbalanced order, a predeclared practical margin, held-out tasks, delayed sessions and recorded preference. Report adverse results and inconclusive intervals alongside improvements. A usability observation is not an objective aiming gain.
