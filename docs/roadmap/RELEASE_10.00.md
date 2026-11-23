# VALOPRAC10.00 /10.0.0 — release evidence

Prepared November4,2026. The existing Site, original maps/assets, fixed-step simulation, Korean defaults, local history, strict security and disabled Unreal staging configuration are retained. This is an in-place upgrade. The roadmap's report IDs are preserved across STAGE1.md, STAGE2.md and STAGE3.md. Production publication is a separate final operation; no build-only result below is a claim that deployment has occurred.

## Final verification

- **1,232/1,232 application tests in98files**, **20/20 broker tests**, **13/13 hosting tests** passed on the final merged source. TypeScript, native-staging opt-out validation, production client build, source export,85embedded Worker asset responses, headers/caching, strict404, search/index policy and complete packaging pass.
- The production search-discovery branch had advanced independently through `538e8ca`. It was fetched and merged in `0753fff`, preserving its SearchIntroduction, static metadata/verification files, homepage-only search policy and Worker response behavior. No force push or replacement checkout was used.
- The last prebuild run completed all three suites and generated the previous reports, then stopped because the asynchronously prepared A1/A6 browser report was not yet present. After that report arrived, the unchanged successful test stdout was reused to finish the remaining report assertions; tests were not rerun or relabeled. Exact log SHA256: `6d4ce252ddc158c3a150dd21e1c4b762a567d3bda6c0208fedbdee52e9561399`. Main packaging then ran with lifecycle prebuild disabled to avoid duplicating those completed suites. The committed validate-release.mjs still runs the complete suites normally.
- Freshly compiled application: **15browser checks and5layouts** pass, including all English settings/tools tabs, current10.00 patch notes, actual release metadata and the same-origin lazy language chunk. No external request or upload was observed. Captured in RELEASE_10.00_BROWSER.json; separate actual input/WebGL, editor, replay and40HUD probes are linked in the stage reports.
- A2's current one-minute fixture is **134,318gzip bytes**, with7,200simulation ticks/60,000look events/3,600submitted frames. Repeated state verification passes. Actual input fixtures include weapon shots, elimination, death/retry, movement restore, scenario rounds and task-specific flash score; these use one common replay format.

## Measured size and performance

All optional and initial JS/CSS chunks together: **2,324,388raw bytes /692,888gzip bytes /575,495Brotli bytes**. The measured baseline was1,809,589raw/512,429gzip. The approximately35.2% all-chunk gzip increase includes the optional110,120-byte gzip English catalog, replay viewer, safe scenario editor and new training tools; this is not the initial transfer size. These modules remain lazy. Exact asset sizes/SHA256 are in RELEASE_10.00_BUILD.json.

A fresh anonymous production09.01 browser immediately before this release measured **400,724encoded bytes /11resources**, after the independent search changes. Earlier roadmap baseline was395,885encoded bytes/10resources. PRE_RELEASE_0901_TRANSFER.json retains navigation/resource timing and its date. Post-publication cold transfer is measured separately against the actual new deployment and retained in the publication evidence; network time is observational, not a controlled bandwidth benchmark.

The matched-camera rendering measurements remain Stage2's Medium complex entry118→101 and gallery136→110draw calls, within the120call target. Low is45calls at both positions. Collision and tactical sightlines are unchanged. Ground-contact batching adds996entry triangles (0.52%) while gallery geometry falls256; this is a disclosed tradeoff, not a claimed hardware FPS improvement. No new shader program appears on the first prepared visible frames in the captured software runs.

Physical GPU FPS, integrated-GPU startup qualification and input-to-photon latency are unmeasured. Headless SwiftShader suffers>500ms stalls and exceeds the proposed3second warm-up cold-start goal (13.2105s measured renderer submission); same-renderer warm retry is441.2ms. Functional input probes isolate those stalls by suspending active draws only after real scene preparation. Headphone/laptop listening and physical sensor polling are also unverified. No claim of improved physical latency or human training effectiveness is made.

## Scope and remaining evidence

Implemented or retained/verified: F1–F8, I1–I9, A2 followed by A1/A3/A4/A5/A6/A7. Important constants retain official/independently-measured/provisional source metadata; the report-derived jump, steering, projection and expert timing targets are provisional. F9 walking ratio0.48 and F10 landing-sound behavior remain unchanged pending direct native-game measurement. Static guide documents remain Korean; application English is explicitly optional and local.

A8 remains optional/deferred. Compatible local task personal bests, result/history export, scenario codes and replay files allow manual comparisons without accounts. No online ranking service, advertising, behavioral tracking, proprietary Riot asset or purported Unreal runtime was introduced. Replay compatibility is strict to the game/simulation/config fingerprint; cross-platform bitwise equivalence and online anti-abuse verification are not claimed.

## Rollback and publication

Preferred pre-release rollback is saved Site version22:
`appgprj_6ad3456a37e08191ae5aef8440d1d28f~appgver_e586e301c74c8191b19cac2ec961edc6`, source `538e8ca4cb6940c158566ab1669aaf6b9cc4321f`, successful deployment `appgdep_6ae70a815c248191959dd8591a2c1414`. It retains the independent search work. Older physics baseline version18/source8abf7b1 remains available as a second rollback point.

Publish through the existing public Sites project `appgprj_6ad3456a37e08191ae5aef8440d1d28f` using an exact pushed commit and matching `.openai/hosting.json` + Worker archive. Preserve the public audience, selected repository and production hostname. The saved version/deployment response and actual HTTPS/browser verification are recorded after publication in the task's release receipt. `/roadmap-validation.json` explicitly describes build evidence and does not falsely mark itself as a deployment receipt.
