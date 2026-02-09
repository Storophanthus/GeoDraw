# Agent Workflow

This project uses 4 focused roles to avoid regressions and tkz-euclide hallucinations.

## Roles

1. `geometry-ui-agent`
- Scope: app features and geometry behavior.
- Owns: `src/state/**`, `src/view/**`, `src/scene/**`, `src/App.tsx`.
- Must preserve dependency correctness and interaction behavior.

2. `export-agent`
- Scope: scene -> TikZ mapping.
- Owns: `src/export/tikz.ts`, exporter IR and rendering logic.
- Must keep exporter fail-closed.

3. `manual-agent`
- Scope: tkz-euclide syntax truth.
- Verifies macros/options against TeXLive docs/source.
- Owns: `docs/tkz-euclide-contract.md`, macro verification notes.

4. `regression-agent`
- Scope: fixtures and reproducible tests.
- Owns: `src/export/__fixtures__/**`, `scripts/test-export.ts`, `scripts/compile-tex.mjs`.
- Encodes every discovered bug as fixture + assertion.

## Required Sequence Per Feature

1. `geometry-ui-agent` implements feature.
2. `regression-agent` adds/updates fixture(s).
3. `export-agent` updates exporter mapping.
4. `manual-agent` verifies any new tkz macro/option.
5. Run gates:
   - `npm run test:export`
   - `npm run build`

## Hard Rules

- No new `\\tkz...` macro/option without manual verification.
- No silent exporter fallback.
- If export cannot be expressed correctly, throw explicit error.
- If a bug is found, add a fixture before closing it.

## Minimal Daily Loop

```bash
npm run test:export
npm run build
```

If either fails, fix before continuing.
