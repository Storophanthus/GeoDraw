import type { Vec2 } from "../geo/vec2";
import {
  circleCircleIntersections,
  lineCircleIntersections,
  lineLineIntersection,
  projectPointToCircle,
  projectPointToLine,
  projectPointToSegment,
} from "../geo/geometry";
import {
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  type GeometryObjectRef,
  type SceneModel,
} from "../scene/points";
import type { Camera, Viewport } from "./camera";
import { camera as camMath } from "./camera";

type LineLike = { ref: GeometryObjectRef; a: Vec2; b: Vec2; finite: boolean };
type CircleLike = { ref: GeometryObjectRef; center: Vec2; radius: number };
type SectorLike = { ref: GeometryObjectRef; center: Vec2; radius: number; start: number; sweep: number };

type SnapKind = "point" | "intersection" | "onLine" | "onSegment" | "onCircle";
const VIS_EPS = 1;
const HUGE_RADIUS_PICK_PX = 200_000;

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
  tolerancePx: number,
  operationBudget = 6000
): SnapCandidate | null {
  const cursorWorld = camMath.screenToWorld(screen, camera, vp);
  const candidates: CandidateInternal[] = [];
  let ops = 0;
  const withinBudget = (cost = 1): boolean => {
    ops += cost;
    return ops <= operationBudget;
  };

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
  const nearSectors: SectorLike[] = [];

  for (const line of scene.lines) {
    if (!line.visible) continue;
    const anchors = getLineWorldAnchors(line, scene);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
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
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) continue;
    const center = geom.center;
    const radius = geom.radius;
    const cScreen = camMath.worldToScreen(center, camera, vp);
    const rScreen = radius * camera.zoom;
    if (!Number.isFinite(rScreen) || rScreen <= 1e-9) continue;
    const vis = circleBoundaryVisibility(cScreen, rScreen, vp.widthPx, vp.heightPx, VIS_EPS);
    if (vis === "none") continue;
    // Extremely large containing circles are not useful for snapping and are expensive.
    if (vis === "contains" && rScreen >= HUGE_RADIUS_PICK_PX) continue;
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

  for (const angle of scene.angles) {
    if (!angle.visible || angle.kind !== "sector") continue;
    const a = getPointWorld(scene, angle.aId);
    const b = getPointWorld(scene, angle.bId);
    const c = getPointWorld(scene, angle.cId);
    if (!a || !b || !c) continue;
    const radius = Math.hypot(a.x - b.x, a.y - b.y);
    if (!Number.isFinite(radius) || radius <= 1e-12) continue;
    const cScreen = camMath.worldToScreen(b, camera, vp);
    const rScreen = radius * camera.zoom;
    if (!Number.isFinite(rScreen) || rScreen <= 1e-9) continue;
    const vis = circleBoundaryVisibility(cScreen, rScreen, vp.widthPx, vp.heightPx, VIS_EPS);
    if (vis === "none") continue;
    if (vis === "contains" && rScreen >= HUGE_RADIUS_PICK_PX) continue;
    const dToBoundary = Math.abs(Math.hypot(screen.x - cScreen.x, screen.y - cScreen.y) - rScreen);
    if (dToBoundary > tolerancePx) continue;
    const sweep = computeSweep(a, b, c);
    nearSectors.push({
      ref: { type: "angle", id: angle.id },
      center: b,
      radius,
      start: Math.atan2(a.y - b.y, a.x - b.x),
      sweep,
    });
  }

  const lineLikes = [...nearLines, ...nearSegments];
  let budgetExceeded = false;
  for (let i = 0; i < lineLikes.length; i += 1) {
    for (let j = i + 1; j < lineLikes.length; j += 1) {
      if (!withinBudget()) {
        budgetExceeded = true;
        break;
      }
      const p = lineLineIntersection(lineLikes[i].a, lineLikes[i].b, lineLikes[j].a, lineLikes[j].b);
      if (!p) continue;
      if (!lineLikeContainsPoint(lineLikes[i], p) || !lineLikeContainsPoint(lineLikes[j], p)) continue;
      pushIntersectionCandidate(p, lineLikes[i].ref, lineLikes[j].ref, screen, camera, vp, tolerancePx, candidates);
    }
    if (budgetExceeded) break;
  }

  for (const line of lineLikes) {
    if (budgetExceeded) break;
    for (const circle of nearCircles) {
      if (!withinBudget()) {
        budgetExceeded = true;
        break;
      }
      const intersections = lineCircleIntersections(line.a, line.b, circle.center, circle.radius);
      for (const p of intersections) {
        if (!lineLikeContainsPoint(line, p)) continue;
        pushIntersectionCandidate(p, line.ref, circle.ref, screen, camera, vp, tolerancePx, candidates);
      }
    }
  }

  for (const line of lineLikes) {
    if (budgetExceeded) break;
    for (const sector of nearSectors) {
      if (!withinBudget()) {
        budgetExceeded = true;
        break;
      }
      const intersections = lineSectorBoundaryIntersections(line, sector);
      for (const p of intersections) {
        pushIntersectionCandidate(p, line.ref, sector.ref, screen, camera, vp, tolerancePx, candidates);
      }
    }
  }

  for (let i = 0; i < nearCircles.length; i += 1) {
    if (budgetExceeded) break;
    for (let j = i + 1; j < nearCircles.length; j += 1) {
      if (!withinBudget()) {
        budgetExceeded = true;
        break;
      }
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

function computeSweep(a: Vec2, b: Vec2, c: Vec2): number {
  const full = Math.PI * 2;
  const start = Math.atan2(a.y - b.y, a.x - b.x);
  const end = Math.atan2(c.y - b.y, c.x - b.x);
  let delta = end - start;
  while (delta < 0) delta += full;
  while (delta >= full) delta -= full;
  return delta;
}

function pointOnSectorArc(p: Vec2, sector: SectorLike): boolean {
  const full = Math.PI * 2;
  let d = Math.atan2(p.y - sector.center.y, p.x - sector.center.x) - sector.start;
  while (d < 0) d += full;
  while (d >= full) d -= full;
  const sweep = ((sector.sweep % full) + full) % full;
  const eps = 1e-6;
  return d <= sweep + eps;
}

function lineSectorBoundaryIntersections(line: LineLike, sector: SectorLike): Vec2[] {
  const out: Vec2[] = [];
  const pushUnique = (p: Vec2) => {
    const eps = 1e-6;
    for (const q of out) {
      if (Math.hypot(p.x - q.x, p.y - q.y) <= eps) return;
    }
    out.push(p);
  };

  const arcHits = lineCircleIntersections(line.a, line.b, sector.center, sector.radius);
  for (const p of arcHits) {
    if (!lineLikeContainsPoint(line, p) || !pointOnSectorArc(p, sector)) continue;
    pushUnique(p);
  }

  const startPoint = {
    x: sector.center.x + sector.radius * Math.cos(sector.start),
    y: sector.center.y + sector.radius * Math.sin(sector.start),
  };
  const endAngle = sector.start + sector.sweep;
  const endPoint = {
    x: sector.center.x + sector.radius * Math.cos(endAngle),
    y: sector.center.y + sector.radius * Math.sin(endAngle),
  };

  const sideStartHit = lineLineIntersection(line.a, line.b, sector.center, startPoint);
  if (sideStartHit && lineLikeContainsPoint(line, sideStartHit) && pointWithinSegmentDomain(sideStartHit, sector.center, startPoint)) {
    pushUnique(sideStartHit);
  }

  const sideEndHit = lineLineIntersection(line.a, line.b, sector.center, endPoint);
  if (sideEndHit && lineLikeContainsPoint(line, sideEndHit) && pointWithinSegmentDomain(sideEndHit, sector.center, endPoint)) {
    pushUnique(sideEndHit);
  }

  return out;
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
