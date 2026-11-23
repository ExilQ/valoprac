# 4.0.1 / patch04.01 validation

The baseline is actual production4.0.0, commit096502ee057dccebc7578e569dc124bfc3889333. User-reported3.0 measurements described the former movement profile. The current rifle profile already used6degrees as its running contribution;4.0.1 removes ambiguity by making walking/running configuration TOTAL no-bloom hip-fire cone radii. Standing rifle endpoints are3/6degrees, Sheriff1.2/3degrees. Base error is included once. Rifle numbers come from historical Riot9.10; the Sheriff pair is a requested calibration reference, not independently verified from that patch. Continuous interpolation, distribution and browser equivalence remain provisional.

## HUD

`GameHUD` is shared by gameplay and the development-only `/dev/hud.html?suite` fixture. Both actual footstep widgets and braking feedback occupy one left flow dock. The right dock holds compact actual recoil measurements, statistics, diagnostics and ammunition. The optical crosshair stays outside the scaled HUD layout. Timer positioning is reset to flow, preventing inherited absolute-position collisions.

Managed Chrome measured actual CSS boxes at1920x1080,1536x864,1366x768 and HUD scales.75,1,1.25. All10widgets, diagnostics, actual simulated full-magazine recoil data, minimap, footstep gauge and braking feedback were enabled. Each of9conditions had zero pairwise overlaps and zero viewport-clipped widgets. These are browser layout measurements of the production components, not GPU gameplay or physical input evidence. The fixture is excluded from public build entries. `hud-layout-evidence.json` preserves the observed counts and conditions.

## Input

Pointer Lock checks actual lock state before processing failures. Promise attempts own their own rejection; late unidentifiable events cannot launch a duplicate fallback. Legacy void-return implementations use event reconciliation. Deferred work is disposed. Success clears input errors only; aim-analysis/storage failures remain separate. Synthetic regressions cover late errors after fallback success, during pending fallback, genuine denial, retry, already-locked requests, legacy cleanup and the complete AimRuntime warmup/measurement path at60/144/240schedules.

## Hosting

The former static host ignored `_headers` and `_redirects`. The Site retains its project/domain/audience but now publishes supported Worker ESM. Its handler embeds the existing compiled browser assets and applies headers/cache/fallback in actual responses. Only hashed `/assets/` files receive31536000-second immutable caching. HTML revalidates, JSON is no-store, and ETag/HEAD preserve security. CSP and X-Frame-Options deny framing; guide inline scripts, when present, receive build-derived hashes. Missing scripts return404 rather than SPA HTML. Hidden host configuration cannot be downloaded. Unknown document paths enter the SPA.

`worker/response.test.mjs` checks actual Response objects; `verify-response-worker.mjs` imports the generated worker and compares every response byte with the compiled client. This catches encoding or packaging changes, not just configuration-file existence. Deployment additionally requires real public-origin header/status/hash checks. Template substitution uses a replacement callback so literal dollar sequences in bundled JS remain unchanged.

## Source export

The archive includes all docs, public configuration, icons, guides, frontend, worker, scripts, pinned lockfile and original UE staging sources, excluding generated downloads and transient dependencies/build products. The new worker is part of the reproducible browser build; no credentials are included. Detached archive installation/build verification is recorded only after execution. This does not claim an Unreal application is built.

## Player-facing changes

New safe dock layout, stale-lock-error fix, real-speed target option, plain VALORANT sensitivity entry, independent-service notice, original audio labeling, favicon/social card and task-focused guides. Disabled Unreal entry is removed from normal menus; old deep links and staging sources remain for compatibility. Riot's notice is not a certification or endorsement. No redistribution permission for Riot recordings or extracted assets is claimed.
