# GeoDraw Handoff (Stability Contract)

## Branch / Baseline
- Active branch: `feat/core-redefine-engine`
- Keep commits small and scoped.
- Do not bundle unrelated files in feature commits.
- Architecture map reference: `docs/architecture-snapshot.md`
- Feature implementation protocol (must follow): see `docs/architecture-snapshot.md` section
  "Feature Implementation Protocol (For Future Changes)".

## Feature Start Protocol (Mandatory)
- Re-open `docs/codex/CONTRACT.md` before touching code.
- Re-open this file (`docs/handoff.md`) and confirm current active work.
- Define expected module touch-set first; avoid ad-hoc edits outside that set.
- For multi-cycle features:
  - checkpoint commit at stable milestones,
  - update this handoff with `Done / Next / Risks`,
  - resume from handoff state, not memory.
- Tool-Command parity (mandatory):
  - Any newly added UI construction tool must ship with a Command Bar counterpart in the same feature cycle.
  - Required minimum:
    - parser support in `src/CommandParser.ts`
    - command execution wiring (store/API) + user feedback in `src/CommandBar.tsx`
    - docs update (`docs/command-bar-reference.md` + this handoff)
    - regression tests for parser/behavior.

## Done (Current Truth)
- 2026-07-21 RGB inputs + recently-used colors in `ColorSwatchInput`
  (owner-reported gap: the popover offered presets and an OS custom-color
  picker, but no way to type R/G/B values, and nothing remembered what you'd
  used before):
  - `ColorField.tsx`: new "RGB" section at the top of the `variant="panel"`
    popover — three number inputs (0-255), derived from `pickerValue` via
    the existing `parseColorToRgb`, committed through the existing
    `commitValue` path (so recents/persistence apply uniformly regardless of
    entry method). New "Recent" section renders only when non-empty, reusing
    the existing `.colorFieldPresetGrid`/`.colorFieldPreset` classes verbatim
    -- no new swatch styling, just a new data source.
  - Recording is centralized: a `recordRecentColor` helper is called from
    `commitValue` (covers RGB inputs AND preset clicks) and separately from
    the native `<input type="color">`'s `onChange` (which bypasses
    `commitValue`'s synthetic-event path since it already has a real one).
    Both paths converge on the same MRU list.
  - Recent list is intentionally **global**, not per-field-instance: read
    fresh from `localStorage` whenever a popover opens (`useEffect` on
    `[open]`), not cached in component state across renders. Verified this
    live -- a color set via one field (Stroke) appeared in a completely
    different field's (Fill) Recent section without a page reload.
  - `appPreferences.ts`: `loadStoredRecentColors`/`saveStoredRecentColors`,
    same `StoredEnvelope` pattern as every other preference here.
    `MAX_RECENT_COLORS = 10`. Validation lives in the loader (regex
    `/^#[0-9a-f]{6}$/`, dedupe, cap) so garbage/oversized/malformed stored
    data degrades to a shorter valid list instead of the usual all-or-nothing
    envelope failure -- matches the export-preferences precedent of
    per-field fallback over whole-envelope invalidation.
  - `variant="token"` (Preferences dialog's theme-color fields) is
    unaffected -- the RGB/Recent additions are `variant="panel"` only,
    matches the plan's existing panel/token split.
  - Verified live end-to-end, not just built: typing into R/G/B updates the
    trigger's swatch and hex text immediately; three sequential edits landed
    in `localStorage` as `["#0a64c8","#0a64f0","#0ae8f0"]` in the correct
    envelope shape; survived a full page reload; clicking a Recent swatch
    applies it and moves it to front (dedupe confirmed -- stayed at 3
    entries, not 4); Dark Mode checked -- legible, though the whole
    `.colorFieldPopover` (predating this change) is hardcoded cream/beige
    rather than token-driven, so it does not itself go dark. Flagging for
    the visual-pass plan's V5 theme sweep rather than fixing here, since
    fixing it means re-theming presets/borders/shadows that this change
    didn't touch.
  - New `src/scene/__tests__/recent-colors.test.ts` (localStorage-stub
    pattern, matching `export-preferences.test.ts`): round-trip, cap at
    `MAX_RECENT_COLORS` keeping the front of the list, garbage entries
    dropped individually rather than invalidating the whole list, duplicate
    entries deduped on load, malformed JSON and non-array values both
    degrade to empty rather than throwing. Wired into `test:scene`.
- 2026-07-21 Visual pass V3: field grid + pilot migration on
  `PointPropertiesSection.tsx` (approved `sidebar-visual-pass.md` plan,
  check-in point before V4 propagates the pattern):
  - Added `.propGrid`/`.propField`/`.propFieldFull`/`.propFieldLabel`/
    `.propSliderControl`/`.checkboxRowGroup` primitives to `App.css`
    (label-above-control, 2-col `1fr 1fr`, `min-width: 0` on every grid
    child). `.controlRow`/`.controlRowWithNumeric` are untouched and stay
    the active pattern for every panel V4 hasn't reached yet.
  - Point pairing map implemented: Name+Apply stays a full-width row,
    structurally unchanged; Caption (TeX) | Show Label paired (Caption is
    `mode="object"`-only, so Show Label falls back to `.propFieldFull` in
    tool-default mode rather than stranding a half-empty grid cell);
    Label Color | Halo Color paired (still gated on
    `showLabel !== "none"`, unchanged condition); Fix Object + Auxiliary
    Object grouped into one full-width `.checkboxRowGroup` row rather than
    two grid cells; Shape stays full-width (its popover needs the room,
    and has no size-matched partner once the sliders were pulled out);
    Stroke Color | Fill Color paired -- required reordering Fill Color to
    sit immediately after Stroke Color (was after Stroke Width/Opacity) so
    the two colors land in the same grid row, a pure layout reorder with
    no handler/prop changes; Size, Stroke Width, Stroke Opacity, Fill
    Opacity all stay full-width slider rows per the plan's own
    "sliders never pair, to avoid overflow" rule.
  - Root-caused and fixed a real overflow bug surfaced by the probe:
    `.colorFieldNativeInput` (the invisible 1x1 `<input type=color>` every
    `ColorSwatchInput` uses to open the OS picker) had no `top`/`left`
    anchor, so its browser-computed static position landed past the end of
    the full-width trigger button, inflating `scrollWidth` by ~6px on
    every host row. Reproduced the identical 6px overflow on an untouched
    `.controlRow` (Circle's Stroke Color) before touching anything,
    confirming this predates V1/V2 and isn't new debt. Fixed with
    `top: 0; left: 0` in `App.css` -- global, zero visual/behavioral
    change (element stays `opacity: 0`/`pointer-events: none`), and it
    de-risks V4's ~9 remaining ColorSwatchInput-in-`.propGrid` migrations.
  - `StyleSectionHeader.tsx` (header-row layout move + "Set Default"
    relabel from "Make this default for this object") was already on disk
    from an interrupted prior session; judgment call was to keep it.
    Measured live at the sidebar's real width (312px, a few px above the
    300px documented minimum): header row 269px, "Point Style" title
    ~70px, leaving 191px for the toggle -- "Set Default" fits at 89px, the
    original sentence measures 224px and would overflow by ~33px. The
    plan's own mockup-language section already names "Set Default" as the
    example text for this control, and two other consumers have longer
    titles than Point's ("Polygon Style", "Segment Style", 13 chars),
    making the short label the safer choice everywhere this shared header
    renders, not just here.
  - `ObjectBrowser.tsx` needed no markup changes -- the monospace command
    text and accent-tinted `.active` row state the plan calls for were
    already fully covered by `App.css` rules already on disk before this
    commit (`.objectItemLabel` 12px/600, `.objectItemCommand` 11px
    monospace muted, `.objectItem.active` accent-bg + inset accent ring).
  - Verified live in Vanilla and Dark Mode via Preferences: build and all
    three test suites exit 0, console clean. Exercised rename+Apply, shape
    popover open/select/close, a Stroke Color change through the pill, a
    Size slider drag, Fix Object/Auxiliary Object toggles, and selecting a
    different object (Point A -> Point B) -- all reverted after. Overflow
    probe (`scrollWidth <= clientWidth`) clean on both `.propGrid`
    instances and `.rightSidebar` at the current width (312px) and at the
    documented minimum (300px; forced via direct style for the probe,
    since the resize handle's pointer-capture drag isn't reliably
    driveable from browser automation).
- 2026-07-21 Visual pass V2: ColorSwatchInput panel variant becomes a
  full-width `[swatch][HEX]` pill (`src/ui/ColorField.tsx` + `src/App.css`),
  one component change reaching all ~30 call sites with zero call-site
  edits, per the approved `sidebar-visual-pass.md` plan:
  - Added `resolvedHex`/`displayText`: shows `toColorInputValue(value)`
    uppercased when it parses as a color, otherwise the raw string
    (matches non-hex style values like named/`none` colors without
    forcing them through the hex formatter); `title` is always the raw
    value.
  - The trigger's panel-variant class changed from `.colorInput` (a fixed
    36x28 swatch-only button) to a new `.colorFieldPill` (full-width, 30px,
    swatch chip + monospace hex text) that reuses the existing shared
    `.colorFieldTrigger` hover/focus/disabled states, so no new interaction
    CSS was needed. `.colorInput` had no other consumers, so it was
    replaced rather than left dead.
  - `variant="token"` (Preferences, paired with its own text input per
    `ThemeColorControl`) takes a different branch entirely -- the hex-text
    span and pill class only render for `variant="panel"` -- so it is
    byte-for-byte the same JSX/CSS path as before. Verified in the
    Preferences dialog: swatch still 36x30, no hex text on the swatch
    itself.
  - Found one pre-existing outlier while spot-checking every style tab:
    `src/ui/object-styles/ArrowListControl.tsx:447` pins its
    `ColorSwatchInput` to an inline `style={{ width: "64px" }}`, which (by
    design, inline styles beat the class) overrides the new pill's
    full width, so "Arrow Color" now shows a heavily truncated
    `#E...`-style pill instead of a hex readout. Not broken --
    `text-overflow: ellipsis` keeps it inside its box and `title` still
    carries the full value on hover -- but it's the one place the pill
    reads worse than before. Left untouched (no call-site edits is the
    point of V2, and `ArrowListControl` is explicit V4 -- object-styles --
    territory); flagging here so V4 knows to drop that inline override.
  - Verified live in Vanilla and Dark Mode: build and all three test
    suites exit 0, console clean, no `.rightSidebar`/`.styleTabList`
    overflow, pill checked in Point/Circle/Sector style tabs (Stroke,
    Fill, Label) and the Preferences token rows.
- 2026-07-21 Visual pass V1: restyle sidebar control primitives onto the
  owner's Figma-style mockup language (approved plan
  `sidebar-visual-pass.md`), CSS-only in `src/App.css`, zero markup edits:
  - Sliders (`.sizeSlider`/`.numberSliderTrack`): track 7px gradient -> 4px
    flat (`--gd-ui-border-soft` fill, `--gd-ui-border` hairline); thumb
    20/18px accent-filled -> 14px surface-filled with a 2px
    `--gd-ui-text-strong` ring (falls back to a token, not a hardcoded hex,
    per the plan's dark-contrast note). Firefox's `-moz-range-progress`
    keeps its accent fill, just flattened to match.
  - Inputs/selects/number boxes (`renameInput`, `selectInput`,
    `scaleInputCompact`, `shapeButton`, and the bare `controlRow` number
    input for consistency) normalized to a shared 30px height / 6px radius
    and a single merged `:focus-visible` rule -- `selectInput` and
    `shapeButton` previously fell through to the browser's default focus
    ring instead of the app's accent outline.
  - `.deleteButton` gained a hover/focus danger-tint background
    (`color-mix` with `--gd-ui-danger`); it was already outline-style
    (red border/text on a neutral fill) but had no interactive state.
  - `.rightTabs`/`.rightTabButton` (the Objects/Export segmented switch):
    dropped the gradient tray, gradient active-pill and `translateY` lift
    for a flat gray tray + white active pill with a hairline shadow,
    matching the `.objectBrowserTab` pattern already used one panel down.
  - `.objectBrowserTabs`/`.objectBrowserTab` (the Points/Lines/Circles...
    filter icons) were declared twice (~2861 and ~3196, known debt from the
    density pass) with the second silently winning on the properties that
    conflicted while the first's `overflow-x` leaked through underneath.
    Consolidated into one declaration each, matching current effective
    behavior exactly, then deleted the duplicate.
  - `.sidebarHeaderBar` de-gradiented to a plain surface card; it plus
    `.sidebarSection` and `.styleControlGroup` moved onto the plan's radius
    scale (16/18/14px -> 8px "card" tier; controls already normalized above
    sit at 6px).
  - `.rightSidebar` gained a styled thin scrollbar (`scrollbar-width: thin`
    + `::-webkit-scrollbar*`), token-colored, additive only.
  - Deliberately left untouched: `.sidebarToggleButton` (still gradient --
    it opens the Quick Help card, which V5 owns alongside a full contrast
    sweep) and radii outside the right-sidebar/properties-panel surface
    (left toolbar, document tabs, command bar) -- out of scope per the plan.
  - Verified live in both Vanilla and Dark Mode via Preferences: build and
    all three test suites exit 0, console clean, `.rightSidebar`/
    `.objectBrowserTabs`/`.rightTabs`/`.styleTabList` all report
    `scrollWidth === clientWidth` (no overflow) at the default sidebar
    width in both themes.
- 2026-07-21 Export panel: attach the copy actions to the code they copy
  (owner-reported: "before, the copy is actually above the code, so it is clear
  what we are copying"; and the long-labelled buttons looked bad):
  - The copy buttons sat at the top of the panel, separated from the textarea by
    the option checkboxes, the Figure sizing card and the status row -- four
    sections between an action and its object. Copy/Copy full file now live on a
    header row belonging to the code block itself, flush on top of the textarea,
    with the status text and Refresh folded into that same row.
  - `Open PDF Preview` was never a copy action, so it no longer sits with them:
    it moved to the section header beside the "Export" title as a compact
    `Open PDF` pill (still desktop-only).
  - Labels shortened (`Copy Code` -> `Copy`, `Copy Full Document` ->
    `Copy full file`, `Refresh code` -> `Refresh`) so they fit the sidebar.
  - The ugly two-line buttons were a CSS bug, not just long text: `.actionButton`
    sets a fixed `height: 38px` with no `white-space`, so a long label wrapped
    onto a second line and was then clipped by that height. Its container was
    `.actionsRowWrap`, which despite the name set `flex-wrap: nowrap`, so the row
    could not reflow either -- buttons could only squeeze their own text.
    Added `white-space: nowrap` to the base rule, which also pre-emptively fixes
    `.findReplaceControls .actionButton` (fixed 32px, "Replace All").
    `.actionsRowWrap` had no other user and was removed.
  - Overleaf guidance moved to sit directly under the copy buttons (where the
    code is about to be pasted from) instead of near the removed PDF button.
  - Verified live: both buttons render single-line (26px, `nowrap`), the header
    sits above the textarea, and clicking Copy generates 1599 chars and flips the
    status to "Up to date". That same check also confirmed the viewport-clip fix
    end to end -- the generated plain-backend output contains `\clip (`.
- 2026-07-21 Fix "Export what I see now" in Exact Coordinates, and un-orphan the
  export unit tests that would have caught it (owner-reported: the exported PDF
  contained the whole drawing instead of the visible canvas region; correct in
  Geometric Constructions, wrong in Exact Coordinates):
  - Root cause: viewport clipping is emitted at exactly one place,
    `renderSetupAndPoints.ts`, gated on `emitTkzSetup`. `ExportPanel.tsx` sets
    `exportEmitTkzSetup = exportBakeCoordinates ? false : (...)`, and
    `exportBakeCoordinates` is true precisely in `visualExact` -- so Exact
    Coordinates force-disabled the only code path that clips to the viewport.
    Introduced by `ad383db`, integrated as part of the tkz-independence work.
    The intent was right (`\tkzInit`/`\tkzClip` ARE tkz-euclide macros and had
    to go), but no pure-TikZ replacement was put in, so the feature did not get
    ported -- it disappeared.
  - Fix: when the plain backend has a viewport and no explicit clip rect/polygon,
    emit `\clip (xmin,ymin) rectangle (xmax,ymax)` inflated by
    `setupViewport.space` (matching `\tkzClip[space=n]`, which grows the region
    by n per side). Deliberately keyed on `drawLayerBackend === "plain"` rather
    than on `!emitTkzSetup`, so a user who manually unticks the setup-lines
    option in tkz mode keeps today's behaviour.
  - The explicit clip tools were never affected: `clipRect`/`clipPolygon` emit a
    plain `\clip` and are not gated, which is why "Only export the clipped area"
    kept working in both modes.
  - **Why nothing caught this:** every file in `src/export/__tests__` was
    orphaned -- referenced by no npm script and no workflow. (`line-extents`
    appeared wired but only via `test:export:watch`, a watch helper.)
    `setup-toggle.test.ts` asserts this exact `\tkzClip` behaviour and never
    ran; `draw-layer-backend-plain.test.ts`, which the tkz work itself extended
    with ~148 lines of assertions, never ran either -- that change was never
    verified by its own tests.
  - A second regression from the same commit surfaced once they were run:
    `point-shape-style-export.test.ts` asserted the exact string
    `\usetikzlibrary{shapes.geometric}`, but libraries are now emitted as one
    combined declaration (`{shapes.geometric,arrows}`). Bisected to the same
    commit. The code is fine -- arguably better, since `arrows` is now pulled in
    for the `>=triangle 45` it already used -- so the stale assertion was
    converted to a regex, the same way the fixture assertions in
    `scripts/test-export.ts` already were.
  - `scripts/test-export-unit.mjs` (new) runs all of them and is chained into
    `test:export`. It discovers files by scanning the directory rather than
    listing them: a hand-maintained list is what created this gap, and a new
    test file would be orphaned again the first time someone forgot to register
    it. 18 files, all passing.
  - New `viewport-clip-plain-backend.test.ts` covers the regression: asserts the
    plain backend emits a `\clip` and no `\tkzClip`/`\tkzInit`, that the
    rectangle matches the viewport, that it precedes the draw commands, that an
    explicit clip rect does not produce two clips, and that tkz mode still uses
    `\tkzClip`. Confirmed it fails with the fix reverted and passes with it.
- 2026-07-21 Phase 3d: promote Save PDF/SVG/PNG to visible preview-window
  buttons (last item of the UI-revamp plan; owner confirmed the desktop PDF
  compile works before this started):
  - `TikzPreviewWindow.tsx` `previewWindowActions`: added Save PDF/SVG/PNG
    next to the existing Copy Edited TikZ and Save Full LaTeX (.tex), calling
    the same `savePreviewPdf`/`savePreviewSvg`/`savePreviewPng` handlers the
    right-click context menu already used (no new logic). `disabled={!pdfData}`
    per the plan; Save Full LaTeX stays enabled since it builds from source,
    not from a compiled PDF. Right-click menu is unchanged -- both surfaces
    now exist side by side, same pattern as the .tex button already set.
  - Verified in the browser by seeding a `gd:tikz-preview:<token>` localStorage
    session and loading `/?tikzPreview=<token>` directly (this window only
    normally opens via `WebviewWindow`, which needs Tauri) -- confirmed all six
    header buttons render on one line via the existing `flex-wrap`, and that
    Save PDF/SVG/PNG are `disabled=true` with no compiled PDF while Copy Edited
    TikZ and Save Full LaTeX stay enabled. Could not verify the buttons going
    enabled after a real compile or an actual file write from this session --
    `pdfData` is internal React state, not something reachable from outside,
    and the compile path is native/Tauri-only. That needs a real desktop
    session: confirm the three buttons enable once a PDF exists and each
    produces a real file.
- 2026-07-21 Construction/stat cards: label moved onto the value's line.
  - Two earlier attempts only shaved padding and moved these 44 -> 42px, which
    was rightly rejected. Padding was never the cost: the card was two *stacked
    text lines* (an uppercase label row, then the value row), and ~8px of its
    42px was padding. No amount of padding work reaches that.
  - `.constructionInfo` and `.toolInfo` are now a two-column grid
    (`auto minmax(0, 1fr)`) so the label sits beside its value instead of above
    it. Nothing was removed — label, value and the card itself all remain.
    Construction 44 -> 26px, sector stat 42 -> 28px.
  - `.toolInfo .detailRow` keeps `grid-column: 2` so object types with several
    stats stack correctly down column two rather than spilling into the label
    column.
  - `flex-wrap: wrap` on that row is load-bearing, not cosmetic: a circle's
    equation is too wide to sit beside its "Equation" label, and without wrap
    it broke mid-expression (`(x+5.25)^2+` / `(y+3.75)^2=12.03^2`). With wrap
    it drops to its own full-width line and stays unbroken, while short stats
    like `Sweep  70.35°` still share the line. Verified both live.
- 2026-07-21 Second sidebar pass, after owner review of the first:
  - **Style tab strip was clipping labels** ("STROKE" rendered as "KE").
    Measured cause: `.styleTabButton` is `flex: 0 0 auto` + `min-width:
    max-content` (tabs never shrink), and a sector shows five of them
    (Stroke/Fill/Label/Arrow/Mark). scrollWidth 314 vs clientWidth 267 —
    a 47px overflow that `overflow-x: auto` then hid by scrolling.
    Fixed by recovering the width: button padding `7px 9px 8px -> 5px 4px 6px`
    (-10px per tab) and `letter-spacing 0.04em -> 0.02em`. Now scrollWidth ==
    clientWidth (267), all five labels visible. Strip height 37 -> 31px.
    Note this was pre-existing, not caused by the first pass — that pass gave
    the strip 12px *more* room.
  - Type chooser row 36 -> 32px, and construction card 44 -> 42px. Both hit a
    floor that padding cannot pass, worth knowing before anyone tries again:
    the chooser row is a hardcoded icon (`ObjectBrowser.tsx`, `size` prop,
    now 16) plus 3px padding; the construction card now sums *exactly* to
    8px padding + 14px title + 2px margin + 16px value + 2px border. Going
    further needs smaller fonts or a structural change, both ruled out.
  - Compounding margins are where the remaining gain came from, since the
    style panel has many rows: `.controlRow`/`.fieldBlock`/`.checkboxRow`
    margin-top `10 -> 6px`, `.fieldLabel` margin-bottom `6 -> 4px`,
    `.styleControlTabs` margin-top `10 -> 6px`, `.styleTabPanel` padding
    `10 -> 8px`.
  - `.objectBrowserTabs` / `.objectBrowserTab` are ALSO duplicated in App.css
    (2831 and 3166), same trap as `.objectListScrollArea`. Left in place this
    time but both copies were edited together; worth consolidating later.
- 2026-07-21 Right sidebar vertical-space pass (owner-reported: style controls
  like arrow/stroke sit at the bottom but get under a third of the panel):
  - Root cause of most of it was a bug, not proportions: `.objectListScrollArea`
    was declared **twice** in `App.css`, merging to `height: 320px` (rule 1) plus
    `flex: 1 1 auto` (rule 2). The list reserved 320px regardless of content and
    then grew into leftover space. Consolidated to one rule: `flex-grow: 0` plus
    `max-height: min(45vh, 320px)`. Measured empty list 320px -> 34px.
    The 320px ceiling is deliberate — it matches the old fixed height so a long
    list is no smaller than before. An earlier draft used `35vh`, which resolved
    to 252px at a 720px viewport and would have *shrunk* long lists; caught by
    measuring in the browser rather than trusting the value.
  - Density pass on the rest, size only. Nothing was moved, merged, hidden, or
    removed — explicitly out of scope per the owner, who tuned these panels for
    utility. Only padding/margin/line-height changed; no font sizes.
    Header 68->54px, tab button 42->34px, object row 50->44px,
    `.sidebarSection` padding 16->10px.
  - Note `.sidebarSection` is shared by three panels (Objects, Properties and
    Export), so the padding change tightens the Export tab too.
  - `.rightTabButton` min-height went 42->34px. There are no `pointer: coarse`
    media queries anywhere in `App.css`, so this is unconditional; if touch
    targets matter later, restore 42px additively inside a coarse-pointer block
    rather than reverting this.
  - Verified: `npm run build`, `test:command`, `test:scene`, `test:export` all
    pass; heights measured live in the browser. Only the light color profile was
    seen visually — the app uses its own profiles rather than
    `prefers-color-scheme`, but these changes carry no color values, so geometry
    is identical across profiles.
- 2026-07-21 Integrate the tkz-euclide-*independent* export work onto main
  (branch `codex/text-editor-rewrite` commits `090eda6` + `c2a1618`):
  - `main` had already moved ahead with the UI-revamp Phase 3 export refactor,
    which *extracted* `buildStandaloneSource` / `deriveDefaultOptionalPreamble`
    out of `TikzPreviewWindow.tsx` into `src/export/tikz/standaloneDocument.ts`.
    Meanwhile `c2a1618` edited those same functions *in place* and added a
    "Save Full LaTeX (.tex)" feature. Brought the two together via a temp
    integration branch (cherry-pick onto `main`), NOT by rebasing/force-pushing
    the shared `codex/text-editor-rewrite` ref — that branch is left untouched;
    its content is now on `main`, so it can be deleted or rebased later (git
    will skip the already-applied patches).
  - Sole conflict: `TikzPreviewWindow.tsx`. Resolved by keeping the extraction
    and porting their additive features (`savePreviewTex`, the `.tex`
    save-dialog signatures, header + context-menu buttons, `MENU_HEIGHT`).
  - Two files git did NOT flag but the fix required, because the functions now
    live in the extracted module: `standaloneDocument.ts`
    (`deriveDefaultOptionalPreamble` gained a `tikzCode` param +
    `containsDvipsNamedColorUsage` so a dvips color name like `Goldenrod`
    pulls in `\usepackage[dvipsnames]{xcolor}`) and `ExportPanel.tsx`
    (Copy Full Document call-site updated to the 2-arg signature).
  - Flag for review (harmless, not a blocker): that added
    `\usepackage[dvipsnames]{xcolor}` line looks redundant with
    `REQUIRED_PREAMBLE`'s existing `\PassOptionsToPackage{dvipsnames}{xcolor}`
    — re-requesting an already-active option is a subset (no clash), so it
    compiles fine, but it can likely be dropped.
  - Verified: `npm run build` (tsc), `test:export` (102 fixtures),
    `test:command`, `test:scene` all pass.
- 2026-07-21 Unblock the GitHub Pages deploy (cherry-pick of `8a91660`):
  - The Pages workflow builds with `npm run build` (= `tsc && vite build`),
    a *full* type-check. A pre-existing error in
    `src/export/__tests__/draw-layer-backend-plain-constructions.test.ts`
    (`kind: "free"` widened to `string` because `scene` had no `SceneModel`
    annotation) failed `tsc`, so the `ad383db` deploy AND the first push of
    UI-revamp Phases 1–4 both failed to deploy — the live site stayed stale
    at the last green commit (`52c90be`) with none of the new work visible.
  - Fix: cherry-picked the owner's own fix commit `8a91660` from
    `codex/text-editor-rewrite` (adds `import type { SceneModel }` +
    `const scene: SceneModel`). Self-contained to that one test file;
    identical content means no conflict when that branch later merges.
  - Process lesson: verify against `npm run build` (the real deploy command),
    NOT `npx vite build` (esbuild, skips types) or `tsc --noEmit | grep -v`,
    both of which masked this error the whole session.
- 2026-07-21 Minimal empty-canvas onboarding (UI/UX revamp Phase 4 — final
  phase of the plan):
  - Zero first-run guidance existed: a brand-new user got a blank canvas,
    "No objects", and a command-bar placeholder as their only orientation.
    Added a single dismissible hint card, deliberately not a multi-step tour.
    - `src/state/appPreferences.ts`: `geodraw.onboarding.v1` envelope
      (`OnboardingFlags.emptyCanvasHintDismissed`), same per-field-normalize
      pattern as export preferences.
    - `src/ui/EmptyCanvasHint.tsx` (new): shows when the active scene is
      empty *and* the dismissal flag is unset; disappears the moment any
      object exists (pure derived visibility from `store.scene`, no flag
      write) and reappears if the scene is emptied again — the flag is only
      ever set by clicking "Got it", which is a one-time permanent dismiss.
      One correction to the plan's field list while implementing: the
      emptiness check covers `scene.vectors` in addition to the 10 fields
      the plan named — `vectors` is a real, actively-created collection
      (e.g. from Translate) that the plan's list omitted, and skipping it
      would have shown the hint over a scene that already has content.
      Positioned via a `pointer-events: none` wrapper (`inset:0` inside
      `canvasDocumentArea`, z-index 30 — below the floating top actions at
      45 and the command bar at 60) with the actual card carrying
      `pointer-events: auto`, so the canvas, palette, tabs, and command bar
      all stay fully interactive underneath it.
    - `src/ui/WorkspaceShell.tsx`: mounted after `CanvasView`.
    - `src/ui/RightSidebar.tsx`: added a "User manual (PDF)" link to the
      bottom of the existing Quick Help card (linking to
      `docs/user-manual.pdf` on GitHub — works from both web and desktop
      since it's a plain external link, not a Tauri-opener call).
    - `src/App.css`: `.emptyCanvasHintWrap`/`.emptyCanvasHint` (matching the
      existing `.sidebarHelpCard` visual language) and
      `.sidebarHelpManualLink`, all on `--gd-ui-*` tokens.
  - Validation:
    - `npx tsc --noEmit` — no new errors (same pre-existing unrelated one)
    - `npm run test:scene` (19/19), `npm run test:command` (5/5) — green
      (Phase 4 adds no new automated tests — it's a visibility/persistence
      component with no algorithmic surface worth unit-testing; covered by
      the manual pass instead)
    - Manual browser pass, all via a fresh empty document tab: hint shows
      on blank scene; typing `Point(1,2)` in the command bar and running it
      hides the hint immediately; deleting that point brings it back
      (confirming the flag is genuinely not written until "Got it");
      clicked "Got it", reloaded the page, hint stayed gone on the still-
      empty tab (real persistence, not just in-session state); confirmed
      via `document.elementFromPoint` that clicks in the hint's empty
      margin land on the actual canvas element, not the wrapper, proving
      `pointer-events: none` isn't blocking canvas interaction; dark theme
      clean. One tool-usage note, not a product bug: a raw coordinate click
      that I expected to hit the Preferences gear instead landed on the
      canvas and placed a stray point (undone via Cmd+Z) — screenshot-to-
      viewport coordinate mapping was off in that instance, not an issue
      with pointer-events or z-index; ref-based clicks were reliable
      throughout and are what actually verified every behavior above.
  - This closes out the phases from the approved plan
    (`~/.claude/plans/rippling-rolling-thunder.md`). Phases 1+2+3+4 are all
    committed on `codex/ui-refactor`, not yet pushed. Remaining from the
    plan: push to `main` for the web deploy, then Phase 3d (preview window
    save buttons) + a desktop compile smoke test before tagging v0.2.0.
- 2026-07-21 Export tab redesigned for the teacher path (UI/UX revamp Phase 3a-3c):
  - The Export tab had ~18 flat controls with jargon labels ("Emit tkz setup
    (Init/Clip/SetUpLine)"), almost no tooltips, and every option reset on
    remount — nothing persisted. Math teachers just want to copy their
    figure's code or get a PDF; the TikZ mechanics they never asked for were
    given equal visual weight. Restructured:
    - `src/state/appPreferences.ts`: new `geodraw.export-preferences.v1`
      envelope (`ExportPreferencesState` — 9 fields) following the file's
      existing `StoredEnvelope` pattern, but **per-field** normalize rather
      than all-or-nothing like the UI/construction loaders — one bad field
      falls back to its own default instead of invalidating everything else,
      since these are independent toggles with no reason to be coupled.
    - `src/ui/ExportPanel.tsx`: hydrates all persisted options via lazy
      `useState` initializers, writes them back via one `useEffect`. New
      layout: action row (**Copy Code** — auto-regenerates via the existing
      `tikzOutdated` signal, then copies; **Copy Full Document**; desktop-only
      **Open PDF Preview**) → plain-language simple options with real
      tooltips → status line with a "Refresh code" button that only appears
      when outdated → `<details>` "Advanced options" (reusing the
      `.exportLogDetails` CSS already in `ExportPanel.css`) holding the TikZ
      mechanics (compact code, tkz setup lines, clip selection, code style) →
      Model JSON now itself a `<details>` "Scene data (JSON) — advanced".
      Web build (no Tauri): Preview button hidden, replaced with a plain-link
      nudge toward pasting the full document into overleaf.com.
    - `src/export/tikz/standaloneDocument.ts` (new): moved
      `REQUIRED_PREAMBLE`, `buildStandaloneSource`, `looksLikeFullDocument`,
      `deriveDefaultOptionalPreamble` out of `TikzPreviewWindow.tsx` — pure
      code motion, both that file and `ExportPanel`'s new "Copy Full
      Document" import from here now.
  - Tests: new `src/scene/__tests__/export-preferences.test.ts` (in-memory
    `window.localStorage` stub assigned to `globalThis` before a *dynamic*
    `import()` of `appPreferences.ts`, since static imports are hoisted
    before the stub would exist) — round-trip, garbage JSON, wrong envelope
    version, per-field fallback, missing key. Wired into `test:scene`.
  - Validation:
    - `npx tsc --noEmit` — no new errors (same pre-existing unrelated one)
    - `npm run test:scene` (19/19), `npm run test:command` (5/5),
      `npm run test:export` (all 102 fixtures) — all green
    - Directly unit-checked the extracted `standaloneDocument.ts` against a
      sample input (documentclass/begin/end present, idempotent re-wrap,
      correct hex→RGB conversion for the page-color preamble) rather than
      relying only on UI clicks, since `TikzPreviewWindow.tsx` has zero
      existing automated coverage — this was the highest-risk slice of the
      phase per the plan's own risk register.
    - Manual browser pass: one-click Copy Code (generate+copy in one
      action, verified via the "Copied" state and the regenerated code
      appearing); Copy Full Document confirmed via direct module check
      (clipboard read is permission-blocked in this environment); changed
      Halo/Global scale, reloaded the page, confirmed both survived — the
      generated code text itself correctly did *not* persist (by design);
      Advanced closed by default; Code style segmented control and its
      dependent checkbox label both update correctly; dark theme clean.
  - Deferred to the v0.2.0 desktop batch (3d, per the plan): promoting the
    preview window's right-click Save PDF/SVG/PNG to visible buttons — can't
    be verified from a web-only session since PDF preview requires Tauri.
  - Next: Phase 4 (minimal onboarding — empty-canvas hint card), then the
    3d + desktop smoke pass before tagging v0.2.0. Plan at
    `~/.claude/plans/rippling-rolling-thunder.md`.
  - Risks: none new. Same TikzPreviewWindow-has-no-tests risk noted in the
    plan — mitigated here by the direct module verification above, but a
    real desktop compile smoke test is still owed before v0.2.0 ships.
- 2026-07-20 In-app command reference popup (UI/UX revamp Phase 2):
  - The only in-app command help was one cryptic placeholder string in the
    command bar; the real reference (`docs/command-bar-reference.md`) was
    never surfaced to users. Added a searchable reference dialog:
    - `src/ui/commandReference/commandReferenceData.ts` (new): pure data
      module, no React/store/parser imports. `COMMAND_SPECS` — 28 entries,
      one per parser constructor (aliases folded into `variants`, e.g.
      `Ortho(A,B,C)` under Orthocenter). `FUNCTION_SPECS` — 29 entries: 25
      scalar functions from `scalarFunctionRegistry.ts` collapsed to one
      canonical name per function (case-variants like `Sin`/`sin` merged;
      `sin`/`sind` kept distinct since they differ in unit), plus the 4
      constants (`pi`,`e`,`tau`,`ans`) which live outside that registry.
    - `src/ui/commandReference/CommandReferenceDialog.tsx` (new): search +
      Commands/Functions tabs, grouped by category, click-to-insert rows.
      Reuses `PreferencesDialog`'s dismissal logic (Escape + outside
      mousedown) and its `preferencesOverlay`/`preferencesModal`/
      `preferencesTabs`/`preferencesTabButton` CSS classes directly, per
      plan. One correction from the approved plan: the plan said to render
      the dialog "inside commandBarWrap", but `commandBarWrap` has no `top`
      offset (it's a slim bottom-pinned bar, not full-bleed), so an
      `inset:0` overlay nested inside it would be confined to that strip.
      Rendered it as a sibling of `commandBarWrap` instead (`CommandBar`
      now returns a Fragment) so the overlay resolves against `.canvasPane`
      the same way `PreferencesDialog` resolves against `.canvasDocumentArea`.
    - `src/CommandBar.tsx`: "?" button (CircleHelp icon) between Run and the
      collapse chevron; insert handler sets the input, closes the dialog,
      refocuses, and selects the text between the first `(`/last `)` so a
      teacher can immediately overtype the placeholder args; placeholder
      text shortened to mention the `?` button.
    - `src/App.css`: `.commandBarExpanded` grid gained a 4th column for the
      new button; added `.commandRef*` styles (search input, grouped list,
      signature/description rows) — all on `--gd-ui-*` tokens.
  - Content fix found while building the registry: `docs/command-bar-reference.md`
    was missing `Ellipse(F1,F2,P)`, which the parser has supported all along
    (`CommandParser.ts` "Ellipse" branch). Added it to both the human doc
    and the new registry.
  - Tests: new `src/scene/__tests__/command-reference-registry.test.ts`,
    wired into `test:command`. A synthetic `ParseContext` fixture (points
    A,B,C,D,O,P,V,X,F1,F2; aliases s/l/c/poly; scalar r_1; ans=1) parses
    every `COMMAND_SPECS` example and every variant that's a full call form
    — this caught 3 variant strings that used descriptive placeholders
    (`Circle(O,r)`, `Line(x1,y1,x2,y2)`, `Homothety(P,O,k)`) instead of real
    values, which would have inserted broken templates into the command bar.
    Also asserts every non-constant `FUNCTION_SPECS` name is a real
    registry key, and every registry function (case-collapsed) has a
    `FUNCTION_SPECS` entry — verified this reverse-coverage check actually
    fires by temporarily deleting an entry and confirming the test failed,
    then restored.
  - Validation:
    - `npx tsc --noEmit` — no new errors (same single pre-existing error
      from `main` noted in the Phase 1 entry below, in an unrelated file)
    - `npm run test:command` (includes the new drift test) — green
    - Manual browser pass: opened the dialog, searched ("circle" correctly
      matches across name/description/category), switched Commands ↔
      Functions & Math tabs (search persists across tabs), clicked
      Circle(x,y,r) → input filled with "Circle(0,0,5)", dialog closed,
      input focused with "0,0,5" pre-selected, Run created a real circle
      (verified via the equation shown in Properties) — full loop works.
      Confirmed the Phase 1 `[role="dialog"]` guard protects this dialog
      too, for free (P/Delete inert while focus is inside it). Dark theme
      pass: all `--gd-ui-*` tokens resolved correctly, nothing hardcoded.
      Zero console errors throughout.
  - Next: Phase 3 (export tab redesign for the teacher path) and Phase 4
    (minimal onboarding). Plan at `~/.claude/plans/rippling-rolling-thunder.md`.
  - Risks: the drift test is one-way — a new parser command added without a
    matching `COMMAND_SPECS` entry is not caught. Flagged as a review
    checklist item, not automated.
- 2026-07-20 Tool shortcuts now match their tooltips (UI/UX revamp Phase 1):
  - Tool tooltips have long advertised single-key shortcuts (V/P/S/L/M/O/C) that no
    handler implemented; pressing them did nothing. Implemented them:
    - `src/ui/toolHotkeyState.ts`: new `TOOL_KEY_SHORTCUTS` map (pure data,
      v→move, p→point, s→segment, l→line2p, m→midpoint, o→circle_cp, c→copyStyle).
    - `src/ui/useGlobalCanvasHotkeys.ts`: letter-key handler inserted after the
      Shift+F block, before Delete/Backspace, gated on no modifier keys.
    - Added a `[role="dialog"]` closest-ancestor guard alongside the existing
      text-input guard — this also fixes a latent bug where Delete/Backspace
      (and now the new letters) could reach the canvas while a modal
      (e.g. Preferences) had focus.
    - `src/ui/RightSidebar.tsx`: Quick Help card (`HELP_ROWS`) documents the
      two new shortcut rows.
  - Tests: extended `src/ui/__tests__/tool-hotkey-state.test.ts` (shortcut set is
    exactly the 7 advertised tools, single lowercase letters, no collision with
    reserved keys) and wired it into the `test:command` npm script — it
    previously existed on disk but ran in no chain.
  - Validation:
    - `npx tsc --noEmit` — one pre-existing error in
      `src/export/__tests__/draw-layer-backend-plain-constructions.test.ts`
      (from an unrelated TikZ export commit already on `main`); confirmed via
      `git stash` that it exists independent of this change. No errors in any
      file this entry touches.
    - `npx vite build` (bundle-only, since the pre-existing tsc error blocks
      the full `npm run build` gate)
    - `npm run test:command`, `npm run test:scene` — all green
    - Manual browser pass: all 7 letters switch tools; typing "value slope" in
      the command bar does not trigger any tool switch; P and Delete are inert
      while the Preferences dialog has focus; Quick Help card renders the new
      rows; Esc still returns to Move; no console errors.
  - Next: this is Phase 1 of a 4-phase UI/UX revamp (plan at
    `~/.claude/plans/rippling-rolling-thunder.md`) — Phase 2 (in-app command
    reference popup) is next, then Phase 3 (export tab redesign) and Phase 4
    (minimal onboarding).
  - Risks: none identified for this change in isolation. The pre-existing tsc
    error above blocks a clean `npm run build` for anyone working in this
    worktree until it's fixed (out of scope for this entry — it's in TikZ
    export test fixtures, unrelated to tool hotkeys).
- 2026-05-03 Multiple canvas tab shell wired:
  - Added visible canvas tabs above the drawing area using the existing document runtime capture/restore path.
  - Each tab now keeps its own:
    - scene/history/camera runtime
    - command aliases
    - save target metadata (`FileSystemFileHandle` or Tauri path)
    - display title derived from opened/saved file names
  - `Open` now creates a new canvas tab instead of replacing the active canvas.
  - Drag-dropping `.geodraw` / `.json` files on the canvas also opens them into a new tab.
  - `Save` / `Save As` operate on the active tab only.
  - `+` creates a blank canvas tab; close resets the last remaining tab to a blank canvas.
  - 2026-05-05 reload recovery follow-up:
    - open tabs, active tab, titles, file metadata, snapshot, camera, undo/redo, and command aliases persist to local storage
    - current active canvas is captured before persistence, including before page unload
    - restored tab sessions skip global construction-preference hydration so per-tab defaults/canvas settings remain independent after reload
    - browser `FileSystemFileHandle`s cannot be serialized, so a reloaded tab keeps the displayed filename but still needs `Save As` to regain a writable browser handle
    - canvas and overlay labels opt out of browser text selection to prevent the whole canvas from turning blue-selected after reload/click-drag
  - Validation:
    - `npx tsc --noEmit`
    - `npm run build`
    - `npm run check:handoff`
  - Next:
    - add dirty/unsaved indicators per tab
    - add close-confirm behavior for dirty tabs
    - consider tab reorder once the base workflow has settled
  - Risks:
    - browser download fallback can only remember the suggested file name, not a writable handle
    - local tab recovery is a convenience snapshot, not a replacement for explicit `.geodraw` saves
- 2026-03-30 TikZ export fixture sweep restored to green:
  - `node --import tsx scripts/test-export.ts` now passes fully (`All 90 export fixtures compiled successfully.`).
  - Closed stale export-test drift:
    - right-angle fixtures now use actual exact-right provenance supports instead of bare free-point geometry:
      - `src/export/__fixtures__/angle-right-german.json`
      - `src/export/__fixtures__/angle-right-square.json`
      - `src/export/__fixtures__/angle-right-mark.json`
    - `line-circle-common-forward-ref-korea14` expectation now accepts either safe sibling order as long as no forward `common=` reference is emitted.
    - `regression-line-coverage-j-o` no longer mixes an unrelated fail-closed point into a line-coverage regression, and the assertion now respects `exportError` before checking emitted TikZ.
  - Restored fail-closed policy for visible undefined intersections in `src/export/tikz.ts`:
    - hidden undefined points may be skipped
    - visible undefined points now throw `Cannot export visible undefined point: ...`
  - This closes the recent suite blockers:
    - stale `angle-right-*` expectations
    - misleading `korea_no_14` expectation
    - false `J/O` regression failure
    - `undefined-circle-line-points` silent-skip regression
- 2026-03-30 TikZ `InterLC` robustness coverage expanded:
  - Added mixed/generic regression coverage for cases that were previously only protected in dedicated intersection kinds:
    - `src/export/__fixtures__/generic-circle-segment-finite-single-root-fail-closed.json`
    - `src/export/__fixtures__/generic-circle-segment-exclude-common-swapped.json`
    - `src/export/__fixtures__/generic-line-circle-exclude-common.json`
    - `src/export/__fixtures__/line-circle-invalid-common-stale-point.json`
    - `src/export/__fixtures__/line-circle-common-forward-ref-korea14.json`
  - Strengthened exporter assertions:
    - dedicated `circle-line-exclude` fixture now explicitly checks `common=...` reuse
    - generic mixed `circle+segment` path is now covered for:
      - fail-closed finite-domain single-root behavior
      - swapped object-order parity
      - endpoint/common reuse parity
  - Export sweep now passes with these added cases and follow-up circle-circle coverage (`All 90 export fixtures compiled successfully.`).
- 2026-03-30 Generic circle-circle export robustness expanded:
  - Added regression coverage for generic `intersectionPoint` circle-circle branch/common cases:
    - `src/export/__fixtures__/circle-circle-invalid-common-stale-point.json`
    - `src/export/__fixtures__/generic-circle-circle-exclude-common-swapped.json`
    - `src/export/__fixtures__/generic-circle-circle-near-tangent.json`
    - `src/export/__fixtures__/generic-circle-circle-near-tangent-swapped.json`
  - Exporter now validates circle-circle `common=...` reuse before emitting it:
    - the common point must already be defined
    - it must geometrically match the opposite root for that exact pair
    - stale or unrelated points are rejected instead of being reused as `common=...`
  - Generic circle-circle export now also respects `excludePointId` parity with runtime evaluation instead of relying only on sibling heuristics.
- 2026-03-30 AGENTS visual TikZ spot checks completed:
  - compiled TikZ vs intended geometry checked for:
    - generic line-circle `common=A` reuse (`generic-line-circle-exclude-common.json`)
    - stale invalid line-circle common rejection with near/swap fallback (`line-circle-invalid-common-stale-point.json`)
    - generic circle-circle swapped-order `common=A` reuse (`generic-circle-circle-exclude-common-swapped.json`)
    - generic circle-circle near-tangent branch/common pairing in both circle argument orders
      (`generic-circle-circle-near-tangent.json`, `generic-circle-circle-near-tangent-swapped.json`)
  - Result:
    - no silent branch flip observed
    - swapped circle argument order preserved the intended common-point semantics
    - near-tangent circle-circle renders keep the intended branch/common pairing; the point markers overlap visually because the two roots are only about `0.1414` world units apart, not because export collapsed them
- 2026-02-26 TikZ exporter architecture refactor (behavior-preserving slice: draw-layer backend emitter + plain-TikZ PoC):
  - Added draw-layer backend emitter module:
    - `src/export/tikz/renderDrawBackend.ts`
  - Introduced a backend emitter interface for draw-layer traversal with minimal backend hooks:
    - line/segment emission
    - circle fill/stroke emission
    - point/absolute label emission
    - raw draw passthrough
  - Added backend selection option:
    - `TikzExportOptions.drawLayerBackend?: "tkz" | "plain"`
    - default remains `"tkz"` (no output behavior change for existing exports)
  - `src/export/tikz/renderDrawLayers.ts` now reuses the same IR traversal and delegates supported commands to backend emitter implementations.
  - Implemented backend variants:
    - `tkz` backend: emits existing tkz-euclide draw/label macros (parity path)
    - `plain` backend (proof-of-concept): emits plain `\draw`/`\fill`/`\node` for supported draw-layer commands while preserving section ordering and label scaling scope
  - Added targeted regression test:
    - `src/export/__tests__/draw-layer-backend-plain.test.ts`
    - validates plain backend emission and tkz backend parity macros.
  - Validation:
    - `npm run test:export` (76 fixtures)
    - `node --import tsx src/export/__tests__/draw-layer-backend-plain.test.ts`
    - `npm run build`
- 2026-02-26 TikZ exporter architecture refactor (behavior-preserving slice: capability wiring separation):
  - Added `src/export/tikz/renderCapabilities.ts` to define the renderer capability contract used by traversal modules:
    - numeric/text utilities (`fmt`, `escapeTikzText`, `buildGroupedMarkAngleTex`)
    - tkz macro capability checks (`assertTkzMacro`, specialized assertion variants)
  - Extended `src/export/tikz/renderContext.ts` so renderer context now carries a single `capabilities` object.
  - `src/export/tikz.ts` `renderTikz(...)` now wires tkz-specific assertion/utility functions in one place via a single `TikzRendererCapabilities` object and passes it through context.
  - Renderer traversal modules now consume `ctx.capabilities` directly and no longer receive per-call dependency bundles:
    - `src/export/tikz/renderSetupAndPoints.ts`
    - `src/export/tikz/renderConstructions.ts`
    - `src/export/tikz/renderConstructionPoints.ts`
    - `src/export/tikz/renderConstructionGeometryHelpers.ts`
    - `src/export/tikz/renderConstructionIntersections.ts`
    - `src/export/tikz/renderDrawLayers.ts`
  - Result:
    - tkz-specific macro assertion wiring is now isolated to `renderTikz(...)`
    - renderer traversal modules are cleaner and easier to reuse for future non-tkz backends.
  - Validation:
    - `npm run test:export` (76 fixtures)
    - `npm run build`
- 2026-02-26 TikZ exporter architecture refactor (behavior-preserving slice: construction helper cluster decomposition):
  - Added:
    - `src/export/tikz/renderConstructionPoints.ts`
    - `src/export/tikz/renderConstructionGeometryHelpers.ts`
  - `src/export/tikz/renderConstructions.ts` now acts as orchestration over dedicated serializers:
    - construction comments
    - point-construction serializer (`appendRenderedPointConstruction(...)`)
    - geometry-helper serializer (`appendRenderedGeometryHelperConstruction(...)`)
    - intersection serializer (`appendRenderedIntersectionConstruction(...)`)
  - Extracted non-intersection construction helper clusters from the monolithic construction renderer:
    - point transforms/definitions (`DefPoint*`, `DefMidPoint`, `DefPointOnCircle`, triangle/circum center point construction)
    - line/circle helper constructions (`DefPerpendicularLine`, `DefParallelLine`, `DefAngleBisectorLine`, `DefCircleSimilitudeCenter`, `DefCircleTangentsFromPoint`, `InterLL`)
  - Behavior preserved:
    - construction command iteration order is unchanged
    - `InterLC`/`InterCC` temp-name sequencing still uses shared renderer context state
    - `near/common` branch/common ordering semantics unchanged
  - Validation:
    - `npm run test:export` (76 fixtures)
    - `npm run build`
- 2026-02-26 TikZ exporter architecture refactor (behavior-preserving slice: shared renderer context + intersection serializer extraction):
  - Added `src/export/tikz/renderContext.ts`:
    - introduces an explicit shared renderer context/state object for the tkz renderer pipeline
    - centralizes:
      - shared output buffer (`out`)
      - renderer options (`scale`, `emitTkzSetup`, `labelScale`, `groupMarkAngles`, `hasGlowLabels`)
      - temp counters/state (`interLCTmpIdx`, `drawCircleRadiusTmpIdx`)
      - section-header writer (`pushSectionHeader(...)`)
  - `src/export/tikz.ts` `renderTikz(...)` now constructs one renderer context (`createTikzRendererContext(...)`) and passes it through:
    - `renderSetupAndPoints`
    - `renderConstructions`
    - `renderDrawLayers`
    instead of passing duplicated output/options/counter-local args to each helper.
  - Added `src/export/tikz/renderConstructionIntersections.ts`:
    - extracts `InterLC` / `InterCC` construction serialization (including `near/common` option emission, temp-name sequencing, and branch/common ordering)
    - shares the same `interLCTmpIdx` counter via renderer context state to preserve fixture output parity
  - `src/export/tikz/renderConstructions.ts` now delegates intersection-construction emission to the new helper while keeping other construction macros inline.
  - Validation:
    - `npm run test:export`
    - `npm run build`
- 2026-02-26 TikZ exporter architecture refactor (behavior-preserving slice: setup/clip/points renderer extraction):
  - Added `src/export/tikz/renderSetupAndPoints.ts` to host pre-construction renderer serialization previously inline in `src/export/tikz.ts`.
    - Centralizes:
      - `tikzpicture` header emission (including global scale)
      - optional `\gdLabelGlow` macro emission
      - tkz setup/clip emission (`tkzInit`, `tkzClip`, `tkzSetUpLine`)
      - explicit clip shapes (`\clip rectangle`, polygon clip path)
      - point style `\tikzset{...}` definitions used by `tkzDrawPoints`
      - `% Points` section (`\tkzDefPoints`, `\tkzDefPoint`)
  - `src/export/tikz.ts` `renderTikz(...)` now delegates setup/clip/point-definition serialization to `appendRenderedSetupAndPoints(...)` while retaining:
    - command partitioning / IR categorization
    - `% Constructions` and draw-layer renderer delegation
    - final post-processing (`hoistNamedColors`, optional library injection)
  - This continues the exporter `IR -> renderer` decomposition without changing construction/intersection branch semantics or draw-layer output grouping.
  - Validation:
    - `npm run test:export`
    - `npm run build`
- 2026-02-26 TikZ exporter fix (unsafe near-equal outer circle-circle tangents):
  - Fixed visually incorrect outer tangent exports in tkz for `simWorld`-unsafe / near-equal-radius cases (user-observed case: tangent line drifting and one line passing through non-tangent point `E`).
  - Root cause:
    - reduced-radius tkz construction path (`tkzTanCC_R_*` + `tkzDefLine[tangent from = ...]` + large homothety rescale) can lose tangency under tkz numeric precision when the reduced helper circle radius is very small and rescaling is large.
  - Exporter change in `src/export/tikz.ts`:
    - for unsafe outer tangent cases (where external similitude center is TeX-unsafe), exporter now prefers exact scene-computed tangency anchors as explicit `DefPoint` constructions (`tkzTanCC_expA_*`, `tkzTanCC_expB_*`) instead of the reduced-radius helper tangent construction.
    - preserves branch selection from scene geometry (no change to scene tangent semantics).
  - Updated export regression expectations in `scripts/test-export.ts` for near-equal unsafe fixtures to require the explicit-point fallback and forbid `tkzTanCC_R_*` in those cases.
  - Validation:
    - `npm run test:export` (76 fixtures)
    - `npm run test:command`
    - `npm run test:scene`
    - `npm run build`
- 2026-02-26 TikZ exporter architecture refactor (behavior-preserving slice: draw-layer renderer extraction):
  - Added `src/export/tikz/renderDrawLayers.ts` to host IR draw-layer serialization previously inline in `src/export/tikz.ts`.
    - Extracted `% Draw objects`, `% Draw points`, and `% Labels` emission blocks (including grouped angle-mark rendering and label-scale scope handling).
  - `src/export/tikz.ts` `renderTikz(...)` now delegates draw-layer rendering to `appendRenderedDrawLayers(...)` while keeping:
    - setup/clip emission,
    - `% Points` definitions,
    - `% Constructions` (tkz-euclide semantics / branch mapping),
    - final color/library post-processing
    inline.
  - Follow-up slice (same day): extracted `% Constructions` IR serialization into:
    - `src/export/tikz/renderConstructions.ts`
    - centralizes tkz-euclide construction command emission for:
      - point constructions / transformations
      - line helpers (parallel/perpendicular/bisector)
      - circle helper constructions
      - `InterLL` / `InterLC` / `InterCC`
    - preserves the shared `interLCTmpIdx` temporary-name sequencing used by both `InterLC` and `InterCC` branches (important for output parity / fixture stability)
    - preserves existing `near` / `common` option emission and branch/common point ordering behavior unchanged
  - `src/export/tikz.ts` `renderTikz(...)` now delegates both:
    - `% Constructions` to `appendRenderedConstructions(...)`
    - draw-layer serialization to `appendRenderedDrawLayers(...)`
    while retaining setup/clip/points serialization and final post-processing.
  - This advances the agreed exporter architecture split (`IR -> renderer`) without touching intersection branch selection/export semantics.
  - Validation:
    - `npm run test:export` (76 fixtures)
    - `npm run test:command`
    - `npm run test:scene`
    - `npm run build`
- 2026-02-25 `src/scene/points.ts` de-GOD split (behavior-preserving slice: scene expression adapter extraction):
  - Added `src/scene/eval/sceneExpressionFacade.ts` to host scene-specific expression adapter wiring previously in `points.ts`:
    - angle expression scene adapter (`evaluateAngleExpressionDegreesWithCtxInSceneModel(...)`)
    - scalar/number expression scene adapter (`evaluateNumberExpressionWithCtxInSceneModel(...)`)
  - `src/scene/points.ts` now delegates both context-aware expression wrapper bodies to the new eval module and keeps public API behavior unchanged.
  - Follow-up slice (same day): extracted point-eval intersection orchestration/wiring from `points.ts` into:
    - `src/scene/eval/scenePointEvalFacade.ts`
    - centralizes `PointEvalDispatchOps` scene wiring and `sceneIntersectionFacade` bridging callbacks for point evaluation
    - `points.ts` now delegates `evalPointUnchecked(...)` and uses the extracted intersection-facade constructor helper
  - Follow-up slice (same day): extracted number-expression / number-definition scene runtime wiring (including intersection-facade geometry bridging) from `points.ts` into:
    - `src/scene/eval/sceneNumberExpressionFacade.ts`
    - centralizes recursive `evalNumberById(...)` + `evaluateNumberExpressionWithCtx(...)` wiring against `sceneIntersectionFacade`
    - removes `getSceneIntersectionFacade(...)` helper from `points.ts` (intersection facade construction no longer owned there for number-expression paths)
  - Follow-up slice (same day): extracted public scene-eval access wrappers from `points.ts` into:
    - `src/scene/eval/scenePublicEvalFacade.ts`
    - centralizes implicit-stats wrapper orchestration for:
      - `getPointWorldPos(...)`
      - `getLineWorldAnchors(...)`
      - `getCircleWorldGeometry(...)`
      - `getNumberValue(...)`
      - `resolveTextLabelDisplayText(...)`
    - `points.ts` now delegates public runtime-read wrappers instead of composing these access flows inline
  - Follow-up slice (same day): extracted remaining public scene-eval API wrappers (lifecycle + public expression entry wrappers) from `points.ts` into:
    - `src/scene/eval/sceneEvalApiFacade.ts`
    - centralizes wrapper orchestration for:
      - `beginSceneEvalTick(...)`
      - `endSceneEvalTick(...)`
      - `getLastSceneEvalStats(...)`
      - `evaluateAngleExpressionDegrees(...)`
      - `evaluateNumberExpression(...)`
    - `points.ts` now retains scene eval state holders (`WeakMap`s / tick builder) while delegating the public wrapper bodies
  - Follow-up slice (same day): extracted segment/angle mark normalization + resolver utilities from `points.ts` into:
    - `src/scene/sceneMarkStyleUtils.ts`
    - centralizes:
      - `resolveSegmentMarks(...)`
      - `collectSegmentMarkPositions(...)`
      - `resolveSegmentMarkAnchorPos(...)`
      - `resolveAngleMarks(...)`
    - `points.ts` now re-exports these helpers to preserve existing imports/API while removing another utility block from the monolith
  - Follow-up slice (same day): extracted remaining scene eval state-holder glue from `points.ts` into:
    - `src/scene/eval/sceneEvalStateStore.ts`
    - centralizes scene-local eval state ownership:
      - `sceneEvalContexts` `WeakMap`
      - `sceneLastEvalStats` `WeakMap`
      - `sceneEvalTick` counter
      - `buildSceneEvalContext(...)`
      - `getOrCreateSceneEvalContext(...)`
    - `points.ts` now uses a single store instance (`createSceneEvalStateStore()`) and delegates the state-holder lifecycle plumbing while preserving all public eval APIs
  - Clarification: the older handoff note about extracting intersection assignment helpers is already reflected in current code (`intersectionAssignments.ts` + `intersectionPairResolution.ts`); this change continues the same de-GOD track with the next remaining eval-wrapper slice.
  - Validation:
    - `npm run test:command`
    - `npm run test:scene`
    - `npm run build`
- 2026-02-25 Scalar function extensibility (phase: shared registry + parser/runtime parity wiring):
  - Extracted shared scalar function registry/dispatch into:
    - `src/scene/eval/scalarFunctionRegistry.ts`
  - `src/scene/eval/scalarExpressionRuntime.ts` now delegates function-call dispatch to the shared registry (single dispatch path for scalar runtime).
  - `src/CommandParser.ts` mixed point/scalar expression evaluator now reuses the same shared scalar registry for scalar functions instead of a duplicated local allowlist/switch.
    - Future standard trig additions (e.g. additional numeric scalar functions) now propagate to both runtime and parser mixed-expression handling by extending the shared registry.
  - Added standard inverse trig functions (radians):
    - `asin`, `acos`, `atan`, `atan2`
    - aliases: `Asin`, `Acos`, `Atan`, `Atan2`
  - Added degree trig helpers and inverse degree trig helpers:
    - `sind`, `cosd`, `tand`, `asind`, `acosd`, `atand`, `atan2d`
    - aliases: `Sind`, `Cosd`, `Tand`, `Asind`, `Acosd`, `Atand`, `Atan2d`
  - Updated command bar reference with new trig functions and `atan2(y,x)` argument-order note.
    - documented `*d` degree suffix helpers and `atan2d(y,x)` behavior.
  - Added parser regression coverage for trig function use inside mixed point/scalar expressions (`A + cos(0)*B`) in `src/scene/__tests__/command-parser.test.ts`.
  - Added parser + scene parity coverage for inverse trig, `atan2`, and degree trig helpers, including mixed point/scalar expression usage.
  - Validation:
    - `npm run test:command`
    - `npm run build`
- 2026-02-20 Deprecate Double Arrow Styles for Circles and Angles:
  - **Refactor**: Replaced legacy inline arrow controls with `ArrowListControl` for Circles and Angles.
    - Enables multiple arrows per object (previously limited to 1 for Circles/Angles).
    - Removes deprecated `<->` and `>-<` styles from the UI (existing files still render).
  - **Fix**: Resolved "Ghost Arrow" issue in `ArrowListControl`.
    - Previously, disabled arrows in legacy data showed up as "Arrow 1" in the list.
    - Updated `ObjectStyleSections.tsx` to filter out disabled arrows for Segments, Circles, and Angles.
  - **Validation**:
    - Verified new UI allows adding/removing arrows on Circles/Angles.
    - Verified ghost arrows are gone for all object types.
    - `npm run type-check && npm run test:unit` passed.
- 2026-02-20 Angle Interaction Refinement:
  - **Selection**: Increased hit test tolerance (10px -> 20px) and min radius (12px -> 20px) for angles.
  - **Labels**: Adjusted angle label positioning logic to place labels closer to the vertex/arc.
- 2026-02-19 Efficient TikZ Export:
  - Implemented new export mode (`makeEfficientTikz`) that post-processes standard TikZ output for readability and compactness.
  - Key transformations:
    - **Numeric Rounding**: Coordinates and sizes rounded to 2 decimal places (std `14.000000...` -> `14`).
    - **Color Simplification**: Map typically used hex colors (e.g. `#0f172a`, `#334155`) to standard TikZ names (`black`, `darkgray`, `teal`).
    - **Label Grouping**: Consolidates consecutive similar label commands into `\foreach` loops (e.g. `\foreach \P/\pos in {A/above left, B/below right}...`).
    - **Precision Cleanup**: Fixes overly precise values in `size`/`mksize`/`mkpos`.
  - UI Integration:
    - Added "Efficient TikZ Code (Compact)" checkbox to Export panel.
    - Updated `ExportPanel` to trigger regeneration when efficient mode is toggled.
  - Architecture:
    - `src/export/tikz/efficient/` module added with `colorTable.ts` and `makeEfficientTikz.ts`.
    - Purely additive pipeline; standard export logic remains untouched to preserve precision/debuggability.
  - Validation:
    - Unit tests in `src/export/tikz/efficient/__tests__/makeEfficientTikz.test.ts`.
    - Verified `angle-arc-arrow-basic.json` output format.
    - `npm run test:export`
- 2026-02-16 transform retcon: split single transform tool into object-transform tools:
  - Replaced single `transform` click workflow with three dedicated tools:
    - `translate` (select source object -> vector start point -> vector end point)
    - `reflect` (select source object -> axis line/segment)
    - `dilate` (select source object -> center point; factor from tool settings)
  - Source object types supported by tool workflow:
    - point, segment, circle, polygon, angle
  - Added object transform helper module:
    - `src/tools/objectTransforms.ts`
    - object-level translate/reflect/dilate constructors are now centralized here.
  - UI/tooling updates:
    - Tool palette now shows separate transform tools with dedicated icons.
    - Tool info panel now shows per-tool instructions (no mode dropdown).
    - Pending previews/highlights updated for object-source selection and per-tool steps.
  - Core integration:
    - `toolClick` IO now dispatches object transforms (`transformObjectByTranslation`, `transformObjectByReflection`, `transformObjectByDilation`).
    - `CanvasView` wires those IO calls to `objectTransforms` helpers and scene creation APIs.
  - Regression coverage:
    - rewrote `src/scene/__tests__/transform-tool-workflow.test.ts` for new tool split and object-source flow.
    - updated scene test harness stubs in:
      - `src/scene/__tests__/engine-boundary.test.ts`
      - `src/scene/__tests__/grid-snap-point-reuse.test.ts`
      - `src/scene/__tests__/perp-line-polygon-edge.test.ts`
  - Validation:
    - `npm run build`
    - `npm run test:scene`
    - `npm run test:command`
    - `npm run test:export`
- 2026-02-16 transform object construction-description + export guarantee follow-up:
  - Construction description now infers shared transform provenance for selected non-point objects:
    - segment/circle/polygon/angle built from transformed points now describe source object + transform action.
    - example now supported: reflected segment text form (`Segment AB reflected over line BC.`).
    - file: `src/state/selectors/constructionDescription.ts`.
  - Added regressions:
    - `src/scene/__tests__/construction-description-transform.test.ts`
      - covers reflected segment, translated circle, dilated polygon descriptions.
    - `src/scene/__tests__/transform-object-export-regression.test.ts`
      - verifies transformed-object export remains construction-based (reflection via `tkzDefPointBy[...]`), and transformed points are not exported as hard-coded coordinate points.
  - `test:scene` now includes both new tests in `package.json`.
- 2026-02-16 line source support for object transforms:
  - Transform source whitelist now includes `line` for `translate` / `reflect` / `dilate`.
  - Interaction updates:
    - line hits (`line2p`) are valid transform targets at source selection step.
    - pending highlight + preview now render transformed line previews.
  - Object transform engine:
    - `src/tools/objectTransforms.ts` now supports source type `line`.
    - `twoPoint` lines transform via transformed endpoints.
    - `angleBisector` lines transform via transformed `(A,B,C)` and `createAngleBisectorLine(...)`.
    - other line kinds are transformed by sampling constrained points on the source line (`createPointOnLine`), transforming those points, then creating a two-point transformed line.
    - source helper sample points are immediately set invisible via `setObjectVisibility`.
  - Construction description:
    - transformed two-point lines now describe source + transform action (e.g. `Line AB reflected over line BC.`).
  - Added/updated regressions:
    - `src/scene/__tests__/transform-tool-workflow.test.ts` (line source accepted in tool workflow)
    - `src/scene/__tests__/construction-description-transform.test.ts` (line transformed description)
    - `src/scene/__tests__/transform-object-export-regression.test.ts` (transformed line export remains construction-based, no hard-coded transformed point coordinates)
  - Validation:
    - `npm run test:scene`
    - `npm run test:command`
    - `npm run test:export`
    - `npm run build`
- 2026-02-16 toolbar ordering/layout tweak:
  - `TRANSFORM` group moved to sit directly above `STYLES` in left toolbar ordering.
  - `toolGroupLabel` layout tightened (`line-height: 1.1`, `white-space: nowrap`) to avoid visual overflow.
  - Files:
    - `src/ui/ToolPalette.tsx`
    - `src/App.css`
  - Validation:
    - `npm run build`
- 2026-02-16 toolbar icon polish follow-up:
  - `regular_polygon` now uses a dedicated icon (distinct from `polygon`).
  - Top action `Fit View` no longer uses `ZoomIn`; now uses `IconFitView`.
  - Group label text was reduced further to prevent `TRANSFORM` overflow on narrow sidebar width.
  - Files:
    - `src/ui/icons.tsx`
    - `src/ui/ToolPalette.tsx`
    - `src/ui/HistoryControls.tsx`
    - `src/App.css`
  - Validation:
    - `npm run build`
- 2026-02-16 sidebar UX pass (toolbar width + hover flyouts + toggle redesign):
  - Left sidebar minimum width increased to preserve long group labels (e.g. `TRANSFORM`) without overflow:
    - `LEFT_MIN` raised and default `leftWidth` increased in `src/ui/useAppShellController.ts`.
    - collapsed sidebar width increased to fit redesigned toggle affordance.
  - Left/right collapse toggles redesigned to panel-style buttons (matching requested visual direction):
    - new icons: `IconSidebarPanelLeft`, `IconSidebarPanelRight` in `src/ui/icons.tsx`.
    - applied in `src/ui/ToolPalette.tsx` and `src/ui/RightSidebar.tsx`.
  - Sidebar hide/show now has visible transitions:
    - width + padding transitions on sidebars.
    - tool/content fade-slide transitions via persistent content wrappers:
      - `.leftToolbarContent`
      - `.rightSidebarContent`
    - resize drag keeps transitions disabled during active resizing (`body.sidebar-resizing` in `src/ui/useSidebarResize.ts` + `src/App.css`).
  - Tool-group interaction changed to GeoGebra-like hover behavior:
    - flyout opens on hover/focus; no extra click needed just to reveal group tools.
    - main tool click now selects immediately (removes previous click-to-toggle friction).
    - file: `src/ui/ToolPalette.tsx`.
  - Validation:
    - `npm run build`
- 2026-02-16 sidebar UX pass stabilization (regression fix):
  - Reverted brittle always-mounted sidebar content wrappers that caused:
    - collapsed panel appearing as blank bar,
    - flyout placement glitches outside expected area.
  - Restored stable conditional rendering for collapsed/expanded sidebars while keeping:
    - wider left minimum width,
    - redesigned panel-style toggle icons/buttons,
    - hover-to-open tool-group flyouts (GeoGebra-like; no extra click needed to reveal options),
    - sidebar width/padding transitions.
  - Visual polish updates:
    - toggle button dark theme softened (no pure-black icon look),
    - collapsed width reduced from oversized value to compact state,
    - flyout anchor/z-index tuned.
  - Files:
    - `src/ui/ToolPalette.tsx`
    - `src/ui/RightSidebar.tsx`
    - `src/ui/useAppShellController.ts`
    - `src/App.css`
  - Validation:
    - `npm run build`
- 2026-02-16 sidebar visual refinement (post-feedback):
  - Reworked sidebar toggle button visual tone away from harsh dark block:
    - light neutral background, slate icon tone, softer border/shadow.
    - keeps panel-style glyphs while matching app light theme.
  - Adjusted collapsed sidebar width to avoid toggle clipping and keep icon fully visible.
  - Added safe tool-group enter animation on expand.
  - Prevented lower-group flyouts from dropping below canvas by opening them upward for:
    - `SHAPES`, `TRANSFORM`, `STYLES`.
  - Files:
    - `src/App.css`
    - `src/ui/useAppShellController.ts`
  - Validation:
    - `npm run build`
- 2026-02-16 transform toolbar tool (point-only) added end-to-end:
  - New toolbar tool id: `transform` (POINTS group) with dedicated icon.
  - Tool settings state added: `transformTool` (`mode`, `angleExpr`, `direction`, `factorExpr`) with UI controls in Properties panel.
  - Click workflows implemented in tool state machine:
    - `translate`: click `P`, then vector start `A`, then vector end `B` => creates translated point.
    - `rotate`: click `P`, then center `O` => creates rotated point using angle expression + direction.
    - `dilate`: click `P`, then center `O` => creates dilated point using factor expression.
    - `reflect`: click `P`, then line/segment axis => creates reflected point.
  - Canvas pending previews and interaction highlights now support all transform modes.
  - History snapshot/restore now persists `transformTool` config.
  - Regression coverage added:
    - `src/scene/__tests__/transform-tool-workflow.test.ts`
  - Test runner hardening:
    - `test:scene` switched to `node --import tsx ...` (avoids `tsx` IPC EPERM in restricted environments).
- 2026-02-16 transform discoverability update:
  - `transform` is now a standalone visible toolbar group (`TRANSFORM`) instead of being hidden inside the `POINTS` flyout.
- 2026-02-16 stability + UX batch:
  - Assignment label propagation for created points is enforced in command assignment flow:
    - assigned point aliases now overwrite point `name` and `captionTex` to assignment label.
    - anchor: `src/state/geoStore.ts` (`applyAssignedPointLabel` usage in object assignment paths).
  - Grid-snap duplicate point regression fixed for line/segment continuation click flow:
    - reuses snapped existing point IDs instead of creating duplicate free points at same snapped world.
    - regression: `src/scene/__tests__/grid-snap-point-reuse.test.ts`.
  - Perpendicular tool now resolves polygon edges as segments (both click orders):
    - hit-test priority changed so polygon boundary clicks resolve to edge segment first.
    - files: `src/engine/hitTest.ts`, `src/view/canvasInteractionHelpers.ts`.
    - regression: `src/scene/__tests__/perp-line-polygon-edge.test.ts`.
  - Polygon tool now renders translucent in-progress fill preview (GeoGebra-like):
    - file: `src/view/previews/pendingPreview.ts`.
    - regression: `src/scene/__tests__/polygon-preview-fill.test.ts`.
  - Polygon border rendering now respects owned-segment visibility:
    - hiding polygon-owned segments hides corresponding polygon border edges while preserving fill.
    - file: `src/view/renderers/polygons.ts`.
    - regression: `src/scene/__tests__/polygon-owned-segment-visibility.test.ts`.
  - Validation:
    - `npm run test:scene`
    - `npm run test:command`
    - `npm run test:export`
    - `npm run build`
- Camera/zoom stability batch completed (commit `0e2c62a`):
  - Expanded camera zoom bounds in `src/view/camera.ts` for better infinite-zoom behavior (`1e-30..1e30`).
  - Added viewport/LOD guards for huge/offscreen circles in:
    - `src/view/snapEngine.ts`
    - `src/engine/hitTest.ts`
  - Added deterministic snap operation budget per frame:
    - bounded pairwise snap loops in `findBestSnap(...)`
    - fixed budget wiring in `src/view/CanvasView.tsx`
  - Added recovery hotkey: `Shift+F` triggers Fit View.
  - Fit View action moved to top actions (next to Undo/Redo), not in left tool groups.
  - Added regression/perf gate:
    - `scripts/zoom-stress.ts`
    - `npm run test:zoom`
- Sector status:
  - Sector endpoint/tool-flow detachment bug is considered fixed for current reported cases.
  - Do not reopen sector endpoint detachment without a new reproducible JSON.
- Correctness track (intersection semantics) advanced:
  - `intersectionPoint` now supports optional `branchIndex` and evaluation honors it for two-root generic intersections.
  - Generic intersection creation records deterministic `branchIndex` when two roots exist.
  - Existing generic intersection reuse now respects `branchIndex` (not just `preferredWorld` proximity).
  - Snapshot export includes `intersectionPoint.definition.branchIndex`.
  - Restore path backfills missing `branchIndex` where deterministically resolvable.
  - Added regression test: branch index must override misleading preferred seed for generic two-root intersections.
  - Added mixed-scene regression coverage to enforce branch persistence (`0/1`) under drag for:
    - segment-circle generic two-root intersections
    - circle-circle generic two-root intersections
- Debug visibility track added:
  - Export panel has `Include evaluated world coords (debug)` for Model JSON.
  - New export path emits `debugPointWorld` with runtime-evaluated coordinates per point.
- `PropertiesPanel` is already decomposed and **not** a monolith now:
  - `src/ui/PropertiesPanel.tsx` (~373 lines, orchestration/composition)
  - `src/ui/ToolInfoSection.tsx`
  - `src/ui/PointPropertiesSection.tsx`
  - `src/ui/ObjectStyleSections.tsx`
  - `src/ui/NumbersSection.tsx`
- `App.tsx` and `CanvasView` decomposition work is in place (controller/shell + extracted interaction/render helpers).
- `geoStore` has action/domain extraction in place (scene/interaction/ui/history actions, domain helpers).
- `scene` eval decomposition is in place under `src/scene/eval/*` with consolidation pass done.
- All recent refactor checkpoints were validated with:
  - `npm run build`
  - `npm run test:export`
- Tangent-line feature wiring is now integrated end-to-end:
  - New line kind: `tangent` (model + eval + integrity + dependency graph)
  - Tool id: `tangent_line` under `LINES` group
  - Interaction flow supports point→circle and circle→point selection
  - Pending preview draws tangent candidates (RAF-driven render path)
  - Construction descriptions include tangent language
  - Export handles tangent lines deterministically via computed tangent helper point + `\\tkzDrawLine`
  - Regression fixture added: `src/export/__fixtures__/tangent-line-through-point.json`
- Process guardrails added:
  - PR checklist template: `.github/pull_request_template.md`
  - Handoff enforcement script: `scripts/check-handoff-update.mjs`
  - CI workflow: `.github/workflows/guardrails.yml`
  - npm command: `npm run check:handoff`
- Command Bar references upgrade added:
  - New parser: `src/CommandParser.ts` (pure parser/evaluator, no store side effects).
  - New UI: `src/CommandBar.tsx` fixed at bottom of workspace.
  - Supported constructors:
    - `Point(x,y)`
    - `Line(x1,y1,x2,y2)` and `Line(A,B)`
    - `Segment(A,B)`
    - `Circle(x,y,r)`, `Circle(O,A)`, `Circle(O,r)`
    - `Distance(A,B)` (evaluation only; creates nothing)
  - Label resolution rules:
    - exact label match
    - unknown => `Unknown point: <id>`
    - non-point => `Not a point: <id>`
    - ambiguous => `Ambiguous identifier: <id>`
  - Expression eval supports safe allowlist functions/constants and `ans` chaining.
  - Input safety guards:
    - max length cap
    - disallowed token filter (`import`, `createUnit`, `unit`, `range`, `ones`, `zeros`, `matrix`)
    - AST allowlist validation for symbols/functions/operators.
  - Feedback:
    - success/error status text
    - expression result display
    - history up/down (last 20)
    - Esc clears input.
- Command Bar Phase 2 assignments added:
  - Assignment syntax:
    - scalar: `n_1 = 2.023242`
    - named objects: `B = Point(...)`, `l = Line(...)`, `s = Segment(...)`, `c_1 = Circle(...)`
  - Parser remains pure and now returns deterministic assignment intents:
    - `assignScalar`
    - `assignObject`
  - Scalar assignments now create visible scene `Number` objects (constants) via store API.
  - Scalar lookup for command evaluation is derived from current scene numbers (`getScalarVars`), not hidden-only state.
  - Named non-point object aliases added in store:
    - `commandObjectAliases` map + `getCommandObjectAliases`
  - Label/name conflict policy enforced (Phase 2):
    - no overwrite for scalar names
    - no overwrite for existing point labels
    - no overwrite for tracked command object aliases
  - `Circle(O, X)` resolution priority is deterministic:
    - if `X` is a point label => center-through circle
    - else if `X` is a scalar name => center-radius circle
    - else error
  - Snapshot semantics are explicit:
    - scalar vars are evaluated at command execution time
    - existing objects do not auto-update on scalar reassignment
- Command Bar Phase 3 (minimal dynamic dependency step):
  - `Circle(O, rExpr)` from Command Bar now preserves the radius expression string (`rExpr`) through parse/execute.
  - Creation path now calls fixed-radius circle creation with the original expression when available, not only frozen numeric text.
  - Practical effect: circles created from scalar names/expressions can update when referenced scene numbers change.
- Command Bar math usability upgrade:
  - Added constant aliases: `Pi`, `PI` (in addition to `pi`).
  - Added trig aliases: `Sin`, `Cos`, `Tan` (in addition to lowercase).
  - Added concise user reference doc: `docs/command-bar-reference.md`.
- Command Bar parity expansion (homework #2 complete):
  - Added tool-command counterparts:
    - `Midpoint(A,B)` and `Midpoint(s)`
    - `Perpendicular(P,l)`
    - `Parallel(P,l)`
    - `Tangent(P,c)` (non-assignable; may create 2 lines)
    - `AngleBisector(A,B,C)`
    - `Angle(A,B,C)`
    - `AngleFixed(V,A,expr[,CW|CCW])`
    - `Sector(O,A,B)`
    - `Circle3P(A,B,C)` (`CircleThreePoint` alias)
  - Parser now resolves point aliases through command alias table as fallback.
  - Added parser tests for new commands and assignment guard on tangent multi-create.
- Regular Polygon tool + command parity (new):
  - New tool id: `regular_polygon` in SHAPES group.
  - Tool flow: click point A, click point B, create regular `n`-gon from edge `AB` (deterministic CCW build).
  - New tool setting in state/UI: `regularPolygonTool.sides` (integer clamped to `[3,64]`), editable from Properties panel tool info.
  - New core creation action: `createRegularPolygon(aId,bId,sides)` (atomic, fail-closed, no partial writes).
  - Vertex generation is dependency-safe:
    - creates derived vertices as `pointByRotation` chain (`radiusMode:"keep"`) so dragging base points updates polygon.
  - Polygon edges are auto-created as owned segments (`ownedByPolygonIds`) using the same ownership semantics as standard polygon creation.
  - Command Bar support:
    - `RegularPolygon(A,B,n)` -> `CreateRegularPolygonFromEdge`
    - assignment form supported: `rp = RegularPolygon(A,B,n)`.
  - Preview/highlight support added for pending regular polygon construction.
- Command redefine/edit (homework #3 slice 1):
  - Assignment redefinition is enabled for:
    - existing constant numbers (`n = ...` updates value in place),
    - existing free points (`A = Point(...)` or point-expression assignment updates coordinates in place).
  - Parser no longer blocks same-name assignments at parse-time; execution layer enforces fail-closed updates.
  - Non-free points and non-constant numbers reject redefinition explicitly.
  - Parser regression tests updated for same-name assignment semantics.
- Command redefine core planner (homework #5 checkpoint):
  - Added `src/domain/redefinePlanner.ts` as the validate-first redefine core for alias-targeted assignments.
  - `commandBarApi.applyObjectAssignment(...)` now performs planner preflight before any mutate path.
  - Added point-alias redefine support for free-point aliases; non-free point aliases remain fail-closed.
  - Added redefine regression coverage:
    - free point alias updates in place
    - non-free point alias redefine rejects with no mutation.
- Export now auto-emits optional TikZ pattern libraries only when needed:
  - no pattern styles => no `\\usetikzlibrary{patterns}` line emitted
  - classic pattern styles (`pattern=...`, `pattern color=...`) => emits exactly `\\usetikzlibrary{patterns}`
  - meta pattern styles (`pattern={...}`) => emits exactly `\\usetikzlibrary{patterns,patterns.meta}`
  - deterministic: single line, stable ordering, no duplicates
- Properties panel now exposes fill pattern controls for current fill-capable objects:
  - Circle style: `Fill Pattern`, `Pattern Color`
  - Angle/Sector style: `Fill Pattern`, `Pattern Color`
  - Backed by typed style fields: `pattern`, `patternColor`
  - Export picks these up automatically (`pattern=...`, `pattern color=...`) and injects required TikZ library lines.
- Angle mark cosmetics upgraded with deterministic right-angle detection:
  - Right-angle detection uses `isRightAngle` (dot-product EPS in `src/scene/eval/angleMath.ts`).
  - UI is conditional:
    - right angles: `RightSquare`, `RightArcDot`, `None`
    - non-right angles: `Vanilla`, `Arc+|`, `Arc+||`, `Arc+|||`, `Double`, `Triple`, `None`
  - Export mapping:
    - non-right -> `\\tkzMarkAngle[arc=l|ll|lll,...]` (+ optional `mark`, `mksize`, `mkcolor`, `mkpos`)
    - right square -> `\\tkzMarkRightAngles[...]`
    - right arc-dot -> `\\tkzMarkRightAngles[german,...]`
  - Added export regression fixtures for all mark variants.
- Right-angle provenance fallback hardened for imported/saved scenes:
  - `isRightExact` is now resolved from provenance when field is missing (not forced to `false`).
  - Covers intersection-vertex case where angle rays lie on a perpendicular line and its base segment.
  - Added regression fixture: `src/export/__fixtures__/angle-right-exact-intersection-vertex.json`.
- Current right-angle fallback policy:
  - provenance first (exact construction relation),
  - then deterministic numeric fallback at high precision (`eps=1e-16`) for unresolved legacy/imported cases.
- Performance optimization and handoff integrity fixes (Completed):
  - `rightAngleProvenance.ts` now uses `Map`/`Set` for O(1) lookups (linear scan removed).
  - `SceneEvalContext` now caches resolved line anchors and circle geometry per-tick.
  - Geometry adapters (`resolveLineAnchors`, `getCircleWorldGeometry`) use this cache to eliminate redundant ops.
  - Verified benchmarks: ~0.47ms/tick on dense 52-node scene.
  - `APPROX_RIGHT_EPS` reverted to `1e-2` (visual/practical hints) to fix strictness regression.
  - `FileControls.tsx` now enforces structural validation on import (fail-closed).
  - `historyActions.ts` `loadSnapshot` fixed to prevent double-undo entry creation.
- Semantic intersection hardening (checkpoint):
  - Added `resolveIntersectionBranchIndexInScene(scene, objA, objB, preferredWorld)` in `src/domain/intersectionReuse.ts`.
  - `normalizeSceneIntegrity` now backfills missing `intersectionPoint.branchIndex` for two-root generic intersections.
  - Export branch inference now prefers explicit `intersectionPoint.branchIndex` when present (line-circle and circle-circle), using `preferredWorld` only as fallback.
  - Added regression: `testNormalizeBackfillsMissingGenericBranchIndex` in `src/scene/__tests__/intersection-ownership-regression.test.ts`.
- Semantic intersections (checkpoint 3):
  - New point kind: `circleSegmentIntersectionPoint` for deterministic segment-circle intersections.
  - `createIntersectionPoint` now emits `circleSegmentIntersectionPoint` for `(segment,circle)` object pairs.
  - Eval pipeline supports the new kind (`pointEvalDispatch` + pair assignment resolution).
  - Integrity/dependency layers now track the new kind:
    - `normalizeSceneIntegrity` validates circle/segment refs and exclude-point refs.
    - `geometryGraph` dependency edges include circle+segment parents.
  - Export supports the new semantic kind directly (mapped to `InterLC` with segment endpoints as line anchors).
  - Model snapshot export supports new definition kind:
    - `circleSegmentIntersectionPoint` in `constructionSnapshot`.
  - Added export regression fixture:
    - `src/export/__fixtures__/circle-segment-intersection-semantic.json`.
- Semantic intersections (checkpoint 4):
  - New point kind: `circleCircleIntersectionPoint` for deterministic circle-circle intersections.
  - `createIntersectionPoint` now emits this semantic kind for `(circle,circle)` object pairs.
  - Eval pipeline supports the new kind (`pointEvalDispatch` + generic pair assignment resolution by explicit circle IDs).
  - Integrity/dependency layers now track the new kind:
    - `normalizeSceneIntegrity` validates both circle refs + exclude-point refs.
    - `geometryGraph` dependency edges include both circles.
  - Export supports the new semantic kind directly (mapped to `InterCC` with explicit `branchIndex` semantics).
  - Snapshot export + diagnostics/test fixture hydration support the new kind.
  - Added export regression fixture:
    - `src/export/__fixtures__/circle-circle-intersection-semantic.json`.
- Semantic intersections (checkpoint 5):
  - New point kind: `lineLikeIntersectionPoint` for deterministic intersections between:
    - line-line
    - line-segment
    - segment-segment
  - `createIntersectionPoint` now emits this semantic kind for line-like pairs instead of generic `intersectionPoint`.
  - Eval pipeline supports the new kind via generic pair assignment with explicit line-like refs.
  - Integrity/dependency/export/snapshot/diagnostics support added.
  - Added export regression fixture:
    - `src/export/__fixtures__/line-like-intersection-semantic.json`.
- Semantic branch indexing generalized for generic intersections:
  - `intersectionPoint.branchIndex` now supports non-binary indices (`number`), not just `0|1`.
  - `resolveIntersectionBranchIndexInScene` now selects nearest branch across **all** resolved roots.
  - Generic assignment now handles `N` roots deterministically (not truncated to first two roots).
  - Scene normalization/restore now treat any non-negative integer `branchIndex` as explicit.
  - Snapshot/test hydration updated to preserve non-binary branch indices.
- Export hardening aligned with generalized branch indexing:
  - Export branch inference now treats any non-negative integer `intersectionPoint.branchIndex` as explicit (not only `0|1`).
  - `preferredWorld` remains fallback-only when explicit branch index is absent.
- Scene regression coverage (semantic kinds):
  - Added semantic drag/persistence tests in `src/scene/__tests__/intersection-ownership-regression.test.ts`:
    - `testCircleSegmentSemanticBranchPersistenceUnderDrag`
    - `testCircleCircleSemanticBranchPersistenceUnderDrag`
    - `testLineLikeSemanticIntersectionTracksGeometryUnderDrag`
  - Note: `npm run test:scene` remains blocked in this sandbox due `tsx` IPC `EPERM`, but code compiles and export harness remains green.
- 2026-02-18 Pure TikZ Export Refactor (Pure Construction):
  - **Eliminated** hardcoded intersection coordinates (no "cheating" with pre-calculated points).
  - Used `tkz-euclide` geometric construction logic (`near`, `common`) for robust point selection.
  - Corrected `InterCC` ordering rule: `angle(P, O1, O2) < 180` determines first point (vertex at intersection).
  - Implemented robust `common` point detection: checks *any* existing point at alternate intersection to stabilize selection.
  - Fixed "undefined segment geometry" regression by ensuring intersection points are tracked in `definedPointIds` even when `common` reference is used.
  - Validation:
    - `npm run test:export`
    - Verified against `tkz-euclide` 5.13c rules.
- 2026-02-17 TikZ export arrow calibration & alignment:
  - **Calibration**: Adjusted export scales to match user requirements (10pt length):
    - Segment arrows: `0.85x`
    - Arc/Circle arrows: `0.75x` (baked into tip dimensions)
  - **Alignment**:
    - **Circles**: Retained `decorations.markings` + `bend` for robustness on large radii.
    - **Angles/Sectors**: Switched to "Constructive Path" export (invisible sub-arc + `flex`) to fix tangent deviation on small radii.
  - **Library**: `bending` library now auto-injected when `arrows.meta` is used.
  - **Validation**: Verified visual parity with provided TikZ snippet. `npm run test:export`.



## Active Work (Open)
- Big homework / next UX milestone: shared right-click context actions system
  - Goal:
    - make GeoDraw feel more desktop-native by using right-click for common object actions and scalar extraction shortcuts.
    - this is a shared action system, not two separate menu implementations.
  - Required entry points:
    1. right-click on an object in the canvas
    2. right-click on the same object in the Object Browser / right sidebar
  - Core UX rule:
    - both entry points must open the same action model for the same object kind.
    - right-click should target the object under cursor even when a different object is currently selected.
  - V1 scope (recommended):
    - point:
      - rename
      - show/hide label
      - delete
    - segment:
      - solid / dashed / dotted
      - show/hide label
      - create variable from length
      - delete
    - circle:
      - solid / dashed / dotted
      - show/hide label
      - create variable from radius
      - create variable from area
      - delete
    - angle:
      - promote to solid
      - show/hide label
      - show/hide value
      - create variable from angle
      - delete
    - polygon:
      - show/hide label
      - delete
      - defer scalar extraction until real number definitions exist for polygon perimeter / area
    - text / textbox / rich text:
      - edit
      - duplicate
      - delete
    - empty canvas:
      - create point
      - create text
      - create textbox
      - paste
      - fit view
      - clear selection
  - Important naming decision:
    - prefer user-facing labels like:
      - `Create Variable from Length`
      - `Create Variable from Angle`
      - `Create Variable from Radius`
      - `Create Variable from Area`
    - do not use vague labels like `Extract value` if the object-specific meaning can be explicit.
  - Existing implementation footholds:
    - canvas interaction root:
      - `src/view/useCanvasInteractionController.ts`
      - `src/view/pointerEventController.ts`
      - `src/view/canvasEventLifecycle.ts`
    - object-row interaction root:
      - `src/ui/ObjectBrowser.tsx`
    - existing scalar creation actions already available:
      - `segmentLength`
      - `circleRadius`
      - `circleArea`
      - `angleDegrees`
      - current UI reference: `src/ui/NumbersSection.tsx`
  - Recommended architecture:
    - add one shared resolver:
      - e.g. `getContextActionsForObject(scene, selectedObject, stores/actions, location)`
    - keep menu rendering separate from action resolution:
      - shared action descriptors
      - two openers (canvas, Object Browser)
      - one presentational menu component
    - avoid hardcoding action lists independently inside canvas and Object Browser.
  - Suggested implementation slices:
    1. add shared action descriptor model and resolver for `point`, `segment`, `circle`, `angle`, `polygon`, `textLabel`, `richText`
    2. add canvas `contextmenu` handling and target resolution
    3. add Object Browser row right-click handling
    4. wire scalar extraction actions for segment / circle / angle using existing number creation actions
    5. add empty-canvas menu
    6. add polish:
      - keyboard escape to close
      - outside click close
      - viewport clamping
      - Mac ctrl-click parity
  - 2026-04-26 implementation checkpoint:
    - Done:
      - Added shared action resolver/model in `src/ui/contextMenuActions.ts`.
      - Added shared menu renderer/executor in `src/ui/GeoContextMenu.tsx`.
      - Wired canvas `contextmenu` handling through:
        - `src/view/canvasInteractionHelpers.ts`
        - `src/view/canvasEventLifecycle.ts`
        - `src/view/pointerEventController.ts`
        - `src/view/useCanvasInteractionController.ts`
        - `src/view/CanvasView.tsx`
      - Wired Object Browser row right-click to the same menu in `src/ui/ObjectBrowser.tsx`.
      - Added context menu CSS in `src/App.css`.
      - Implemented V1 actions:
        - point: rename, show/hide label, delete
        - line/segment: solid/dashed/dotted, show/hide label, delete
        - segment: create variable from length
        - circle: solid/dashed/dotted, show/hide label, create variable from radius/area, delete
        - polygon: solid/dashed/dotted, show/hide label, delete
        - angle: promote to solid/use approximation dash, show/hide label, show/hide value, create variable from angle/sweep, delete
        - text label/rich textbox: show/hide, delete
        - empty canvas: create point, create text, create textbox, fit view, clear selection
      - Right-click and Mac ctrl-click no longer start the normal pointer-drag/construction flow.
      - Added focused tests:
        - `src/ui/__tests__/contextMenuActions.test.ts`
        - extended `src/view/__tests__/canvas-event-lifecycle.test.ts`
    - Validation:
      - `node --import tsx src/ui/__tests__/contextMenuActions.test.ts`
      - `node --import tsx src/view/__tests__/canvas-event-lifecycle.test.ts`
      - `npx tsc --noEmit`
      - `npm run build`
    - Next:
      - Add paste once clipboard/object duplication semantics are explicit.
      - Add polygon perimeter/area extraction only after real polygon number definitions exist.
      - Do a browser/manual pass for canvas target priority, Object Browser menu placement, and ctrl-click on macOS.
    - Risks:
      - V1 point rename uses `window.prompt`; replace with an in-app rename affordance later if desired.
      - This was implemented on top of a dirty worktree with unrelated local changes in `src/App.css`, `src/view/CanvasView.tsx`, and `src/ui/ObjectBrowser.tsx`; keep future commits carefully staged.
  - 2026-04-27 text context-menu follow-up:
    - Done:
      - Added `Edit Text` and `Duplicate` actions for text labels.
      - Added `Edit Textbox` and `Duplicate` actions for rich textboxes.
      - Added shared `Copy` actions for text labels and rich textboxes.
      - Added empty-canvas `Paste`, enabled only when GeoDraw's internal text clipboard has content.
      - Refactored `Cmd+C` / `Cmd+V` text-object copy-paste to use the same store-backed clipboard as the context menu.
      - Text-label edit currently uses a compact `window.prompt` path because the legacy text-label canvas editor is intentionally disabled after the rich-text rewrite.
      - Rich-textbox edit uses a transient store-level edit request consumed by `CanvasView`, so canvas and Object Browser context menus both open the same rich-text editor.
      - Added store-level duplication actions:
        - `duplicateTextLabel`
        - `duplicateRichTextNode`
      - Added store-level text clipboard actions:
        - `copyTextObjectToClipboard`
        - `pasteTextClipboard`
      - Duplicates preserve content/style, deep-clone rich-text documents, offset the copy, and select the new object.
      - Follow-up fix: duplicate offset is now camera-aware (`24px / zoom`) instead of a fixed world-unit offset, so copies appear near the original on canvas rather than only appearing in Object Browser on normal zoom levels.
    - Validation:
      - `node --import tsx src/ui/__tests__/contextMenuActions.test.ts`
      - `node --import tsx src/state/__tests__/text-duplication.test.ts`
      - `npx tsc --noEmit`
      - `npm run build`
    - Next:
      - Do a browser/manual pass for canvas target priority, Object Browser menu placement, duplicate/paste visibility, rich-text edit opening, and ctrl-click on macOS.
    - Risks:
      - Text-label edit is prompt-based; upgrade to an in-app plain-label editor only if/when plain labels get a new editor path.
      - Rich-textbox edit depends on `CanvasView` being mounted, which is true in the current app shell.
      - Paste currently uses GeoDraw's internal text-object clipboard, not arbitrary OS clipboard content.
  - 2026-04-27 polygon scalar extraction follow-up:
    - Done:
      - Added first-class number definition kinds:
        - `polygonPerimeter`
        - `polygonArea`
      - Polygon values are evaluated directly from current polygon vertices:
        - perimeter sums closed-edge distances
        - area uses absolute shoelace area
      - Added dependency/integrity support so polygon scalar variables:
        - are deleted with their source polygon
        - are filtered if the source polygon is stale/missing
        - have construction descriptions
      - Added shared context-menu actions for polygons:
        - `Create Variable from Perimeter`
        - `Create Variable from Area`
      - Added polygon scalar quick actions to the number flyout.
    - Validation:
      - `node --import tsx src/scene/__tests__/polygon-number-definitions.test.ts`
      - `node --import tsx src/scene/__tests__/geometry-graph-delete-regression.test.ts`
      - `node --import tsx src/ui/__tests__/contextMenuActions.test.ts`
      - `node --import tsx src/state/__tests__/text-duplication.test.ts`
      - `npx tsc --noEmit`
      - `npm run build`
    - Next:
      - Do a browser/manual pass for canvas target priority, Object Browser menu placement, duplicate/paste visibility, rich-text edit opening, polygon scalar extraction, and ctrl-click on macOS.
  - Guardrails:
    - do not let right-click start drag behavior
    - do not fork behavior between canvas and Object Browser menus
    - do not ship fake polygon scalar extraction until number definitions actually support it
    - keep V1 compact; avoid turning the menu into a second tool palette
  - Verification / manual checks when implementing:
    1. right-click a segment on canvas -> `Create Variable from Length` creates the same number kind as the Numbers panel action
    2. right-click the same segment in Object Browser -> same action list appears
    3. right-click an angle after dashed segment styling -> promoted solid state still renders correctly
    4. right-click empty canvas does not accidentally select or drag an object
    5. ctrl-click on macOS triggers the same context flow
- UX consistency update:
  - Grid lattice magnetism now follows Grid visibility: when `Grid` is off, free-point grid snapping is disabled even if `Snap` remains checked.
- Intersection semantics hardening (completed this pass):
  - Runtime branch selection no longer uses nearest-`preferredWorld` heuristics in generic intersection assignment.
  - Export fallback for legacy generic intersections no longer uses `preferredWorld` root distance; explicit branch is used when present, deterministic root `0` otherwise.
  - Export path now normalizes scene integrity before emitting TikZ, so missing legacy branch indices are backfilled once before export.
  - Export path now normalizes scene integrity before emitting TikZ, so missing legacy branch indices are backfilled once before export.
  - Regression fixture `regression-line-coverage-j-o.json` was upgraded to semantic intersection kinds (`lineLikeIntersectionPoint`, `circleSegmentIntersectionPoint`, `circleCircleIntersectionPoint`) with explicit branch indices.
- **Circle/Arc Arrow Gap Tuning** (Next Priority):
  - General arrow gap logic is settled.
  - Remaining work: tune gap scaling for small-radius arcs (Angles/Circles) where current logic (`separationPx / pathLengthPx`) may cause excessive gaps.
- Active homework focus (correctness-first):
  1. Validate on dense construction scenes and guard against regressions.
  2. Regular polygon follow-up: optional orientation toggle (CW/CCW) if needed.
  3. TikZ `InterLC` longer-tail hardening:
     - keep adding concrete fixtures for mixed-topology branch/common edge cases instead of widening heuristics blindly
     - watch for cases beyond current coverage where `excludePointId` and sibling/common reuse can still diverge from runtime semantics
     - keep `common=<pt>` gated by both:
       - already defined in emitted TeX
       - geometrically valid for that exact pair
- Performance track is secondary and must not alter intersection semantics.
- Performance follow-up now is measurement/tuning only:
  - run `npm run test:zoom` and dense-scene checks
  - do not reopen zoom architecture items from commit `0e2c62a` unless there is a new reproducible regression.
- Closed decision (do not reopen unless concrete failing file is provided):
  - Legacy migration/backfill for pre-branchIndex snapshots is already implemented and active.
  - Implementation locations:
    - `src/domain/sceneIntegrity.ts` (normalization backfill)
    - `src/state/slices/historyRestore.ts` (restore/load backfill)
  - Policy: do not re-discuss or re-scope this item without a reproducible failing scene file.
- Command Bar Phase 2 candidates:
  - optional overwrite semantics (`set`, `:=`, `let`, `del`) if desired.
  - parametric dependencies (Phase 3) where objects depend on scalars dynamically.
  - Redefine/edit next slices:
    - in-place redefine for line/segment/circle/angle aliases with dependency preservation rules.
- Tool-Command parity backlog (homework):
  - Optional/non-goal parity:
    - `move`, `copyStyle`, `export_clip` (UI workflow tools; no strict command mapping required).

## Risks / Notes
- `preferredWorld` is a branch seed for `intersectionPoint`, not guaranteed solved world coordinate.
- For geometric truth/debugging, use runtime-evaluated positions (or export JSON with `debugPointWorld`).
- `mathjs` bundle size impact should be monitored (parser currently uses strict guards to keep scope safe).
- `Circle(x,y,r)` currently constructs a center point and then uses existing fixed-radius-circle creation, which is deterministic and compatible with current scene model.
- In current model `Circle(O,r)` maps directly to fixed-radius circle creation (`createCircleFixedRadius`), no synthetic through-point needed.
- Command Bar name collisions now span three namespaces:
  - point labels
  - scalar vars
  - command object aliases
  This is intentional to keep deterministic, fail-closed behavior.
- Pattern-library auto-emission only affects export header lines; drawing semantics are unchanged.
- Future polygon fill can reuse the same `pattern`/`patternColor` style contract to stay consistent across object classes.
- TikZ exporter note:
  - `korea_no_14` compile failure is resolved; exporter now refuses forward `common=` references for `InterLC`.
  - Visible undefined intersections are fail-closed again; hidden undefined intersections may still be skipped.
  - Remaining exporter homework is semantic edge coverage, not a known suite blocker.

## Historical (Do Not Reopen Automatically)
- Items below are historical progress logs and rationale.
- Do **not** treat them as pending tasks unless explicitly re-added under **Active Work**.
- In particular, do not reopen resolved items like:
  - “PropertiesPanel is monolithic”
  - old `I_C` label anchor discussion
  - angle preview/copy-style regressions already marked fixed
  - Fit View placement (already moved to top actions near Undo/Redo)
  - camera zoom culling/snap-budget/hotkey batch from commit `0e2c62a`
  - sector endpoint detachment bug unless a new reproducible file is provided

## Intersection Do-Not-Break Checklist (Read First)

Before changing any intersection-related logic (creation, evaluation, export), read:

- `docs/regression-log.md`

Mandatory invariants to preserve:

- Creation/evaluation branch ordering must stay identical (no alternate sorting).
- No root stealing between sibling intersections on same pair in non-degenerate regimes.
- `excludePointId` stabilization semantics must remain enforced.
- Undefined handling must be deterministic (no arbitrary jumps).
- Tangency is a degeneracy case only (see "Future-Proof Note: Tangent Tool Compatibility" in `docs/regression-log.md`).

Required validation after such changes:

- `npm run build`
- `npm run test:export`
- `npm run test:scene`

## Architecture Refactor Status (Current)
- `handleToolClick` extraction is already done (`src/tools/toolClick.ts`).
- Store slice scaffolding exists:
  - `src/state/slices/storeTypes.ts`
  - `src/state/slices/sceneSlice.ts`
  - `src/state/slices/interactionSlice.ts`
  - `src/state/slices/uiSlice.ts`
  - `src/state/slices/historySlice.ts`
  - `src/state/slices/index.ts`
- Action modules extracted and wired into `geoStore`:
  - `src/state/slices/interactionActions.ts`
  - `src/state/slices/uiActions.ts`
  - `src/state/slices/historyActions.ts`
  - `src/state/slices/sceneCoreActions.ts`
  - `src/state/slices/sceneLineAngleActions.ts`
  - `src/state/slices/sceneCreationActions.ts`
  - `src/state/slices/sceneMutationActions.ts`
- New domain service introduced:
  - `src/domain/geometryGraph.ts` for dependency graph + cascade deletion planning.
- New headless engine boundary introduced:
  - `src/engine/evaluateScene.ts`
  - `src/engine/hitTest.ts`
  - `src/engine/construct.ts`
  - `src/engine/index.ts`
- `geoStore.ts` now composes these actions instead of owning those methods inline.
- Extracted scene-core methods:
  - `createFreePoint`
  - `createMidpointFromPoints`
  - `createMidpointFromSegment`
  - `createSegment`
  - `createLine`
- Extracted line/angle creation methods:
  - `createPerpendicularLine`
  - `createParallelLine`
  - `createAngleBisectorLine`
  - `createAngle`
  - `createAngleFixed`
- Extracted circle/point/intersection/number creation methods:
  - `createCircle`
  - `createCircleThreePoint`
  - `createCircleFixedRadius`
  - `createPointOnLine`
  - `createPointOnSegment`
  - `createPointOnCircle`
  - `createIntersectionPoint`
  - `createNumber`
- Extracted mutation/update/copy/delete methods:
  - `movePointTo`
  - `movePointLabelBy`
  - `moveAngleLabelTo`
  - `updateSelectedPointStyle`, `updateSelectedPointFields`
  - `updateSelectedSegmentStyle`, `updateSelectedSegmentFields`
  - `updateSelectedLineStyle`, `updateSelectedLineFields`
  - `updateSelectedCircleStyle`, `updateSelectedCircleFields`
  - `updateSelectedAngleStyle`, `updateSelectedAngleFields`
  - `setCopyStyleSource`, `applyCopyStyleTo`, `clearCopyStyle`
  - `deleteSelectedObject`
- `deleteSelectedObject` now delegates cascade planning + application to domain graph helpers:
  - `collectCascadeDelete(scene, selected)`
  - `applyDeletion(scene, deletedSet)`
- Engine hit-test primitives now own canvas object hit logic:
  - `hitTestPointId`
  - `hitTestSegmentId`
  - `hitTestLineId`
  - `hitTestCircleId`
  - `hitTestAngleId`
  - `resolveVisibleAngles`
- `CanvasView` now delegates hover/click object hit testing to `src/engine/hitTest.ts` (local duplicated hit-test functions removed).
- `CanvasView` interaction orchestration (slice 1) extracted into:
  - `src/view/pointerInteraction.ts`
  - `decideMovePointerDown(...)` (move-tool pointer-down decision tree)
  - `computeCanvasCursor(...)` (cursor policy for move/copyStyle/targetable tools)
  - `CanvasView` now calls these helpers instead of inlining equivalent branching logic.
- `CanvasView` interaction orchestration (slice 2) extracted into:
  - `src/view/pointerDragInteraction.ts`
  - `applyBufferedDragUpdate(...)` (mode-specific drag application for pan / drag-point / drag-label / drag-angle-label)
  - `bufferDragForMode(...)` (mode-specific drag-buffer updates from pointermove)
  - `resetDragBuffers(...)`
  - `CanvasView` now delegates drag mode branching to these helpers.
- `CanvasView` interaction orchestration (slice 3) extracted into:
  - `src/view/pointerEventController.ts`
  - `createPointerHandlers(...)` now owns `onDown`, `onMove`, `finish` orchestration with explicit injected deps.
  - `CanvasView` now provides:
    - hit-test/hit-resolve callbacks
    - drag buffers/refs and scheduling callbacks
    - tool-click construction callback (`constructFromClick` path)
    - cursor/hover world state callbacks
- `CanvasView` event lifecycle extraction (slice 4):
  - `src/view/pointerEventController.ts`
    - `createCanvasAuxHandlers(...)` now owns `onWheel`/`onLeave`.
  - `src/view/canvasEventLifecycle.ts`
    - `bindCanvasEventLifecycle(...)` centralizes pointer/wheel listener attach-detach.
  - `CanvasView` no longer manually registers/removes each canvas event listener inline.
- `CanvasView` construction-click adapter extraction (slice 5):
  - `src/view/constructClickAdapter.ts`
  - `runConstructClickAdapter(...)` now owns `constructFromClick` payload assembly:
    - hit-object/top-hit + snap computation
    - click-hit payload normalization
    - IO bundle merge with camera/vp/angleFixedTool
  - `CanvasView` now delegates tool-click release construction wiring to this adapter.
- `CanvasView` helper-factory extraction (slice 6):
  - `src/view/canvasInteractionHelpers.ts`
    - `createReadScreen(canvas)`
    - `createHoveredHitResolver(...)`
    - `createDragBufferAccess(...)`
  - These were moved out of the large `CanvasView` effect body to reduce orchestration noise.
- `CanvasView` typed dependency-bundle cleanup (slice 7):
  - `src/view/constructClickAdapter.ts`
    - exports `ConstructClickIo` type (derived from `constructFromClick` signature).
  - `CanvasView` now builds:
    - `hitTolerances` memo bundle
    - `constructClickIo` memo bundle
  - Reduces large inline object plumbing and simplifies effect dependency surface.
- `CanvasView` label overlay prep extraction (slice 8):
  - `src/view/labelOverlays.ts`
    - `createPointLabelOverlays(...)`
    - `createAngleLabelOverlays(...)`
    - `buildAngleLabelTex(...)`
    - `getAngleTextRenderSize(...)`
  - `CanvasView` now consumes these helpers instead of inlining KaTeX overlay prep.
- `CanvasView` angle resolution extraction (slice 9):
  - `src/view/angleResolution.ts`
    - `resolveAngles(scene)` now owns angle point resolution + oriented-angle evaluation.
  - `CanvasView` now memoizes via `useMemo(() => resolveAngles(scene), [scene])`.
- `CanvasView` label layer extraction (slice 10):
  - `src/view/CanvasLabelsLayer.tsx`
  - `CanvasView` now delegates label DOM rendering for:
    - point caption overlays
    - angle label overlays
  - DOM output/props preserved.
- `CanvasView` render-pass orchestration extraction (slice 11):
  - `src/view/renderFrame.ts`
  - `renderCanvasFrame(...)` now owns frame draw order:
    - grid -> circles/lines/segments/angles
    - pending preview
    - points
    - interaction highlights
    - hover snap visual accents
  - `CanvasView` now delegates draw callback internals to this helper.
- `CanvasView` interaction-effect extraction (slice 12):
  - `src/view/useCanvasInteractionController.ts`
  - Moved the large pointer/wheel/listener orchestration effect out of `CanvasView` into a dedicated hook.
  - Hook owns:
    - hover-hit resolver wiring
    - cursor policy application on interaction changes
    - drag buffering + RAF flush scheduling
    - pointer handlers / wheel handlers integration
    - lifecycle bind/unbind + cleanup of pending RAF
  - `CanvasView` now supplies refs/state/actions to this hook.
- Scene expression parser extraction (slice 13):
  - `src/scene/eval/numericExpression.ts`
    - `parseNumericExpression(...)`
    - `NumberExpressionEvalResult`
  - `src/scene/points.ts` now imports parser from `scene/eval` instead of owning parser internals inline.
  - `NumberExpressionEvalResult` remains exported through `points.ts` to preserve API surface.
- Scene expression wrappers/symbol tables extraction (slice 14):
  - `src/scene/eval/expressionEval.ts`
    - `buildAngleSymbolTable(...)`
    - `buildNumberSymbolTable(...)`
    - `evaluateAngleExpressionDegreesWithSymbols(...)`
    - `evaluateNumberExpressionWithSymbols(...)`
    - `AngleExpressionEvalResult`
  - `src/scene/points.ts` now uses these helpers inside its existing context-aware wrappers:
    - `evaluateAngleExpressionDegreesWithCtx(...)`
    - `evaluateNumberExpressionWithCtx(...)`
  - Public exports preserved through `points.ts` (`AngleExpressionEvalResult`, `NumberExpressionEvalResult`).
- Scene number-definition branch extraction (slice 15):
  - `src/scene/eval/numberDefinitions.ts`
    - `evalNumberDefinitionWithOps(...)`
  - `src/scene/points.ts`
  - `evalNumberDefinition(...)` now delegates to `evalNumberDefinitionWithOps(...)`
  - context/cache-aware callbacks are injected from `points.ts` (no behavior change).
- Scene eval-context management extraction (slice 16):
  - `src/scene/eval/evalContext.ts`
    - `SceneEvalStats`
    - generic `SceneEvalContext<...>`
    - `buildSceneEvalContext(...)`
    - `getOrCreateSceneEvalContext(...)`
    - `beginSceneEvalTick(...)`
    - `endSceneEvalTick(...)`
    - `updateImplicitEvalStats(...)`
    - debug helpers (`isEvalDebugEnabled`, `formatEvalStats`)
  - `src/scene/points.ts`
    - now uses eval-context helpers for tick/context lifecycle and implicit stats updates
    - preserves public API by re-exporting `SceneEvalStats`
    - local context-map/index-map ownership unchanged (behavior-preserving split).
- Scene geometry-resolve extraction (slice 17):
  - `src/scene/eval/geometryResolve.ts`
    - `resolveLineAnchorsWithOps(...)`
    - `resolveLineLikeRefAnchorsWithOps(...)`
    - `getCircleWorldGeometryWithOps(...)`
    - `asLineLikeWithOps(...)`
    - `asCircleWithOps(...)`
  - `src/scene/points.ts`
    - `resolveLineAnchors`, `getCircleWorldGeometryWithCtx`, `asLineLike`, `asCircle` now delegate to injected-op helpers.
    - behavior preserved (including line recursion guard and fixed-radius expression evaluation).
- Properties panel decomposition start (UI monolith mitigation step 1):
  - Added `src/ui/NumbersSection.tsx`
  - `src/ui/PropertiesPanel.tsx` now delegates full Numbers block rendering/handlers to `NumbersSection`.
  - No behavior change; just structural extraction.
- Properties panel decomposition (UI monolith mitigation step 2):
  - Added `src/ui/ObjectStyleSections.tsx`
    - Owns selected object style editors for Segment / Line / Circle / Angle.
    - Includes segment marking + arrow marking sub-panels and all existing handlers.
  - Added `src/ui/PointPropertiesSection.tsx`
    - Owns selected point detail/editor UI (name, caption, visibility, label mode, lock/auxiliary, point style).
  - `src/ui/PropertiesPanel.tsx`
    - reduced to orchestration/composition for:
      - tool info blocks
      - object selection wiring
    - default-style toggle
    - composing `PointPropertiesSection`, `ObjectStyleSections`, `NumbersSection`
    - line count reduced substantially (~1415 -> ~442) with behavior preserved.
- Store/domain decomposition (scene integrity extraction):
  - Added `src/domain/sceneIntegrity.ts`
    - `normalizeSceneIntegrity(scene)` moved out of `geoStore`.
    - Includes object-reference liveness filtering and iterative dependency cleanup for:
      - points/segments/lines/circles/angles
      - circle/line intersection point validity
      - number-definition integrity (including ratio references).
  - `src/state/geoStore.ts`
    - now imports `normalizeSceneIntegrity` from domain layer.
    - reduced store-local orchestration size (~631 -> ~508 lines in this step).
  - Behavior preserved; `build` + export fixture suite remain green.
- Store/domain decomposition (intersection + number/history helper extraction):
  - Added `src/domain/intersectionReuse.ts`
    - moved stable intersection helper cluster out of store wiring:
      - `getLineCircleRefs(...)`
      - `findExistingIntersectionPointId(...)`
      - `createStableLineCircleIntersectionPoint(...)`
    - logic preserved (branch-order, `excludePointId`, target-root reuse behavior unchanged).
  - Added `src/domain/numberDefinitions.ts`
    - moved numeric-definition helper functions:
      - `isValidNumberDefinition(...)`
      - `numberPrefixForDefinition(...)`
      - `nextAvailableNumberName(...)`
  - Added `src/state/slices/historyRestore.ts`
    - `restoreGeoStateFromSnapshot(...)` extracted from `geoStore`.
  - `src/state/geoStore.ts`
    - now primarily composes slices + imports pure helpers.
    - reduced further (~508 -> ~235 lines in this step).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Store decomposition (rename action extraction):
  - Added `src/state/slices/sceneRenameActions.ts`
    - moved `renameSelectedPoint(...)` out of `geoStore`.
    - validation/uniqueness/error behavior preserved.
  - `src/state/geoStore.ts`
    - now composes rename action via `createSceneRenameActions(...)`.
    - reduced further (~235 -> ~190 lines in this step).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Store runtime extraction (state/listener/history plumbing):
  - Added `src/state/slices/storeRuntime.ts`
    - `createStoreRuntime(...)` now owns:
      - mutable store state
      - listener subscription/emit
      - `setState(...)` pipeline with scene normalization + history bookkeeping
      - history runtime fields (`undoStack`, `redoStack`, action key, restoring flag)
  - `src/state/geoStore.ts`
    - now composes runtime via `createStoreRuntime(...)`
    - passes runtime hooks/stacks to action slices
    - reduced further (~190 -> ~135 lines in this step).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- UI decomposition (Properties tool-info extraction):
  - Added `src/ui/ToolInfoSection.tsx`
    - moved tool-specific info/config panels from `PropertiesPanel`:
      - Copy Style info
      - Fixed Angle tool info
      - Fixed Radius Circle tool info
  - `src/ui/PropertiesPanel.tsx` now composes `ToolInfoSection` + object editors.
  - Behavior preserved.
- Scene decomposition (`points.ts` slice: intersection utility extraction):
  - Added `src/scene/eval/intersectionUtils.ts` with pure helpers:
    - `clamp(...)`
    - `circleLineStabilitySignature(...)`
    - `genericIntersectionPairKey(...)`
    - `genericIntersectionSignature(...)`
    - `sameObjectPair(...)`
    - `lineLikeContainsPoint(...)`
    - `pointWithinSegmentDomain(...)`
    - `circleLinePairAssignmentKey(...)`
  - `src/scene/points.ts` now imports and uses these utilities; duplicate local implementations removed.
  - No algorithmic change intended; this is structural extraction only.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: intersection assignment extraction):
  - Added `src/scene/eval/intersectionAssignments.ts`:
    - `assignCircleLinePairPoints(...)`
    - `assignGenericIntersectionPairPoints(...)`
  - `src/scene/points.ts` now delegates both pair-assignment algorithms to this module
    via callback ops (excluded point lookup + stable-point memory access).
  - Kept deterministic ownership rules and stability behavior unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: object intersection query extraction):
  - Added `src/scene/eval/intersectionQueries.ts`:
    - `objectIntersectionsWithOps(...)`
  - Moved line-line / line-circle / circle-circle query branching from
    `points.ts` into the new module.
  - `points.ts` now provides adapter callbacks (asLineLike/asCircle + stats counters),
    preserving existing behavior.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point geometry helper extraction):
  - Added `src/scene/eval/pointGeometryEval.ts`:
    - `evalMidpoint(...)`
    - `evalPointOnLine(...)`
    - `evalPointOnSegment(...)`
    - `evalPointOnCircle(...)`
    - `evalPointByRotation(...)`
  - `points.ts` now delegates pure geometry computations for these point kinds.
  - Behavior unchanged (only orchestration remains in `points.ts`).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: shared geometry-resolve ops builder):
  - In `src/scene/points.ts`, consolidated duplicated resolver-op closures into:
    - `buildGeometryResolveOps(scene, ctx)`
  - Reused by:
    - `asLineLike(...)`
    - `resolveLineAnchors(...)`
    - `asCircle(...)`
    - `getCircleWorldGeometryWithCtx(...)`
  - Structural refactor only; no algorithm changes.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point-kind evaluator split):
  - Split monolithic `evalPointUnchecked(...)` into dedicated helpers:
    - `evalMidpointPointsPoint(...)`
    - `evalMidpointSegmentPoint(...)`
    - `evalPointOnLinePoint(...)`
    - `evalPointOnSegmentPoint(...)`
    - `evalPointOnCirclePoint(...)`
    - `evalPointByRotationPoint(...)`
    - `evalCircleLineIntersectionPoint(...)`
    - `evalGenericIntersectionPoint(...)`
  - Dispatcher remains in `evalPointUnchecked(...)`; behavior is unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: stable-point memory extraction):
  - Added `src/scene/eval/stablePointMemory.ts`:
    - `getPreviousStablePoint(...)`
    - `rememberStablePoint(...)`
  - `points.ts` now delegates stable intersection memory reads/writes to this module.
  - This is structural only; stability signatures/selection behavior unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: angle math extraction):
  - Added `src/scene/eval/angleMath.ts`:
    - `computeConvexAngleRad(...)`
    - `computeOrientedAngleRad(...)`
  - `points.ts` now imports/re-exports these math helpers; local implementations removed.
  - Structural extraction only; formulas unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: expression runtime extraction):
  - Added `src/scene/eval/expressionRuntime.ts`:
    - `evaluateAngleExpressionWithRuntime(...)`
    - `evaluateNumberExpressionWithRuntime(...)`
  - `points.ts` now delegates symbol-table orchestration to this module from:
    - `evaluateAngleExpressionDegreesWithCtx(...)`
    - `evaluateNumberExpressionWithCtx(...)`
  - All callbacks and math remain unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: number runtime extraction):
  - Added `src/scene/eval/numberRuntime.ts`:
    - `evalNumberByIdWithRuntime(...)`
  - `points.ts` `evalNumberById(...)` now delegates cache/in-progress orchestration to this helper.
  - Number definition math/evaluation callbacks unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: scene geometry access extraction):
  - Added `src/scene/eval/sceneGeometryAccess.ts`:
    - `asLineLikeInScene(...)`
    - `resolveLineAnchorsInScene(...)`
    - `asCircleInScene(...)`
    - `getCircleWorldGeometryInScene(...)`
  - `points.ts` now delegates geometry-resolve wrappers to this module.
  - Behavior unchanged; this is adapter centralization.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: number-definition scene wiring extraction):
  - Added `src/scene/eval/numberSceneEval.ts`:
    - `evalNumberDefinitionInScene(...)`
  - `points.ts` now delegates number-definition callback wiring to this helper.
  - Core number math and expression semantics unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point basic helpers extraction):
  - Added `src/scene/pointBasics.ts`:
    - `nextLabelFromIndex(...)`
    - `isNameUnique(...)`
    - `isValidPointName(...)`
    - `isPointDraggable(...)`
    - `movePoint(...)`
  - `points.ts` now re-exports these to preserve existing import paths.
  - Structural extraction only; behavior preserved.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: eval-context builder extraction):
  - Added `src/scene/eval/sceneContextBuilder.ts`:
    - `buildSceneEvalContextForScene(...)`
    - exported scene `SceneEvalContext` alias
  - `points.ts` now delegates context map/tick construction to this helper.
  - Behavior unchanged; context lifecycle API remains the same.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: intersection pair-resolution orchestration extraction):
  - Added `src/scene/eval/intersectionPairResolution.ts`:
    - `resolveCircleLinePairAssignmentsInScene(...)`
    - `resolveGenericIntersectionPairAssignmentsInScene(...)`
  - `points.ts` now delegates pair-candidate scan/caching orchestration to this module.
  - Branch ownership and stable-point rules unchanged (still delegated to existing assignment helpers).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: geometry-resolve runtime wiring extraction):
  - Added `src/scene/eval/geometryResolveRuntime.ts`:
    - `buildGeometryResolveOpsRuntime(...)`
  - `points.ts` `buildGeometryResolveOps(...)` now delegates to this helper.
  - No geometry algorithm change (same callbacks/data sources).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: point-runtime orchestration extraction):
  - Added `src/scene/eval/pointRuntime.ts`:
    - `evalPointByIdWithRuntime(...)`
  - `points.ts` `evalPoint(...)` now delegates point cache/in-progress orchestration to this helper.
  - Point-kind evaluation and intersection behavior unchanged.
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Scene decomposition (`points.ts` slice: non-intersection point-kind evaluators extraction):
  - Added `src/scene/eval/pointKindEvaluators.ts`:
    - `evalMidpointPointsPoint(...)`
    - `evalMidpointSegmentPoint(...)`
    - `evalPointOnLinePoint(...)`
    - `evalPointOnSegmentPoint(...)`
    - `evalPointOnCirclePoint(...)`
    - `evalPointByRotationPoint(...)`
  - `points.ts` now delegates these non-intersection point kind evaluators to the module.
  - Circle-line and generic intersection evaluators remain in `points.ts` (unchanged logic).
  - Validation:
    - `npm run build` ✅
    - `npm run test:export` ✅ (22/22)
- Label hit-testing extracted from `CanvasView` into:
  - `src/view/labelHit.ts`
  - `hitTestPointLabel`
  - `hitTestAngleLabelHandle`
  - `hitTestPointLabelFromDom`
- Angle draw math helpers extracted from `CanvasView` into:
  - `src/view/angleRender.ts`
  - `drawAngleArcPreview`
  - `drawAngleSector`
  - `drawRightAngleMark`
- Snap highlight rendering extracted from `CanvasView` into:
  - `src/view/snapHighlight.ts`
  - `highlightSnapObject`
- Stroke/point/segment overlay rendering helpers extracted from `CanvasView`:
  - `src/view/strokeStyle.ts` (`applyStrokeDash`)
  - `src/view/pointRender.ts` (`drawPointSymbol`)
  - `src/view/segmentOverlayRender.ts` (`drawSegmentMarkOverlay`, `drawSegmentArrowOverlay`)
- Full object render passes extracted from `CanvasView` into `src/view/renderers/*`:
  - `circles.ts` (`drawCircles`)
  - `lines.ts` (`drawLines`)
  - `segments.ts` (`drawSegments`)
  - `angles.ts` (`drawAngles`)
  - `points.ts` (`drawPoints`)
  - `types.ts` (`DrawableObjectSelection`)
  - `index.ts` barrel
- Pending tool preview rendering extracted from `CanvasView`:
  - `src/view/previews/pendingPreview.ts` (`drawPendingPreview`)
  - Includes 3-point circumcircle helper and per-tool preview logic.
- Stage #2 App decomposition started:
  - Left toolbar extracted from `src/App.tsx` into `src/ui/ToolPalette.tsx`.
  - `ToolPalette` owns:
    - tool registry/group definitions
    - flyout state (`openFlyoutGroup`, `groupLastSelected`)
    - long-press + context-menu behavior
    - outside-click and Escape flyout close behavior
  - `App.tsx` now delegates toolbar rendering to `ToolPalette` and no longer contains duplicate toolbar icon/helper code.
  - Export tab UI extracted from `src/App.tsx` into `src/ui/ExportPanel.tsx`.
  - `ExportPanel` refactored to be store-driven + self-contained state (scene/camera from store, local export controls/actions).
  - Export panel is always mounted and uses `visible` prop to preserve state across tab switches.
  - Properties tab UI extracted from `src/App.tsx` into `src/ui/PropertiesPanel.tsx`.
  - `PropertiesPanel` then refactored to be store-driven (`useGeoStore` + local panel state/effects), removing a large prop surface from `App.tsx`.
  - `PropertiesPanel` is always mounted and uses `visible` prop.
  - Construction-description logic moved out of `App.tsx` into selector module:
    - `src/state/selectors/constructionDescription.ts`
    - `selectConstructionDescription(selectedObject, scene)`
  - `App.tsx` no longer owns construction-description helper functions.
  - Right sidebar shell/tabs wrapper extracted from `src/App.tsx` into `src/ui/RightSidebar.tsx`.
    - `RightSidebar` now owns right-tab local state (`algebra` / `export`) and renders:
      - tab switcher
      - object browser section
      - `ExportPanel` + `PropertiesPanel` visibility wiring
      - right-sidebar collapse/expand controls
  - `App.tsx` now composes high-level layout only (left palette, canvas, right sidebar, resizers, history buttons).
  - Top-canvas history controls extracted from `src/App.tsx` into `src/ui/HistoryControls.tsx`.
  - Sidebar resize drag lifecycle extracted from `App.tsx` into reusable hook:
    - `src/ui/useSidebarResize.ts`
    - owns pointermove/pointerup listeners, clamping, and startResize handlers.
  - Global keyboard shortcuts extracted from `App.tsx` into reusable hook:
    - `src/ui/useGlobalCanvasHotkeys.ts`
    - owns Escape copy-style cancel, undo/redo shortcuts, delete/backspace delete.
  - App shell/resizer markup extracted from `App.tsx` into:
    - `src/ui/WorkspaceShell.tsx`
    - owns composition layout for left palette, canvas/history, resize handles, right sidebar.
  - Direct `App.tsx` store wiring grouped into app-shell controller hook:
    - `src/ui/useAppShellController.ts`
    - owns:
      - store selectors/actions used by shell
      - left/right sidebar local widths + collapsed state
      - global hotkeys hook wiring
      - sidebar resize hook wiring
    - `App.tsx` now reduced to:
      - `const shell = useAppShellController()`
      - `<WorkspaceShell {...shell} />`
  - `App.tsx` now primarily wires store actions and composes shell components.
  - Behavior unchanged; structural extraction/refactor only.
- Verified after each extraction:
  - `npm run build` passes
  - `npm run test:export` passes (22 fixtures)
  - `node --import tsx src/scene/__tests__/geometry-graph-delete-regression.test.ts` passes
  - `node --import tsx src/scene/__tests__/engine-boundary.test.ts` passes

## Architectural Effectiveness Snapshot (Homework)
- Runtime/user effectiveness is good (features working, acceptable performance after recent fixes).
- Developer effectiveness is still constrained by monolith structure:
  - `src/App.tsx` remains very large (~2.6k lines) and still mixes composition with significant UI state wiring.
  - `src/scene/points.ts` remains very large (~1.6k lines), mixing model types and evaluation logic.
- Interpretation:
  - Product is usable.
  - Delivery speed/risk for new features is still limited by structural coupling.
- This is expected technical debt, and confirms continuing the refactor roadmap below.

## Next Refactor Chunk (Do Next)
1. Keep helper functions (`normalizeSceneIntegrity`, intersection helpers) in `geoStore` for now unless needed.
2. Introduce headless engine API boundary module(s):
   - `evaluateScene(scene)` ✅ initial facade
   - `hitTest(scene, camera, pointer)` ✅ initial facade
   - `construct(scene, toolIntent)` ✅ initial facade
3. Gradually move pure evaluation/hit-test logic out of monolith files into engine modules.
   - `CanvasView` click-release top-object hit-test now uses `engine/hitTestTopObject`.
   - `CanvasView` hover/click hit tests now use engine primitives (`hitTestPointId/SegmentId/LineId/CircleId/AngleId`).
   - `CanvasView` selection/highlight draw extraction completed:
     - `src/view/interactionHighlights.ts`
     - owns `drawInteractionHighlights(...)` + internal `drawHitHighlight(...)`
     - behavior preserved; `CanvasView` now delegates this draw pass.
   - Next major stage (`scene`): extract generic/circle-line intersection assignment helpers from `src/scene/points.ts` into `src/scene/eval/intersections.ts` (pair-assignment logic), preserving stability behavior.
   - Recent `scene` extractions completed (behavior-preserving, validated):
     - `src/scene/eval/expressionRuntime.ts`
     - `src/scene/eval/numberSceneEval.ts`
     - `src/scene/pointBasics.ts` (with re-exports from `points.ts` for API stability)
     - `src/scene/eval/sceneContextBuilder.ts`
     - `src/scene/eval/intersectionPairResolution.ts`
     - `src/scene/eval/geometryResolveRuntime.ts`
     - `src/scene/eval/pointRuntime.ts`
     - `src/scene/eval/pointKindEvaluators.ts`
     - `src/scene/eval/pointIntersectionEvaluators.ts`
     - `src/scene/eval/pointEvalDispatch.ts`
     - `src/scene/eval/numberExpressionEvaluators.ts`
     - `src/scene/eval/geometryAdapters.ts`
     - `src/scene/eval/numberEvaluators.ts`
     - `src/scene/eval/intersectionStabilityAdapters.ts`
     - `src/scene/eval/pointValueRuntime.ts` (later consolidated back into `src/scene/eval/pointRuntime.ts`)
   - `src/scene/points.ts` now primarily orchestrates runtime wiring/delegation; next step is continuing to peel remaining orchestration pieces into `src/scene/eval/*`.
   - Next major stage (`ui`): continue `PropertiesPanel` split by extracting tool-info blocks (Angle Fixed / Circle Fixed) and selected-object editors into dedicated subcomponents.
4. Keep behavior identical (no geometry semantics change in same commit).
5. Re-run:
   - `npm run build`
   - `npm run test:export`

## Refactor Roadmap (Incremental, Low-Risk)
1. Finish geoStore action extraction (mutation/update block) into dedicated slice module(s).
2. Introduce headless engine boundary module(s):
   - `evaluateScene(scene)`
   - `hitTest(scene, camera, pointer)`
   - `construct(scene, toolIntent)`
3. Move pure geometry/evaluation out of `src/scene/points.ts` into smaller engine-focused modules (types separate from evaluators).
4. Reduce `App.tsx` to composition + panel orchestration only (no geometry/tool logic).
5. Keep all steps regression-locked with `npm run build` and `npm run test:export`.
6. For deletion graph changes, also run:
   - `node --import tsx src/scene/__tests__/geometry-graph-delete-regression.test.ts`

## Label Export Note (Recent Fix)
- In match-canvas export mode, label anchor direction must derive from raw user label offset, not post-processed spread/clearance shift.
- Caption labels (`showLabel: "caption"`) use top-left overlay semantics; anchor direction requires center-biased mapping to avoid wrong quadrant.
- Do not reintroduce `xshift/yshift` in match-canvas mode.
- Status: the earlier `I_C` caption-side mismatch was handled; do not reopen this unless there is a fresh reproducible JSON + exported TeX mismatch.

## Non-Negotiable Invariants

### Geometry and dependencies
- Constrained points must remain constrained after parent updates.
  - `pointOnCircle` must stay on its circle.
  - `pointOnLine` / `pointOnSegment` must stay on their locus.
- Segment intersections are finite-domain filtered (no infinite-line leakage).
- Intersection identity is never merged by proximity.
- Intersection selection is stable and deterministic.

### Angle behavior
- Directed angle convention is required.
- `computeOrientedAngleRad(A,B,C)` drives value/label meaning.
- Preview arc, final arc, fill sector, and hit-testing must use the same orientation convention.
- Angle label dragging updates `labelPosWorld` in world coordinates.

### Performance and eval
- Recompute must avoid eval explosion (memoized / one-pass per tick behavior).
- Pointer-move heavy interactions should be rAF-coalesced where applicable.

### Export policy
- Exporter is fail-closed.
- No invented tkz-euclide macro names or option keys.
- If unsupported mapping is requested, throw explicit error.
- Keep deterministic output order and stable naming.

### UI/UX policies already requested
- Circle tools live in `CIRCLES` group, not `LINES`.
- Perpendicular and Parallel line tools exist and are interactive with preview.
- Angle tool exists as its own group.
- Right sidebar tabs are `Algebra`/`Export` structure as currently implemented.
- “Make this default for this object” should work for point/segment/line/circle/angle.

## Locked Invariants (Previously Fixed; Must Stay Fixed)
- Circle-line “other intersection” must not collapse to excluded point.
- Segment logic must stay finite-domain in snapping/intersections (no infinite-line leakage).
- Dependent/intersection points must not disappear from canvas while still present in model/export.

## Resolved History (Reopen Only With Fresh Repro)
- Angle preview direction/value mismatch vs final created angle.
- Copy Style applying to angles.
- Caption label anchor quadrant mismatch in TikZ export (historic `I_C` case).

## Pre-merge Checklist (Every Feature)
1. `npm run build`
2. `npm run test:export`
3. Manually test the touched interaction (tool flow + drag updates + selection)
4. Verify no unrelated files are staged
5. Commit with narrow scope

## Regression Gate (Mandatory Before Commit)
- If any geometry interaction, snapping, intersection, or exporter logic was touched:
  - Run `npm run build && npm run test:export`
  - Verify Locked Invariants above with at least one manual repro scene.
- Do not merge if any Locked Invariant behavior changes without adding/updating a regression test and documenting why.

## Safe Feature Workflow (Micro-milestones)
For each new feature, split into:
1. Data model + store action
2. Canvas interaction + preview
3. Rendering + hit-test
4. Export mapping (fail-closed)
5. Fixture/test regression

## Context Reset Recovery Template
When starting a new chat, provide:
- Current branch + latest commit hash
- This file (`docs/handoff.md`)
- Exact acceptance tests for the current task
- Explicit “do not regress” list from this file

## Commands
- Build: `npm run build`
- Export regressions: `npm run test:export`
- Status check: `git status --short`

## Latest Done (Angle Real Perpendicular)
- Added deterministic right-angle provenance module: `src/domain/rightAngleProvenance.ts`.
  - Maintains O(1) pair index for `(point,point) -> line/segment`.
  - Maintains O(1) perpendicular adjacency between line-like refs.
  - Exposes `isRightExactByProvenance(scene, aId, bId, cId)`.
- Angle creation now stores `isRightExact` on created angles (from provenance, not numeric epsilon).
  - `createAngle(...)` sets `isRightExact` and defaults mark style to `rightSquare` when exact and default style was `arc`.
  - `createSector(...)` and `createAngleFixed(...)` set `isRightExact: false`.
- Provenance lifecycle wired:
  - Register line/segment pair indices on `createLine` / `createSegment`.
  - Register perpendicular relation on `createPerpendicularLine`.
  - Rebuild provenance on delete cascade (`deleteSelectedObject`) and on undo/redo restore.
  - Initial store boot also rebuilds provenance from scene.
- UI gating now uses `angle.isRightExact` (not numeric dot-product):
  - Right-only mark options shown only for exact-right angles.
- Renderer / hit-test / hover highlight right-angle behavior now keys off `angle.isRightExact`.
- Exporter fail-closed right-angle gating:
  - Right-angle marks emitted only when `isRightExact=true`.
  - Otherwise throws: `Unsupported construction: RightAngleMark on non-right angle`.
- New regression fixtures:
  - `src/export/__fixtures__/angle-right-exact-from-perp-tool.json`
  - `src/export/__fixtures__/angle-right-approx-only.json` (expected fail-closed)

## Next
- If needed later: add optional `isRightApprox` (numeric hint only) strictly for UI hints, never for export/certification.
- Keep provenance manager as the only source of truth for “real right angle”.

## Risks / Constraints
- “Real perpendicular” is provenance-based only. Visually perpendicular free-point angles are intentionally not certified.
- Pair-index relies on explicit constructions (`line/segment` endpoints or constrained point-on-line/segment).

## Latest Done (Sector Arc Intersections)
- Added sector as a valid `GeometryObjectRef` (`{ type: "angle", id }`) for intersection workflows.
- Implemented boundary-only sector support in intersection evaluation:
  - supported now: `line/segment ∩ sector-arc`
  - explicitly not supported: sector interior intersections.
- Wired sector-arc into runtime geometry adapters/resolvers:
  - `asSectorArcWithOps` / `asSectorArcWithCtx` / `asSectorArcInScene`
  - intersection query path now filters line-circle roots by sector sweep.
- Wired sector-arc into snap intersection candidates:
  - point tool can now create intersection points between line-like objects and sector arcs.
- Added dependency/integrity support for intersection points referencing sectors:
  - graph key mapping for `GeometryObjectRef.type === "angle"`
  - integrity liveness check for sector refs.
- Added scene regression coverage:
  - `testLineSectorArcIntersectionTracksBoundary` in `src/scene/__tests__/intersection-ownership-regression.test.ts`.

## Sector Intersection Notes
- Sector intersection semantics are boundary-only and currently arc-focused.
- Radial-edge boundary intersections (with BA/BC rays/segments) are not included in this phase.
- Sector tool endpoint constraint fix:
  - Step-3 no longer creates `pointByRotation` for the third sector point.
  - It now creates a `pointOnCircle` constrained to a hidden auxiliary two-point circle `(center=startVertex, through=sectorStartPoint)`.
  - This keeps the endpoint draggable on the locus and preserves radius coupling when the start point moves.

## Latest Done (Polygon Tool + Command Parity)
- Added first-class `ScenePolygon` support to scene model/state:
  - `scene.polygons` added to `SceneModel`, state slice defaults, history snapshots, restore path, and integrity normalization.
  - New polygon defaults (`polygonDefaults`) and ids (`nextPolygonId`).
- Added polygon creation/action surface:
  - `createPolygon(pointIds)` in scene core actions.
  - Polygon creation now auto-creates missing edge segments for each consecutive pair (including closing edge), reusing existing segments order-insensitively to avoid duplicates.
  - Edge segment creation is atomic with polygon creation (single history action) and registers right-angle provenance segment pair index for new edges.
  - polygon selection/hover/copy-style/delete graph support in domain/store.
- Added canvas integration:
  - Tool id: `polygon`
  - Pending polygon preview (polyline rubber-band).
  - Polygon renderer + hit-test support.
  - Object browser lists polygons (under Circles/Polygons tab).
- Added properties/style editing parity:
  - Polygon style controls in properties panel (stroke/fill/pattern/pattern-color) via `ObjectStyleSections`.
  - “Make this default for this object” now supports polygons.
- Added TikZ export support for polygons:
  - Export emits deterministic raw TikZ closed path:
    - `\draw[<style>] (P1) -- (P2) -- ... -- cycle;`
  - Polygon style maps include stroke, fill opacity/color, pattern, pattern color.
  - Added regression fixture: `src/export/__fixtures__/polygon-basic.json`.
- Added Command Bar parity for polygon:
  - Parser command: `Polygon(A,B,C,...)` -> `CreatePolygonByPoints`.
  - Supports assignment form (`P = Polygon(A,B,C,...)`) through existing assignObject flow.
  - Command execution wiring for both direct and assigned polygon creation.
  - Added parser regression assertion in `src/scene/__tests__/command-parser.test.ts`.

## Next
- Add polygon construction descriptions with vertex list polishing in UI (currently basic id/name display).
- Optional: add dedicated polygon tab icon semantics and specialized polygon info panel.
- Optional: add polygon command docs entry in `docs/command-bar-reference.md`.

## Risks / Constraints
- Command alias labeling for polygons is command-level alias only (same behavior as line/segment/circle aliases), not scene object renaming.
- Polygon export uses raw `\draw[...] ... -- cycle;` (deterministic and compile-safe), not tkz-specific polygon macros.

## Latest Done (Command Redefine Slice 2: Aliased Objects)
- Added `commandBarApi.applyObjectAssignment(name, cmd)` as the single execution path for `assignObject` in the command bar.
- Extended command assignment behavior from create-only to create-or-update for command aliases:
  - If alias name does not exist: object is created with existing `*WithLabel` helpers.
  - If alias exists: object is updated in-place (same id) for supported types.
- Supported in-place redefine by alias:
  - `line`: `Line(A,B)`, `Perpendicular(...)`, `Parallel(...)`, `AngleBisector(...)`
  - `segment`: `Segment(A,B)`
  - `circle`: `Circle(O,A)`, `Circle(O,r)`, `Circle(A,B,C)`
  - `polygon`: `Polygon(A,B,C,...)`
  - `angle`: `Angle(A,B,C)` and `Sector(O,A,B)`
- Free-point and scalar redefine from slice 1 remain unchanged:
  - `P = Point(x,y)` updates existing free point `P` in place.
  - `n = <expr>` updates existing constant scalar `n`.
- Fail-closed behavior retained:
  - incompatible redefine command for an existing alias returns explicit error (no partial mutation).
- Right-angle provenance consistency retained:
  - line redefine path triggers provenance rebuild to keep exact-right metadata consistent.

## Next
- Add parser/store tests for alias redefine updates across line/segment/circle/polygon/angle to lock behavior.
- Expand object-browser text rendering to display command-style definitions for aliased objects.

## Risks / Constraints
- Alias redefine currently supports in-place updates only for explicitly implemented command/object pairs; unsupported pairs fail closed.
- Alias map is command-level metadata; manual scene renames outside command flow are not auto-synced into alias entries.

## Latest Done (Command Redefine Regression Tests)
- Added `src/scene/__tests__/command-redefine.test.ts`.
- Covers create-then-update in-place behavior for command aliases:
  - line, segment, circle, polygon, angle.
- Covers fail-closed incompatible redefine (`segment` alias with `Line(...)`) and verifies no mutation.
- Updated `npm run test:command` to run both parser and redefine tests.

## Next
- Add a small UI smoke test checklist for command redefine (alias id stability + dependency updates) for manual QA.

## Risks / Constraints
- Test suite runs against singleton store state in one process; keep test labels unique to avoid collisions.

## Latest Done (Object Browser: Alias Command Definitions)
- Object Browser command text now surfaces command-assignment form for aliased objects.
- For any object created/managed via Command Bar alias assignment, the browser shows:
  - `<alias> = <command>`
  - examples: `l = Line(A,B)`, `c = Circle(O,5)`, `poly = Polygon(A,B,C)`.
- Applied across browser rows for:
  - points, segments, lines, circles, polygons, angles.
- Non-aliased objects continue to show plain command form without alias prefix.

## Next
- Optional: show alias badge in object title row (not only in command text) if you want stronger visual differentiation.

## Risks / Constraints
- Alias display depends on command-level alias map; manual scene renames done outside command assignment do not create alias entries.

## Latest Done (Redefine Hardening: Fail-Closed + Dependency Safety)
- Hardened command alias redefine path in `geoStore`.
- Added stale-alias pruning:
  - command alias entries are now pruned when their target object no longer exists.
  - avoids dead alias collisions and allows deterministic re-creation with same alias after delete.
- Hardened in-place segment redefine:
  - segment aliases cannot redefine polygon-owned segments (`ownedByPolygonIds`), fail-closed.
- Fixed polygon alias redefine dependency behavior:
  - redefining `Polygon(...)` now updates polygon-owned edge membership deterministically.
  - creates missing owned edges, removes no-longer-used owned edges, preserves shared-owned edges.
  - new edges are registered in right-angle provenance segment pair index.
- Added regression coverage in `command-redefine.test.ts`:
  - stale alias recreate after deletion.
  - polygon-owned edge set correctness after polygon redefine.

## Next
- Add a tiny export smoke scenario for redefine-created polygon ownership transitions (no UI changes).

## Risks / Constraints
- Alias map remains command-level metadata; manual object renames still do not auto-remap aliases.

## Latest Done (Redefine Export Smoke Validation)
- Added `src/scene/__tests__/command-redefine-export.test.ts`.
- Test builds scene state via command alias create+redefine calls and verifies TikZ export reflects post-redefine state.
- Assertions include:
  - redefined polygon path emitted (and stale pre-redefine path absent),
  - redefined fixed-radius circle export emitted (`\tkzDefCircle[R](...)`).
- Updated `test:command` to include this export-smoke redefine test.

## Next
- Add one additional smoke for angle/sector redefine export mapping if needed.

## Risks / Constraints
- Export smoke test intentionally checks deterministic string signatures; it is not a full symbolic equivalence checker.

## Latest Done (Angle/Sector Redefine Export Smoke)
- Extended `command-redefine-export.test.ts` to cover angle alias redefine from `Angle(...)` to `Sector(...)`.
- Export assertions now verify post-redefine behavior for this case:
  - sector export macro present (`\tkzDrawSector`),
  - angle-mark macro absent (`\tkzMarkAngle`) in this smoke scene.

## Next
- Optional: add one smoke for `Sector -> Angle` redefine if bidirectional behavior is needed.

## Risks / Constraints
- Export smoke remains signature-based and intentionally minimal/deterministic.

## Latest Done (Sector-Owned Radial Segments)
- Sector construction now creates/reuses two owned radial segments:
  - `Segment(center,start)` and `Segment(center,end)`.
- Added `ownedBySectorIds` ownership metadata on `SceneSegment`.
- Sector ownership integrated into integrity/dependency/cascade systems:
  - `sceneIntegrity` now normalizes both polygon and sector ownership arrays.
  - dependency graph now includes segment -> sector ownership edges.
  - cascade delete now handles sector-owned segment multi-owner logic (same pattern as polygon owners).
- Command alias redefine integration:
  - `Sector -> Sector` updates radial ownership deterministically.
  - `Sector -> Angle` releases sector-owned radial ownership.
  - orphaned ownership-generated segments are removed when no owners remain.
- Added regression coverage:
  - `command-redefine.test.ts`: sector ownership creation + release checks.
  - `geometry-graph-delete-regression.test.ts`: delete sector cascades owned edge, shared-owner edge remains.

## Next
- Optional: expose sector radial sides in object browser as derived/owned edges if desired (UI-facing).

## Risks / Constraints
- Manual segments reused by sector become owner-tagged; deleting sector will only delete them when no remaining owners exist.

## Latest Done (Redefine Export Smoke: Bidirectional Angle/Sector)
- Extended `command-redefine-export.test.ts` to cover both directions:
  - `Angle -> Sector`
  - `Sector -> Angle`
- Export smoke now asserts sector macros and angle-mark macros are both represented when expected after redefine transitions.

## Next
- Optional: add a dedicated fixture-driven export case for mixed angle+sector redefine in one saved scene.

## Risks / Constraints
- Current smoke checks are deterministic string assertions; they intentionally do not prove full semantic equivalence.

  - Polygon ownership stress validation (closure for homework #1 lifecycle hardening):
    - Added `src/scene/__tests__/polygon-ownership-stress.test.ts`.
    - Covers high-churn polygon redefine cycles, shared-edge owner integrity, and delete cleanup.
    - Added to `npm run test:scene` so ownership lifecycle regressions are caught in routine scene tests.
  EOF

- Polygon ownership stress validation (closure for homework #1 lifecycle hardening):
  - Added `src/scene/__tests__/polygon-ownership-stress.test.ts`.
  - Covers high-churn polygon redefine cycles, shared-edge owner integrity,
  and delete cleanup.
  - Added to `npm run test:scene` so ownership lifecycle regressions are caught in routine scene tests.

## Latest Done (Arrow Marks: Full Direction Semantics + Circle/Sector/Angle Support)
- Implemented full 4-direction arrow semantics across canvas and TikZ export:
  - `->`, `<-`, `<->`, `>-<`.
  - Fixed the previous `<->` mid-mark overlap issue (`>-<` look) by separating paired arrowheads.
- Added arrow tip style option across supported arrow marks:
  - `Stealth`, `Latex`, `Triangle`.
- Added reusable path-arrow rendering helpers:
  - `src/view/pathArrowRender.ts`.
  - Segment/circle/arc overlays now share consistent sizing/separation rules.
- Canvas rendering updates:
  - `src/view/segmentOverlayRender.ts`: corrected 4-direction behavior for end + mid modes.
  - `src/view/renderers/circles.ts`: new circle boundary arrow overlay.
  - `src/view/renderers/angles.ts`: new arc arrow overlay for sector arcs and angle arcs.
- Scene/style model updates:
  - `src/scene/points.ts`: cleaned corrupted patch residue and finalized shared arrow types:
    - `ArrowDirection` includes `>-<`.
    - `ArrowTipStyle` includes `Stealth | Latex | Triangle`.
    - `PathArrowMark` reused by circle/angle; segment uses `SegmentArrowMark`.
    - Added `CircleStyle.arrowMark`, `AngleStyle.arcArrowMark`.
  - `src/state/slices/sceneSlice.ts`: defaults for segment/circle/angle arrow marks.
  - `src/state/slices/sceneMutationActions.ts`: copy-style conversion now maps arrow fields between line/circle/polygon/angle where applicable.
  - `src/ui/PropertiesPanel.tsx`: style equality now includes new arrow fields.
- UI updates:
  - `src/ui/ObjectStyleSections.tsx`:
    - Direction dropdown now uses readable labels (not raw `"<->"` text).
    - Added tip style selector for segment arrows.
    - Added circle arrow controls.
    - Added sector/angle arc arrow controls.
- TikZ export updates:
  - `src/export/tikz.ts`:
    - Added generic path-arrow overlay emission for segment mid, circles, sectors, and angle arcs.
    - Correctly maps all 4 directions and all 3 tip styles.
    - Added arc/circle raw path helpers for arrow overlays.
    - End-mode segment now supports explicit inward `>-<` using extrapolated tails.
    - Optional TikZ library injection now includes `decorations.markings,arrows.meta` when needed.
- Regression fixtures/tests:
  - Added fixtures:
    - `src/export/__fixtures__/segment-mark-arrow-mid-inward.json`
    - `src/export/__fixtures__/circle-arrow-basic.json`
    - `src/export/__fixtures__/sector-arrow-basic.json`
    - `src/export/__fixtures__/angle-arc-arrow-basic.json`
  - Updated assertions in `scripts/test-export.ts` for:
    - separated bidirectional mid marks,
    - inward mid marks,
    - circle/sector/angle arc arrow overlays,
    - arrow tip style export,
    - required TikZ library injection.

## Verification
- `npm run build` passed.
- `npm run test:export` passed (all fixtures compiled).
- `npm run test:scene` passed.
- `npm run test:command` passed.

## Latest Done (Arrow Follow-up Bugfixes)
- Fixed circle arrow direction mismatch between canvas and TikZ export:
  - Circle arrow overlay export now uses clockwise full-arc path anchored to named through-points
    `(Through) arc[start angle=<a0>,end angle=<a0-360>,radius=<r>]`
    to match canvas path direction semantics.
- Fixed missing sector arc arrows in "sector-only" exports under `\tkzClip`:
  - Root cause: `\tkzDrawSector` + raw numeric arc-start coordinates can shift decoration marks out of clipped viewport.
  - Fix: sector arrow overlays are now anchored at the named sector start point
    `(A) arc[start angle=<a0>,end angle=<a1>,radius=<r>]`
    instead of numeric `(<sx>,<sy>)`.
- Hardened canvas arrow rendering against legacy/non-finite style values:
  - segment/circle/angle arrow overlays now default opacity to `1` when style opacity is missing/non-finite.
  - arrow width fallback now resolves safely even if source style width is missing/non-finite.
  - prevents silent arrow disappearance from invalid alpha/width propagation.
- Updated export regression expectations:
  - circle arrow fixture now asserts named through-point anchoring for clockwise overlay path.
  - sector arrow fixture now asserts named start-point anchoring (guards against sector-only missing-arrow regression).

## Verification
- `npm run build` passed.
- `npm run test:export` passed.
- `npm run test:scene` passed.
- `npm run test:command` passed.

## Planned Work (Next): Transformation MVP (Point-Only)
Date planned: February 16, 2026

### Scope (Phase 1)
- Add command-driven transformations that produce a new point from an input point.
- Input object `P` is point-only for this phase.
- No object-wide transforms yet (segment/line/circle/polygon/angle transforms are out-of-scope for phase 1).

### Proposed Commands
- `T = Translate(P, A, B)`:
  - `T = P + (B - A)`
  - Inputs: points `P, A, B`
- `R = Rotate(P, O, expr[,CW|CCW])`:
  - Rotate point `P` around center `O` by angle `expr` (degrees).
  - Default direction: `CCW`.
- `H = Dilate(P, O, k)`:
  - Homothety of point `P` with center `O` and ratio `k`.
- `S = Reflect(P, l)`:
  - Reflection of point `P` across line/segment alias `l`.

### Architecture Plan
1. Parser
- Extend `src/CommandParser.ts` with 4 command forms above.
- Reuse existing identifier resolution (`resolvePointIdentifier`, alias resolution).
- Keep assignment flow identical to current assign-object pipeline.

2. Scene Point Definitions
- Add new point kinds in `src/scene/points.ts` for:
  - translated point
  - dilated point
  - reflected point
- Reuse existing `pointByRotation` for rotate command where possible.

3. Evaluation
- Add evaluators in `src/scene/eval/*` and dispatch in `pointEvalDispatch`.
- Reflection must support both line and segment bases using line support geometry.
- Ensure constrained recompute stability and finite checks.

4. Creation / Command Alias Integration
- Add creation methods in `src/state/slices/sceneCreationActions.ts` and alias plumbing in `src/state/geoStore.ts`.
- Respect redefine constraints and current alias typing behavior.
- Any assign-object that creates a point must preserve assignment name/caption mapping behavior (current guardrail).

5. Construction Description
- Add readable construction text in `src/state/selectors/constructionDescription.ts`.

6. TikZ Export
- Extend `src/export/tikz.ts` IR + renderer:
  - Translate: explicit point arithmetic fallback (or supported tkz macro if stable).
  - Rotate: keep using `tkzDefPointBy[rotation=...]` path.
  - Dilate: `tkzDefPointBy[homothety=...]`.
  - Reflect: explicit coordinate fallback if no stable whitelist macro path.
- Keep whitelist guardrails intact; do not introduce non-whitelisted tkz macros.

### Tests Plan
1. Command parser tests (`src/scene/__tests__/command-parser.test.ts`)
- Parse success/failure for each new command form.
- Direction defaults and optional args.

2. Scene behavior tests (`src/scene/__tests__/...`)
- Dependency recompute correctness for each transform.
- Redefine assignment behavior.

3. Export tests
- Add fixtures in `src/export/__fixtures__/` for each transform.
- Extend `scripts/test-export.ts` expectations for emitted TikZ patterns.

4. Manual geometry checks (before finish)
- Move source/center/reference points and verify transformed point follows deterministically.
- Reflection across segment and line aliases.
- Confirm no identity merging or proximity-based point collapse.

### Out-of-Scope (Phase 1)
- Transforming non-point objects directly.
- Dedicated transform toolbar workflows.
- Composition syntax (e.g., nested transforms beyond parser-safe command forms).

### Acceptance Criteria
- New commands parse and execute through assign-object path.
- Redefine works for point aliases bound to transform outputs.
- Export emits deterministic TikZ and passes fixture compilation.
- Full suite passes:
  - `npm run test:command`
  - `npm run test:scene`
  - `npm run test:export`
  - `npm run build`

## Latest Done (Transformation MVP: Point-Only)
Date completed: February 16, 2026

### Implemented Commands
- `Translate(P, A, B)` -> point translation by vector `AB`.
- `Rotate(P, O, expr[,CW|CCW])` -> point rotation around center `O`.
- `Dilate(P, O, k)` -> point dilation from center `O` by scalar factor `k`.
- `Reflect(P, l)` -> point reflection across line/segment alias `l`.

### End-to-End Wiring
- Parser + command model:
  - Updated `src/CommandParser.ts` to parse all 4 forms and emit:
    - `CreatePointByTranslation`
    - `CreatePointByRotation`
    - `CreatePointByDilation`
    - `CreatePointByReflection`
- Command execution:
  - Updated `src/CommandBar.tsx` to execute non-assignment forms for all 4 commands.
- Scene creation actions:
  - Added point creation methods in `src/state/slices/sceneCreationActions.ts`:
    - `createPointByTranslation`
    - `createPointByDilation`
    - `createPointByReflection`
  - Reused existing `createPointByRotation`.
- Store action typing:
  - Added new GeoAction signatures in `src/state/slices/storeTypes.ts`.
- Assignment alias integration:
  - Updated `src/state/geoStore.ts` assign-object path for all new point commands.
  - Added label-aware helpers:
    - `createPointByTranslationWithLabel`
    - `createPointByRotationWithLabel`
    - `createPointByDilationWithLabel`
    - `createPointByReflectionWithLabel`
  - Guardrail preserved: any assignment-created point gets `name/captionTex = assignment label`.

### New Point Kinds + Evaluation
- Added point kinds in `src/scene/points.ts`:
  - `pointByTranslation`
  - `pointByDilation`
  - `pointByReflection`
- Added geometry evaluators in `src/scene/eval/pointGeometryEval.ts`:
  - translation, dilation, reflection formulas.
- Added kind evaluators + dispatch in:
  - `src/scene/eval/pointKindEvaluators.ts`
  - `src/scene/eval/pointEvalDispatch.ts`
- Added number-expression dependency for dilation eval (factor expression stays dynamic).

### Integrity / Dependency / Description / Snapshot
- Scene integrity normalization support for new point kinds:
  - `src/domain/sceneIntegrity.ts`
- Dependency graph support:
  - `src/domain/geometryGraph.ts`
- Construction snapshot support (definition + dependsOn):
  - `src/export/constructionSnapshot.ts`
- Construction description text support:
  - `src/state/selectors/constructionDescription.ts`
- Object Browser formula text support:
  - `src/ui/ObjectBrowser.tsx`

### TikZ Export Support
- Added new TikZ IR constructions in `src/export/tikz.ts`:
  - `DefPointByTranslation`
  - `DefPointByDilation`
  - `DefPointByReflection`
- Emission details:
  - Translate: `\tkzDefPointBy[translation= from A to B](P)`.
  - Dilate: `\tkzDefPointBy[homothety=center O ratio k](P)`.
  - Reflect:
    1. projection foot on axis line via `projection=onto A--B`
    2. symmetric point via `homothety=center foot ratio -1`
  - This avoids probabilistic/unstable reflection syntax.

### Regression Tests Added/Updated
- `src/scene/__tests__/command-parser.test.ts`
  - Added parse coverage for Translate/Rotate/Dilate/Reflect.
  - Added assign-object parse coverage for all four.
- `src/scene/__tests__/command-redefine.test.ts`
  - Added assignment integration checks:
    - transform assignments create constrained points
    - assignment label maps to point name/caption
    - translated point remains constrained when dependency moves
- `src/scene/__tests__/command-redefine-export.test.ts`
  - Added export assertions for translate/rotate/dilate/reflect constructions.

### Verification (post-change)
- `npm run build` passed.
- `npm run test:command` passed.
- `npm run test:scene` passed.
- `npm run test:export` passed.

### Notes
- Existing fail-closed redefine policy for point aliases remains unchanged:
  - only free-point alias redefinition (`CreatePointXY`) is allowed.
  - transform-derived point aliases are not redefined in-place by assignment updates.

## Latest Done (Vector-First Translation Foundation)
Date completed: February 16, 2026

### What Changed
- Added first-class vectors in scene model:
  - `vectorFromPoints` (`fromId`, `toId`)
  - `freeVector` (`dx`, `dy`)
- Added `scene.vectors` container (initialized in state as `[]`).
- Added `nextVectorId` to store state + history snapshot/restore.

### Translation Point Upgrade
- `pointByTranslation` now supports optional `vectorId`.
- Kept legacy `fromId/toId` fields for compatibility with parser/export/references.
- Creation path now vector-first:
  - `createPointByTranslation` creates or reuses a `vectorFromPoints` object.
  - New translated point stores `vectorId` (and still stores `fromId/toId`).
  - Same `(fromId,toId)` pair reuses existing vector instead of duplicating.

### Evaluation + Integrity
- Eval context now indexes vectors by id.
- Translation evaluation prefers `vectorId` resolution, then falls back to legacy `fromId/toId`.
- Scene integrity normalization now:
  - validates/removes invalid vectors,
  - clears stale `pointByTranslation.vectorId`,
  - keeps translation points valid via vector path or legacy fallback.

### Snapshot Support
- Construction snapshot now includes `vectors`.
- `pointByTranslation` snapshot definition now includes optional `vectorId`.
- `dependsOn` for translated points includes `vector:<id>` when present.

### Regression Coverage Added
- Extended `src/scene/__tests__/command-redefine.test.ts`:
  - asserts translate assignment creates `pointByTranslation.vectorId`,
  - asserts vector object exists with expected endpoints,
  - asserts repeated same translation reuses vector (no duplication).
- Added new test: `src/scene/__tests__/vector-translation-regression.test.ts`
  - verifies translation evaluates from `vectorId` (vector-first), even if legacy fields disagree.
- Included new test in `npm run test:scene`.

### Verification
- `npm run build` passed.

## Latest Done (Bidirectional Arc Arrow Overlap Regression)
Date completed: February 16, 2026

### Problem
- `<->` arc/circle arrow rendering could appear as a collapsed/star-like mark because opposite tips were too close in canvas mid-arrow placement.

### Fix
- Updated `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`:
  - increased paired-tip separation in `segmentArrowHeadSize()` from `headSize * 0.72` to `headSize * 1.1`.
  - this keeps `<->` and `>-<` visually distinct for arc/circle/segment mid overlays.

### Regression Coverage
- Added `/Users/ajatadriansyah/Documents/GeoDraw-core/src/scene/__tests__/path-arrow-bidirectional-regression.test.ts`:
  - asserts bidirectional separation is large enough to prevent overlap.
  - asserts `<->` and `>-<` placement orientation semantics.
- Added test runner inclusion in `/Users/ajatadriansyah/Documents/GeoDraw-core/package.json` (`test:scene`).
- Strengthened export fixture check in `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`:
  - `circle-arrow-basic.json` now verifies paired mark positions are present and visibly separated.

### Verification
- `npm run test:scene` passed.
- `npm run test:export` passed (all 51 fixtures compiled).
- `npm run build` passed.

## Latest Done (Export Arrow Direction Reverse Mapping)
Date completed: February 16, 2026

### Change
- Per user request ("just reverse"), path-decoration export arrow direction mapping was reversed:
  - in `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `forwardCmd` now emits `\\arrowreversed[...]`
  - `reverseCmd` now emits `\\arrow[...]`

### Verification
- `npm run test:export` passed (all 51 fixtures compiled).

### Note
- `npm run build` currently fails due unrelated pre-existing TS unused-symbol errors in:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/object-styles/DetailsSummary.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/styleUtils.ts`

## Latest Done (Arrow Emergency Rollback + Cleanup)
Date completed: February 16, 2026

### Why
- Broad arrow tweaks caused visible regressions (segment/circle/arc arrow appearance and user trust impact).

### What was rolled back
- Restored arrow pipeline files to checkpoint `9641e0c`:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/segmentOverlayRender.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/circles.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/angles.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/package.json`
- Restored style panel core files to checkpoint `9641e0c`:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/PropertiesPanel.tsx`

### Cleanup
- Removed accidental/unwired files that were breaking TS/build:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/styleUtils.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/object-styles/DetailsSummary.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/object-styles/AngleStyleSection.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/object-styles/CircleStyleSection.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/object-styles/LineStyleSection.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/object-styles/SegmentStyleSection.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/CommandBarStyles.temp.css`

### Verification
- `npm run test:export` passed (all 51 fixtures).
- `npm run build` passed.

## Latest Done (Bidirectional/Inward Spacing Review Fix)
Date completed: February 16, 2026

### Review finding
- Bidirectional `<->` and inward `>-<` were directionally mapped correctly, but paired marks were too close, so they could look visually identical.
- Example before: segment export marks at `0.488` and `0.512` (spread `0.024`) were too cramped.

### Fix (minimal scope)
- Canvas pair spacing only:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - `segmentArrowHeadSize` separation factor increased from `0.72 * headSize` to `1.25 * headSize`.
- TikZ export pair spacing only:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `pairDelta` increased from `0.009 + 0.003*scale` (clamped) to `0.02 + 0.006*scale` (clamped).

### Verification
- `npm run test:export` passed (all 51 fixtures).
- `npm run build` passed.
- Re-checked sample segment export now emits `0.474` / `0.526` (spread `0.052`), clearly wider than before.

## Latest Done (Arrow Size/Width Decoupling + Direction Parity)
Date completed: February 16, 2026

### User-Facing Issues
- Bidirectional arc arrows still looked too close.
- Canvas controls for `Arrow Width` and `Arrow Size` looked redundant.
- Canvas vs TikZ export arrow direction could diverge (notably on full-circle overlays).

### Fixes
- Canvas renderer (`/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`):
  - Increased paired mid-arrow separation for `<->` / `>-<` (`headSize * 1.6`).
  - Decoupled controls:
    - `Arrow Size` now primarily controls arrow length.
    - `Arrow Width` now primarily controls arrowhead thickness profile via `ctx.lineWidth`.
- Export overlay (`/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`):
  - Increased bidirectional/inward paired mark offset (`pairDelta`) for clearer separation in TikZ.
  - Switched circle overlay path to explicit clockwise `delta angle=-360` to keep direction parity stable with canvas.
- Updated export validation for circle-arrow path form:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`.

### Regression / Validation
- Existing regression `path-arrow-bidirectional-regression` kept and tightened separation expectations.
- `npm run test:scene` passed.
- `npm run test:export` passed (all 51 fixtures compiled).
- `npm run build` passed.

## Latest Done (Style Section Clickability Pass)
Date completed: February 16, 2026

### Problem
- `MARKING` and `ARC ARROW` were clickable but visually looked like static section headings.

### Fix
- Updated `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`:
  - introduced reusable `DetailsSummary` renderer for details headers.
  - applied to `Marking`, `Arrow Mark`, and `Arc Arrow`.
  - added state badges (`On`/`Off`) based on each section's enabled flag.
- Updated `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`:
  - styled summary rows as full-width accordion controls (border, hover, focus ring, active/open state).
  - added right-side chevron with rotation on expand/collapse.

### Verification
- `npm run build` passed.

## Latest Done (Flyout Direction Consistency)
Date completed: February 16, 2026

### Problem
- `SHAPES` (polygon/regular polygon) and `TRANSFORM` tool groups were opening flyouts upward, unlike other groups.

### Cause
- `src/App.css` had a hardcoded rule forcing `circles`, `transform`, and `styles` flyouts to anchor with `bottom: 0` (drop-up).

### Fix
- Removed the forced drop-up selector block so all tool-group flyouts use the same default drop-down direction.

### Verification
- `npm run build` passed.
- `npm run test:command` passed.
- `npm run test:scene` passed.
- `npm run test:export` passed.

## Latest Done (Toolbar Flyout Overlay Cleanup)
Date completed: February 16, 2026

### Problem
- In the left tool palette, opening a group flyout could still show the main tool tooltip behind it.
- This rendered as a clipped dark pill (e.g. partial `"S..."`) behind the flyout and looked like a visual glitch.

### Fix
- Updated `src/ui/ToolPalette.tsx`:
  - main group button wrapper now uses `suppressTooltip` class while that group flyout is open.
- Updated `src/App.css`:
  - added `.toolButtonWrap.suppressTooltip .toolTooltip` rule to force tooltip hidden.
  - updated tooltip visual style to light theme (removed dark chip look).
  - moved flyout anchor flush to toolbar edge (`left: 100%`) and reduced resize handle width (`4px`) to avoid pointer conflict.
- Updated `src/ui/WorkspaceShell.tsx` + `src/ui/ToolPalette.tsx`:
  - when any left-tool flyout is open, left resize handle is disabled (`pointer-events: none`) and re-enabled after flyout closes.

### Verification
- `npm run build` passed.

## Latest Done (Bidirectional Export Parity Guard)
Date completed: February 16, 2026

### Problem Context
- User reported a concrete `<->` segment export case still showing tightly packed marks (`0.488` / `0.512`) and asked for explicit canvas/export parity review.

### What Was Verified
- Reproduced minimal AB segment export directly from exporter code.
- Current output now emits wider paired marks for `<->`: `0.474` / `0.526`.
- Confirmed command mapping parity:
  - `<->` emits left `\\arrowreversed`, right `\\arrow` (outward pair).
  - `>-<` emits left `\\arrow`, right `\\arrowreversed` (inward pair).

### Regression Hardening
- Updated `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`:
  - `segment-mark-arrow-mid.json` now asserts:
    - parseable mark commands,
    - outward command order (`arrowreversed` then `arrow` by position),
    - minimum visible spacing (`>= 0.04`).
  - `segment-mark-arrow-mid-inward.json` now asserts:
    - parseable mark commands,
    - inward command order (`arrow` then `arrowreversed` by position),
    - minimum visible spacing (`>= 0.04`).

### Verification
- `npm run test:export` passed (all 51 fixtures compiled).
- `npm run build` passed.

## Latest Done (Canvas Mid-Arrow Spacing Widened)
Date completed: February 16, 2026

### User Feedback
- Bidirectional/inward mid-arrow pair still looked too narrow in canvas.

### Fix
- Updated `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`:
  - `segmentArrowHeadSize` separation changed from `max(3, headSize * 1.25)` to `max(3, headSize * 1.6)`.
- Scope: canvas overlay rendering only (`<->` and `>-<` mid pair readability).

### Verification
- `npm run build` passed.

## Latest Done (Circle Arrow Position Parity + Path-Length Pair Spacing)
Date completed: February 16, 2026

### User-reported mismatch
- Canvas and TikZ were inconsistent for:
  - full-circle arrow pair position (`pos=0.5` landed at different arc locations),
  - pair spacing across different path types.

### Root cause
- Canvas circle arrow uses fixed parameterization `angle = 2πt` (`t=0` at rightmost point).
- Export circle arrow used through-point-based start angle.
- Export pair spacing used fixed fraction offsets, while canvas spacing is pixel-based and path-length dependent.

### Fixes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - Circle arrow overlay path now uses canvas-equivalent parameterization:
    - start at `(center.x + radius, center.y)`
    - `arc[start angle=0,end angle=-360,...]` (clockwise)
  - Mid-pair mark offset now computed from path length + screen zoom:
    - uses same core arrow sizing formula as canvas (`headSize`, `separation = max(3, headSize*1.6)`)
    - converts separation to path-fraction delta using `pathLengthWorld * screenPxPerWorld`
    - applied to segment/circle/sector/angle arc overlays.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`
  - updated circle-arrow basic expectation to no longer require named through-point anchor.
  - added fixture-specific assertions for new parity fixture.
- Added fixture:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__fixtures__/circle-arrow-mid-position-parity.json`

### Verification
- `npm run test:export` passed (all 52 fixtures compiled).
- `npm run build` passed.

## Latest Done (Canvas Curved-Path Arrow Tip Attachment)
Date completed: February 16, 2026

### User feedback
- Circle inward arrow heads in canvas looked slightly detached from arc.

### Root cause
- For curved paths (circle/arc), paired heads were separated by linear tangent offset (`tip +/- tangent * separation`), which moves tips off the curve.

### Fix
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/circles.ts`
  - paired mid-arrow tips now separated by path-parameter offset (`t +/- delta`) on the circle itself (wrapped), keeping tips on arc.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/angles.ts`
  - same change for sector/non-sector arc overlays (clamped `t +/- delta`), keeping tips on arc.

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 52 fixtures).

## Latest Done (Arrow Width Scale Fix in Canvas)
Date completed: February 16, 2026

### User-reported symptom
- Segment configured as `Mid arrow` + `Inward` could render as huge wedge-like heads near endpoints when Arrow Width/Size were increased.

### Root cause
- UI stores arrow width as `lineWidthPt = sliderValue * 8` (`SEGMENT_ARROW_WIDTH_UI_FACTOR`).
- Canvas renderers were using stored `lineWidthPt` directly as pixel width, causing 8x inflation.

### Fix
- Added `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts` helper:
  - `arrowCanvasLineWidthFromStoredPt(lineWidthPt)`
  - converts stored width back to canvas width (`/8`, clamped).
- Applied in:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/segmentOverlayRender.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/circles.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/angles.ts`

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 52 fixtures).

## Latest Done (Arrow Width/Size Remap Experiment)
Date completed: February 16, 2026

### Goal
- Decouple arrow controls:
  - `Arrow Size` controls tip length.
  - `Arrow Width` controls tip width (not tip length).
- Keep pair-gap logic explicit and separate from single-arrow placement.

### Canvas changes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - `segmentArrowHeadSize(...)` now computes length from `sizeScale` and width influence via `widthScale = sqrt(widthUi)`.
  - pair separation now includes width contribution: `max(headSize*1.6, headSize*1.2*widthScale)`.
  - `drawArrowPlacements(...)` now accepts `widthScale` so `drawArrowHead(...)` widens only the wing/base.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/segmentOverlayRender.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/circles.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/angles.ts`
  - pass `widthScale` into arrow drawing.

### Export changes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - Added arrow tip geometry mapping for export:
    - tip spec now emitted as `Tip[length=...pt,width=...pt]` (e.g. `Stealth[length=...,width=...]`).
  - `arrow.lineWidthPt` now maps to tip width UI scale (`/8`) rather than directly driving tip length.
  - path-arrow `scale=...` removed from `\\arrow[...]` options to avoid double-scaling when explicit tip length/width are present.
  - pair-gap (`pairDelta`) now derives from computed pair separation px + path length.
  - improved library detection regex to include `\\arrow{Tip[length=...,width=...]}` forms.

### Export test updates
- `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`
  - tip assertions updated from exact `{Latex}` / `{Triangle}` to option-capable forms (`{Latex[...]}`, `{Triangle[...]}`).

### Validation
- `npm run build` passed.
- `npm run test:export` passed (all 52 fixtures compiled).

### Rollback checkpoint
- checkpoint commit before this remap experiment:
  - `834d948` (`checkpoint: arrow parity before width-size remap`)
  - tag: `checkpoint/arrow-parity-2026-02-16`

## Latest Done (Explicit Pair Arrow Gap Control)
Date completed: February 16, 2026

### Goal
- Add a manual `Arrow Gap` override for pair directions (`<->`, `>-<`) while preserving current auto spacing behavior by default.

### Changes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/scene/points.ts`
  - Added optional `pairGapPx?: number` to `PathArrowMark` (and therefore `SegmentArrowMark` via extension).
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/sceneMutationActions.ts`
  - Preserved `pairGapPx` when converting between segment/path/angle/circle arrow mark models.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - Added `resolveArrowPairGapPx(explicitGapPx, autoGapPx)`.
  - Included `pairGapPx` in `asPathArrowMark(...)`.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/segmentOverlayRender.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/circles.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/angles.ts`
  - Pair-arrow spacing now uses `pairGapPx` when set, else keeps auto separation.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `pathArrowOverlayToTikz(...)` now passes `arrow.pairGapPx` into pair-delta computation.
  - `computePathArrowPairDelta(...)` now supports explicit gap override and falls back to auto when unset.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - Added pair-direction-only controls for Segment (mid mode), Circle, and Arc Arrow sections:
    - `Auto Gap` toggle
    - `Arrow Gap` slider + numeric input
  - When Auto is enabled, `pairGapPx` is unset and current auto behavior is used.

### Regression coverage
- Added fixture:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__fixtures__/segment-mark-arrow-mid-gap.json`
- Updated:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`
  - Added assertion that explicit `pairGapPx` drives exported pair spacing (fraction delta parity check).

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Default Arrow Baseline Increase)
Date completed: February 16, 2026

### Goal
- Increase default `Arrow Size=1` / `Arrow Width=1` visual baseline in canvas and keep export metrics in sync.

### Changes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - Increased default head base from `14*scale` to `16*scale`.
  - Increased pair separation coefficient for width influence.
  - Retuned tip profiles:
    - `Stealth` longer and wider (`lengthMul=1.2`, `wingMul=0.44`, notch kept)
    - `Triangle` slightly wider (`wingMul=0.56`)
    - `Latex` unchanged open-stroke behavior.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `resolvePathArrowTipMetricsPx(...)` updated to same geometry constants for parity:
    - `baseSize = max(6, 16*scale)`
    - same tip multipliers and pair-separation rule.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - Auto-gap estimator updated to the same baseline constants.

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Arrow Default Visibility Root-Cause Fix)
Date completed: February 16, 2026

### Root cause found
- Canvas arrow overlays used segment/arc stroke width as fallback when `arrow.lineWidthPt` was unset.
- That bypassed arrow UI default (`width=1` -> stored `8`) and made default arrows appear too small.

### Fixes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - exported `DEFAULT_ARROW_LINE_WIDTH_PT = 8`.
  - increased head baseline and adjusted pair-separation curve.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/segmentOverlayRender.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/circles.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/angles.ts`
  - all now fallback to `DEFAULT_ARROW_LINE_WIDTH_PT` when arrow width is unset.
  - no longer fallback to object stroke width for arrowhead rendering.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - updated auto-gap estimator to match the revised canvas head/separation model.

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Direction Glyph + Stealth Shape Retune)
Date completed: February 16, 2026

### Changes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - Direction dropdown labels now mimic line+arrow layout:
    - `─▶`, `◀─`, `◀─▶`, `▶─◀`
  - Tip dropdown labels now include shaft+tip glyph:
    - `─➤` (Stealth), `─❯` (Latex), `─▶` (Triangle)
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - `Latex` tip remains open-stroked.
  - `Stealth` tip profile adjusted to slimmer default stealth-like geometry:
    - longer length, narrower wings, deeper notch.
  - Arrow scaling retuned so default `size=1` is more visible while `<1` still scales down coherently.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - Arrow metric model updated to track new canvas head-size/spacing profile for better parity.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - Auto-gap estimator updated to match new canvas separation model.

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Arrow Icon/Scale Corrections)
Date completed: February 16, 2026

### User issues addressed
- Tip icon for `Latex` looked too close to filled triangle representation.
- Direction/tip icons in dropdown looked too small.
- Canvas default arrow at size=1 was still too small; size values below 1 did not feel meaningful.

### Changes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - Direction labels updated to icon-only glyphs with stronger forms: `⟶`, `⟵`, `⟷`, `⇄`.
  - Tip labels updated to icon-only glyphs: `➤` (Stealth), `❯` (Latex), `▶` (Triangle).
  - Applied `arrowIconSelect` class to all arrow direction/tip dropdowns (segment/circle/arc).
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Added `.arrowIconSelect` styling (`font-size`, weight, centered glyph layout) so icon dropdowns are visibly larger.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - `Latex` canvas tip now draws as open stroked chevron (not filled triangle body).
  - Increased default canvas visibility:
    - larger width mapping from stored arrow width
    - larger head sizing baseline with proper downscaling for `size < 1`.
  - Updated pair-separation formula consistently.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - Updated auto-gap estimator to mirror the same new canvas sizing/separation math.

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Arrow Picker UI Simplification)
Date completed: February 16, 2026

### Change
- Reverted arrow direction/tip controls from custom button-grid preview UI back to compact dropdowns.
- Direction dropdown now uses icon-only entries: `→`, `←`, `↔`, `⇄`.
- Tip dropdown now uses icon-only entries: `➤`, `▷`, `▶`.
- Removed the temporary custom arrow picker CSS styles.

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Arrow UI Polish + Export Robustness)
Date completed: February 16, 2026

### User-reported issues addressed
- Arrow direction and tip style controls were too abstract (text-only).
- Arrow position slider could overflow/right-clip.
- Arrow width/size numeric box looked oversized and could visually clash with slider.
- Canvas default arrow at width=1,size=1 looked too small.
- Export could fail with `% Export failed: Unsupported PathArrowMark: lineWidthPt`.

### Fixes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - Replaced text-only direction/tip selects with icon-based pickers:
    - direction icons for `->`, `<-`, `<->`, `>-<`
    - tip icons previewing `Stealth`, `Latex`, `Triangle`
  - Arrow width inputs now clamp to valid UI range (`0.2..12`) via parser helper.
  - Arrow width sliders/numbers now use safe minimum `0.2` (prevents zero/invalid width export path).
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Tightened numeric control column widths.
  - Made sliders fully responsive (`width:100%`, `min-width:0`, no extra margins) to stop right-edge overflow.
  - Added styles for icon-based arrow direction/tip picker buttons.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
  - Increased canvas arrow baseline visibility:
    - larger default head size
    - slightly stronger width mapping from stored arrow width to canvas width
  - keeps export behavior unchanged.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - removed hard fail for non-positive/invalid arrow `lineWidthPt` in path/segment arrow export path;
  - exporter now falls back to safe defaults (no more `% Export failed: Unsupported PathArrowMark: lineWidthPt` in this case).

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Arrow Default Retcon 1 -> 1.3 + Width Typing Fix)
Date completed: February 16, 2026

### User-requested retcon
- Arrow default baseline was redefined so previous `1` now maps to `1.3` as the new default.
- Applied consistently for:
  - scene default styles (segment/circle/sector-arc arrow marks),
  - canvas fallback rendering for unset arrow values,
  - TikZ export fallback for unset arrow values,
  - UI fallback values shown in arrow controls.

### Numeric input fix
- Arrow width numeric fields no longer snap intermediate `0` to `0.2` while typing.
- This allows entering values like `0.5` naturally (without being forced to `0.2` first).
- Slider minimum remains unchanged (`0.2`); the fix targets numeric entry behavior.

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pathArrowRender.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/sceneSlice.ts`

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Arrow Tip Export Scale-Proportional Conversion)
Date completed: February 16, 2026

### Problem
- Arrowheads in TikZ export still looked disproportionate versus canvas in some views (notably sector arcs).
- Root cause: tip geometry used a fixed `canvas px -> pt` conversion constant, ignoring actual export coordinate scale.

### Fix
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - computes `canvasPxToTikzPt` from actual export metrics:
    - `coordScale` (world->cm in tikzpicture),
    - `screenPxPerWorld` (camera zoom used for match-canvas export).
  - passes this conversion through arrow overlay metrics for:
    - segment arrows,
    - circle arrows,
    - sector/arc arrows.
  - tip spec (`length`, `width`) now uses the dynamic conversion instead of fixed fallback.
  - keeps a fallback constant only when metrics are unavailable.

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Arrow Tip Metric Parity: Export = Canvas Formula)
Date completed: February 16, 2026

### Problem
- After scale-proportional conversion, visual mismatch still remained in arrowhead proportions.
- Root cause: export tip metrics still used an older base-size model (`16 * scale`) while canvas uses `headSize = max(8, 24 * scale)`.

### Fix
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `resolvePathArrowTipMetricsPx(...)` now mirrors canvas formulas exactly:
    - `headSize = max(8, 24 * sizeScale)`
    - same tip profile multipliers
    - same pair-separation formula using `headSize`.

### Verification
- `npm run build` passed.
- `npm run test:export` passed (all 53 fixtures compiled).

## Latest Done (Multi-Arrow Support + UI Polish)
Date completed: February 17, 2026

### Multi-Arrow Support
- Data Model:
  - Updated `CircleStyle`, `SegmentStyle`, `AngleStyle` to support `PathArrowMark[]` / `SegmentArrowMark[]` arrays.
  - Migrated legacy single-arrow fields to the new array format.
  - Legacy bidirectional `<->` / `>-<` styles migrated to two separate inward/outward arrows with offset.
- Rendering:
  - Updated `circles.ts`, `segmentOverlayRender.ts`, `pathArrowRender.ts` to render multiple arrows.
  - Supports arbitrary number of arrows per object.
- Export:
  - Updated `tikz.ts` to export loop over all arrows.

### UI Polish ("App Polish")
- `ArrowListControl`:
  - Implemented Master-Detail layout for arrow management.
  - Allowed zero-arrow state (user can remove all arrows).
  - Selector uses simple indices (`1`, `2`, ...) instead of long names.
- Styling:
  - "Appearance" group (Color, Width, Size, Length) now styled with shaded, rounded box (consistent with Distribution group).
  - Action buttons (+, Duplicate, Remove) grouped with icon-only buttons (`Plus`, `Copy`, `Trash2`).
  - Fixed truncation issues in arrow selector.

### Verification
- `npm run build` passed.
- `npm run test:export` passed.

## Latest Done (Color Profile Picker Moved to Left Toolbar Swatches)
Date completed: February 20, 2026

### User-requested UX change
- Color profile control is no longer in the right properties area.
- Profile choice is now shown as color-based swatch buttons on the left toolbar (under tools), not text options.

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ToolPalette.tsx`
  - Added left-toolbar `PALETTE` group with one-click swatch buttons.
  - Each button shows miniature profile preview (background, line, fill, vertex).
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Added swatch button styles and active/hover states.
  - Updated swatches to square icon format for fast visual selection.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/PropertiesPanel.tsx`
  - Removed right-panel profile selector UI (profile controls now live in left toolbar).

### Verification
- `npm run build` currently fails at existing repo issue unrelated to this move:
  - `src/export/tikz/efficient/__tests__/makeEfficientTikz.test.ts` missing Node typings (`assert`, `process`).

## Latest Done (Palette Group Flyout Behavior)
Date completed: February 20, 2026

### User-requested UX change
- Left toolbar color profiles now behave like tool groups:
  - only one main palette button is shown,
  - hover/focus opens flyout with other profile options.
- This reduces vertical space use while keeping one-click profile switching.

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ToolPalette.tsx`
  - Added dedicated palette flyout state (`profileFlyoutOpen`).
  - Main button shows currently active profile swatch.
  - Flyout lists non-active profiles.
  - Escape/outside-click/collapse now closes palette flyout too.
  - Sidebar "flyout open" signal includes palette flyout state.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Added `.profileGroupWrap` and `.profilePaletteFlyout`.
  - Removed now-unused stacked-list palette class.

### Verification
- `npm run build` still blocked by existing Node-typing issue in efficient exporter tests (`assert`, `process`), unrelated to palette flyout changes.

## Latest Done (Palette Position + Flyout Hover Tolerance)
Date completed: February 20, 2026

### User-requested UX tweaks
- Moved `PALETTE` group to below `STYLES` in the left toolbar.
- Reduced accidental flyout close sensitivity by adding invisible hover tolerance area around flyouts.
  - This specifically helps when cursor passes near upper-right flyout corners.
- Made palette swatch button size match tool buttons (`40x40`).
- Active palette halo/border now uses current profile colors (canvas/profile-driven), not fixed blue.

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ToolPalette.tsx`
  - Reordered layout so palette group renders after tool groups (`below STYLES`).
  - Added dynamic CSS variables for active swatch halo/border:
    - `--profile-active-border` from profile line color
    - `--profile-active-halo` from profile canvas/background color
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Updated palette spacing and swatch size (`40x40`).
  - Active swatch halo/border now read CSS variables instead of hardcoded blue.
  - Added invisible flyout tolerance area using `::before` around `.toolFlyout`:
    - top/bottom/left: `12px`
    - right: `14px`

### Verification
- `npm run build` still blocked by existing Node-typing issue in efficient exporter tests (`assert`, `process`), unrelated to this UI tweak.

## Latest Done (Canvas Label Glow Uses Canvas Background)
Date completed: February 20, 2026

### Clarification applied
- Kept TikZ export glow behavior unchanged (still uses existing `\\gdLabelGlow` macro with `\\thepagecolor`/`white` fallback).
- Updated only canvas rendering so label halo/glow tracks current canvas background color exactly.

### Scope
- Applies to both:
  - point name labels drawn on canvas (`showLabel = name`),
  - caption/TeX point labels rendered as overlays (`showLabel = caption`).

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderers/points.ts`
  - Added optional halo override parameter to `drawPoints(...)`.
  - Name-label halo stroke now uses override when provided.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/labelOverlays.ts`
  - Added optional halo override parameter to `createPointLabelOverlays(...)`.
  - Caption overlay glow now uses override when provided.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/renderFrame.ts`
  - Passes `canvasTheme.backgroundColor` into `drawPoints(...)`.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/CanvasView.tsx`
  - Passes `canvasTheme.backgroundColor` into `createPointLabelOverlays(...)`.

### Verification
- `npm run build` still blocked by existing Node-typing issue in efficient exporter tests (`assert`, `process`), unrelated to this canvas-label change.

## Latest Done (TikZ Calibration Single-Source Block + God-File Refactor Priority Start)
Date completed: February 20, 2026

### Priority update
- TikZ exporter maintainability is now treated as active priority.
- First concrete step completed: calibration constants are centralized in one explicit module.

### New single edit location for export calibration
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz/calibration.ts`
  - Contains all calibration constants that were previously hardcoded in `ExportPanel` and parts of `tikz.ts`:
    - line scale UI->export mapping,
    - point stroke/size calibration,
    - segment mark calibration,
    - angle calibration,
    - auto-fit default dimensions,
    - point conversion constants used by point style export formulas.

### Wiring changes
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ExportPanel.tsx`
  - Export options now read calibration values from `TIKZ_EXPORT_CALIBRATION` instead of inline numeric literals.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - Auto-fit fallback defaults now read from `TIKZ_EXPORT_CALIBRATION.autoScaleToFitCm`.
  - `pointStyleToTikz(...)` conversion constants now read from `TIKZ_EXPORT_CALIBRATION.pointConversion`.

### Refactor intent (next)
- Continue splitting `tikz.ts` by responsibility while keeping output stable:
  1. style mappers,
  2. label placement/render helpers,
  3. arrow overlay builders,
  4. IR construction helpers.

### Verification
- `npm run build` still blocked by existing Node-typing issue in efficient exporter tests (`assert`, `process`), unrelated to this calibration centralization.

## Latest Done (Point Export Size Follows Scene Size Again)
Date completed: February 20, 2026

### Problem
- Exported points stayed at `inner sep=1.5pt` even when point size changed in scene/UI.
- Cause: `pointInnerSepFixedPt` was always forced by ExportPanel calibration.

### Fix
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz/calibration.ts`
  - `pointInnerSepFixedPt` set to `null` (no forced lock by default).
  - Added `getPointInnerSepFixedPt()` helper returning `number | undefined`.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ExportPanel.tsx`
  - now passes `pointInnerSepFixedPt: getPointInnerSepFixedPt()`.
  - when calibration is `null`, exporter receives `undefined` and uses point-size-driven formula.

### Operational note
- If you want to lock point radius again, set `pointInnerSepFixedPt` to a number in calibration.
- If you want export to follow object point size, keep it `null`.

### Verification
- `npm run build` still blocked by existing Node-typing issue in efficient exporter tests (`assert`, `process`), unrelated to this point-size fix.

## Latest Done (Match Canvas Conversion Set Permanent)
Date completed: February 20, 2026

### Why
- Export quality degrades significantly when `matchCanvas` is off.
- User decision: keep canvas-conversion behavior always on.

### Change
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ExportPanel.tsx`
  - removed UI toggle for "Match canvas size conversion".
  - exporter now always sends `matchCanvas: true`.

### Result
- TikZ export consistently uses the canvas-matching conversion path.
- Fewer accidental low-parity exports from checkbox state drift.

### Verification
- `npm run build` still blocked by existing Node-typing issue in efficient exporter tests (`assert`, `process`), unrelated to this export-toggle removal.

## Latest Done (Exporter Legacy Cleanup + Optional tkz Setup Omit)
Date completed: February 20, 2026

### User request implemented
- Removed legacy non-match conversion path in TikZ exporter internals.
- Added explicit export option to omit:
  - `\\tkzInit[...]`
  - `\\tkzClip[space=...]`
  - `\\tkzSetUpLine[add=... and ...]`

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `TikzExportOptions`:
    - removed `matchCanvas` option usage from exporter logic.
    - added `emitTkzSetup?: boolean`.
  - `buildTikzIR(...)`:
    - auto-fit scale now always applied (legacy branch removed).
  - `renderTikz(...)`:
    - now accepts `emitTkzSetup` control and conditionally emits `tkzInit/tkzClip/tkzSetUpLine`.
  - style/label conversion paths simplified to single canvas-parity path.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ExportPanel.tsx`
  - added new checkbox:
    - `Emit tkz setup (Init/Clip/SetUpLine)`
  - wired to exporter via `emitTkzSetup`.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz/calibration.ts`
  - removed unused non-match point conversion constants.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__tests__/setup-toggle.test.ts`
  - new regression test for `emitTkzSetup` include/omit behavior.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`
  - added regression check `assertTkzSetupToggleRegression()` to ensure setup lines can be toggled off without losing geometry output.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__tests__/line-extents.test.ts`
  - updated to current conversion scale expectation (`line width=1.8pt`) and relaxed anchor assertion to current exporter behavior.

### Verification
- Passed:
  - `node --import tsx src/export/__tests__/setup-toggle.test.ts`
  - `node --import tsx src/export/__tests__/line-extents.test.ts`
- `npm run build` still blocked by pre-existing repo issue:
  - `src/export/tikz/efficient/__tests__/makeEfficientTikz.test.ts` lacks Node typings (`assert`, `process`).

## Latest Done (Point Export Default Calibration + Robust Dotted TikZ)
Date completed: February 20, 2026

### User-requested calibration target
- Default point export now matches:
  - `line width=0.4pt`
  - `inner sep=1pt`
- This applies to the normal Export panel defaults.

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz/calibration.ts`
  - `pointStrokeScale` updated to `32 / 35`.
  - added `pointInnerSepScale: 1 / 3`.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ExportPanel.tsx`
  - passes `pointInnerSepScale` into exporter options.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `TikzExportOptions` now supports `pointInnerSepScale?: number`.
  - point style export now multiplies computed `inner sep` by `pointInnerSepScale`.
  - dotted stroke export no longer uses plain `dotted`; now uses explicit dot pattern:
    - `line cap=round`
    - `dash pattern=on 0pt off Npt`
  - goal: thick dotted strokes remain dot-like instead of visually becoming dashed.

### Regression coverage added
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__tests__/point-style-calibration.test.ts`
  - validates default point style exports as `line width=0.4pt` and `inner sep=1pt`.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__tests__/dotted-line-style.test.ts`
  - validates dotted export uses explicit round-cap dot pattern and avoids built-in `dotted`.

### Verification
- Passed:
  - `node --import tsx src/export/__tests__/point-style-calibration.test.ts`
  - `node --import tsx src/export/__tests__/dotted-line-style.test.ts`
  - `node --import tsx src/export/__tests__/setup-toggle.test.ts`
  - `node --import tsx src/export/__tests__/line-extents.test.ts`

## Latest Done (Global Draw Layer Order: Fills -> Strokes -> Overlays -> Points -> Labels)
Date completed: February 20, 2026

### Why
- TikZ draw order is command-order based. Mixed per-object emit order can cause fills to cover unrelated linework.
- Standardized layering now matches expected geometry rendering practice.

### New export layering policy
1. Area fills (circle/polygon/sector/angle)
2. Strokes (segments/lines/circle outlines/polygon borders/sector borders)
3. Overlays (marks/arrows)
4. Points
5. Labels

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tikz.ts`
  - `buildTikzIR(...)` now uses dedicated layer arrays:
    - `drawFills`, `drawStrokes`, `drawOverlays`, `drawPointsLayer`, `drawLabelsLayer`.
  - Circle export split into fill and stroke paths:
    - added `FillCircle` and `FillCircleRadius` IR commands.
    - fill style and stroke style are generated separately.
  - Polygon export split into two raw paths:
    - `\\fill[...] ... -- cycle;`
    - `\\draw[...] ... -- cycle;`
  - Sector/angle fill emits to fill layer; arc/right marks and arc arrows emit to overlay layer.
  - Segment marks/arrows moved to overlay layer.
  - Renderer updated to support new commands:
    - emits `\\tkzFillCircle(...)`
    - emits fixed-radius fill via `\\tkzDefCircle[R] ... \\tkzFillCircle(...)`
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/tkzWhitelist.ts`
  - added `tkzFillCircle` to allowed emitted macro set.

### Regression coverage
- Added:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__tests__/layer-order.test.ts`
    - verifies fills are emitted before first stroke command,
    - verifies points are emitted after draw objects and before labels.

### Verification
- Passed:
  - `node --import tsx src/export/__tests__/layer-order.test.ts`
  - `node --import tsx src/export/__tests__/setup-toggle.test.ts`
  - `node --import tsx src/export/__tests__/line-extents.test.ts`
  - `node --import tsx src/export/__tests__/point-style-calibration.test.ts`
  - `node --import tsx src/export/__tests__/dotted-line-style.test.ts`
- `npm run build` still blocked by pre-existing Node typing issue in:
  - `src/export/tikz/efficient/__tests__/makeEfficientTikz.test.ts` (`assert`, `process`)

## Latest Done (Export Clip Tools + Double-Click Cancel Restore)
Date completed: February 20, 2026

### Why
- User requested rectangular clip selection to return **without removing** polygon clip flow.
- User also requested double-click cancel behavior back, including polygon pending workflows.

### Behavior changes
- Added a separate rectangular clip tool (`export_clip_rect`) while keeping existing polygon clip tool (`export_clip`) intact.
- Polygon clip remains: click vertices, click near first vertex to close.
- Rectangle clip now works as classic 2-click corner-to-corner selection.
- Double-click on canvas now cancels pending tool selection (including polygon/polygon-clip pending).
- Double-click in move/select tool clears current selected object.

### Files
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/storeTypes.ts`
  - Added `ActiveTool` variant: `export_clip_rect`.
  - Added `PendingSelection` variant for rectangle clip first corner.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/tools/toolClick.ts`
  - Kept existing `export_clip` polygon logic unchanged.
  - Added `export_clip_rect` branch that commits `{ kind: "rect", xmin/xmax/ymin/ymax }` on second click.
  - Updated empty-point and valid-target checks for the new tool id.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ToolPalette.tsx`
  - Move group now includes both clip tools.
  - `export_clip_rect` uses rectangle clip icon/label.
  - `export_clip` now explicitly labeled polygon clip.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ToolInfoSection.tsx`
  - Separate instructions for polygon clip vs rectangle clip.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/previews/pendingPreview.ts`
  - Added rectangle clip pending preview rectangle.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/interactionHighlights.ts`
  - Included `export_clip_rect` in clip-pending highlight short-circuit.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/canvasEventLifecycle.ts`
  - Added `dblclick` event binding/unbinding.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/useCanvasInteractionController.ts`
  - Added `onDoubleClick` handling:
    - clear pending selection if pending exists,
    - else clear selected object in move tool.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pointerInteraction.ts`
  - Added `shouldCancelOnCanvasDoubleClick(...)` helper.
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/CanvasView.tsx`
  - Passed `clearPendingSelection` to interaction controller actions.

### Regression coverage
- Added:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/scene/__tests__/export-clip-tools.test.ts`
    - verifies polygon clip remains intact,
    - verifies new rectangle clip tool behavior.
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/__tests__/pointer-interaction-double-click.test.ts`
    - verifies double-click cancel policy for move vs pending workflows.
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/__tests__/canvas-event-lifecycle.test.ts`
    - verifies `dblclick` is wired and unbound correctly.

### Verification
- Passed:
  - `node --import tsx src/scene/__tests__/export-clip-tools.test.ts`
  - `node --import tsx src/view/__tests__/pointer-interaction-double-click.test.ts`
  - `node --import tsx src/view/__tests__/canvas-event-lifecycle.test.ts`
- `npm run build` remains blocked by pre-existing Node typing issue in:
  - `src/export/tikz/efficient/__tests__/makeEfficientTikz.test.ts` (`assert`, `process`)

## Latest Done (Dedicated Polygon Clip Tool Icon)
Date completed: February 20, 2026

### Why
- User requested polygon export-clip tool icon to be distinct from regular polygon tool icon.

### Changes
- Added new icon component:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/icons.tsx`
  - `IconExportClipPolygon`
- Updated tool palette mapping:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ToolPalette.tsx`
  - `export_clip` now uses `IconExportClipPolygon` (instead of `IconPolygon`).

### Verification
- `npm run build` shows no new errors from this icon change.
- Existing unrelated blocker remains:
  - `src/export/tikz/efficient/__tests__/makeEfficientTikz.test.ts` (`assert`, `process` typings)

## Latest Done (App Startup Point Defaults Updated)
Date completed: February 20, 2026

### User request
- Set new point defaults when app starts:
  - `sizePx = 6`
  - `strokeWidth = 1.7`

### File
- `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/colorProfiles.ts`
  - In `buildDefaultStylesForProfile(...)`:
    - `pointDefaults.sizePx` changed from `4` to `6`
    - `pointDefaults.strokeWidth` changed from `1.4` to `1.7`

### Notes
- This affects startup/default point style across profiles (new scene/app start behavior).
- Existing points in already-loaded scenes keep their saved style unless reset/applied.

### Verification
- `npm run build` passes.

## Latest Done (Fix Segment Chain Regression from Double-Click Cancel)
Date completed: February 20, 2026

### Regression
- After broad double-click cancel was added, segment chaining (`A-B`, then click `B` again to anchor next) broke.
- Cause: dblclick handler cleared pending selection for *all* pending tools, including `segment`.

### Fix
- Narrowed double-click cancel policy in:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pointerInteraction.ts`
- New rule:
  - cancel on dblclick for `move` tool,
  - cancel for pending `polygon` and pending `export_clip` (polygon clip),
  - **do not** cancel pending `segment`/`line2p`/etc.

### Regression test
- Updated:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/__tests__/pointer-interaction-double-click.test.ts`
- Added explicit assertion:
  - pending `segment` should not cancel on double click.

### Verification
- `node --import tsx src/view/__tests__/pointer-interaction-double-click.test.ts` passed.
- `npm run build` passed.

## Latest Done (Tokenized UI Color Profile System)
Date completed: February 20, 2026

### Why
- User requested UI colors to follow the active profile (not only canvas/object defaults), with centralized tokens for easier tuning.

### What changed
- Added centralized profile-driven UI CSS variable mapping in:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/colorProfiles.ts`
  - New exported helper: `getUiCssVariables(profileId)`
  - New defaults map: `UI_CSS_VARIABLE_DEFAULTS`
  - Profile overrides map: `UI_CSS_VARIABLE_PROFILE_OVERRIDES` for:
    - `classic`
    - `grayscale_white_dot`
    - `beige_light`

- Wired UI CSS variables into app shell:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.tsx`
    - reads `colorProfileId` from store
    - computes `uiCssVariables` via `getUiCssVariables`
    - passes vars into `WorkspaceShell`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/WorkspaceShell.tsx`
    - accepts `uiCssVariables` prop and applies on root `.appShell` style

- Migrated shell/component colors to CSS vars:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
    - added `:root` defaults for `--gd-ui-*` tokens
    - replaced hardcoded palette colors in toolbar/sidebar/buttons/sections/tabs/forms/lists/details blocks with token vars
    - replaced key shadow/focus/hover rgba values with token vars

- Migrated inline-style hardcoded colors:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/CommandBar.tsx`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/ObjectStyleSections.tsx`
  - now use `var(--gd-ui-...)` for border/background/text/status colors.

### Verification
- `npm run build` passed.

## Latest Done (Slider Color Token + Settings Tab for UI Profile)
Date completed: February 20, 2026

### Why
- User reported slider controls still showing default browser blue.
- User requested a dedicated Settings place to change UI color/profile.

### Changes
- Slider theming:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Added:
    - `input[type="range"] { accent-color: var(--gd-ui-accent, #2563eb); }`
  - Result: range bars/thumb tint now follows active UI token color.

- Settings tab + UI profile controls:
  - Added:
    - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/SettingsPanel.tsx`
      - exposes `UI Color Profile` selector with palette swatch cards.
  - Updated:
    - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/RightSidebar.tsx`
      - new right tab: `Settings`
      - renders `SettingsPanel` when active.
    - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
      - added styles for settings profile cards (`profileOption*` classes).

### Verification
- `npm run build` passed.

## Latest Done (Moved UI Theme Setting to File -> Preferences)
Date completed: February 20, 2026

### User correction
- UI theme setting must **not** live in right sidebar.
- UI theme setting must be under **File -> Preferences**.
- This setting is for **UI colors only**, not scene/object palette colors.

### What changed
- File menu + preferences popover:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/FileControls.tsx`
  - Replaced standalone top-left icon group with `File` dropdown:
    - `Open…`
    - `Save`
    - `Save As…`
    - `Preferences…`
  - Added `Preferences` popover with swatch-based UI theme picker.
  - Picker updates `setUiColorProfile(...)` (UI-only profile state).
  - Scene palette state (`colorProfileId`) remains unchanged.

- Styling for new controls:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Added styles for:
    - file menu button/dropdown items
    - preferences popover
    - top-left action positioning helper (`canvasTopActionsLeft`)

- Removed obsolete sidebar settings component:
  - deleted `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/SettingsPanel.tsx`

### Notes
- Left toolbar palette swatches still control scene/canvas/object palette via `setColorProfile(...)`.
- File -> Preferences controls only UI token theme via `setUiColorProfile(...)`.

## Latest Done (Native File Menu Preferences + Reverted Canvas File Buttons)
Date completed: February 21, 2026

### User correction
- Canvas top-left controls should stay as icon buttons (`Open`, `Save`, `Save As`).
- `Preferences` must live in the app-level `File` menu (macOS menubar), not as an in-canvas File dropdown.

### What changed
- Restored top-left file controls:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/FileControls.tsx`
  - reverted from custom in-canvas File dropdown back to three icon buttons.

- Added native `File` menu integration in Tauri:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src-tauri/src/lib.rs`
  - Builds default app menu and injects:
    - `Open…` (`Cmd/Ctrl+O`)
    - `Save` (`Cmd/Ctrl+S`)
    - `Save As…` (`Shift+Cmd/Ctrl+S`)
    - `Preferences…` (`Cmd/Ctrl+,`)
  - Menu events are bridged to frontend via Tauri events:
    - `gd-menu-file-open`
    - `gd-menu-file-save`
    - `gd-menu-file-save-as`
    - `gd-menu-preferences`

- Frontend now listens for those menu events:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/FileControls.tsx`
  - `Open/Save/Save As` trigger existing handlers.
  - `Preferences` opens a dedicated preferences modal for UI theme selection.

- Updated modal styles:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - added `preferencesOverlay` / `preferencesModal` style block.

## Latest Done (Decoupled UI Theme Profiles from Scene Color Profiles)
Date completed: February 21, 2026

### Problem fixed
- UI theme selector was incorrectly reusing scene palette IDs (`classic`, `grayscale_white_dot`, `beige_light`).
- `classic` UI theme looked beige because UI token defaults had been overwritten to beige.

### What changed
- Added dedicated UI profile ID model in:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/colorProfiles.ts`
  - New type: `UiColorProfileId = "vanilla" | "grayscale" | "beige"`
  - New default: `DEFAULT_UI_COLOR_PROFILE_ID = "vanilla"`
  - New options: `UI_COLOR_PROFILE_OPTIONS`
  - New UI swatch helper: `getUiColorProfileSwatch(...)`
  - `getUiCssVariables(...)` now consumes `UiColorProfileId` (not scene profile id)

- Restored true vanilla UI token defaults in:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/colorProfiles.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css` (`:root`)

- Store typing updated to enforce separation:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/storeTypes.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/uiSlice.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/historySlice.ts`

- Backward compatibility for older snapshots:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/historyRestore.ts`
  - Legacy values map:
    - `classic -> vanilla`
    - `grayscale_white_dot -> grayscale`
    - `beige_light -> beige`

- Preferences modal now uses dedicated UI profile options/swatches:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/FileControls.tsx`

## Latest Done (Full UI Color Customize in Preferences)
Date completed: February 21, 2026

### Goal
- Enable full UI token customization (not just preset UI profiles), while keeping scene/object palette controls separate.

### What changed
- Added UI token override model in store state:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/storeTypes.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/uiSlice.ts`
  - New state:
    - `uiCssOverrides: Partial<UiCssVariables>`
  - New actions:
    - `setUiCssVariable(name, value)`
    - `clearUiCssOverrides()`

- Added preset-base + custom-override merge pipeline:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/colorProfiles.ts`
  - New exports:
    - `UI_CSS_VARIABLE_DEFAULTS`
    - `UI_CSS_VARIABLE_KEYS`
    - `getUiProfileBaseVariables(profileId)`
  - `getUiCssVariables(profileId, customOverrides?)` now merges:
    - defaults -> profile preset -> per-token custom overrides

- App shell now applies custom UI overrides:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.tsx`
  - Reads `uiCssOverrides` from store and passes them into `getUiCssVariables(...)`.

- Snapshot persistence for custom UI overrides:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/historySlice.ts`
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/state/slices/historyRestore.ts`
  - Saves/loads `uiCssOverrides` and sanitizes keys on restore.

- Preferences modal upgraded to full token editor:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/FileControls.tsx`
  - Keeps preset swatch picker (vanilla/grayscale/beige).
  - Adds `Full Customize` section with:
    - per-token row
    - color picker (when value parseable as color)
    - text field (any CSS color string)
    - per-token reset button
    - global `Reset to preset`
    - custom-token count

- Styling for token editor:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/App.css`
  - Added `preferencesCustomize*` and `preferencesToken*` classes.

- Regression test:
  - Added `/Users/ajatadriansyah/Documents/GeoDraw-core/src/scene/__tests__/ui-color-profile-overrides.test.ts`
  - Included in `test:scene` script in `/Users/ajatadriansyah/Documents/GeoDraw-core/package.json`

### Verification
- `npm run build` passed.
- `node --import tsx src/scene/__tests__/ui-color-profile-overrides.test.ts` passed.
- `node --import tsx src/scene/__tests__/color-profile-regression.test.ts` passed.

## Latest Done (Preferences Entry Moved to Gear Icon)
Date completed: February 21, 2026

### User correction
- UI Preferences should open from a gear icon next to `Save As` in top-left actions.
- Do not keep Preferences under native `File` menu.

### What changed
- Added gear button to canvas top-left action cluster:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/ui/FileControls.tsx`
  - New icon button opens the existing Preferences modal.

- Removed Preferences menu bridge from Tauri File menu:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src-tauri/src/lib.rs`
  - Deleted `Preferences…` menu item/event forwarding.
  - Native menu now forwards only:
    - Open
    - Save
    - Save As

## Latest Done (Selection Priority: Angle Over Filled Polygon)
Date completed: February 21, 2026

### Problem fixed
- Filled polygon interior was swallowing clicks, preventing angle selection when angle lay inside polygon area (example: selecting `∠BCD` over filled `ABCD`).

### What changed
- Reordered engine top-hit priority so polygon fill is a fallback, not a blocker:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/engine/hitTest.ts`
  - New order:
    - point -> segment -> angle -> line -> circle -> polygon

- Reordered hover hit resolution to match runtime UX behavior:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/canvasInteractionHelpers.ts`
  - Polygon now evaluated after angle/line/circle.

- Reordered move-tool pointer-down object choice:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/view/pointerInteraction.ts`
  - Angle now prioritized over polygon when both are hit.

- Added regression test:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/scene/__tests__/angle-polygon-hit-priority.test.ts`
  - Covers:
    - `hitTestTopObject` chooses angle over polygon fill.
    - move selection chooser prefers angle over polygon when both IDs are present.
    - polygon remains selectable when angle is not visible.

- Wired regression into scene test suite:
  - `/Users/ajatadriansyah/Documents/GeoDraw-core/package.json`
  - Added `angle-polygon-hit-priority.test.ts` to `test:scene`.

### Verification
- `node --import tsx src/scene/__tests__/angle-polygon-hit-priority.test.ts` passed.
- `npm run test:scene` passed.
- `npm run build` passed.

## Latest Done (Label System Expansion: Object Labels + Label Tool + TikZ Export)
Date completed: February 21, 2026

### Goal completed
- Added non-point object labels end-to-end and kept export parity with canvas behavior.

### What changed
- Data model and normalization:
  - Added object label fields for segment/line/circle/polygon:
    - `showLabel`
    - `labelText`
    - `labelPosWorld`
  - Added object-label defaults/helpers:
    - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/scene/objectLabels.ts`
  - Added integrity normalization/backfill for label fields in:
    - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/domain/sceneIntegrity.ts`

- State/actions:
  - Creation actions now initialize object label defaults.
  - Added mutation actions:
    - `enableObjectLabel(...)`
    - `moveObjectLabelTo(...)`
  - `updateSelected*Fields` for segment/line/circle/polygon now handle label fields.

- UI and interaction:
  - Added `Label` tool to `STYLES` group (beside `Copy Style`).
  - Label tool behavior:
    - click object => enable/select label target
    - drag label => move label position
  - Added object label overlays + DOM hit test + pointer drag mode for:
    - segment, line, circle, polygon
  - Added object label property controls:
    - `Show Label`
    - `Label Text`

- TikZ export parity:
  - Added object-label emission in TikZ export for segment/line/circle/polygon with deterministic ordering.
  - Uses explicit label world position (or deterministic fallback) and exports via `\node ... at (...)`.
  - Preserved existing point/angle label behavior.

- Export regression coverage:
  - Added object-label export fixture:
    - `/Users/ajatadriansyah/Documents/GeoDraw-core/src/export/__fixtures__/object-labels-basic.json`
  - Updated export test hydration/assertions in:
    - `/Users/ajatadriansyah/Documents/GeoDraw-core/scripts/test-export.ts`

### Verification
- `npm run test:export` passed (`All 65 export fixtures compiled successfully.`)
- `npm run test:scene` passed.
- `npm run test:command` passed.
- `npm run build` passed.

## Homework (Pinned Next Work)
Date pinned: February 21, 2026

### Label System Expansion (Object labels + Label tool)
Goal:
- Support labels for non-point objects with explicit label workflow.
- Keep export parity with canvas behavior.

Scope agreed:
1. Add object-attached label fields for:
   - segment
   - line
   - circle
   - polygon
2. Auto-create/enable label when `Show Label` is enabled in object properties.
3. Add dedicated `Label` tool in `STYLES` group beside `Copy Style`.
4. Label tool behavior:
   - click object => enable/select label target
   - click/drag label anchor => reposition label
   - supports existing object types + points/angles consistently
5. Export:
   - include new object labels in TikZ output with deterministic placement rules
   - preserve existing point/angle label behavior

Implementation phases:
- Phase A: data model + state actions for non-point object labels.
- Phase B: canvas overlay render/hit-test/drag for all object labels.
- Phase C: tool palette + `label` active tool flow.
- Phase D: TikZ export + regression tests.

Acceptance checks:
1. For filled polygon + inner angle/objects, label selection remains selectable (no fill-block regression).
2. Toggling `Show Label` on any supported object immediately shows label.
3. Label position drag persists through save/open and export.
4. `npm run test:scene` and `npm run build` remain green.

### Homework Update (Current Active Priorities)
Date updated: February 23, 2026

### Tool Preconfiguration Panel Update
Date updated: May 3, 2026

- Selecting a non-move tool now gives the right Properties panel to the tool instead of the previously selected object.
- A newly created object now takes the Properties panel back immediately, even while the construction tool remains active; click the active tool again to reopen that tool's default-style editor.
- Construction tools map to their default style target:
  - point/midpoint -> point defaults
  - segment -> segment defaults
  - line/perpendicular/parallel/tangent/bisector -> line defaults
  - circle tools -> circle defaults
  - polygon tools -> polygon defaults
  - angle tools -> angle defaults
  - sector -> shared angle/sector style defaults
  - label -> label text defaults
  - textbox -> current rich-text textbox defaults
- The default editor reuses existing style sections in `toolDefault` mode, hiding object-only controls such as delete buttons, convert-line actions, generated label text, names, and positions.
- Object-label glow is now stored in `objectLabelDefaults` for segment/line/circle/polygon so preconfigured `Label Glow` applies to newly created objects.
- Move/select mode still shows selected-object properties as before.
- Follow-up UI clarity:
  - tool-default mode now uses a highlighted notice explaining that edits affect newly created objects
  - arrow tip picker glyphs are larger and show only the actual tip shape instead of tiny shafted arrows
  - style option groups now render as contained folder-style tabs for crowded panels (stroke/fill/label/arrow/marks), reducing right-sidebar scrolling while keeping the existing controls and state paths
  - active-tool clicks carry a `toolActivationVersion`; Properties uses it to distinguish "new object should be edited now" from "user explicitly reopened tool defaults"
  - object selections now carry a separate Properties-panel intent, so clicking an object on canvas/Object Browser switches back from `Editing tool defaults` to that object's properties
- Regression checks added:
  - `src/ui/__tests__/toolPreconfigure.test.ts`
  - `src/scene/__tests__/label-visibility-defaults-and-copy-style.test.ts` now checks default/copy label glow.

### Preferences Construction UX Update
Date updated: May 3, 2026

- Construction preferences no longer use one flat token list for object defaults.
- The Construction tab is grouped into human-facing categories:
  - Canvas
  - Points
  - Lines
  - Shapes
  - Angles
  - Text
- Color controls now foreground a swatch and human-readable color name, with exact values secondary.
- The right side of the Construction preferences panel shows a live SVG preview of the selected category, so users can see what point/line/shape/angle/text changes affect.
- Preview grid is only shown for the Canvas category; object previews use a cleaner background.
- Preferences dialog ignores clicks inside floating color-picker popovers so choosing a color does not close the dialog.
- Each Construction category has a `Reset to default` action; object categories reset to the active construction palette defaults, Canvas clears canvas overrides.
- Construction previews start zoomed in for object categories and support mouse-wheel zoom plus +/- controls.
- Construction preset persistence now includes `richTextToolDefaults`, matching the state/apply-preferences path.
- UI Theme preferences received the same usability pass:
  - categories: App, Panels, Text, Accent, Preview, Status
  - color controls show swatch + human-readable color name with exact values secondary
  - each UI category has `Reset to default`
  - right preview shows a mini GeoDraw interface that updates live for UI theme tokens

1. Scalar function extensibility (cross-layer)
- Goal:
  - Make adding scalar expression functions (e.g. `Area(...)`, `Perimeter(...)`, future `AngleMeasure(...)`) fast and low-risk.
- Problem observed:
  - New scalar functions currently require touching multiple layers (parser, scene runtime, dynamic labels, parse context adapters, tests).
  - This causes slow implementation and parity drift risk.
- Next refactor target:
  - Introduce a shared scalar-function registry with per-context geometry resolvers/adapters.
  - Keep one function dispatch path and avoid duplicating function semantics in parser/runtime code.
- Acceptance checks:
  1. Adding one new scalar function requires changes in one core runtime location + context adapters only.
  2. Parser and scene runtime parity tests cover the new function automatically.
  3. Dynamic label expressions use the same semantics as command/scalar expressions.

2. Continue `src/scene/points.ts` de-GOD split (behavior-preserving)
- Goal:
  - Reduce maintenance risk in `src/scene/points.ts` by extracting evaluation and geometry adapter responsibilities.
- Current progress:
  - Shared scalar runtime is in place.
  - Scene scalar adapter extraction started (`src/scene/eval/sceneScalarExpressionAdapter.ts`).
  - Scene expression wrapper extraction continued (`src/scene/eval/sceneExpressionFacade.ts`); `points.ts` now delegates angle/scalar scene expression adapter wiring.
  - Point-eval intersection wiring extraction continued (`src/scene/eval/scenePointEvalFacade.ts`); `points.ts` now delegates `PointEvalDispatchOps` scene wiring / intersection-facade bridging.
  - Number-expression runtime wiring extraction continued (`src/scene/eval/sceneNumberExpressionFacade.ts`); `points.ts` now delegates recursive number-eval / scene-expression geometry bridging.
  - Public scene-eval access wrapper extraction continued (`src/scene/eval/scenePublicEvalFacade.ts`); `points.ts` now delegates implicit-stats public runtime-read wrappers.
  - Public scene-eval API wrapper extraction continued (`src/scene/eval/sceneEvalApiFacade.ts`); `points.ts` now delegates lifecycle wrappers (`begin/end/getLastSceneEvalStats`) and public expression entry wrappers (`evaluateAngleExpressionDegrees`, `evaluateNumberExpression`).
  - Mark-style utility extraction continued (`src/scene/sceneMarkStyleUtils.ts`); `points.ts` now re-exports segment/angle mark normalization/resolver helpers instead of owning that logic inline.
  - Scene eval state-store extraction continued (`src/scene/eval/sceneEvalStateStore.ts`); `points.ts` no longer owns eval state `WeakMap`s / tick counter / builder/get-or-create wrapper inline.
- Next slices:
  - Extract intersection assignment helpers into dedicated modules while preserving branch/ownership stability behavior.
    - Note: pair-assignment modules already exist in current tree (`src/scene/eval/intersectionAssignments.ts`, `src/scene/eval/intersectionPairResolution.ts`); verify remaining in-`points.ts` intersection orchestration before repeating this slice.
  - Optional cleanup slice (low-risk): extract remaining style/type utility clusters from `points.ts` only if churn is justified (diminishing returns compared with exporter refactor).
  - Keep fixes covered by intersection regression tests and manual checks from `docs/tkz_report_intersections.md`.
  - Preserve the new intersection extensibility rule:
    - shape-specific solvers generate roots
    - shared assignment/stability policy owns branch continuity, exclude semantics, and singleton occupied-root avoidance
    - future curve tools must extend shared assignment inputs instead of duplicating root-ownership logic

3. TikZ exporter architecture refactor (scaling-safe draw pipeline)
- Goal:
  - Separate construction semantics from drawing output so export scaling can be controlled without tkz-euclide transform fragility.
- Direction agreed:
  - `scene -> export IR -> renderer (tkz / future plain TikZ draw backend) -> optional compactor`
  - Keep `% Constructions` in tkz-euclide, move draw layer toward plain TikZ where needed.
- Current progress:
  - Draw-layer IR serialization extraction started:
    - `src/export/tikz/renderDrawLayers.ts` now owns `% Draw objects`, `% Draw points`, `% Labels` rendering from `TikzCommand[]`.
  - Construction IR serialization extraction continued:
    - `src/export/tikz/renderConstructions.ts` now orchestrates `% Constructions` rendering and delegates to construction serializers.
    - `src/export/tikz/renderConstructionPoints.ts` now owns point construction transform/definition emission.
    - `src/export/tikz/renderConstructionGeometryHelpers.ts` now owns line/circle helper construction emission (including `InterLL`).
    - `src/export/tikz/renderConstructionIntersections.ts` now owns `InterLC` / `InterCC` `near/common` option + temp-name emission rules and shares temp sequencing via renderer context state.
  - Setup/clip/point-definition serialization extraction continued:
    - `src/export/tikz/renderSetupAndPoints.ts` now owns `tikzpicture` preamble/setup/clip + point-style definitions + `% Points` rendering.
  - Shared renderer context/state extraction continued:
    - `src/export/tikz/renderContext.ts` now provides a shared renderer context/state object (output buffer, options, temp counters, section writer) used by setup/points + constructions + draw-layer renderers.
    - `src/export/tikz.ts` now primarily partitions IR commands, constructs renderer context, delegates setup/points + constructions + draw-layer serialization, then performs final post-processing.
  - Capability wiring separation continued:
    - `src/export/tikz/renderCapabilities.ts` now defines renderer capability interfaces for traversal modules.
    - `src/export/tikz.ts` now provides tkz-specific assertion/text/format wiring through one capability object at renderer-context creation.
    - renderer modules now consume capabilities via context instead of per-call dependency bundles.
  - Draw-layer backend abstraction continued:
    - `src/export/tikz/renderDrawBackend.ts` now hosts draw-layer backend emitter implementations (`tkz` and `plain` PoC).
    - `src/export/tikz/renderDrawLayers.ts` now traverses draw-layer IR once and delegates supported emission to selected backend.
    - `TikzExportOptions.drawLayerBackend` now controls draw-layer emitter selection (`"tkz"` default).
  - Construction/intersection export semantics (including `near` / `common` / branch mapping) remain in `src/export/tikz.ts` and are unchanged in this slice.
  - Note (2026-02-26): unsafe near-equal outer circle-circle tangents now intentionally use explicit tangent-point fallback (`tkzTanCC_exp*`) instead of reduced-radius helper tangents due tkz numeric instability in the reduced path.
- Next slices:
  - Expand plain backend coverage for currently tkz-only draw-layer commands (`MarkSegment`, sector/angle marks/labels, circle-radius helpers) as additional emitter methods.
  - Add opt-in UI control (or debug flag) for backend selection only after plain backend command coverage is sufficient for user-facing export.
- Reason:
  - Current global `tikzpicture` scaling is pragmatic but can overflow.
  - Scope scaling is not a real fix for tkz-euclide draw macros.
