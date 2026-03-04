# GeoDraw-core

Core geometry engine, scene model, interaction tools, and TikZ/tkz-euclide export for GeoDraw.

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

## Core References

- Contributing guide: `CONTRIBUTING.md`
- Agent workflow: `docs/agent-workflow.md`
- tkz-euclide contract: `docs/tkz-euclide-contract.md`
- tkz-euclide reference and macro update flow: `docs/tkz-euclide-reference.md`
- Export testing guide: `docs/export-testing.md`
