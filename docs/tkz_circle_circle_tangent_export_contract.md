# tkz Circle-Circle Tangent Export Contract

## Purpose

This document defines the exporter contract for `circleCircleTangent` lines in
TikZ/tkz-euclide export.

It exists to prevent repeated regressions in a high-value feature:

- canvas tangents are correct
- exported tkz-euclide construction must match the same tangent branch
- exporter must remain constructive (no silent coordinate fallback)

## Scope

This contract applies to:

- `line.kind === "circleCircleTangent"`
- related tangent-dependent points (for example `circleLineIntersectionPoint`
  created on a tangent line)
- tkz-euclide constructive export path using similitude centers and
  `tangent from = ...`

This contract does **not** define:

- generic conic/ellipse tangent solvers (future work)
- PGF/TikZ numeric internals

## Non-Negotiable Rules

1. Constructive export first.
- Export circle-circle tangents as tkz-euclide constructions (similitude center +
  tangent-from-point), not hard-coded line coordinates.

2. No silent coordinate fallback for core tangents.
- If constructive export is impossible or unstable, fail closed with a clear
  error instead of emitting wrong geometry.

3. Branch pairing correctness is separate from tkz numeric fragility.
- Logical pairing mistakes and tkz compile/math failures must be diagnosed and
  fixed independently.

4. Hidden undefined geometry must not block export unless it is required by the
   visible/exported dependency closure.
- A hidden impossible tangent (or hidden point on it) should not poison export
  of unrelated visible objects.

## Two Independent Failure Classes

### A. Branch Pairing Mismatch (Exporter Logic Bug)

Symptoms:

- export compiles
- tangent line exists, but it is the wrong branch compared to canvas

Cause:

- wrong pairing of tangent points between circle A and circle B
- usually due to assuming "same index means same branch" without mapping to
  tkz-euclide ordering semantics

Fix strategy:

- explicitly map internal branch ordering to tkz tangent point ordering
- verify against canvas geometry (line anchors/branch identity)

### B. Numeric / Compile Fragility (tkz/PGF Limitation)

Symptoms:

- TeX/PGF math errors (for example `\\pgfmath@acos@1001`)
- fragile behavior near tangency / degeneracy

Cause:

- tkz-euclide / PGF numeric precision limits
- degenerate or near-degenerate configurations

Fix strategy:

- preflight classify geometry before emitting fragile constructions
- fail closed in unsupported/unstable cases
- do not “fix” by switching to silent coordinate fallback

## tkz-euclide Semantics We Rely On

### Tangent point ordering (`tangent from = P`)

For:

```tex
\tkzDefLine[tangent from = P](O,A) \tkzGetPoints{T1}{T2}
```

The returned tangent points are ordered by orientation around the circle.
Our exporter must not assume canvas root ordering matches tkz ordering directly;
it must map explicitly.

Operational rule:

- treat tkz tangent points as an ordered pair in tkz's orientation convention
- choose exporter pairing by matching to canvas tangent branch geometry

## Required Constructive Path (Default)

For non-degenerate circle-circle tangent export:

1. Compute circle geometries in canvas/runtime (`center`, `radius`)
2. Compute internal or external similitude center (depending on tangent family)
3. Emit tkz similitude center construction
4. Emit `tangent from =` constructions on both circles
5. Pair tangent points deterministically to reproduce the canvas branch
6. Emit the tangent line from the paired tangent points

## Geometry Preflight Classification (Required Before Emitting Tangent)

Given two circles with centers distance `d`, radii `r1`, `r2`:

- `d == 0 && r1 == r2`: coincident circles (infinite tangents) -> fail closed
- `d == 0 && r1 != r2`: concentric unequal (no tangents) -> fail closed
- `d < |r1-r2|`: one circle inside another (no common tangents) -> fail closed
- `|r1-r2| < d < r1+r2`: circles intersect -> outer tangents only
- `d > r1+r2`: disjoint -> outer + inner tangents
- near `d ~= r1+r2` or `d ~= |r1-r2|`: degenerate/near-degenerate -> treat as
  unstable unless explicitly handled

Exporter policy must use a tolerance and classify these cases before generating
tkz tangent constructions.

## Export Policy (Current / Target)

### Current expected behavior (minimum correct)

- Visible impossible tangent line -> explicit export failure
- Hidden impossible tangent line -> should not block export by itself
- Hidden undefined dependent point -> should not block export unless later needed
  by visible exported geometry

### Target strict policy

- Non-degenerate valid tangent family -> constructive export
- Impossible tangent family (for current circle positions) -> fail only if
  visible/exported dependency requires it
- Degenerate or near-degenerate tangent family -> fail closed (clear message)

## Explicitly Forbidden Shortcuts

- Silent replacement of `circleCircleTangent` construction with hard-coded line
  coordinates
- Pairing tangent points by index without explicit branch mapping
- Treating tkz compile fragility as proof of exporter branch mismatch

## Validation Requirements

### Automated

1. Branch pairing correctness
- Compare exporter-selected tangent branch to canvas tangent anchors

2. Visibility/undefined dependency handling
- Hidden impossible tangents do not block export
- Visible impossible tangents fail clearly

3. Classification behavior
- intersecting circles export only valid tangent families
- impossible families are rejected deterministically

### Manual (“literal eyes” checks)

Run visual checks for:

- disjoint circles (4 tangents)
- intersecting circles (2 tangents only)
- near external tangency
- near internal tangency
- equal radii cases
- rotated/reflected placements (to detect branch-order mistakes)

Canvas and exported tkz output must represent the same tangent branches.

## Extension Rule (Future Curves / Conics)

If ellipse/conic tangent tools are added later:

- root generation / tangent solver is shape-specific
- branch/ownership/continuity assignment policy is shared

Do not reintroduce tangent identity bugs by embedding assignment policy inside
new shape-specific solvers.

