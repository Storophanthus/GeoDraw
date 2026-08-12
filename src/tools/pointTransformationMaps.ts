import { transformationMapIsAlive, type TransformationMapDefinition } from "../domain/transformationMaps";
import { evaluateAngleExpressionDegrees, type ReflectionObjectRef, type SceneModel } from "../scene/points";
import { applyInversionToPoint } from "./objectTransforms";

export type PointTransformationMapOps = {
  readonly scene: SceneModel;
  createPointByTranslation: (pointId: string, fromId: string, toId: string) => string | null;
  createPointByRotation: (
    centerId: string,
    pointId: string,
    angleDeg: number,
    direction: "CCW" | "CW",
    angleExpr?: string
  ) => string | null;
  createPointByDilation: (pointId: string, centerId: string, factorExpr: string) => string | null;
  createPointByReflection: (pointId: string, axis: ReflectionObjectRef) => string | null;
  createCircleCenterPoint: (circleId: string) => string | null;
  setPointVisibility: (pointId: string, visible: boolean) => void;
  hideIntermediatePoint: (pointId: string) => void;
};

export function applyTransformationMapToPoint(
  pointId: string,
  definition: TransformationMapDefinition,
  ops: PointTransformationMapOps
): string | null {
  if (!ops.scene.points.some((point) => point.id === pointId)) return null;
  if (!transformationMapIsAlive(ops.scene, definition)) return null;

  let currentPointId = pointId;
  for (let i = 0; i < definition.steps.length; i += 1) {
    const step = definition.steps[i];
    let nextPointId: string | null = null;
    if (step.kind === "translation") {
      nextPointId = ops.createPointByTranslation(currentPointId, step.fromId, step.toId);
    } else if (step.kind === "rotation") {
      if (currentPointId === step.centerId) {
        // Preserve a distinct image-point identity for a fixed point.
        nextPointId = ops.createPointByDilation(currentPointId, step.centerId, "1");
      } else {
        const angle = evaluateAngleExpressionDegrees(ops.scene, step.angleExpr);
        if (!angle.ok || !Number.isFinite(angle.valueDeg)) return null;
        nextPointId = ops.createPointByRotation(
          step.centerId,
          currentPointId,
          angle.valueDeg,
          step.direction,
          step.angleExpr
        );
      }
    } else if (step.kind === "homothety") {
      nextPointId = ops.createPointByDilation(currentPointId, step.centerId, step.factorExpr);
    } else if (step.kind === "reflection") {
      nextPointId = ops.createPointByReflection(currentPointId, step.axis);
    } else {
      nextPointId = applyInversionToPoint(currentPointId, step.circleId, {
        get scene() {
          return ops.scene;
        },
        createPointByDilation: ops.createPointByDilation,
        createCircleCenterPoint: ops.createCircleCenterPoint,
        setObjectVisibility: (object, visible) => ops.setPointVisibility(object.id, visible),
      });
    }
    if (!nextPointId) return null;
    if (i < definition.steps.length - 1) ops.hideIntermediatePoint(nextPointId);
    currentPointId = nextPointId;
  }
  return currentPointId;
}
