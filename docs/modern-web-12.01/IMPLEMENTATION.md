# Modern Web Guidance remodel — 12.01

This presentation-only update applies GoogleChrome/modern-web-guidance-src through its published `modern-web-guidance` skill. Search and guide retrieval ran with `DISABLE_TELEMETRY=1`; no CLI or browser-test dependency was added to the application. The source checkpoint is `76ad060f3dd55f56cca71978f23336f9751e59f9` (12.00).

## Applied guidance and implementation

- `size-aware-styling`: The session wrapper declares `container-type: inline-size` with a named container. A stacked layout is the safe default; a 44rem container query enables side-by-side configuration and the real collision-derived plan. No screen-width assumption substitutes for available component space.
- `performance`: An explicit user action mounts the existing lazy game stage. Closing it unmounts the real renderer. Settings, weapons, history and results are independent dynamic route chunks. The visible map plan is immediate DOM/SVG, with no decorative video or external image service.
- `accessibility`: Native destination links retain modified clicks and browser history. A first-focus skip link and exactly one main landmark serve eight menu destinations. SPA transitions update the document title and focus. Visible focus, high-contrast selection and reduced-motion behavior are retained. Empty-history copy now uses tested theme tokens instead of old hardcoded greens.
- `dialog`: History deletion uses `showModal()` and native form dismissal, a visible name/description, initial Cancel autofocus, no custom trap or Escape handler, and progressive scroll containment. Storage errors stay visible inside the open dialog; successful deletion closes only after the actual storage operation completes.

## Measured verification

The baseline has 1,444 passing application tests. The final suite has 1,455 passing application tests, 20 broker tests and 14 response-worker tests. Eleven new tests cover actual link-click policies, landmark structure, deferred gameplay rendering and safe dialog markup. Existing selection assertions were updated for link semantics without reducing their coverage.

`WORKFLOW.json` records 15 passing checks and eight viewport sizes (1280×720 through 3440×1440, plus 390×844 and 320×700). The container fallback, Ctrl-click, Back, persistent disclosure, preview lifecycle, safe destructive confirmation and injected storage failure were exercised. `READABILITY.json` records 48 screen/category/theme samples with 2,894 text samples and no measured text/form-boundary/layout failures.

`GAMEPLAY.json` records real Pointer Lock firing, ammunition use, two-click rifle ADS, Escape, actual session persistence, replay reconstruction and historical simulation-2 replay import. GPU draws were not disabled to make these checks pass.

`INITIAL_LOAD.json` compares cold default home pages in separate browser contexts. Before: 14 JavaScript responses, 1,461,059 decoded bytes, 442,732 identically computed gzip bytes and one canvas. After: 3 responses, 942,665 decoded bytes, 264,499 gzip bytes and zero canvases. This is a source-payload comparison; local/public elapsed load time and native network compression are not compared. These figures do not demonstrate hardware FPS or input-to-photon latency gains.

## Preservation and limitations

Game 12.0.0, simulation 3, movement/material rules, weapons, hitboxes, AI, footsteps, maps, analytics and replay algorithms are unchanged. The older physics and interface captures retain their original release identifiers; the current presentation capture is separate. The light/dark/system themes, Korean text, stored settings and collapsible training list remain available. No tracking, external runtime asset request or CSP weakening was added.

This environment tests Chromium with software graphics, not a qualified integrated GPU, physical mouse latency, screen-reader device or human usability study. Native modal scroll containment varies in older browsers; established native modality and explicit Cancel remain available without requiring newer invoker commands or `closedby`.

## Reproduction

Run `npm run prebuild` and `npm --ignore-scripts run build` using the repository-pinned Node version. Browser scripts use an independently supplied Playwright module (`PLAYWRIGHT_MODULE`) and Chromium; they are QA tools rather than application dependencies. Set `VALOPRAC_QA_DIR` to an existing output directory. `workflow.mjs` accepts `QA_ORIGIN`; local fixture-injection checks require the Vite source origin. `readability.mjs` and `gameplay.mjs` use the audited local port5541. `initial-load.mjs` accepts `BASELINE_ORIGIN` and `CURRENT_BUILD_ORIGIN`; reproduce the baseline from the retained checkpoint instead of treating the updated production URL as the old build. The adjacent legacy replay is the actual frozen fixture used by the browser test.

Before/after images at `/modern-web.html` are original full-page captures at the same 1366×768 viewport and default free-practice state, converted to WebP without compositing. Full page height differs because the layout changed. Keep the 12.00 Site version as the rollback target. Deployment status is verified and recorded separately after publication.
