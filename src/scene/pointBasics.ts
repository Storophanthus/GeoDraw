import type { ScenePoint } from "./points";
import type { Vec2 } from "../geo/vec2";

export function nextLabelFromIndex(index: number): string {
  const letterIndex = index % 26;
  const cycle = Math.floor(index / 26);
  const letter = String.fromCharCode(65 + letterIndex);
  if (cycle === 0) return letter;
  return `${letter}_${cycle}`;
}

export function isNameUnique(
  name: string,
  existingNames: Iterable<string>,
  ignoreName?: string
): boolean {
  for (const existing of existingNames) {
    if (existing === ignoreName) continue;
    if (existing === name) return false;
  }
  return true;
}

export function isValidPointName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

export function isPointDraggable(point: ScenePoint): boolean {
  if (point.locked) return false;
  return (
    point.kind === "free" ||
    point.kind === "pointOnLine" ||
    point.kind === "pointOnSegment" ||
    point.kind === "pointOnCircle"
  );
}

export function movePoint(point: ScenePoint, world: Vec2): ScenePoint {
  if (point.kind !== "free") return point;
  if (point.locked) return point;
  return { ...point, position: world };
}
