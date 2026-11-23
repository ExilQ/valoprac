# Bright workspace refinement

The light interface uses white main surfaces and a very pale neutral secondary
surface. Explicit light selectors own the palette and `color-scheme`; a late
legacy `:root { color-scheme: dark }` must not darken native controls. The browser
toolbar follows the selected theme. Saved theme choice and gameplay state remain
independent.

The training screen uses a plain training list and open configuration area instead
of nested card frames. Decorative navigation numbers, redundant heading labels,
the repeated map footer and the duplicated start-button subtitle are omitted.
Selection, keyboard focus, training descriptions, counts, controls, the map drawing
and the start action remain available. Settings and measurement sections use
dividers and consistent type hierarchy.

Design reference: [Impeccable](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md),
particularly its Operate and quieter guidance. The executable was unavailable;
project source and the existing committed comparison images supplied context.
Those images are historical and do not represent this revision.

Verification runs against the actual built CSS: root selector precedence, native
control scheme, light-surface luminance, normal text and placeholder contrast
(4.5:1), control boundary and focus contrast (3:1), and the independent dark
palette. This checks CSS declarations and color arithmetic, not rendered geometry.
The current environment has no supported browser-control tool, so new screenshots,
responsive rendering and visual usability have not been verified. Historical
browser reports are retained without relabeling them as new captures.
