import { projectPointToLine, projectPointToSegment } from "../geo/geometry";
import { resolveAngleRightStatus } from "../domain/rightAngleProvenance";
import {
  computeOrientedAngleRad,
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../view/camera";
import { computeRightMarkSizePx } from "../view/angleRender";
import type { Vec2 } from "../geo/vec2";
const VIS_EPS = 1;
const HUGE_RADIUS_PICK_PX = 200_000;

export type EngineHit =
  | { type: "point"; id: string }
  | { type: "polygon"; id: string }
  | { type: "angle"; id: string }
  | { type: "segment"; id: string }
  | { type: "line"; id: string }
  | { type: "circle"; id: string }
  | null;

export type HitTestOptions = {
  pointTolPx?: number;
  angleTolPx?: number;
  segmentTolPx?: number;
  lineTolPx?: number;
  circleTolPx?: number;
};

export type ResolvedPoint = { point: ScenePoint; world: Vec2 };
export type ResolvedAngle = {
  angle: SceneModel["angles"][number];
  a: Vec2;
  b: Vec2;
  c: Vec2;
  theta: number;
};

export function resolveVisibleAngles(scene: SceneModel): ResolvedAngle[] {
  const out: ResolvedAngle[] = [];
  for (let i = 0; i < scene.angles.length; i += 1) {
    const angle = scene.angles[i];
    if (!angle.visible) continue;
    const aPoint = scene.points.find((p) => p.id === angle.aId);
    const bPoint = scene.points.find((p) => p.id === angle.bId);
    const cPoint = scene.points.find((p) => p.id === angle.cId);
    if (!aPoint || !bPoint || !cPoint) continue;
    const a = getPointWorldPos(aPoint, scene);
    const b = getPointWorldPos(bPoint, scene);
    const c = getPointWorldPos(cPoint, scene);
    if (!a || !b || !c) continue;
    const theta = computeOrientedAngleRad(a, b, c);
    if (theta === null) continue;
    const status = resolveAngleRightStatus(scene, angle);
    const resolvedAngle = { ...angle, isRightExact: status === "exact", isRightApprox: status === "approx" };
    out.push({ angle: resolvedAngle, a, b, c, theta });
  }
  return out;
}

export function hitTestPointId(
  screenPoint: Vec2,
  points: ResolvedPoint[],
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  const maxDistanceSq = tolerancePx * tolerancePx;
  let closestId: string | null = null;
  let closestDistanceSq = maxDistanceSq;

  for (let i = points.length - 1; i >= 0; i -= 1) {
    const entry = points[i];
    if (!entry.point.visible) continue;
    const p = camMath.worldToScreen(entry.world, camera, vp);
    const dx = screenPoint.x - p.x;
    const dy = screenPoint.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= closestDistanceSq) {
      closestDistanceSq = d2;
      closestId = entry.point.id;
    }
  }

  return closestId;
}

export function hitTestSegmentId(
  screenPoint: Vec2,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  let bestId: string | null = null;
  let best = tolerancePx;

  for (let i = scene.segments.length - 1; i >= 0; i -= 1) {
    const seg = scene.segments[i];
    if (!seg.visible) continue;
    const aPoint = scene.points.find((p) => p.id === seg.aId);
    const bPoint = scene.points.find((p) => p.id === seg.bId);
    if (!aPoint || !bPoint) continue;
    const aWorld = getPointWorldPos(aPoint, scene);
    const bWorld = getPointWorldPos(bPoint, scene);
    if (!aWorld || !bWorld) continue;
    const ap = camMath.worldToScreen(aWorld, camera, vp);
    const bp = camMath.worldToScreen(bWorld, camera, vp);
    const pr = projectPointToSegment(screenPoint, ap, bp);
    if (pr.distance <= best) {
      best = pr.distance;
      bestId = seg.id;
    }
  }

  return bestId;
}

export function hitTestLineId(
  screenPoint: Vec2,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  let bestId: string | null = null;
  let best = tolerancePx;

  for (let i = scene.lines.length - 1; i >= 0; i -= 1) {
    const line = scene.lines[i];
    if (!line.visible) continue;
    const anchors = getLineWorldAnchors(line, scene);
    const aWorld = anchors?.a ?? null;
    const bWorld = anchors?.b ?? null;
    if (!aWorld || !bWorld) continue;
    const a = camMath.worldToScreen(aWorld, camera, vp);
    const b = camMath.worldToScreen(bWorld, camera, vp);
    const pr = projectPointToLine(screenPoint, a, b);
    if (pr.distance <= best) {
      best = pr.distance;
      bestId = line.id;
    }
  }

  return bestId;
}

export function hitTestCircleId(
  screenPoint: Vec2,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  let bestId: string | null = null;
  let best = tolerancePx;

  for (let i = scene.circles.length - 1; i >= 0; i -= 1) {
    const circle = scene.circles[i];
    if (!circle.visible) continue;
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) continue;
    const centerScreen = camMath.worldToScreen(geom.center, camera, vp);
    const radiusPx = geom.radius * camera.zoom;
    if (!Number.isFinite(radiusPx) || radiusPx <= 1e-9) continue;
    const vis = circleBoundaryVisibility(centerScreen, radiusPx, vp.widthPx, vp.heightPx, VIS_EPS);
    if (vis === "none") continue;
    if (vis === "contains" && radiusPx >= HUGE_RADIUS_PICK_PX) continue;
    const d = Math.abs(Math.hypot(screenPoint.x - centerScreen.x, screenPoint.y - centerScreen.y) - radiusPx);
    if (d <= best) {
      best = d;
      bestId = circle.id;
    }
  }

  return bestId;
}

export function hitTestAngleId(
  screenPoint: Vec2,
  resolvedAngles: ResolvedAngle[],
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  const sectorPickupRatio = 0.45;
  let bestId: string | null = null;
  let best = tolerancePx;
  for (let i = resolvedAngles.length - 1; i >= 0; i -= 1) {
    const entry = resolvedAngles[i];
    if (!entry.angle.visible) continue;
    const as = camMath.worldToScreen(entry.a, camera, vp);
    const bs = camMath.worldToScreen(entry.b, camera, vp);
    const cs = camMath.worldToScreen(entry.c, camera, vp);
    const r =
      entry.angle.kind === "sector"
        ? Math.max(2, Math.hypot(as.x - bs.x, as.y - bs.y))
        : Math.max(12, entry.angle.style.arcRadius * camera.zoom);
    const right = Boolean(entry.angle.isRightExact) || Boolean(entry.angle.isRightApprox);
    const rawMarkStyle = entry.angle.style.markStyle === "right" ? "rightSquare" : entry.angle.style.markStyle;
    const markStyle = right && rawMarkStyle === "arc" ? "rightSquare" : rawMarkStyle;
    const arcDistance = distanceToAngleArc(screenPoint, as, bs, entry.theta, r, sectorPickupRatio);
    const d =
      right && markStyle === "rightSquare"
        ? Math.min(
            distanceToRightAngleMark(screenPoint, as, bs, cs, computeRightMarkSizePx(r, entry.angle.style.strokeWidth)),
            arcDistance
          )
        : arcDistance;
    if (d <= best) {
      best = d;
      bestId = entry.angle.id;
    }
  }
  return bestId;
}

export function hitTestPolygonId(
  screenPoint: Vec2,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number
): string | null {
  for (let i = scene.polygons.length - 1; i >= 0; i -= 1) {
    const polygon = scene.polygons[i];
    if (!polygon.visible || polygon.pointIds.length < 3) continue;
    const screenVertices = polygon.pointIds
      .map((id) => scene.points.find((p) => p.id === id))
      .map((point) => (point ? getPointWorldPos(point, scene) : null))
      .filter((world): world is Vec2 => Boolean(world))
      .map((world) => camMath.worldToScreen(world, camera, vp));
    if (screenVertices.length < 3) continue;
    if (pointInPolygon(screenPoint, screenVertices)) return polygon.id;
    let nearEdge = false;
    for (let j = 0; j < screenVertices.length; j += 1) {
      const a = screenVertices[j];
      const b = screenVertices[(j + 1) % screenVertices.length];
      if (projectPointToSegment(screenPoint, a, b).distance <= tolerancePx) {
        nearEdge = true;
        break;
      }
    }
    if (nearEdge) return polygon.id;
  }
  return null;
}

export function hitTestTopObject(
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  screenPoint: Vec2,
  opts: HitTestOptions = {}
): EngineHit {
  const pointTolPx = opts.pointTolPx ?? 10;
  const angleTolPx = opts.angleTolPx ?? 10;
  const segmentTolPx = opts.segmentTolPx ?? 8;
  const lineTolPx = opts.lineTolPx ?? 8;
  const circleTolPx = opts.circleTolPx ?? 8;

  const resolvedPoints: ResolvedPoint[] = [];
  for (let i = 0; i < scene.points.length; i += 1) {
    const point = scene.points[i];
    const world = getPointWorldPos(point, scene);
    if (!world) continue;
    resolvedPoints.push({ point, world });
  }

  const pointId = hitTestPointId(screenPoint, resolvedPoints, camera, vp, pointTolPx);
  if (pointId) return { type: "point", id: pointId };
  const segmentId = hitTestSegmentId(screenPoint, scene, camera, vp, segmentTolPx);
  if (segmentId) return { type: "segment", id: segmentId };
  const polygonId = hitTestPolygonId(screenPoint, scene, camera, vp, segmentTolPx);
  if (polygonId) return { type: "polygon", id: polygonId };
  const angleId = hitTestAngleId(screenPoint, resolveVisibleAngles(scene), camera, vp, angleTolPx);
  if (angleId) return { type: "angle", id: angleId };
  const lineId = hitTestLineId(screenPoint, scene, camera, vp, lineTolPx);
  if (lineId) return { type: "line", id: lineId };
  const circleId = hitTestCircleId(screenPoint, scene, camera, vp, circleTolPx);
  if (circleId) return { type: "circle", id: circleId };

  return null;
}

function pointInPolygon(point: Vec2, vertices: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function angleSweep(aScreen: Vec2, bScreen: Vec2, thetaRad: number): { start: number; sweep: number } {
  const start = Math.atan2(aScreen.y - bScreen.y, aScreen.x - bScreen.x);
  const sweep = Math.min(Math.PI * 2, Math.max(0, thetaRad));
  return { start, sweep };
}

function distanceToAngleArc(
  p: Vec2,
  aScreen: Vec2,
  bScreen: Vec2,
  thetaRad: number,
  radiusPx: number,
  sectorPickupRatio: number
): number {
  const sweep = angleSweep(aScreen, bScreen, thetaRad);
  const dx = p.x - bScreen.x;
  const dy = p.y - bScreen.y;
  const dist = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx);
  const isWithin = isAngleOnArc(theta, sweep.start, sweep.sweep);
  if (isWithin && dist <= radiusPx * Math.max(0, Math.min(1, sectorPickupRatio))) {
    return 0;
  }
  if (!isWithin) {
    const pStart = { x: bScreen.x + Math.cos(sweep.start) * radiusPx, y: bScreen.y + Math.sin(sweep.start) * radiusPx };
    const pEnd = {
      x: bScreen.x + Math.cos(sweep.start - sweep.sweep) * radiusPx,
      y: bScreen.y + Math.sin(sweep.start - sweep.sweep) * radiusPx,
    };
    return Math.min(Math.hypot(p.x - pStart.x, p.y - pStart.y), Math.hypot(p.x - pEnd.x, p.y - pEnd.y));
  }
  return Math.abs(dist - radiusPx);
}

function distanceToRightAngleMark(p: Vec2, aScreen: Vec2, bScreen: Vec2, cScreen: Vec2, sizePx: number): number {
  const u = normalizeScreenVec({ x: aScreen.x - bScreen.x, y: aScreen.y - bScreen.y });
  const v = normalizeScreenVec({ x: cScreen.x - bScreen.x, y: cScreen.y - bScreen.y });
  const p1 = { x: bScreen.x + u.x * sizePx, y: bScreen.y + u.y * sizePx };
  const p3 = { x: bScreen.x + v.x * sizePx, y: bScreen.y + v.y * sizePx };
  const p2 = { x: p1.x + v.x * sizePx, y: p1.y + v.y * sizePx };
  const d1 = projectPointToSegment(p, p1, p2).distance;
  const d2 = projectPointToSegment(p, p2, p3).distance;
  const d3 = projectPointToSegment(p, p1, p3).distance;
  return Math.min(d1, d2, d3);
}

function normalizeScreenVec(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function isAngleOnArc(theta: number, start: number, sweep: number): boolean {
  const norm = (a: number): number => {
    let out = a;
    while (out < 0) out += Math.PI * 2;
    while (out >= Math.PI * 2) out -= Math.PI * 2;
    return out;
  };
  const t = norm(theta);
  const s = norm(start);
  const delta = norm(s - t);
  return delta <= sweep + 1e-9;
}

function circleBoundaryVisibility(center: Vec2, radius: number, width: number, height: number, eps: number): "none" | "contains" | "crosses" {
  const nearestX = Math.max(0, Math.min(width, center.x));
  const nearestY = Math.max(0, Math.min(height, center.y));
  const dx = center.x - nearestX;
  const dy = center.y - nearestY;
  const d2 = dx * dx + dy * dy;
  const r2 = radius * radius;
  if (d2 > r2 + eps) return "none";

  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ];
  const allInside = corners.every((c) => {
    const cx = c.x - center.x;
    const cy = c.y - center.y;
    return cx * cx + cy * cy <= r2 - eps;
  });
  return allInside ? "contains" : "crosses";
}
