# Text Editor Rewrite

## Goal

Replace the current textbox editor with a source-first math editor that is pleasant for real TeX input.

The editor should feel closer to a lightweight LyX / Typst / matcha-style workflow:

- raw source is always editable
- rendered math is always visible
- suggestions help discover commands from `amsmath` and `amssymb`
- placeholders are navigable
- mixed paragraph text and math are first-class

This is explicitly **not** a WYSIWYG-over-the-caret editor. TeX source must remain easy to type and easy to revise.

## Product Rules

1. The typing surface shows source text, not rendered math.
2. Live preview is separate from the typing surface.
3. Inline math starts with `$...$`.
4. Display math starts with `\[...\]`.
5. Plain text paragraphs, inline math, and display math can be mixed in one textbox.
6. Resizing a textbox changes both writing area and exported layout.
7. Editing must remain usable for `\\frac{}{}`, `a_{n-1}^2`, `{n \\choose k}`, matrices, cases, aligned environments, and nested braces.

## Editor Architecture

### 1. Source Model

Keep a single canonical source string for each textbox.

Also maintain transient editor state:

- selection start / end
- active segment under cursor
- parsed spans
- completion query
- placeholder jump targets
- preview diagnostics

### 2. Segmented Parser

Replace the current lightweight segment splitter with a richer parser that emits:

- text spans
- inline math spans
- display math spans
- unmatched delimiter diagnostics
- brace range metadata
- command token metadata

The parser only needs to be robust enough for editing and preview. It does not need to be a full TeX engine.

### 3. Dual-Pane Canvas Editor

Each textbox edit session renders:

- top: source editor textarea / contenteditable source layer
- bottom: live preview layer

The source pane is for typing.
The preview pane is for feedback.

Do not stack preview over the caret again.

### 4. Completion Engine

Add completion suggestions triggered by:

- `\\fra` -> `\\frac{}{}`
- `\\alp` -> `\\alpha`
- `\\beg` -> common environments
- `_` and `^` context helpers

Initial command catalog should include high-value `amsmath` / `amssymb` commands:

- fractions: `\\frac`, `\\dfrac`, `\\tfrac`
- roots: `\\sqrt`
- scripts: `_`, `^`
- accents: `\\hat`, `\\bar`, `\\overline`, `\\vec`
- delimiters: `\\left`, `\\right`, `\\lvert`, `\\rvert`, `\\langle`, `\\rangle`
- operators: `\\sin`, `\\cos`, `\\tan`, `\\log`, `\\ln`, `\\max`, `\\min`
- symbols: `\\alpha`, `\\beta`, `\\gamma`, `\\theta`, `\\pi`, `\\infty`, `\\partial`, `\\nabla`
- relations: `\\leq`, `\\geq`, `\\neq`, `\\approx`, `\\cong`, `\\sim`, `\\in`, `\\subseteq`
- set / number symbols: `\\mathbb{R}`, `\\mathbb{Z}`, `\\mathbb{N}`, `\\varnothing`
- combinatorics: `\\binom`
- layout helpers: `\\text{}`, `\\quad`, `\\qquad`
- environments: `aligned`, `cases`, `matrix`, `pmatrix`, `bmatrix`

Each suggestion should provide:

- insert text
- snippet form with placeholders
- short label
- optional preview sample

### 5. Placeholder Navigation

Snippet insertion must support jump targets for braces.

Examples:

- `\\frac{}{}` -> jump numerator, then denominator
- `\\sqrt{}` -> jump radicand
- `\\binom{}{}` -> jump upper, then lower
- `\\text{}` -> jump body

Use `Tab` and `Shift+Tab` to move through snippet fields.

### 6. Preview Diagnostics

Preview should not silently fail.

Show lightweight diagnostics for:

- unmatched `$`
- unmatched `\\[`
- unmatched braces
- unknown command
- invalid environment closure

Preview must degrade gracefully. The editor should never become unusable because one span fails to render.

## Export Model

Textbox export remains source-based.

Rules:

- plain text lines export as escaped text
- inline math exports as `$...$`
- display math exports as `\\displaystyle` lines or display blocks inside node text
- textbox width and height export as node sizing hints where possible

We should keep TikZ export deterministic and avoid embedding editor-only metadata.

## Phased Rollout

### Phase 1

- branch the work
- define parser metadata
- split source pane and preview pane
- remove preview-over-caret behavior

### Phase 2

- command completion menu
- snippet insertion
- placeholder navigation

### Phase 3

- diagnostics UI
- environment helpers
- richer preview blocks for aligned / matrix / cases

### Phase 4

- polish keyboard navigation
- preserve undo / redo semantics
- improve export parity tests

## Immediate Next Tasks

1. Introduce a dedicated textbox editor model module:
   - parser
   - diagnostics
   - completion state
   - snippet expansion state
2. Replace the current textarea-plus-preview canvas editor with a true two-panel popover/editor shell.
3. Add an initial static completion catalog for `amsmath` and `amssymb`.
4. Add snippet navigation for `\\frac`, `\\sqrt`, `\\binom`, `\\text`, and scripts.
5. Add regression tests for source editing edge cases:
   - `\\frac{}{}` then typing inside both slots
   - `a_{n-1}^2`
   - `{n \\choose k}`
   - `\\begin{cases} ... \\end{cases}`
