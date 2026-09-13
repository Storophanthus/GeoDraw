# ISL Shortlist diagram preset

Choose **ISL Shortlist** from the left toolbar's **Palette** menu or from
**Preferences > Construction > Canvas > Construction palette**.
**Preferences > Presets > Apply ISL Shortlist** also reapplies the complete
configuration when ISL is already selected. These UI actions save construction
preferences for new diagrams and future starts.

The preset follows the user's selected reference, **ISL 2018 G1**: firm black
strokes, solid dots, clear math labels, and unfilled shapes on
white paper. Reference: the local scan
`~/Downloads/ISL2018/IMO2018SL_figure/847f31de-8b48-4e0f-ab4a-89ef0caec11a-38_546_597_1090_736.jpg`.
These proportions are adapted to GeoDraw's working scale; ISL figures vary
between years and this is not an official configuration.

| Setting | ISL Shortlist |
| --- | --- |
| Paper | White `#ffffff`; grid, axes, snapping, and glow keep their current settings |
| Main ink / points / labels | Black `#000000` |
| Optional fill color | Neutral gray `#bfbfbf`, with shape fills off |
| Point radius / outline | 3.5 / 0.6 px, solid circular marker |
| Point label size / halo | 28 / 1.5 px |
| Segment / polygon edge | 2.2 px |
| Infinite line | 1.8 px |
| Circle / ellipse | 2.2 px |
| Angle arc / mark size | 1.6 / 6 px |
| New angle values | Off; angle marks remain available |

All widths above use GeoDraw's logical canvas pixels. Existing export sizing
controls still govern the final physical size. Point names use the existing
TeX caption renderer for math typography. Existing custom captions, hidden
labels, label offsets, dash patterns, equality/arrow marks, and custom colors
are retained. Ordinary name labels with a separately stored custom caption
keep their current name mode so the preset cannot reveal or overwrite that
caption. Selecting ISL also selects the matching Vanilla UI theme. Reapplying
ISL repairs a previous UI-theme mismatch; choosing another palette afterward
keeps normal UI/construction pairing. As with the
other palettes, the UI theme is saved as an app preference, independently of
diagram undo/redo and scene files.

Applying the preset restyles existing objects and future defaults in one undo
step. Reopening an ISL document or loading saved preferences does not reapply
fixed sizes over later customizations. Explicit selection of any palette
clears custom canvas-color overrides, including when reapplying the same
palette, so the background and grid actually use the selected colors. Undo
restores the previous overrides with the rest of the diagram configuration.
Palette changes preserve grid/axes/snap/glow toggles. ISL uses black grid ink
because the renderer already applies low opacity to minor and major lines.
If a drawing was saved with the grid disabled by the initial preset, enable
Grid once; loading does not override an intentionally disabled grid.

For colored auxiliary objects, the ordinary color picker provides the same
basic red, blue, green, and magenta used selectively in the newer references.
The preset preserves those accents rather than assigning colors automatically
by construction type.

Implementation: `src/state/colorProfiles.ts`, `src/state/islStyle.ts`, and the
explicit profile-selection action in `src/state/slices/uiActions.ts`.
The ISL identifier is accepted by construction-preference persistence.

Regression: `src/export/__fixtures__/isl-shortlist-style.json` and
`src/export/__tests__/isl-shortlist-style.test.ts` exercise a triangle,
circumcircle, dependent midpoint, and blue dashed auxiliary segment. They
cover existing/default styles, coordinates and labels, undo/redo, preferred
settings, document reload after customization, and compilation through both
plain and tkz drawing backends in standard and efficient output.

Manual check: load the fixture into a local test drawing, open Preferences,
apply the preset, and confirm white paper, substantial dots, firm strokes,
math labels, an unfilled triangle, and the blue dashed auxiliary. Undo and redo;
then create a point and confirm the defaults and caption mode. Reopen the
drawing after changing one size and confirm that customization survives.
With Grid enabled, switch palettes and confirm it stays checked and visible;
repeat with Grid disabled and confirm it stays off. To reproduce the canvas
override regression, choose Dark Mode, set Canvas background to Peach under
Preferences > Construction > Canvas, then choose Classic from the left menu.
The canvas must become white and the diagram must recolor; undo must restore
the Peach background. `palette-linking-regression.test.ts` covers every
palette, both visibility states, override replacement, undo, and reapplication.

Validation on 2026-09-08: the ISL regression, scene suite, isolated TypeScript
check, Vite build, and browser checks pass. GUI checks include switching from
ISL to Dark, replacing a customized background with Classic, and undoing it.
Both drawing backends compile in both output modes. The later PDF-label fix
repaired the related canvas-origin fixture and updated stale label-placement
assertions; the full TypeScript build and all export unit tests now pass.
The final gate results are recorded in `docs/handoff.md`.
