import type { Vec2 } from "../../geo/vec2";
import type {
  SceneCircle,
  SceneLine,
  SceneModel,
  SceneNumber,
  ScenePoint,
  SceneTextLabel,
} from "../points";
import { getCircleWorldGeometryInSceneWithImplicitStats, getLineWorldAnchorsInSceneWithImplicitStats } from "./sceneGeometryFacade";
import type { NumberExpressionEvalResult } from "./numericExpression";
import { getNumberValueInScene } from "./sceneNumberAccess";
import type { SceneEvalContext } from "./sceneContextBuilder";
import { resolveTextLabelDisplayTextWithOps } from "./textLabelDisplay";

type SharedImplicitEvalDeps = {
  getOrCreateSceneEvalContext: (scene: SceneModel) => SceneEvalContext;
  updateImplicitEvalStats: (scene: SceneModel, ctx: SceneEvalContext) => void;
};

type GeometryAccessDeps = SharedImplicitEvalDeps & {
  getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  evaluateNumberExpressionWithCtx: (
    scene: SceneModel,
    exprRaw: string,
    ctx: SceneEvalContext,
    excludeNumberId?: string
  ) => NumberExpressionEvalResult;
};

export function getPointWorldPosInSceneWithImplicitStats(
  point: ScenePoint,
  scene: SceneModel,
  deps: SharedImplicitEvalDeps & {
    evalPointById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  }
): Vec2 | null {
  const ctx = deps.getOrCreateSceneEvalContext(scene);
  const value = deps.evalPointById(point.id, scene, ctx);
  deps.updateImplicitEvalStats(scene, ctx);
  return value;
}

export function getLineWorldAnchorsInScenePublic(
  line: SceneLine,
  scene: SceneModel,
  deps: GeometryAccessDeps
): { a: Vec2; b: Vec2 } | null {
  return getLineWorldAnchorsInSceneWithImplicitStats(line, scene, {
    getOrCreateSceneEvalContext: deps.getOrCreateSceneEvalContext,
    updateImplicitEvalStats: deps.updateImplicitEvalStats,
    getPointWorldById: deps.getPointWorldById,
    evaluateNumberExpressionWithCtx: (s, exprRaw, c) => deps.evaluateNumberExpressionWithCtx(s, exprRaw, c),
  });
}

export function getCircleWorldGeometryInScenePublic(
  circle: SceneCircle,
  scene: SceneModel,
  deps: GeometryAccessDeps
): { center: Vec2; radius: number } | null {
  return getCircleWorldGeometryInSceneWithImplicitStats(circle, scene, {
    getOrCreateSceneEvalContext: deps.getOrCreateSceneEvalContext,
    updateImplicitEvalStats: deps.updateImplicitEvalStats,
    getPointWorldById: deps.getPointWorldById,
    evaluateNumberExpressionWithCtx: (s, exprRaw, c) => deps.evaluateNumberExpressionWithCtx(s, exprRaw, c),
  });
}

export function getNumberValueInScenePublic(
  numOrId: SceneNumber | string,
  scene: SceneModel,
  deps: SharedImplicitEvalDeps & {
    evalNumberById: (id: string, scene: SceneModel, ctx: SceneEvalContext) => number | null;
  }
): number | null {
  return getNumberValueInScene(numOrId, scene, {
    getOrCreateSceneEvalContext: deps.getOrCreateSceneEvalContext,
    evalNumberById: deps.evalNumberById,
    updateImplicitEvalStats: deps.updateImplicitEvalStats,
  });
}

export function resolveTextLabelDisplayTextInScene(
  label: SceneTextLabel,
  scene: SceneModel,
  deps: {
    getNumberValue: (numOrId: SceneNumber | string, scene: SceneModel) => number | null;
    evaluateNumberExpression: (scene: SceneModel, exprRaw: string) => NumberExpressionEvalResult;
  }
): string {
  return resolveTextLabelDisplayTextWithOps(label, {
    getNumberValue: (id) => deps.getNumberValue(id, scene),
    evaluateNumberExpression: (expr) => deps.evaluateNumberExpression(scene, expr),
  });
}
