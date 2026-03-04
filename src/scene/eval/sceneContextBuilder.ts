import { buildSceneEvalContext as buildSceneEvalContextCore, type SceneEvalContext as CoreSceneEvalContext } from "./evalContext";
import type { SceneAngle, SceneCircle, SceneLine, SceneModel, SceneNumber, ScenePoint, SceneSegment, SceneVector } from "../points";

export type SceneEvalContext = CoreSceneEvalContext<
  ScenePoint,
  SceneVector,
  SceneLine,
  SceneSegment,
  SceneCircle,
  SceneAngle,
  SceneNumber
>;

export function buildSceneEvalContextForScene(
  scene: SceneModel,
  explicit: boolean,
  tick: number,
  startedAtMs: number
): SceneEvalContext {
  const pointById = new Map<string, ScenePoint>();
  for (const point of scene.points) pointById.set(point.id, point);
  const vectorById = new Map<string, SceneVector>();
  for (const vector of scene.vectors ?? []) vectorById.set(vector.id, vector);
  const lineById = new Map<string, SceneLine>();
  for (const line of scene.lines) lineById.set(line.id, line);
  const segmentById = new Map<string, SceneSegment>();
  for (const seg of scene.segments) segmentById.set(seg.id, seg);
  const circleById = new Map<string, SceneCircle>();
  for (const circle of scene.circles) circleById.set(circle.id, circle);
  const angleById = new Map<string, SceneAngle>();
  for (const angle of scene.angles) angleById.set(angle.id, angle);
  const numberById = new Map<string, SceneNumber>();
  for (const num of scene.numbers) numberById.set(num.id, num);
  return buildSceneEvalContextCore({
    tick,
    startedAt: startedAtMs,
    explicit,
    pointById,
    vectorById,
    lineById,
    segmentById,
    circleById,
    angleById,
    numberById,
    dirtyNodes: scene.points.length + scene.numbers.length,
  });
}
