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

5. Constrained points must stay constrained.
- A point created on a circle/line/segment must remain on that parent object when dependencies move.

## Required Manual Checks Before Finishing Geometry Changes

1. Create circle `Γ` from center + through point, create a line/segment with one endpoint on `Γ`, and create the other intersection point. Move dependencies; verify the second intersection never collapses to the endpoint except true tangency.
2. Shorten a segment so only one circle intersection remains in finite segment domain; verify second intersection becomes undefined/disappears.
3. Create point on circle via non-point tools (line/segment workflows), move the circle; verify point remains on circle.
