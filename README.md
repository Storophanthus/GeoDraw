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

## Validation

Run before opening/merging a PR:

```bash
npm run test:command
npm run test:scene
npm run test:export
npm run build
```
