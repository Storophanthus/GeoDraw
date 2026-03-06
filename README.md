# GeoDraw-core

GeoDraw is an interactive geometry editor with deterministic construction behavior and high-quality TikZ export.
This repository contains the app core: geometry engine, scene/state model, construction tools, command bar, desktop preview workflow, and exporter pipeline.

## What GeoDraw provides

- Interactive Euclidean construction: points, lines, segments, circles, angles, sectors, polygons, transforms.
- Command-driven workflows with assignment/redefine support and scalar expressions.
- Stable intersection semantics with explicit branch handling for export parity.
- Rich object styling: marks, arrows, fills/patterns, labels, and theme-aware UI.
- TikZ/tkz-euclide export with preview window, editable `tikzpicture`, optional preamble, and compiler log.
- Desktop runtime via Tauri with file operations and PDF compilation flow.

## Documentation

- User manual (LaTeX source): `docs/user-manual.tex`
- Command reference: `docs/command-bar-reference.md`
- Contributing guide: `CONTRIBUTING.md`
- Agent workflow: `docs/agent-workflow.md`
- tkz-euclide contract: `docs/tkz-euclide-contract.md`
- tkz-euclide reference and macro update flow: `docs/tkz-euclide-reference.md`
- Export testing guide: `docs/export-testing.md`

## Project Rules

- Geometry and export guardrails are defined in `AGENTS.md`.
- Treat `AGENTS.md` non-negotiable invariants as required behavior.

## Getting Started

```bash
npm ci
npm run dev
```

For desktop app development:

```bash
npm run tauri
```

## Windows Setup

### Option A: Try instantly (web)

- Open: `https://storophanthus.github.io/GeoDraw/`

### Option B: Run desktop app (Tauri)

Install prerequisites:

1. Node.js LTS
2. Rust (stable, MSVC toolchain)
3. Visual Studio Build Tools (Desktop development with C++)

Then run:

```bash
npm ci
npm run tauri
```

### TeX compiler on Windows (for PDF Preview compile)

GeoDraw desktop currently looks for `latexmk`/`pdflatex` on `PATH` (plus macOS fixed paths).  
On Windows, install MiKTeX or TeX Live and ensure binaries are available on `PATH`.

Check in PowerShell:

```powershell
where.exe latexmk
where.exe pdflatex
```

If both commands return paths, GeoDraw should be able to compile TikZ previews.
If not, add your TeX `bin` folder to PATH and restart the app/terminal.

## Web Deployment (GitHub Pages)

This repo now includes automatic deployment to GitHub Pages via:

- `.github/workflows/deploy-pages.yml`

On each push to `main`, GitHub Actions builds the app and publishes `dist/`.

After enabling Pages in repository settings, the site URL is typically:

- `https://<your-github-username>.github.io/<repo-name>/`

Notes:

- The web build supports the interactive canvas and editor workflows.
- Desktop-only features (Tauri file APIs and local TeX PDF compilation in Preview) are not available in browser-only hosting.

## Validation

Run before opening/merging a PR:

```bash
npm run test:command
npm run test:scene
npm run test:export
npm run build
```
