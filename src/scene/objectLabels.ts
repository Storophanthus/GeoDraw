import type { Vec2 } from "../geo/vec2";
import {
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  type SceneCircle,
  type SceneLine,
  type SceneModel,
  type ScenePolygon,
  type SceneSegment,
} from "./points";

export type LabelableObjectType = "segment" | "line" | "circle" | "polygon";

export type LabelableObjectRef = {
  type: LabelableObjectType;
  id: string;
};

function pointName(scene: SceneModel, pointId: string): string {
  const point = scene.points.find((item) => item.id === pointId);
  return point?.name ?? pointId;
}

function pointWorld(scene: SceneModel, pointId: string): Vec2 | null {
  const point = scene.points.find((item) => item.id === pointId);
  if (!point) return null;
  return getPointWorldPos(point, scene);
}

function labelOffsetNormal(a: Vec2, b: Vec2): { nx: number; ny: number; amount: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-9) return { nx: 0, ny: 1, amount: 0.35 };
  const nx = -dy / len;
  const ny = dx / len;
  const amount = Math.max(0.22, Math.min(0.85, len * 0.08));
  return { nx, ny, amount };
}

export function defaultSegmentLabelText(segment: SceneSegment, scene: SceneModel): string {
  return `${pointName(scene, segment.aId)}${pointName(scene, segment.bId)}`;
}

export function defaultLineLabelText(line: SceneLine, scene: SceneModel): string {
  if (line.kind === "twoPoint" || line.kind === undefined) {
    return `${pointName(scene, line.aId)}${pointName(scene, line.bId)}`;
  }
  return line.id;
}

export function defaultCircleLabelText(circle: SceneCircle, scene: SceneModel): string {
  if (circle.kind === "twoPoint" || circle.kind === undefined) {
    return `(${pointName(scene, circle.centerId)}${pointName(scene, circle.throughId)})`;
  }
  if (circle.kind === "fixedRadius") {
    return `(${pointName(scene, circle.centerId)})`;
  }
  if (circle.kind === "threePoint") {
    return `(${pointName(scene, circle.aId)}${pointName(scene, circle.bId)}${pointName(scene, circle.cId)})`;
  }
  return circle.id;
}

export function defaultPolygonLabelText(polygon: ScenePolygon, scene: SceneModel): string {
  if (polygon.pointIds.length === 0) return polygon.id;
  return polygon.pointIds.map((id) => pointName(scene, id)).join("");
}

export function defaultSegmentLabelPosWorld(segment: SceneSegment, scene: SceneModel): Vec2 | null {
  const a = pointWorld(scene, segment.aId);
  const b = pointWorld(scene, segment.bId);
  if (!a || !b) return null;
  const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  const { nx, ny, amount } = labelOffsetNormal(a, b);
  return { x: mid.x + nx * amount, y: mid.y + ny * amount };
}

export function defaultLineLabelPosWorld(line: SceneLine, scene: SceneModel): Vec2 | null {
  const anchors = getLineWorldAnchors(line, scene);
  if (!anchors) return null;
  const mid = {
    x: (anchors.a.x + anchors.b.x) * 0.5,
    y: (anchors.a.y + anchors.b.y) * 0.5,
  };
  const { nx, ny, amount } = labelOffsetNormal(anchors.a, anchors.b);
  return { x: mid.x + nx * Math.max(0.3, amount), y: mid.y + ny * Math.max(0.3, amount) };
}

export function defaultCircleLabelPosWorld(circle: SceneCircle, scene: SceneModel): Vec2 | null {
  const geom = getCircleWorldGeometry(circle, scene);
  if (!geom) return null;
  const r = Math.max(0.12, geom.radius);
  const d = Math.max(0.3, Math.min(r * 1.1, r + 0.65));
  const diag = Math.SQRT1_2;
  return {
    x: geom.center.x + d * diag,
    y: geom.center.y + d * diag,
  };
}

export function defaultPolygonLabelPosWorld(polygon: ScenePolygon, scene: SceneModel): Vec2 | null {
  if (polygon.pointIds.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const pointId of polygon.pointIds) {
    const world = pointWorld(scene, pointId);
    if (!world) continue;
    sumX += world.x;
    sumY += world.y;
    count += 1;
  }
  if (count === 0) return null;
  return { x: sumX / count, y: sumY / count };
}

export function defaultObjectLabelText(ref: LabelableObjectRef, scene: SceneModel): string {
  if (ref.type === "segment") {
    const segment = scene.segments.find((item) => item.id === ref.id);
    return segment ? defaultSegmentLabelText(segment, scene) : ref.id;
  }
  if (ref.type === "line") {
    const line = scene.lines.find((item) => item.id === ref.id);
    return line ? defaultLineLabelText(line, scene) : ref.id;
  }
  if (ref.type === "circle") {
    const circle = scene.circles.find((item) => item.id === ref.id);
    return circle ? defaultCircleLabelText(circle, scene) : ref.id;
  }
  const polygon = scene.polygons.find((item) => item.id === ref.id);
  return polygon ? defaultPolygonLabelText(polygon, scene) : ref.id;
}

export function defaultObjectLabelPosWorld(ref: LabelableObjectRef, scene: SceneModel): Vec2 | null {
  if (ref.type === "segment") {
    const segment = scene.segments.find((item) => item.id === ref.id);
    return segment ? defaultSegmentLabelPosWorld(segment, scene) : null;
  }
  if (ref.type === "line") {
    const line = scene.lines.find((item) => item.id === ref.id);
    return line ? defaultLineLabelPosWorld(line, scene) : null;
  }
  if (ref.type === "circle") {
    const circle = scene.circles.find((item) => item.id === ref.id);
    return circle ? defaultCircleLabelPosWorld(circle, scene) : null;
  }
  const polygon = scene.polygons.find((item) => item.id === ref.id);
  return polygon ? defaultPolygonLabelPosWorld(polygon, scene) : null;
}

export function resolveObjectLabelText(raw: string | undefined, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  return raw.trim();
}

export function isFiniteLabelPosWorld(pos: Vec2 | null | undefined): pos is Vec2 {
  if (!pos) return false;
  return Number.isFinite(pos.x) && Number.isFinite(pos.y);
}
