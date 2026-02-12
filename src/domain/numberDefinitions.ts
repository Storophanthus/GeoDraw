import { evaluateNumberExpression, type SceneModel, type SceneNumberDefinition } from "../scene/points";

export function isValidNumberDefinition(def: SceneNumberDefinition, scene: SceneModel): boolean {
  if (def.kind === "constant") return Number.isFinite(def.value);
  if (def.kind === "distancePoints") {
    return scene.points.some((p) => p.id === def.aId) && scene.points.some((p) => p.id === def.bId);
  }
  if (def.kind === "segmentLength") {
    return scene.segments.some((s) => s.id === def.segId);
  }
  if (def.kind === "circleRadius" || def.kind === "circleArea") {
    return scene.circles.some((c) => c.id === def.circleId);
  }
  if (def.kind === "angleDegrees") {
    return scene.angles.some((a) => a.id === def.angleId);
  }
  if (def.kind === "expression") {
    return evaluateNumberExpression(scene, def.expr).ok;
  }
  return (
    scene.numbers.some((n) => n.id === def.numeratorId) &&
    scene.numbers.some((n) => n.id === def.denominatorId) &&
    def.numeratorId !== def.denominatorId
  );
}

export function numberPrefixForDefinition(def: SceneNumberDefinition): string {
  if (def.kind === "distancePoints" || def.kind === "segmentLength") return "l";
  if (def.kind === "circleRadius") return "r";
  if (def.kind === "circleArea") return "Area";
  if (def.kind === "angleDegrees") return "ang";
  return "n";
}

export function nextAvailableNumberName(usedNames: Set<string>, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}_(\\d+)$`);
  const usedIndices = new Set<number>();
  for (const name of usedNames) {
    const m = name.match(re);
    if (!m) continue;
    const idx = Number(m[1]);
    if (Number.isInteger(idx) && idx > 0) usedIndices.add(idx);
  }
  let i = 1;
  while (usedIndices.has(i)) i += 1;
  return `${prefix}_${i}`;
}
