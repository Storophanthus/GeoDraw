import type { SceneAngle, SceneCircle, SceneLine, SceneSegment } from "../points";
import type { Vec2 } from "../../geo/vec2";

export function buildGeometryResolveOpsRuntime(
  runtime: {
    getPointWorldById: (id: string) => Vec2 | null;
    lineById: Map<string, SceneLine>;
    segmentById: Map<string, SceneSegment>;
    circleById: Map<string, SceneCircle>;
    angleById: Map<string, SceneAngle>;
    evaluateCircleRadiusExpr: (expr: string) => number | null;
    lineInProgress: Set<string>;
  }
) {
  return {
    getPointWorldById: (id: string) => runtime.getPointWorldById(id),
    getLineById: (id: string) => runtime.lineById.get(id) ?? null,
    getSegmentById: (id: string) => {
      const seg = runtime.segmentById.get(id);
      return seg ? { aId: seg.aId, bId: seg.bId } : null;
    },
    getCircleById: (id: string) => runtime.circleById.get(id) ?? null,
    getAngleById: (id: string) => runtime.angleById.get(id) ?? null,
    evaluateCircleRadiusExpr: (expr: string) => runtime.evaluateCircleRadiusExpr(expr),
    lineInProgress: runtime.lineInProgress,
  } as const;
}
