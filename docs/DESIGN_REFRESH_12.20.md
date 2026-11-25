# Design refresh 12.20

Scope: the menu shell (training, maps, weapons, sensitivity lab, history,
settings) and the in-game pause card. Gameplay, HUD geometry, simulation,
storage keys, routes and markup class names are unchanged.

## Audit of 12.0.19 (live site, 1440×900 and 390×844, both themes)

| # | Finding | Where |
|---|---------|-------|
| 1 | Two competing action colours: brand teal for links/selection, a fixed orange (`#edb576`) for "훈련 시작" | home, pause card |
| 2 | The training brief was a fixed dark slab (`#182329`) with cream text even in the light theme | home, pause card |
| 3 | `.primary-button` rendered identically to `.secondary-button` (a generic `.practice-buttons button` rule won) — e.g. "첫 기준 평가 시작" had no emphasis | sensitivity lab |
| 4 | Route focus drew a link-like underline under every page title except home | lab, weapons, history, settings |
| 5 | Dark theme used a teal-tinted mid grey (`#202a2d`/`#293539`) with heavy `#52686b` dividers — low depth, muddy | all |
| 6 | Page frames differed: title x = 240/244/251 px, padding 28–32 px, h1 28 or 30 px | all routes |
| 7 | Map preview card content sat flush against the card edge; stray inner divider | home |
| 8 | History chart heading touched the card edge | history |
| 9 | English "Language" text label in an otherwise Korean top bar | top bar |
| 10 | Korean body copy could break inside words | all |

## Reference analysis

Captured on 2026-11-25: Aim Lab, KovaaK's, 3D Aim Trainer, aimtrainer.io,
Human Benchmark, Voltaic, Blitz, PlayVALORANT (ko-KR), Linear, Vercel, Raycast,
Toss, Monkeytype.

- Aim-trainer sites (KovaaK's, Aim Lab, Voltaic, aimtrainer.io) all use a
  near-black neutral canvas and exactly one saturated accent reserved for the
  primary action and the current selection. KovaaK's app shell (left nav,
  breadcrumb top bar, cards with large numerals) is the closest structural match
  to VALOPRAC.
- Linear's 2026 refresh: secondary navigation recedes so the work area leads;
  structure is "felt, not seen" (fewer, softer separators); warmer, less
  saturated greys tuned not to look muddy.
- Material dark theme: dark grey rather than pure black; higher elevation =
  lighter surface; desaturated accents that still pass 4.5:1.
- Button hierarchy guidance (NN/g and design systems): one filled primary per
  area; secondary actions outlined or text.
- Korean typography: `word-break: keep-all` with `overflow-wrap` fallback.

## Changes

- `src/ui/tokens.css`: new neutral graphite dark palette with tonal elevation
  (`--bg #111417` → `--surface-raised #1e2328`), softer `--line`, desaturated
  teal accent. Light palette unchanged. All pairs pass the existing WCAG gate
  (`scripts/verify-interface-palette.mjs`).
- `src/ui/designRefresh.css` (loaded last): single accent for primary actions
  (start button, pause-card launch, `.primary-button`); themed training brief
  that keeps the cut-corner/hatch signature; receding sidebar with an accent
  marker on the active item; unified page frame and title scale; framed map
  card; padded history chart; keep-all Korean wrapping and tabular digits;
  reduced-motion and forced-colors fallbacks.
- `LanguageSelect`: globe-style icon replaces the visible English label; the
  label stays for assistive technology.
- `theme-color` meta follows the new dark background.

`src/ui/modernWeb.css` is hash-locked by `scripts/verify-modern-web.mjs`, so its
one hard-coded dark colour is overridden in `designRefresh.css` instead.

## Verification

- `pnpm test` 1526/1526, `pnpm typecheck` clean, `vite build` succeeds,
  bundled palette WCAG check passes for both themes.
- Before/after screenshots: Chrome (SwiftShader) at 1440×900 and 390×844, light
  and dark, all menu routes plus the pause card.
- Not verified: real GPU rendering, Safari/Firefox, human usability.
- Pre-existing, unrelated to this change: `verify-build`, `verify-modern-web`
  and `verify-search` read binary comparison images and
  `deployment/search-discovery.json` that are not in the uploaded 12.0.19
  source snapshot, so the full `pnpm build` chain stops there on a fresh checkout.
