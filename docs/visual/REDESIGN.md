# VALOPRAC 05.00 visual redesign

Existing Site and source repository preserved. Baseline: release 4.0.1, commit `8ca371a9744cace0d1479569fb6e20e8942574d3`. Runtime remains React / Three.js WebGL. Unreal staging remains disabled.

## Prioritized audit

1. **Weapon form / first-person anatomy.** Both rifles shared rectangular receiver, stock and grip assemblies; their 80 mm receiver bodies, 95 mm butt pads and disconnected 110 mm sleeve emphasized blockiness. Revolver frame and grip read as stacked blocks. Replaced with independent beveled side-profile topology, 63–64 mm rifle receivers, narrower shaped stocks/grips, a fluted six-chamber revolver cylinder, curved trigger guards and separately skinned sleeve/glove rigs. PBR steel/polymer/rubber use controlled roughness, no emissive decorative strips.
2. **Character silhouette.** Render meshes were unit boxes scaled to collision dimensions. New original tapered cross sections, layered cloth/vest, face covering, small visor, gloves, knees and shaped shoes follow the existing eleven articulated hit-rig nodes. Collision/AI data remain unchanged. These are instanced articulated procedural characters, not imported full-body motion-capture assets.
3. **Environment construction.** Original wall and cover volumes remain authoritative. Inset cladding, cornices, clerestories, door/window framing, platform trim, rail details and authored material variation improve construction without relocating collision. Warm plaster, sage concrete and blue metal share a readable daylight palette. Static meshes batch by material; characters remain instanced.
4. **UI composition.** Tall cards and inconsistent panel treatments replaced with seven compact mode rows, focused inventory preview/specifications, six settings tabs and consistent analytics/patch panels. Korean instructions and combat numbers have explicit readable desktop font sizes. Shared design tokens define the palette, spacing and motion. Existing state/actions/storage/routes remain connected.
5. **HUD hierarchy.** Edge docks preserve central target space. Minimap, footsteps and braking use one flowing left column; statistics and ammunition use the right. Safe-area insets and responsive grid tracks replace independent panel stacking. User HUD scale remains supported.

## Preservation and validation

No changes to authoritative movement, recoil, trajectory, hitbox, footstep, bot AI, map collision, exposure or analytics algorithms. Original 1.25× rifle FOV zoom, separate viewmodel camera, toggle/hold ADS and Sheriff ADS exclusion remain. All four graphics presets retained. No external Riot models, textures, audio or trademarks-as-artwork were downloaded.

Tests exercise finite registered geometry, normalized skin weights, animation stability, distinct receiver/stock geometry, centered head visibility at four aspect ratios, unchanged hit-rig matrices and existing engine regression coverage. Browser screenshot staging and hardware limitations are recorded in the final QA report; CPU tests do not establish GPU FPS, acoustic fidelity or input-to-photon latency.

## Rollback

Existing saved production version 9 / patch 04.01 remains available:
`appgprj_6ad3456a37e08191ae5aef8440d1d28f~appgver_4f08cae0515c819195f1c97b8fb591b2`.
Redeploy that saved version through Sites to roll back; do not replace the Site or alter its custom domain.

## Executed release QA (2026-10-25)

- 17 matched before/after views: menu/training, inventory, settings, history, patch notes, both rifles in hip/ADS, Sheriff, character, corridor, elevated area, and four HUD resolutions. Renderer screenshots are paused/staged inspections of the real application, not generated concept art. Separate analytics overview, exploration and analysis screenshots also passed horizontal overflow checks.
- All optional HUD elements: 1366×768, 1920×1080, 2560×1440, 3440×1440 at 100% and 125% HUD scale: zero overlapping panels, zero viewport escapes and zero horizontal clipping. HUD layout captures use low-cost rendering; weapon/map comparison captures use Medium.
- Actual Chromium Pointer Lock, firing, reload, toggle ADS, Hold ADS, movement/release, footstep events, Sheriff ADS exclusion, and the real fullscreen button succeeded via the browser DOM adapter. Headless Escape did not release Pointer Lock; the native exitPointerLock API was verified instead. These are automated browser checks, not physical hardware or input-to-photon tests.
- Final browser smoke: zero page/console errors. Mixed indexed/beveled/ramp architecture batching was fixed after browser inspection. Static weapon details batch within their own animated parent; contiguous hand material groups combine without modifying skin weights.
- Same Vandal/5-bot/1920×1080/Medium scene: total render submissions 125 → 116, triangles 16,753 → 66,639. This records the cost of more detailed geometry and reduced submissions; it does not prove hardware FPS improvement. Medium SwiftShader sampling yielded only 1–2 frames and is unsuitable for an FPS comparison.
- After-only software Low test with explicit 0.5 render scale: 52 frames over 10 seconds, about 5.25 FPS, p95 333.3 ms. These values describe the cloud software renderer only. GPU utilization and physical latency were inaccessible; dedicated GPU/high-refresh/physical mouse validation remains unverified.

Machine-readable results: `public/visual-validation.json`, `docs/visual/final-smoke.json`, `docs/visual/browser-input-report.json`. The task workspace contains the original PNGs and a self-contained comparison HTML/contact sheet under `/workspace/qa-valoprac/`. Large screenshots are deliberately excluded from runtime assets.
