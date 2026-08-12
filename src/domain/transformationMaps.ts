import type { ReflectionObjectRef, SceneModel } from "../scene/points";

export const MAX_TRANSFORMATION_MAP_STEPS = 64;

export type TransformationMapStep =
  | { kind: "translation"; fromId: string; toId: string }
  | { kind: "rotation"; centerId: string; angleExpr: string; direction: "CCW" | "CW" }
  | { kind: "homothety"; centerId: string; factorExpr: string }
  | { kind: "reflection"; axis: ReflectionObjectRef }
  | { kind: "inversion"; circleId: string };

export type TransformationMapDefinition = {
  /** Primitive maps in application order: steps[0] is applied first. */
  steps: TransformationMapStep[];
};

function cloneReflectionAxis(axis: ReflectionObjectRef): ReflectionObjectRef {
  return axis.type === "pointPair" ? { ...axis } : { ...axis };
}

function cloneStep(step: TransformationMapStep): TransformationMapStep {
  if (step.kind === "reflection") return { kind: "reflection", axis: cloneReflectionAxis(step.axis) };
  return { ...step };
}

export function cloneTransformationMap(definition: TransformationMapDefinition): TransformationMapDefinition {
  return { steps: definition.steps.map(cloneStep) };
}

/**
 * Compose maps using mathematical argument order: Compose(f,g) means f ∘ g,
 * so g is applied first and f is applied second.
 */
export function composeTransformationMaps(
  outerToInner: readonly TransformationMapDefinition[]
): TransformationMapDefinition {
  const steps: TransformationMapStep[] = [];
  for (let i = outerToInner.length - 1; i >= 0; i -= 1) {
    steps.push(...outerToInner[i].steps.map(cloneStep));
  }
  return { steps };
}

export function invertTransformationMap(definition: TransformationMapDefinition): TransformationMapDefinition {
  const steps: TransformationMapStep[] = [];
  for (let i = definition.steps.length - 1; i >= 0; i -= 1) {
    const step = definition.steps[i];
    if (step.kind === "translation") {
      steps.push({ kind: "translation", fromId: step.toId, toId: step.fromId });
    } else if (step.kind === "rotation") {
      steps.push({
        kind: "rotation",
        centerId: step.centerId,
        angleExpr: step.angleExpr,
        direction: step.direction === "CCW" ? "CW" : "CCW",
      });
    } else if (step.kind === "homothety") {
      steps.push({ kind: "homothety", centerId: step.centerId, factorExpr: `1/(${step.factorExpr})` });
    } else if (step.kind === "reflection") {
      steps.push(cloneStep(step));
    } else {
      // Circle inversion is an involution on the punctured plane.
      steps.push({ kind: "inversion", circleId: step.circleId });
    }
  }
  return { steps };
}

function reflectionAxisIsAlive(scene: SceneModel, axis: ReflectionObjectRef): boolean {
  if (axis.type === "line") return scene.lines.some((line) => line.id === axis.id);
  if (axis.type === "segment") return scene.segments.some((segment) => segment.id === axis.id);
  if (axis.type === "point") return scene.points.some((point) => point.id === axis.id);
  return (
    axis.aId !== axis.bId &&
    scene.points.some((point) => point.id === axis.aId) &&
    scene.points.some((point) => point.id === axis.bId)
  );
}

export function transformationMapIsAlive(scene: SceneModel, definition: TransformationMapDefinition): boolean {
  if (definition.steps.length === 0 || definition.steps.length > MAX_TRANSFORMATION_MAP_STEPS) return false;
  const hasPoint = (id: string) => scene.points.some((point) => point.id === id);
  return definition.steps.every((step) => {
    if (step.kind === "translation") return hasPoint(step.fromId) && hasPoint(step.toId);
    if (step.kind === "rotation" || step.kind === "homothety") return hasPoint(step.centerId);
    if (step.kind === "reflection") return reflectionAxisIsAlive(scene, step.axis);
    return scene.circles.some((circle) => circle.id === step.circleId);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReflectionAxis(value: unknown): value is ReflectionObjectRef {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "pointPair") {
    return typeof value.aId === "string" && typeof value.bId === "string" && value.aId !== value.bId;
  }
  return (
    (value.type === "point" || value.type === "line" || value.type === "segment") &&
    typeof value.id === "string"
  );
}

function isTransformationMapStep(value: unknown): value is TransformationMapStep {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "translation") return typeof value.fromId === "string" && typeof value.toId === "string";
  if (value.kind === "rotation") {
    return (
      typeof value.centerId === "string" &&
      typeof value.angleExpr === "string" &&
      (value.direction === "CCW" || value.direction === "CW")
    );
  }
  if (value.kind === "homothety") return typeof value.centerId === "string" && typeof value.factorExpr === "string";
  if (value.kind === "reflection") return isReflectionAxis(value.axis);
  return value.kind === "inversion" && typeof value.circleId === "string";
}

export function isTransformationMapDefinition(value: unknown): value is TransformationMapDefinition {
  if (!isRecord(value) || !Array.isArray(value.steps)) return false;
  return (
    value.steps.length > 0 &&
    value.steps.length <= MAX_TRANSFORMATION_MAP_STEPS &&
    value.steps.every(isTransformationMapStep)
  );
}
