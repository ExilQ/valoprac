# Stage3 A7: optional English presentation

Status 2026-11-04: implemented and tested on the unreleased Stage3 worktree after checkpoint `892fe4c`. The browser evidence was captured with the existing 09.01 / 9.0.1 source version. A final patch version and production verification belong to the owning release workflow; this document is not a deployment receipt.

## Implemented behavior

Korean remains the default. The six-tab settings interface offers an explicit Korean/English choice. English is a local, dynamically imported catalog: a new Korean session leaves it unloaded, while an explicit or previously persisted English choice loads it from the same origin. `valoprac-locale-v1` stores only that preference. No translation service, account, external font dependency, tracking script or upload was added.

The schema1 catalog contains 2,470 entries with stable message identifiers, canonical Korean source text and English text. Presentation uses exact lookup, then longest-known-fragment matching for existing composed labels; new parameterized messages have named parameters. App locale subscriptions trigger a presentation update, `document.lang` and locale-aware numbers/dates. The English stylesheet uses normal word wrapping; Korean typography remains the default. Existing range-sign canvas textures repaint on locale changes and unsubscribe when disposed.

The JSX host adapter translates actual DOM children and accessible text (`title`, `aria-label`, descriptions, value text, placeholders and image alternatives). It leaves component data arguments, form values, callbacks, identifiers, URLs, serialized settings and executable strings unchanged. Code/preformatted data and `data-locale="literal"` content retain their exact source. Custom scenario names use the literal path, while built-in route titles can translate. The Korean language autonym remains recognizable in the language picker. Standalone technical documentation is explicitly linked as Korean.

The language preference is outside gameplay Settings and replay command data. Selecting a language does not change movement, aim sensitivity, weapon configuration or canonical scenario rules. Automated tests compare complete simulation checksums before/after language changes and verify the same replay in both languages, including a flash exercise and a custom scenario.

## Browser defect found and corrected

The first real-browser check exposed a development-only singleton split that server-rendered tests did not catch: Vite's React plugin forced the custom JSX runtime into dependency optimization, bundling its own Korean locale copy while the settings picker updated the source locale module. English loaded and `document.lang` changed, but the UI stayed Korean.

The root integration explicitly selects `@valoprac/i18n` for the React JSX import source, excludes its two runtimes from dependency optimization and removes their forced include entries in `configResolved`. Real transformed application imports now reference `/src/i18n/jsx-dev-runtime.ts`, sharing the same locale instance with settings. The production Rollup build uses the same source modules. A final production build/browser check remains part of the release gate; this development capture alone does not establish deployed behavior.

## Reproducible measurements

| Check | Environment and method | Result |
| --- | --- | --- |
| Focused localization suite | Vitest3.2.7; two current source test files | **9/9 pass**, zero failed |
| Primary render coverage | Real React server rendering: App, six settings tabs, weapons and empty history; populated result/history | No residual Korean interface fragments in the checked views |
| New platform render coverage | Ten real exercise, movement, route, editor, HUD and platform views | No residual Korean text or accessible-label fragments in the checked views |
| Canonical authority | Real Simulation, shared ReplayRecorder/ReplayPlayer, language changes in ordinary, flash and scenario sessions | Checksums unchanged; replay verification passes in both languages |
| Actual application browser | Headless Chromium; live App and settings/platform navigation at local origin | **19 checks pass**, zero browser errors |
| Browser layout | 390×844, 1280×720, 1920×1080, 3440×1440 | No horizontal overflow in all four sampled layouts |
| Network/privacy | Actual request log from browser exercise | Same-origin GET/HEAD only; no telemetry upload or translation service |

The actual browser checks all six settings tabs, English preference after reload, weapon selection, statistics, all six training-platform tabs and the aim-analysis landing. Before/after serialized gameplay settings are identical. An untranslated-text walker inspects visible DOM text, with literal/code/autonym exceptions. The English platform screenshot is [english-platform.png](localization/english-platform.png). Raw checks, layouts, requests, source hashes and limits are retained in [STAGE3_A7_BROWSER.json](STAGE3_A7_BROWSER.json). The repeatable harness is `/workspace/roadmap-qa/a7-app-browser.mjs`.

Run the focused suite with:

```text
node_modules/.bin/vitest run src/tests/localization.test.tsx src/tests/localization-platform.test.tsx --reporter=verbose
```

## Files and boundaries

Presentation foundation: `src/i18n/{locale,host,jsx-runtime,jsx-dev-runtime}.ts`, `catalog.en.json`, `locale.css`, TypeScript JSX configuration and `vite.config.ts`. Integration includes App subscription, settings selector, locale-aware analytics/history formatting, canvas sign repainting and literal custom-title treatment. Validation is in `localization.test.tsx` and `localization-platform.test.tsx`; the parent integration owns exercise/input/browser authority tests.

The catalog preserves the existing application's Korean strings rather than rewriting all gameplay modules around translated values. Exact/fragment lookup is a compatibility layer, so changed source grammar and newly added dynamic labels require explicit entries and regression coverage. Unknown text stays visible and is recorded only in a bounded local missing-translation set; no message data is uploaded. The checks above cover named views, not every possible historical record, imported user title, popup, error or future screen. English technical-document translation and native Firefox/Safari are not certified here.

This feature changes interface presentation, not VALORANT parameter calibration. It supplies no new native-game mechanical measurements. Physical input latency, GPU FPS, cross-platform font rendering and total release transfer/build size are not measured by this localization probe; those remain separate release checks. No performance improvement or completed production deployment is claimed.
