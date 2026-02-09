import type { Vec2 } from "../geo/vec2";
import {
  circleCircleIntersections,
  distance,
  lineCircleIntersections,
  lineLineIntersection,
  projectPointToCircle,
  projectPointToLine,
  projectPointToSegment,
} from "../geo/geometry";
import { getPointWorldPos, type GeometryObjectRef, type SceneModel } from "../scene/points";
import type { Camera, Viewport } from "./camera";
import { camera as camMath } from "./camera";

type LineLike = { ref: GeometryObjectRef; a: Vec2; b: Vec2; finite: boolean };
type CircleLike = { ref: GeometryObjectRef; center: Vec2; radius: number };

type SnapKind = "point" | "intersection" | "onLine" | "onSegment" | "onCircle";

export type SnapCandidate = {
  kind: SnapKind;
  world: Vec2;
  screenDistPx: number;
  pointId?: string;
  lineId?: string;
  segId?: string;
  circleId?: string;
  s?: number;
  u?: number;
  t?: number;
  objA?: GeometryObjectRef;
  objB?: GeometryObjectRef;
};

type CandidateInternal = SnapCandidate & { priority: number };

export function findBestSnap(
  screen: Vec2,
  camera: Camera,
  vp: Viewport,
  scene: SceneModel,
  tolerancePx: number
): SnapCandidate | null {
  const cursorWorld = camMath.screenToWorld(screen, camera, vp);
  const candidates: CandidateInternal[] = [];

  for (let i = scene.points.length - 1; i >= 0; i -= 1) {
    const point = scene.points[i];
    if (!point.visible) continue;
    const world = getPointWorld(scene, point.id);
    if (!world) continue;
    const p = camMath.worldToScreen(world, camera, vp);
    const d = Math.hypot(screen.x - p.x, screen.y - p.y);
    if (d <= tolerancePx) {
      candidates.push({
        kind: "point",
        world,
        screenDistPx: d,
        pointId: point.id,
        priority: 1,
      });
    }
  }

  const nearLines: LineLike[] = [];
  const nearSegments: LineLike[] = [];
  const nearCircles: CircleLike[] = [];

  for (const line of scene.lines) {
    if (!line.visible) continue;
    const a = getPointWorld(scene, line.aId);
    const b = getPointWorld(scene, line.bId);
    if (!a || !b) continue;
    const ap = camMath.worldToScreen(a, camera, vp);
    const bp = camMath.worldToScreen(b, camera, vp);
    const pr = projectPointToLine(screen, ap, bp);
    if (pr.distance <= tolerancePx) {
      nearLines.push({ ref: { type: "line", id: line.id }, a, b, finite: false });
      const wpr = projectPointToLine(cursorWorld, a, b);
      const sp = camMath.worldToScreen(wpr.point, camera, vp);
      candidates.push({
        kind: "onLine",
        lineId: line.id,
        s: wpr.s,
        world: wpr.point,
        screenDistPx: Math.hypot(sp.x - screen.x, sp.y - screen.y),
        priority: 3,
      });
    }
  }

  for (const seg of scene.segments) {
    if (!seg.visible) continue;
    const a = getPointWorld(scene, seg.aId);
    const b = getPointWorld(scene, seg.bId);
    if (!a || !b) continue;
    const ap = camMath.worldToScreen(a, camera, vp);
    const bp = camMath.worldToScreen(b, camera, vp);
    const pr = projectPointToSegment(screen, ap, bp);
    if (pr.distance <= tolerancePx) {
      nearSegments.push({ ref: { type: "segment", id: seg.id }, a, b, finite: true });
      const wpr = projectPointToSegment(cursorWorld, a, b);
      const sp = camMath.worldToScreen(wpr.point, camera, vp);
      candidates.push({
        kind: "onSegment",
        segId: seg.id,
        u: wpr.u,
        world: wpr.point,
        screenDistPx: Math.hypot(sp.x - screen.x, sp.y - screen.y),
        priority: 3,
      });
    }
  }

  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    const center = getPointWorld(scene, circle.centerId);
    const through = getPointWorld(scene, circle.throughId);
    if (!center || !through) continue;
    const radius = distance(center, through);
    const cScreen = camMath.worldToScreen(center, camera, vp);
    const rScreen = radius * camera.zoom;
    const dToBoundary = Math.abs(Math.hypot(screen.x - cScreen.x, screen.y - cScreen.y) - rScreen);
    if (dToBoundary <= tolerancePx) {
      nearCircles.push({ ref: { type: "circle", id: circle.id }, center, radius });
      const pr = projectPointToCircle(cursorWorld, center, radius);
      const sp = camMath.worldToScreen(pr.point, camera, vp);
      candidates.push({
        kind: "onCircle",
        circleId: circle.id,
        t: pr.t,
        world: pr.point,
        screenDistPx: Math.hypot(sp.x - screen.x, sp.y - screen.y),
        priority: 3,
      });
    }
  }

  const lineLikes = [...nearLines, ...nearSegments];
  for (let i = 0; i < lineLikes.length; i += 1) {
    for (let j = i + 1; j < lineLikes.length; j += 1) {
      const p = lineLineIntersection(lineLikes[i].a, lineLikes[i].b, lineLikes[j].a, lineLikes[j].b);
      if (!p) continue;
      if (!lineLikeContainsPoint(lineLikes[i], p) || !lineLikeContainsPoint(lineLikes[j], p)) continue;
      pushIntersectionCandidate(p, lineLikes[i].ref, lineLikes[j].ref, screen, camera, vp, tolerancePx, candidates);
    }
  }

  for (const line of lineLikes) {
    for (const circle of nearCircles) {
      const intersections = lineCircleIntersections(line.a, line.b, circle.center, circle.radius);
      for (const p of intersections) {
        if (!lineLikeContainsPoint(line, p)) continue;
        pushIntersectionCandidate(p, line.ref, circle.ref, screen, camera, vp, tolerancePx, candidates);
      }
    }
  }

  for (let i = 0; i < nearCircles.length; i += 1) {
    for (let j = i + 1; j < nearCircles.length; j += 1) {
      const intersections = circleCircleIntersections(
        nearCircles[i].center,
        nearCircles[i].radius,
        nearCircles[j].center,
        nearCircles[j].radius
      );
      for (const p of intersections) {
        pushIntersectionCandidate(p, nearCircles[i].ref, nearCircles[j].ref, screen, camera, vp, tolerancePx, candidates);
      }
    }
  }

  const filtered = candidates.filter((candidate) => candidate.screenDistPx <= tolerancePx);
  if (filtered.length === 0) return null;

  filtered.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.screenDistPx - b.screenDistPx;
  });

  const { priority: _priority, ...best } = filtered[0];
  return best;
}

function pushIntersectionCandidate(
  world: Vec2,
  objA: GeometryObjectRef,
  objB: GeometryObjectRef,
  screen: Vec2,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number,
  out: CandidateInternal[]
) {
  const sp = camMath.worldToScreen(world, camera, vp);
  const d = Math.hypot(sp.x - screen.x, sp.y - screen.y);
  if (d > tolerancePx) return;
  out.push({
    kind: "intersection",
    world,
    screenDistPx: d,
    objA,
    objB,
    priority: 2,
  });
}

function getPointWorld(scene: SceneModel, pointId: string): Vec2 | null {
  const point = scene.points.find((item) => item.id === pointId);
  if (!point) return null;
  return getPointWorldPos(point, scene);
}

function lineLikeContainsPoint(line: LineLike, p: Vec2): boolean {
  if (!line.finite) return true;
  return pointWithinSegmentDomain(p, line.a, line.b);
}

function pointWithinSegmentDomain(p: Vec2, a: Vec2, b: Vec2): boolean {
  const EPS = 1e-6;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dd = dx * dx + dy * dy;
  if (dd <= EPS * EPS) return Math.hypot(p.x - a.x, p.y - a.y) <= EPS;
  const ux = p.x - a.x;
  const uy = p.y - a.y;
  const u = (ux * dx + uy * dy) / dd;
  return u >= -EPS && u <= 1 + EPS;
}
