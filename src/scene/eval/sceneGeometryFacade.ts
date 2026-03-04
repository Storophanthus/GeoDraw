import type { Vec2 } from "../../geo/vec2";
import type { NumberExpressionEvalResult } from "./numericExpression";
import type { SceneEvalContext } from "./sceneContextBuilder";
import {
  asCircleWithCtx,
  asLineLikeWithCtx,
  asSectorArcWithCtx,
  buildGeometryResolveOpsWithCtx,
  getCircleWorldGeometryWithCtxInScene,
  resolveLineAnchorsWithCtx,
} from "./geometryAdapters";
import type { GeometryObjectRef, SceneCircle, SceneLine, SceneModel } from "../points";

type GeometryFacadeDeps = {
  getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  evaluateNumberExpressionWithCtx: (
    scene: SceneModel,
    exprRaw: string,
    ctx: SceneEvalContext
  ) => NumberExpressionEvalResult;
};

export function createSceneGeometryFacadeWithCtx(
  scene: SceneModel,
  ctx: SceneEvalContext,
  deps: GeometryFacadeDeps
) {
  const resolveOps = buildGeometryResolveOpsWithCtx(scene, ctx, deps);
  return {
    asLineLike(ref: GeometryObjectRef): { a: Vec2; b: Vec2; finite: boolean } | null {
      return asLineLikeWithCtx(ref, scene, ctx, resolveOps);
    },
    resolveLineAnchors(line: SceneLine): { a: Vec2; b: Vec2 } | null {
      return resolveLineAnchorsWithCtx(line, scene, ctx, resolveOps);
    },
    asCircle(ref: GeometryObjectRef): { center: Vec2; radius: number } | null {
      return asCircleWithCtx(ref, scene, ctx, resolveOps);
    },
    asSectorArc(ref: GeometryObjectRef): { center: Vec2; radius: number; start: number; sweep: number } | null {
      return asSectorArcWithCtx(ref, scene, ctx, resolveOps);
    },
    getCircleWorldGeometry(circle: SceneCircle): { center: Vec2; radius: number } | null {
      return getCircleWorldGeometryWithCtxInScene(circle, scene, ctx, resolveOps);
    },
  };
}

export function getLineWorldAnchorsInSceneWithImplicitStats(
  line: SceneLine,
  scene: SceneModel,
  deps: GeometryFacadeDeps & {
    getOrCreateSceneEvalContext: (scene: SceneModel) => SceneEvalContext;
    updateImplicitEvalStats: (scene: SceneModel, ctx: SceneEvalContext) => void;
  }
): { a: Vec2; b: Vec2 } | null {
  const ctx = deps.getOrCreateSceneEvalContext(scene);
  const facade = createSceneGeometryFacadeWithCtx(scene, ctx, deps);
  const value = facade.resolveLineAnchors(line);
  deps.updateImplicitEvalStats(scene, ctx);
  return value;
}

export function getCircleWorldGeometryInSceneWithImplicitStats(
  circle: SceneCircle,
  scene: SceneModel,
  deps: GeometryFacadeDeps & {
    getOrCreateSceneEvalContext: (scene: SceneModel) => SceneEvalContext;
    updateImplicitEvalStats: (scene: SceneModel, ctx: SceneEvalContext) => void;
  }
): { center: Vec2; radius: number } | null {
  const ctx = deps.getOrCreateSceneEvalContext(scene);
  const facade = createSceneGeometryFacadeWithCtx(scene, ctx, deps);
  const value = facade.getCircleWorldGeometry(circle);
  deps.updateImplicitEvalStats(scene, ctx);
  return value;
}
