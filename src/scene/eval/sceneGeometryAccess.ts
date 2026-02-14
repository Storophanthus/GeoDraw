import type { Vec2 } from "../../geo/vec2";
import type { GeometryObjectRef, SceneAngle, SceneCircle, SceneLine } from "../points";
import {
  asCircleWithOps,
  asLineLikeWithOps,
  asSectorArcWithOps,
  getCircleWorldGeometryWithOps,
  resolveLineAnchorsWithOps,
} from "./geometryResolve";

type SegmentRef = { aId: string; bId: string };

type SceneGeometryRuntime = {
  getPointWorldById: (id: string) => Vec2 | null;
  getLineById: (id: string) => SceneLine | null;
  getSegmentById: (id: string) => SegmentRef | null;
  getCircleById: (id: string) => SceneCircle | null;
  getAngleById: (id: string) => SceneAngle | null;
  evaluateCircleRadiusExpr: (expr: string) => number | null;
  lineInProgress: Set<string>;
};

export function asLineLikeInScene(
  ref: GeometryObjectRef,
  runtime: SceneGeometryRuntime
): { a: Vec2; b: Vec2; finite: boolean } | null {
  return asLineLikeWithOps(ref, runtime);
}

export function resolveLineAnchorsInScene(
  line: SceneLine,
  runtime: SceneGeometryRuntime
): { a: Vec2; b: Vec2 } | null {
  return resolveLineAnchorsWithOps(line, runtime);
}

export function asCircleInScene(
  ref: GeometryObjectRef,
  runtime: SceneGeometryRuntime
): { center: Vec2; radius: number } | null {
  return asCircleWithOps(ref, runtime);
}

export function asSectorArcInScene(
  ref: GeometryObjectRef,
  runtime: SceneGeometryRuntime
): { center: Vec2; radius: number; start: number; sweep: number } | null {
  return asSectorArcWithOps(ref, runtime);
}

export function getCircleWorldGeometryInScene(
  circle: SceneCircle,
  runtime: SceneGeometryRuntime
): { center: Vec2; radius: number } | null {
  return getCircleWorldGeometryWithOps(circle, runtime);
}
