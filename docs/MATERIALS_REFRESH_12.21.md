# Training-range materials, lighting and colour — 12.21

Appearance only. Collision boxes, hit zones, character poses, simulation,
replay headers and checksums are unchanged (all replay compatibility tests pass
unmodified).

## Audit of 12.0.20 (engine-audit captures, High preset)

Maps: range, tactical, garage, ascent, bind, icebox, sunset.

1. **Flat lighting.** Hemisphere fill 1.42 against a 2.85 sun gave a key:fill
   ratio near 2:1, so forms read flat; ACES plus a pale horizon and fog from
   45 m washed everything toward pastel.
2. **Noisy, blurry joints.** Panel/tile joints were wide dark bands in 128 px
   maps tiled over 1.2–2.4 m, so at arm's length they magnified into soft grey
   stripes — visual noise rather than structure.
3. **Mottled surfaces.** Low-frequency noise (`broad`) on plaster, paint and
   concrete read as dirt blotches on large walls.
4. **Target readability.** Teal target clothing matched teal walls and the range
   backstop; nothing separated characters from the environment.

## Reference analysis

- **VALORANT map art:** keep materials similar in value, avoid high-contrast
  combinations and excessive darkness, use distinct colour only for wayfinding,
  and keep characters always clearly visible.
- **VALORANT shaders:** one heavily styled directional light for dynamic objects;
  friend-or-foe fresnel rim light, biased toward upward-facing edges and boosted
  with distance so characters stay readable at range.
- **Overwatch:** readability first; stylised environments avoid micro-detail and
  rely on palette and shape.
- **CS2:** repeated map updates adjust lighting and remove textures specifically
  for player readability.
- **Aim Lab / KovaaK's:** aim trainers deliberately use stripped-down,
  high-contrast scenes so targets isolate from the background.
- **Khronos PBR Neutral tone mapping:** reproduces base colour, hue and
  saturation under neutral light where ACES desaturates and hue-shifts.

## Changes

| Area | 12.0.20 | 12.21 |
|---|---|---|
| Tone mapping | ACES Filmic | Khronos PBR Neutral (`THREE.NeutralToneMapping`) |
| Key / fill | sun 2.85, hemisphere 1.42 | sun 3.3–3.35, hemisphere 1.04–1.06 |
| Sky | pale zenith `#70a9cf` | saturated zenith `#4f90d2` / `#4d8bc9` |
| Fog | 45–140 m | 70–190 m |
| Warm maps | fixed list | fixed list + course style (`urban`, `courtyard`) with near-neutral sun |
| High texture size | 128 px, 4× aniso | 256 px, 8× aniso (library still < 16 MiB) |
| Ultra | 256 px, 8× aniso | 256 px, 16× aniso |
| Panel joints | 2.5–3.2 % width, −0.18 shade | 1.1–2 % width, −0.17 groove + lit lip |
| Surface mottling | broad ±0.021–0.027 | broad ±0.010–0.012 |
| Enemy readability | none | rim highlight: red (default) / yellow / purple / off |

The rim highlight (`CharacterMaterial.useEnemyRim`) adds a grazing-angle
emissive term after `emissivemap_fragment`, biased upward and up to 1.8× at
40 m. It is a uniform, so changing colour never recompiles. The choice is a
display preference stored under `valoprac-enemy-highlight-v1`, outside
`Settings`, so replay headers stay byte-identical.

## Verification

- 1529 tests pass (3 new in `enemy-highlight.test.ts`); `tsc -b` clean.
- `renderer-fallback.test.ts` now expects 256 px maps at High (intentional).
- Before/after captures via `dev/engine-audit.html` (SwiftShader, 1280×720).
- Not verified: hardware GPU frame cost of the larger High maps, Safari/Firefox
  rendering, colour-vision user testing of the highlight colours.
