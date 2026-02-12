# GeoDraw Codex Contract (Fail-Closed, Regression-Locked)

This document is the **single source of truth** for how Codex must implement changes in the GeoDraw repo.
Canonical prompt path: **`docs/codex/CONTRACT.md`**.
If this file exists in both `docs/codex/` and `src/docs/codex/`, keep them synchronized.

---

## 0) Scope

This contract governs:

* UI tools (selection, preview, toolbar grouping, icon integration)
* Geometry model/evaluation
* TikZ/tkz-euclide export
* Documentation updates
* Regression fixtures + compile tests

It does **not** change product requirements; it enforces engineering discipline.

---

## 0.5) Session Start & Context-Low Protocol (Mandatory)

Before writing code for any new feature/fix, Codex must:

1. Open and read:
   - `docs/codex/CONTRACT.md`
   - `docs/handoff.md`
2. Post a short execution checklist in-progress (what files/modules are expected to change).
3. If the task is expected to exceed one context window:
   - create a checkpoint commit before risky rewires,
   - update `docs/handoff.md` at each milestone (done/next/risks/open invariants),
   - continue from handoff instead of memory.

When context remaining is low, Codex must prioritize:

1. checkpointing current stable state (commit when appropriate),
2. updating `docs/handoff.md`,
3. only then continuing feature work.

---

## 1) Non-negotiables (Hard Rules)

1. **Fail-closed exporter**

* If a construction or style cannot be exported using **whitelisted** tkz-euclide macros/options, the exporter **must throw** with a precise message.
* No silent fallback. No “best effort” degradation unless explicitly documented and tested.

2. **No invented tkz macros / option keys**

* Every `\tkz...` macro and every option key emitted must appear in:

  * `docs/tkz-euclide-macros.json` (generated whitelist), and/or
  * `docs/tkz-euclide-reference.md` (repo reference)
* If not present: **throw** and (if needed) add a “missing macro” workflow note.

3. **Any bug fix or new feature must add regression**

* Add **at least one** fixture and **at least one** test assertion.
* If the feature is “unsupported by whitelist,” add a test that expects the exporter to **throw**.

4. **Do not touch unrelated uncommitted files**

* If the working tree contains unrelated changes, Codex must not revert/format/move them.
* Only edit files required for the task.

5. **Determinism**

* Export output must be stable across runs:

  * deterministic naming
  * stable ordering
  * stable branch selection rules for multi-solution intersections

6. **Commit scope discipline**

* One feature/fix per commit.
* Do not mix unrelated work (e.g., UI polish + geometry engine + exporter refactor) unless inseparable for correctness.
* If inseparable, document the coupling in the commit message.

---

## 2) Required Workflow (4-Step Agent Discipline)

For each task, follow this order:

1. **geometry-ui-agent**

* Implement UI interaction + selection state machine
* Add rubber-band preview (ephemeral)
* Add/extend geometry node types + evaluator
* Keep drag performance smooth (RAF throttling; no deep scene clones per pointermove)

2. **export-agent**

* Map new node kinds to tkz-euclide output using whitelist only
* Preserve fail-closed behavior
* Keep naming/order deterministic

3. **manual-agent**

* Verify tkz syntax from repo references / sources
* Update:

  * `docs/tkz-euclide-contract.md` (mapping rules)
  * `docs/tkz-euclide-reference.md` (minimal snippets)
* Do not rely on memory for tkz keys/arguments

4. **regression-agent**

* Add fixture(s) under `src/export/__fixtures__/`
* Add assertions + compile test via harness (`scripts/compile-tex.mjs`, `npm run test:export`)
* Ensure test fails before change and passes after

---

## 3) UI Interaction Standards

### 3.1 Selection state machines

* Tools must accept inputs in a deterministic way (order-agnostic only if explicitly designed).
* When invalid selections occur:

  * do not create objects
  * show consistent “cannot construct” feedback (same mechanism as existing tools)

### 3.2 Rubber-band preview (mandatory for construction tools)

* Preview is **ephemeral**: never stored as real scene nodes.
* Preview updates at most once per `requestAnimationFrame`.
* Preview uses existing preview style (dashed / translucent) and existing draw pipeline.
* Preview must never allocate large structures per pointermove (avoid array churn, deep clones).

### 3.3 Label coordinates for export-critical objects

For any object whose exported form depends on label placement (e.g., angles used by `\tkzLabelAngle`):

* Store **label position in world coordinates** explicitly.
* Label anchor must be draggable and stable under pan/zoom.
* Export must use label position (or throw if mapping is impossible).

---

## 4) Geometry / Evaluation Standards

### 4.1 Incremental recomputation

* Prefer dirty propagation or tick-based memoization so each node evaluates at most once per update tick.
* Avoid recursive re-evaluation explosion (especially in scenes with many intersections).

### 4.2 No GC churn in hot paths

* Avoid allocating new `{x,y}` objects or arrays in tight loops.
* Reuse buffers/arrays if the architecture supports it.

### 4.3 Degeneracy handling

* If a construction is mathematically undefined (zero-length direction, coincident lines, etc.):

  * mark node as undefined
  * do not silently substitute a different construction

---

## 5) TikZ / tkz-euclide Export Standards

### 5.1 Whitelist enforcement

* Only emit macros/options that are present in `docs/tkz-euclide-macros.json`.
* If absent: throw with a specific reason, e.g.:

  * `Unsupported construction: Angle (missing tkz macro: \\tkzLabelAngle)`
  * `Unsupported Angle style: fillOpacity (no tkz mapping)`

### 5.2 Viewport and “infinite” lines

* If the exporter supports viewports, prefer:

  * `\tkzInit[...]` + `\tkzClip[...]`
  * global `\tkzSetUpLine[add=...]`
    to avoid stubby lines and giant whitespace.
* If viewport export is disabled, the exporter must still be deterministic; do not emit tiny `add` values derived from short segments.

### 5.3 Naming, ordering, branch selection

* Helper points must be named deterministically (e.g., `tkzPerp_1`, `tkzBis_2_i`).
* When multiple solutions exist (circle-circle, line-circle):

  * choose branch deterministically (e.g., nearest-to-previous cached point or stable ordering rule)
  * ensure export matches the chosen branch consistently

---

## 6) Regression Policy

### 6.1 Fixtures

* Each new feature adds at least one fixture JSON in:

  * `src/export/__fixtures__/...`
* Fixtures must be minimal but non-trivial (include at least one dependent object to test ordering).

### 6.2 Tests

* Add assertions:

  * macro tokens present (string-level)
  * options present (when relevant)
  * expected throw message (for unsupported features)
* Compile test must run for TeX-producing fixtures:

  * `scripts/compile-tex.mjs` (via `npm run test:export`)

### 6.3 Canvas regression coverage (mandatory for canvas bugs/features)

When the issue or feature is canvas-interaction/rendering related (preview direction, hit-testing, snapping, missing points, label drag, etc.):

* Add at least one automated canvas/geometry regression test if the harness supports it.
* If no dedicated canvas harness exists yet, add:
  * a focused geometry-level regression test that reproduces the bug condition, and
  * a fixture/manual-check note in docs describing exact reproduction and expected on-canvas outcome.
* Do not merge canvas behavior changes with only export tests.
### 6.4 Definition of Done

A feature is “done” only if:

* UI tool works (including preview)
* Geometry updates dynamically
* Export either compiles or throws explicitly (fail-closed)
* Docs updated for any new macro mapping
* Fixture + test added, and:

  * `npm run test:export`
  * `npm run build`
    both pass

---

## 7) Git / Diff Hygiene

* Minimal diffs. Avoid reformatting entire files.
* Do not rename/move files unless required.
* Do not edit generated artifacts unless the task explicitly requires regeneration.

---

## 8) Standard “Patch Prompt” Template (Use This Every Time)

Copy/paste this into Codex and fill in brackets:

---

Follow `docs/codex/CONTRACT.md`.

**Task:** [Feature name]

**Allowed files:**

* [file1]
* [file2]
  (Only these unless absolutely necessary)

**UI behavior:**

* Selection: [inputs and order rules]
* Preview: [rubber-band rules]
* Toolbar: [group + icon]

**Model:**

* New node kind(s): [names] deps: [deps]
* Degenerate cases: [rules]

**Export:**

* Mapping: [macro names] from `docs/tkz-euclide-macros.json`
* Fail-closed conditions: [exact throw messages]

**Regression:**

* Fixture: [path]
* Assertions: [tokens/options or expected throw]
* Compile: [yes/no and why]
* Canvas regression: [test path or documented manual-check note]

## **Run:** `npm run test:export` and `npm run build`

---

## 9) If You Hit Context Limits

Do not paste boilerplate. Instead:

* Reference this contract file.
* Reference existing docs (`docs/tkz-euclide-*.md`, whitelist JSON).
* Provide only feature-specific deltas and the allowed-files list.
