import type { Vec2 } from "../geo/vec2";

/** Halfway from the vertex to the arc, on the internal angle bisector.
 * Matches tkz-euclide's German right-angle mark (`size/2`).
 * Coordinates and radius may use either screen or world units.
 */
export function rightAngleDotCenter(a: Vec2, b: Vec2, c: Vec2, arcRadius: number): Vec2 | null {
  const uLen = Math.hypot(a.x - b.x, a.y - b.y);
  const vLen = Math.hypot(c.x - b.x, c.y - b.y);
  if (uLen <= 1e-9 || vLen <= 1e-9) return null;
  const x = (a.x - b.x) / uLen + (c.x - b.x) / vLen;
  const y = (a.y - b.y) / uLen + (c.y - b.y) / vLen;
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return null;
  const distance = arcRadius / 2;
  return { x: b.x + x / length * distance, y: b.y + y / length * distance };
}
