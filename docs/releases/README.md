# VALOPRAC GitHub releases

Development happens on the `production` line (package `12.0.N`, app label `12.N`).
Each development version is published as a GitHub Release by
`.github/workflows/release.yml`.

1. Bump `package.json` and `public/release.json` to `12.0.N`.
2. Add `docs/releases/v12.N.md`: first line `# VALOPRAC 12.N — <title>`, then Korean patch notes
   (user-visible changes, fixes, validation limits).
3. Commit and push to `production` or a `claude/` branch.

On that push the workflow releases every version that has notes but no release
yet: it tags `v12.N` on the last commit whose `package.json` says `12.0.N` and
that contains the notes, runs the tests, typecheck, broker/hosting tests and the
bundle build on that commit, packages `valoprac-v12.0.N-unreal-source.zip`,
appends its SHA-256 to the notes and publishes the release. The newest version
is marked latest. Pushing a `v*` tag yourself republishes that one version.

A GitHub Release does not deploy the website.
