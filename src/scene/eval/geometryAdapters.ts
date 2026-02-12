import type { Vec2 } from "../../geo/vec2";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { buildGeometryResolveOpsRuntime } from "./geometryResolveRuntime";
import {
  asCircleInScene,
  asLineLikeInScene,
  getCircleWorldGeometryInScene,
  resolveLineAnchorsInScene,
} from "./sceneGeometryAccess";
import type { SceneEvalContext } from "./sceneContextBuilder";
import type { GeometryObjectRef, SceneCircle, SceneLine, SceneModel } from "../points";

export function buildGeometryResolveOpsWithCtx(
  scene: SceneModel,
  ctx: SceneEvalContext,
  ops: {
    getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
    evaluateNumberExpressionWithCtx: (
      scene: SceneModel,
      exprRaw: string,
      ctx: SceneEvalContext
    ) => NumberExpressionEvalResult;
  }
) {
  return buildGeometryResolveOpsRuntime({
    getPointWorldById: (id) => ops.getPointWorldById(id, scene, ctx),
    lineById: ctx.lineById,
    segmentById: ctx.segmentById,
    circleById: ctx.circleById,
    evaluateCircleRadiusExpr: (expr) => {
      const evaluated = ops.evaluateNumberExpressionWithCtx(scene, expr, ctx);
      return evaluated.ok ? evaluated.value : null;
    },
    lineInProgress: ctx.lineInProgress,
  });
}

export function asLineLikeWithCtx(
  ref: GeometryObjectRef,
  _scene: SceneModel,
  _ctx: SceneEvalContext,
  resolveOps: ReturnType<typeof buildGeometryResolveOpsWithCtx>
): { a: Vec2; b: Vec2; finite: boolean } | null {
  return asLineLikeInScene(ref, resolveOps);
}

export function resolveLineAnchorsWithCtx(
  line: SceneLine,
  _scene: SceneModel,
  _ctx: SceneEvalContext,
  resolveOps: ReturnType<typeof buildGeometryResolveOpsWithCtx>
): { a: Vec2; b: Vec2 } | null {
  return resolveLineAnchorsInScene(line, resolveOps);
}

export function asCircleWithCtx(
  ref: GeometryObjectRef,
  _scene: SceneModel,
  _ctx: SceneEvalContext,
  resolveOps: ReturnType<typeof buildGeometryResolveOpsWithCtx>
): { center: Vec2; radius: number } | null {
  return asCircleInScene(ref, resolveOps);
}

export function getCircleWorldGeometryWithCtxInScene(
  circle: SceneCircle,
  _scene: SceneModel,
  _ctx: SceneEvalContext,
  resolveOps: ReturnType<typeof buildGeometryResolveOpsWithCtx>
): { center: Vec2; radius: number } | null {
  return getCircleWorldGeometryInScene(circle, resolveOps);
}
