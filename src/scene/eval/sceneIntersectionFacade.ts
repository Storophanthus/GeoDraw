import type { Vec2 } from "../../geo/vec2";
import type { NumberExpressionEvalResult } from "./numericExpression";
import type { SceneEvalContext } from "./sceneContextBuilder";
import { objectIntersectionsWithOps } from "./intersectionQueries";
import { createSceneGeometryFacadeWithCtx } from "./sceneGeometryFacade";
import {
  resolveCircleLinePairAssignmentsWithCtx,
  resolveGenericIntersectionPairAssignmentsWithCtx,
} from "./intersectionStabilityAdapters";
import type { GeometryObjectRef, SceneModel } from "../points";

type SceneIntersectionFacadeDeps = {
  getPointWorldById: (pointId: string, scene: SceneModel, ctx: SceneEvalContext) => Vec2 | null;
  evaluateNumberExpressionWithCtx: (
    scene: SceneModel,
    exprRaw: string,
    ctx: SceneEvalContext,
    excludeNumberId?: string
  ) => NumberExpressionEvalResult;
};

export function createSceneIntersectionFacadeWithCtx(
  scene: SceneModel,
  ctx: SceneEvalContext,
  deps: SceneIntersectionFacadeDeps
) {
  let geometryFacade: ReturnType<typeof createSceneGeometryFacadeWithCtx> | null = null;
  const getGeometryFacade = () => {
    if (geometryFacade) return geometryFacade;
    geometryFacade = createSceneGeometryFacadeWithCtx(scene, ctx, {
      getPointWorldById: deps.getPointWorldById,
      evaluateNumberExpressionWithCtx: (s, exprRaw, c) => deps.evaluateNumberExpressionWithCtx(s, exprRaw, c),
    });
    return geometryFacade;
  };

  return {
    getSceneGeometryFacade() {
      return getGeometryFacade();
    },
    objectIntersections(a: GeometryObjectRef, b: GeometryObjectRef): Vec2[] {
      const geometry = getGeometryFacade();
      return objectIntersectionsWithOps(a, b, {
        asLineLike: (ref) => geometry.asLineLike(ref),
        asCircle: (ref) => geometry.asCircle(ref),
        asSectorArc: (ref) => geometry.asSectorArc(ref),
        onLineLineCall: () => {
          ctx.stats.lineLineCalls += 1;
        },
        onCircleLineCall: () => {
          ctx.stats.circleLineCalls += 1;
        },
        onCircleCircleCall: () => {
          ctx.stats.circleCircleCalls += 1;
        },
        onAllocation: (count) => {
          ctx.stats.allocationsEstimate += count;
        },
      });
    },
    resolveCircleLinePairAssignments(
      circleId: string,
      lineId: string,
      branches: Array<{ point: Vec2; t: number }>,
      stabilitySignature: string
    ): Map<string, Vec2 | null> {
      return resolveCircleLinePairAssignmentsWithCtx(scene, ctx, circleId, lineId, branches, stabilitySignature, {
        getPointWorldById: (pointId) => deps.getPointWorldById(pointId, scene, ctx),
      });
    },
    resolveGenericIntersectionPairAssignments(
      objA: GeometryObjectRef,
      objB: GeometryObjectRef,
      intersections: Vec2[]
    ): Map<string, Vec2 | null> {
      return resolveGenericIntersectionPairAssignmentsWithCtx(scene, ctx, objA, objB, intersections, {
        getPointWorldById: (pointId) => deps.getPointWorldById(pointId, scene, ctx),
      });
    },
  };
}
