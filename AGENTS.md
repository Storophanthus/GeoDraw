# GeoDraw Agent Guardrails

## Non-Negotiable Invariants

1. Intersection identity must be stable.
- Never merge point identities by proximity.
- Proximity is only for hit-testing.

2. Segment intersections are finite-domain only.
- Segment support is not infinite-line support.
- For candidate point `P` on segment `AB`, require `u in [0,1]` (with epsilon).

3. Critical regression to never reintroduce:
- For segment-circle intersection with one endpoint on the circle (e.g. `A`) and another intended intersection (`F`), the second intersection point must not collapse to `A`.
- If two intersection roots exist and one root is already occupied by another intersection/anchor point, prefer the unoccupied root for the other dependent intersection point.

4. Line-circle branch semantics:
- Keep explicit branch selection stable over recompute.
- If branch selection is exported (TikZ), map internal branch ordering to target-system branch ordering explicitly.
- Do not assume `tkz-euclide` "first/second" intersection ordering matches internal ordering.
- `\tkzGetSecondPoint` does not select; it only returns whatever the preceding tkz intersection macro stored as the second result.
- For tkz ordering/`near`/`common` behavior, read `docs/tkz_report_intersections.md` before changing exporter branch mapping.

5. Constrained points must stay constrained.
- A point created on a circle/line/segment must remain on that parent object when dependencies move.

6. Intersection extensibility contract (future curves/conics)
- Root generation is shape-specific; root assignment/stability policy is shared.
- New shapes (ellipse/conic/etc.) must reuse the generic intersection assignment policy for:
  - `excludePointId`
  - branch preference
  - previous-stable continuity
  - occupied-root avoidance (singleton "other root" behavior)
- Do not re-implement ownership/branch-stability heuristics inside each new shape solver.
- If a new intersection type needs extra metadata (parameters/tangency classification), extend the generic assignment inputs rather than bypassing the shared policy.

## Required Manual Checks Before Finishing Geometry Changes

1. Create circle `Γ` from center + through point, create a line/segment with one endpoint on `Γ`, and create the other intersection point. Move dependencies; verify the second intersection never collapses to the endpoint except true tangency.
2. Shorten a segment so only one circle intersection remains in finite segment domain; verify second intersection becomes undefined/disappears.
3. Create point on circle via non-point tools (line/segment workflows), move the circle; verify point remains on circle.

## Required Manual Checks Before Finishing TikZ Intersection Export Changes

1. Visually compare app canvas vs compiled TikZ for line-circle intersections using `near` and `common=...`; confirm the same geometric branch is selected.
2. Test a circle-line case where one intersection is an existing anchor/common point and the other is the intended new point; verify exporter does not collapse both to the common point.
3. Test circle-circle intersections with swapped circle argument order in exporter helpers (or equivalent fixtures); verify branch mapping remains stable.
4. Include at least one tangency or near-tangency case and confirm output is either correct or explicitly guarded (no silent branch flip).
