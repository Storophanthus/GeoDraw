# Export Testing

Run exporter compile-regression tests with:

```bash
npm run test:export
```

This command exports all JSON fixtures in `src/export/__fixtures__/` and compiles each generated TeX with `tkz-euclide`.

Optional watch mode for the lightweight TypeScript script test:

```bash
npm run test:export:watch
```

Important:
- Do **not** use `ts-node` in this repo for exporter script tests.
- Use `tsx` via npm scripts to avoid Node ESM/TypeScript resolution issues.
