# VALOPRAC production deployment

Target: **https://valoprac.global**. Repository: **https://github.com/ExilQ/valoprac** (private). Production branch: `main`. Hosting preference: **Cloudflare Pages**. The application needs no server, Railway service, API key or player account.

## Current state — 2026-10-18

The production website is **not live**. The domain is not registered to this project and no Cloudflare account is connected to the deployment integration. These are account/registration gates, not build failures. The existing functional FPS game is preserved.

Observed checks:

- Identity Digital RDAP: HTTP 404, `Object not found`; registrant/registrar details were not returned. No ownership is claimed.
- Google Public DNS NS query: status 3, NXDOMAIN.
- GoDaddy's domain-availability tool: exact `valoprac.global`, standard inventory, `available: true`, `purchasable: true`. It returned no price or currency. Availability can change; purchase price and renewal terms require a fresh registrar checkout.
- Actual Chrome navigation to `https://valoprac.global`: HTTP 502 error page, `[Errno 111] Connection refused`. No running game or valid production certificate was observed.
- GitHub: authenticated as ExilQ; private `ExilQ/valoprac` repository created, repository ID 1423858736. Cloudflare's GitHub integration is a separate authorization and has not been installed/verified for this repository.
- Production dependency audit: zero vulnerabilities reported for the browser-runtime dependency tree.

Domain purchase and new account connections require the user's explicit authorization. No domain has been purchased, no payment made, and no Cloudflare credentials are present in this repository.

## Production implementation

- VALOPRAC branding, Korean instructions, no account gate in application code.
- All original engine systems retained: 120 Hz simulation, motion/inertia/braking, rifles/recoil/spread, 3D exact hit zones, headshot-only elimination, four training modes, six target behaviors and IndexedDB statistics.
- Actual Three.js game code is lazy-loaded. The React shell, engine UI and stable Three.js vendor chunk are cached independently. Procedural geometry requires no external asset CDN.
- `npm run build` runs `prebuild` first: strict typecheck and the full automated suite, then Vite and artifact verification. The build cannot succeed after a failed validation.
- A single `package-lock.json` and exact top-level versions support reproducible `npm ci` installs. `.node-version` selects Node 22.
- Public `_headers`: CSP, HSTS, MIME protection, top-level-only rendering, same-origin isolation, immutable caching for hashed assets, noncached release identity. Pages' default revalidation remains in effect for HTML.
- `_redirects` canonicalizes www and HTTP to `https://valoprac.global` once the domain is associated and serves through Cloudflare.
- Native Pages SPA fallback is used: there is deliberately no top-level `404.html` or broad rewrite that would override real static files. `/training`, `/settings`, `/statistics` restore usable client screens after a direct visit/refresh. Browser back/forward is supported. Reloading `/results` without an in-memory result opens the menu; prior sessions remain in local history.
- React error boundary, lazy-chunk deployment retry (limited to once/minute), WebGL context loss handling, pause and reload recovery.
- `version.json` includes app/version/commit, allowing the deployed artifact to be matched to an exact source revision.

## Authorized continuation

The repository contains the concrete desired Cloudflare project configuration at `deployment/cloudflare-pages.json`. It uses real GitHub owner/repository IDs and no invented Cloudflare account/project/domain IDs.

After the user authorizes Cloudflare access:

1. List actual accounts and select the user's intended account. Verify Pages and DNS edit permissions for this project. Do not create duplicate accounts/zones/projects.
2. Check registrar availability and exact first-year price, renewal price, currency, taxes and auto-renew terms. Present the concrete purchase for explicit authorization before registration/payment. Register in the user's account only.
3. Authorize Cloudflare's GitHub App for **ExilQ/valoprac only** if not already authorized. Do not grant access to unrelated repositories.
4. Create or reuse a **Git-integrated** Pages project with `deployment/cloudflare-pages.json`: branch `main`, command `npm run build`, output `dist`, root repository, Node 22. Do not start as Direct Upload if native Git integration is the chosen CD path.
5. Add the apex domain to a Cloudflare zone in the same account and set the registrar's nameservers to the exact values Cloudflare returns. Do not fabricate nameserver names or overwrite unrelated records.
6. Associate `valoprac.global` and `www.valoprac.global` with the Pages project before creating any required CNAMEs. Use the exact returned Pages hostname. The root domain requires Cloudflare nameservers/flattening. Provision HTTPS and enforce HTTPS at the zone edge. Wait for actual DNS/TLS activation rather than treating a pending state as success.
7. Publish the successful main-branch build, then execute `npm run verify:production` from an internet-connected runner. Its machine-readable report covers DNS, public unauthenticated HTML, TLS validation, hashed assets/caching, SPA refresh, HTTP/www redirects preserving path/query, and commit metadata.
8. In real Chrome and Edge, execute `docs/MANUAL_TESTING.md`, including Pointer Lock, mouse/WASD, shooting/recoil, animated head hits, all modes, storage, resize/refresh and errors. Record actual hardware/frame timing. A CPU-only engine test is not evidence of 144 FPS rendering.

## Continuous deployment and rollback

The GitHub validation workflow runs on main-branch pushes and pull requests, preserving a validated `dist` artifact for 14 days. Its action versions are pinned to verified commit SHAs. This workflow alone does not install or authorize the Cloudflare GitHub App.

Once the Git-integrated Pages project is actually connected, each main-branch change triggers Pages' `npm run build`. The prebuild checks gate the deployment. Use pull requests and require the `validate` check through repository rules if the account plan allows it; those remote protection settings have not been applied without inspection.

On a failed build, Pages should retain the last successful deployment. For a bad successful release, use the project's prior successful production deployment as a rollback target. Capture the actual deployment ID and verify its `version.json`; do not guess IDs. A source rollback uses a reviewed revert commit on main. Never force-push shared history as a rollback shortcut.

The on-demand `Verify production on demand` workflow performs a public external check and retains the result artifact. Do not add scheduled monitoring without an explicit recurring-automation request.

## Credentials and required permissions

No application runtime secrets are required. Infrastructure credentials remain in the connected provider/secret manager, never `VITE_*`, browser source, GitHub source, static artifacts or chat text. Request the narrowest available Cloudflare account-level Pages edit access plus DNS/zone changes for the new domain; verify the actual token permission UI before authorization. Any registrar payment is separate.

## Primary provider references

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/redirects/
- https://developers.cloudflare.com/pages/configuration/rollbacks/
