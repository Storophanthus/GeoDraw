# Contributing

## Core References
- Agent workflow: `docs/agent-workflow.md`
- tkz-euclide contract: `docs/tkz-euclide-contract.md`
- tkz-euclide reference + update flow: `docs/tkz-euclide-reference.md`
- Export testing guide: `docs/export-testing.md`
- PR checklist: `docs/pr-template.md`

## Required Validation
Run before merging:

```bash
npm run test:export
npm run build
```

## Non-Negotiables
- Do not invent tkz-euclide macros/options.
- Exporter must fail closed (throw on unsupported output).
- Every bug fix should include a regression fixture/test.
