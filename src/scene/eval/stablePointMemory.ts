import type { Vec2 } from "../../geo/vec2";

const lastResolvedPointWorld = new Map<string, { value: Vec2; signature: string }>();

export function getPreviousStablePoint(pointId: string, signature: string): Vec2 | null {
  const prev = lastResolvedPointWorld.get(pointId);
  if (!prev) return null;
  if (prev.signature !== signature) return null;
  return prev.value;
}

export function rememberStablePoint(pointId: string, signature: string, value: Vec2): void {
  lastResolvedPointWorld.set(pointId, { value, signature });
}
