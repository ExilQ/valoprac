# Astryx settings pilot — branch only

This experiment deliberately integrates **Astryx 0.7.11** into VALOPRAC's **General** settings tab only. The other tabs, game HUD, Three.js simulation, Unreal staging, and production deployment files are untouched.

## Implementation

- Component entry: `src/ui/AstryxGeneralSettings.tsx`
- Styles: `src/ui/astryx-pilot.css`
- Existing settings source: `useApp` / Zustand, no new persistence or analytics
- Components exercised: `Switch` (five controls), `Slider` (HUD scale)
- Theme: Neutral in dark mode, locally mounted inside the General tab
- Dependencies: `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@stylexjs/stylex` (all explicitly pinned); agent CLI in devDependencies
- An existing Lucide React dependency remains unchanged. The Neutral theme has its own newer Lucide dependency; check duplicate package sizes in the lockfile.

## Validation (not a claim of having passed)

1. `corepack pnpm install --frozen-lockfile` after updating the lockfile
2. `pnpm test && pnpm typecheck && pnpm test:broker && pnpm verify:migration && pnpm build`
3. Compare `dist` asset sizes against the same main commit; record raw/gzip size for JS and CSS
4. Open `/settings.html`; use Tab/Shift+Tab and keyboard to change every switch and the slider; check labels, 44px touch targets, color contrast (WCAG AA), and mobile layout
5. Verify data persists after reload, other four settings tabs behave unchanged, and gameplay Pointer Lock + HUD remain unchanged
6. Compare screenshots of main and pilot, including the menu and game HUD, for regressions from global reset/theme CSS

No production changes or merges are authorized by this pilot. Remove the packages and revert this branch if the pilot doesn't meet acceptance criteria.

## Guidance for agents

With CLI installed, use `pnpm exec astryx component Switch`, `pnpm exec astryx component Slider`, and `pnpm exec astryx docs styling-overview` for the component APIs. Do not call `astryx init` against the production branch; its instruction-file changes require review.
