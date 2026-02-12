import { getCircleWorldGeometry, getLineWorldAnchors, getPointWorldPos, type SceneModel, type ScenePoint } from "../scene/points";
import type { Vec2 } from "../geo/vec2";

export type EvaluatedScene = {
  points: Map<string, Vec2 | null>;
  lines: Map<string, { a: Vec2; b: Vec2 } | null>;
  circles: Map<string, { center: Vec2; radius: number } | null>;
};

export function evaluateScene(scene: SceneModel): EvaluatedScene {
  const points = new Map<string, Vec2 | null>();
  const lines = new Map<string, { a: Vec2; b: Vec2 } | null>();
  const circles = new Map<string, { center: Vec2; radius: number } | null>();

  for (const point of scene.points) {
    points.set(point.id, getPointWorldPos(point as ScenePoint, scene));
  }
  for (const line of scene.lines) {
    lines.set(line.id, getLineWorldAnchors(line, scene));
  }
  for (const circle of scene.circles) {
    circles.set(circle.id, getCircleWorldGeometry(circle, scene));
  }

  return { points, lines, circles };
}
