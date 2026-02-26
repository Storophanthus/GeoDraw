import type { Vec2 } from "../../geo/vec2";
import type { SceneModel } from "../points";
import { computeOrientedAngleRad } from "./angleMath";
import type { AngleExpressionEvalResult } from "./expressionEval";
import { evaluateAngleExpressionDegreesWithCtxInScene } from "./numberExpressionEvaluators";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { type SceneEvalContext } from "./sceneContextBuilder";
import { evaluateSceneScalarNumberExpression } from "./sceneScalarExpressionAdapter";

type SceneExpressionFacadeDeps = {
  getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  evalNumberById: (numberId: string, scene: SceneModel, ctx: SceneEvalContext) => number | null;
  resolveLineAnchorsById: (lineId: string, scene: SceneModel, ctx: SceneEvalContext) => { a: Vec2; b: Vec2 } | null;
  getCircleWorldGeometryById: (
    circleId: string,
    scene: SceneModel,
    ctx: SceneEvalContext
  ) => { center: Vec2; radius: number } | null;
};

export function evaluateAngleExpressionDegreesWithCtxInSceneModel(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext,
  deps: Pick<SceneExpressionFacadeDeps, "getPointWorldById" | "evalNumberById">
): AngleExpressionEvalResult {
  return evaluateAngleExpressionDegreesWithCtxInScene(
    exprRaw,
    {
      angles: scene.angles.map((angle) => ({
        id: angle.id,
        aId: angle.aId,
        bId: angle.bId,
        cId: angle.cId,
        labelText: angle.style.labelText,
      })),
      numbers: scene.numbers.map((num) => ({ id: num.id, name: num.name })),
    },
    {
      getAngleValueDeg: (angleId) => {
        const angle = ctx.angleById.get(angleId);
        if (!angle) return null;
        const a = deps.getPointWorldById(angle.aId, scene, ctx);
        const b = deps.getPointWorldById(angle.bId, scene, ctx);
        const c = deps.getPointWorldById(angle.cId, scene, ctx);
        if (!a || !b || !c) return null;
        const theta = computeOrientedAngleRad(a, b, c);
        if (theta === null) return null;
        return (theta * 180) / Math.PI;
      },
      getAnglePointNames: (angleId) => {
        const angle = ctx.angleById.get(angleId);
        if (!angle) return null;
        const pa = ctx.pointById.get(angle.aId);
        const pb = ctx.pointById.get(angle.bId);
        const pc = ctx.pointById.get(angle.cId);
        if (!pa || !pb || !pc) return null;
        return { aName: pa.name, bName: pb.name, cName: pc.name };
      },
      getNumberValue: (numberId) => deps.evalNumberById(numberId, scene, ctx),
    }
  );
}

export function evaluateNumberExpressionWithCtxInSceneModel(
  scene: SceneModel,
  exprRaw: string,
  ctx: SceneEvalContext,
  deps: SceneExpressionFacadeDeps,
  excludeNumberId?: string
): NumberExpressionEvalResult {
  return evaluateSceneScalarNumberExpression({
    exprRaw,
    numbers: scene.numbers.map((num) => ({ id: num.id, name: num.name })),
    points: scene.points.map((p) => ({ id: p.id, name: p.name })),
    lines: scene.lines.map((l) => ({ id: l.id, labelText: l.labelText })),
    segments: scene.segments.map((s) => ({ id: s.id, aId: s.aId, bId: s.bId, labelText: s.labelText })),
    circles: scene.circles.map((c) => ({ id: c.id, labelText: c.labelText })),
    polygons: scene.polygons.map((p) => ({ id: p.id, pointIds: p.pointIds, labelText: p.labelText })),
    excludeNumberId,
    getNumberValue: (numberId) => deps.evalNumberById(numberId, scene, ctx),
    getPointWorldById: (pointId) => deps.getPointWorldById(pointId, scene, ctx),
    resolveLineAnchors: (lineId) => deps.resolveLineAnchorsById(lineId, scene, ctx),
    getCircleWorldGeometry: (circleId) => deps.getCircleWorldGeometryById(circleId, scene, ctx),
  });
}
