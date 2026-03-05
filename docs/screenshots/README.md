# User Manual Screenshot Slots

The LaTeX manual (`docs/user-manual.tex`) auto-loads screenshots with `\IfFileExists`.
If a file is missing, a placeholder box is rendered instead.

Add screenshots with these exact names:

- `fit-view.png`
- `arrow-controls.png`
- `mark-controls.png`
- `tikz-preview-window.png`

All files should be placed in this directory:

- `docs/screenshots/`

The manual also uses icon assets in:

- `docs/screenshots/icons/fit-view.png`
- `docs/screenshots/icons/arrow-controls.png`
- `docs/screenshots/icons/marking-controls.png`
- `docs/screenshots/icons/pdf-preview.png`

Tool icons are in:

- `docs/screenshots/tools/`

They are generated from the app's live `TOOL_REGISTRY` mapping via:

- `node --import tsx scripts/generate-doc-tool-icons.tsx`

Suggested capture guidance:

- Use the same UI color profile/theme you want to publish.
- Keep window chrome visible for context.
- Prefer 1x scale (not retina-upscaled) to keep PDF size moderate.
