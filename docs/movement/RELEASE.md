# 09.00 release verification and rollback

The 08.00 checkpoint is source commit
`a2d5d97b93d15363b2d182fd775f1bebabfbb0bc`, branch
`checkpoint/08.00-before-dual-movement` and a detached QA worktree.
Its production Site version is
`appgprj_6ad3456a37e08191ae5aef8440d1d28f~appgver_3737a9aa24908191a7b4f9a8f938d356`.

After verification, publish the exact pushed 09.00 source commit with its built
Worker archive via the existing public Sites project. Preserve access policy.
If production validation fails materially, redeploy that saved 08.00 version;
do not force-push history or discard browser preferences. New physics settings
are optional sanitized fields; older source ignores them without destroying
existing movement, sensitivity, weapon or analytics records.

Before evidence: frozen 08.00 controller trajectory measurements, same declared
input schedule and SI units. After evidence: new profiles, exact fixed-tick samples,
actual Chromium controls/HUD/input and separate production HTTP/UI verification.
No native-game recording, human movement study, high-refresh GPU or physical
mouse-to-photon measurement was performed.
