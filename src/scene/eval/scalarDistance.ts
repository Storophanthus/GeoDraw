import type { Vec2 } from "../../geo/vec2";
import { projectPointToLine, projectPointToSegment } from "../../geo/geometry";

export type ScalarDistanceArg =
  | { kind: "point"; x: number; y: number }
  | { kind: "lineLike"; finite: boolean; a: Vec2; b: Vec2 };

export type ScalarDistanceEvalResult = { ok: true; value: number } | { ok: false; error: string };

export function evaluateScalarDistanceArgs(a: ScalarDistanceArg, b: ScalarDistanceArg): ScalarDistanceEvalResult {
  if (a.kind === "point" && b.kind === "point") {
    return { ok: true, value: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  if (a.kind === "point" && b.kind === "lineLike") {
    return {
      ok: true,
      value: b.finite
        ? projectPointToSegment(a, b.a, b.b).distance
        : projectPointToLine(a, b.a, b.b).distance,
    };
  }
  if (a.kind === "lineLike" && b.kind === "point") {
    return {
      ok: true,
      value: a.finite
        ? projectPointToSegment(b, a.a, a.b).distance
        : projectPointToLine(b, a.a, a.b).distance,
    };
  }
  return { ok: false, error: "Distance(Line/Segment, Line/Segment) is not supported" };
}
