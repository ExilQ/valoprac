# VALOPRAC GitHub releases

Development happens on the `production` line (package `12.0.N`, app label `12.N`).
Each development version is published as a GitHub Release by
`.github/workflows/release.yml`.

1. Bump `package.json` and `public/release.json` to `12.0.N`.
2. Add `docs/releases/v12.N.md`: first line `# VALOPRAC 12.N — <title>`, then Korean patch notes
   (user-visible changes, fixes, validation limits).
3. Commit, then tag that exact commit `v12.N` and push the tag.

The workflow checks that the tag matches `package.json`, runs the tests, typecheck,
broker/hosting tests and the bundle build, packages
`valoprac-v12.0.N-unreal-source.zip`, appends its SHA-256 to the notes and publishes
the release. Pushing the same tag again after a fix (re-tag) updates the existing release.

A GitHub Release does not deploy the website.
