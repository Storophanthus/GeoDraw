import { add, mul, sub } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import { hitTestLineId, hitTestSegmentId } from "../../engine";
import {
  computeOrientedAngleRad,
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  type LineLikeObjectRef,
  type SceneModel,
} from "../../scene/points";
import type { HoveredHit, PendingSelection } from "../../state/geoStore";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import type { SnapCandidate } from "../snapEngine";
import { drawAngleArcPreview, drawAngleSector } from "../angleRender";

export type AngleFixedToolState = { angleExpr: string; direction: "CCW" | "CW" };
export type CircleFixedToolState = { radius: string };

function circumcircleFromThreePoints(a: Vec2, b: Vec2, c: Vec2): { center: Vec2; radius: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) <= 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  const radius = Math.hypot(center.x - a.x, center.y - a.y);
  if (!Number.isFinite(radius) || radius <= 1e-12) return null;
  return { center, radius };
}

export function drawPendingPreview(
  ctx: CanvasRenderingContext2D,
  pendingSelection: PendingSelection,
  cursorWorld: Vec2 | null,
  cursorScreen: Vec2 | null,
  hoverSnap: SnapCandidate | null,
  hoveredHit: HoveredHit,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  angleFixedTool: AngleFixedToolState,
  circleFixedTool: CircleFixedToolState,
  tolerances: { linePx: number; segmentPx: number }
): void {
  if (!pendingSelection) return;
  const firstPointId = pendingSelection.first.type === "point" ? pendingSelection.first.id : null;
  const firstPoint = firstPointId ? scene.points.find((p) => p.id === firstPointId) : null;
  const firstWorld = firstPoint ? getPointWorldPos(firstPoint, scene) : null;
  const p1 = firstWorld ? camMath.worldToScreen(firstWorld, camera, vp) : null;

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 1.3;

  const drawInfinitePreviewLine = (through: Vec2, dirVec: Vec2): void => {
    const len = Math.hypot(dirVec.x, dirVec.y);
    if (len <= 1e-12) return;
    const dir = { x: dirVec.x / len, y: dirVec.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const q1 = camMath.worldToScreen(add(through, mul(dir, -span)), camera, vp);
    const q2 = camMath.worldToScreen(add(through, mul(dir, span)), camera, vp);
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
  };

  if (p1 && (pendingSelection.tool === "segment" || pendingSelection.tool === "midpoint") && cursorWorld) {
    const p2 = camMath.worldToScreen(cursorWorld, camera, vp);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (p1 && pendingSelection.tool === "line2p" && cursorWorld && firstWorld) {
    const d = sub(cursorWorld, firstWorld);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) {
      ctx.restore();
      return;
    }
    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const q1 = camMath.worldToScreen(add(firstWorld, mul(dir, -span)), camera, vp);
    const q2 = camMath.worldToScreen(add(firstWorld, mul(dir, span)), camera, vp);
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (p1 && pendingSelection.tool === "circle_cp" && cursorScreen) {
    const radiusPx = Math.hypot(cursorScreen.x - p1.x, cursorScreen.y - p1.y);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (pendingSelection.tool === "circle_3p" && pendingSelection.step === 3 && p1 && pendingSelection.second && cursorScreen) {
    const p2Point = scene.points.find((p) => p.id === pendingSelection.second.id);
    const p2World = p2Point ? getPointWorldPos(p2Point, scene) : null;
    const p3World = camMath.screenToWorld(cursorScreen, camera, vp);
    if (firstWorld && p2World) {
      const geom = circumcircleFromThreePoints(firstWorld, p2World, p3World);
      if (geom) {
        const c = camMath.worldToScreen(geom.center, camera, vp);
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, geom.radius * camera.zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  if (p1 && pendingSelection.tool === "circle_fixed") {
    const evaluated = evaluateNumberExpression(scene, circleFixedTool.radius);
    if (evaluated.ok && Number.isFinite(evaluated.value) && evaluated.value > 0) {
      const radiusPx = evaluated.value * camera.zoom;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (pendingSelection.tool === "perp_line" || pendingSelection.tool === "parallel_line") {
    let through: Vec2 | null = null;
    let baseRef: LineLikeObjectRef | null = null;

    const first = pendingSelection.first;
    if (first.type === "point") {
      const throughPoint = scene.points.find((p) => p.id === first.id);
      through = throughPoint ? getPointWorldPos(throughPoint, scene) : null;
      if (hoverSnap?.kind === "onLine" && hoverSnap.lineId) baseRef = { type: "line", id: hoverSnap.lineId };
      else if (hoverSnap?.kind === "onSegment" && hoverSnap.segId) baseRef = { type: "segment", id: hoverSnap.segId };
      else if (hoveredHit?.type === "line2p") baseRef = { type: "line", id: hoveredHit.id };
      else if (hoveredHit?.type === "segment") baseRef = { type: "segment", id: hoveredHit.id };
      else if (cursorWorld && cursorScreen) {
        const lineId = hitTestLineId(cursorScreen, scene, camera, vp, tolerances.linePx);
        const segId = hitTestSegmentId(cursorScreen, scene, camera, vp, tolerances.segmentPx);
        if (lineId) baseRef = { type: "line", id: lineId };
        else if (segId) baseRef = { type: "segment", id: segId };
      }
    } else {
      baseRef = first.ref;
      if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
        const p = scene.points.find((pt) => pt.id === hoverSnap.pointId);
        through = p ? getPointWorldPos(p, scene) : null;
      } else if (hoveredHit?.type === "point") {
        const p = scene.points.find((pt) => pt.id === hoveredHit.id);
        through = p ? getPointWorldPos(p, scene) : null;
      } else if (cursorWorld) {
        through = cursorWorld;
      }
    }

    if (!through || !baseRef) {
      ctx.restore();
      return;
    }
    const baseAnchors =
      baseRef.type === "line"
        ? (() => {
            const line = scene.lines.find((l) => l.id === baseRef.id);
            if (!line) return null;
            return getLineWorldAnchors(line, scene);
          })()
        : (() => {
            const seg = scene.segments.find((item) => item.id === baseRef.id);
            if (!seg) return null;
            const aPoint = scene.points.find((p) => p.id === seg.aId);
            const bPoint = scene.points.find((p) => p.id === seg.bId);
            if (!aPoint || !bPoint) return null;
            const a = getPointWorldPos(aPoint, scene);
            const b = getPointWorldPos(bPoint, scene);
            if (!a || !b) return null;
            return { a, b };
          })();
    if (!baseAnchors) {
      ctx.restore();
      return;
    }
    const d = sub(baseAnchors.b, baseAnchors.a);
    if (d.x * d.x + d.y * d.y <= 1e-12) {
      ctx.restore();
      return;
    }
    const dirVec = pendingSelection.tool === "perp_line" ? { x: -d.y, y: d.x } : d;
    drawInfinitePreviewLine(through, dirVec);
  }

  if (pendingSelection.tool === "tangent_line") {
    let through: Vec2 | null = null;
    let circleId: string | null = null;

    if (pendingSelection.first.type === "point") {
      const throughPoint = scene.points.find((p) => p.id === pendingSelection.first.id);
      through = throughPoint ? getPointWorldPos(throughPoint, scene) : null;
      circleId =
        hoverSnap?.kind === "onCircle" && hoverSnap.circleId
          ? hoverSnap.circleId
          : hoveredHit?.type === "circle"
            ? hoveredHit.id
            : null;
    } else {
      circleId = pendingSelection.first.id;
      if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
        const p = scene.points.find((pt) => pt.id === hoverSnap.pointId);
        through = p ? getPointWorldPos(p, scene) : null;
      } else if (hoveredHit?.type === "point") {
        const p = scene.points.find((pt) => pt.id === hoveredHit.id);
        through = p ? getPointWorldPos(p, scene) : null;
      } else if (cursorWorld) {
        through = cursorWorld;
      }
    }

    if (!through || !circleId) {
      ctx.restore();
      return;
    }

    const circle = scene.circles.find((c) => c.id === circleId);
    if (!circle) {
      ctx.restore();
      return;
    }
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) {
      ctx.restore();
      return;
    }
    const center = geom.center;
    const radius = geom.radius;
    if (!Number.isFinite(radius) || radius <= 1e-12) {
      ctx.restore();
      return;
    }
    const vx = through.x - center.x;
    const vy = through.y - center.y;
    const d2 = vx * vx + vy * vy;
    const r2 = radius * radius;
    const eps = 1e-10;
    if (d2 <= 1e-12 || d2 < r2 - eps) {
      ctx.restore();
      return;
    }
    const perp = { x: -vy, y: vx };
    if (Math.abs(d2 - r2) <= eps) {
      drawInfinitePreviewLine(through, perp);
      ctx.restore();
      return;
    }
    const k = r2 / d2;
    const h = (radius * Math.sqrt(Math.max(0, d2 - r2))) / d2;
    const t0 = { x: center.x + k * vx + h * perp.x, y: center.y + k * vy + h * perp.y };
    const t1 = { x: center.x + k * vx - h * perp.x, y: center.y + k * vy - h * perp.y };
    drawInfinitePreviewLine(through, sub(t0, through));
    drawInfinitePreviewLine(through, sub(t1, through));
  }

  if (pendingSelection.tool === "angle" && pendingSelection.step === 3) {
    const aPoint = scene.points.find((p) => p.id === pendingSelection.first.id);
    const bPoint = scene.points.find((p) => p.id === pendingSelection.second.id);
    const a = aPoint ? getPointWorldPos(aPoint, scene) : null;
    const b = bPoint ? getPointWorldPos(bPoint, scene) : null;
    let c: Vec2 | null = null;
    if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
      const p = scene.points.find((pt) => pt.id === hoverSnap.pointId);
      c = p ? getPointWorldPos(p, scene) : null;
    }
    if (!c && hoveredHit?.type === "point") {
      const p = scene.points.find((pt) => pt.id === hoveredHit.id);
      c = p ? getPointWorldPos(p, scene) : null;
    }
    if (!c) c = cursorWorld;
    if (a && b && c) {
      const theta = computeOrientedAngleRad(a, b, c);
      if (theta !== null) {
        const as = camMath.worldToScreen(a, camera, vp);
        const bs = camMath.worldToScreen(b, camera, vp);
        const radiusPx = Math.max(18, Math.min(72, Math.hypot(as.x - bs.x, as.y - bs.y) * 0.28));
        drawAngleArcPreview(ctx, as, bs, theta, radiusPx);
        const start = Math.atan2(as.y - bs.y, as.x - bs.x);
        const mid = start - theta * 0.5;
        const lx = bs.x + Math.cos(mid) * (radiusPx + 16);
        const ly = bs.y + Math.sin(mid) * (radiusPx + 16);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([]);
        ctx.fillStyle = "#0284c7";
        ctx.font = "12px system-ui";
        const deg = (theta * 180) / Math.PI;
        ctx.fillText(`${deg.toFixed(2)}°`, lx, ly);
        ctx.restore();
      }
    }
  }

  if (pendingSelection.tool === "sector" && pendingSelection.step === 3) {
    const oPoint = scene.points.find((p) => p.id === pendingSelection.first.id);
    const aPoint = scene.points.find((p) => p.id === pendingSelection.second.id);
    const o = oPoint ? getPointWorldPos(oPoint, scene) : null;
    const a = aPoint ? getPointWorldPos(aPoint, scene) : null;
    if (!o || !a) {
      ctx.restore();
      return;
    }
    const r = Math.hypot(a.x - o.x, a.y - o.y);
    if (!Number.isFinite(r) || r <= 1e-12) {
      ctx.restore();
      return;
    }

    let c: Vec2 | null = null;
    if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
      const p = scene.points.find((pt) => pt.id === hoverSnap.pointId);
      c = p ? getPointWorldPos(p, scene) : null;
    }
    if (!c && hoveredHit?.type === "point") {
      const p = scene.points.find((pt) => pt.id === hoveredHit.id);
      c = p ? getPointWorldPos(p, scene) : null;
    }
    if (!c) c = cursorWorld;
    if (!c) {
      ctx.restore();
      return;
    }
    const vx = c.x - o.x;
    const vy = c.y - o.y;
    const d = Math.hypot(vx, vy);
    const ux = d <= 1e-12 ? (a.x - o.x) / r : vx / d;
    const uy = d <= 1e-12 ? (a.y - o.y) / r : vy / d;
    const cOn = { x: o.x + ux * r, y: o.y + uy * r };
    const theta = computeOrientedAngleRad(a, o, cOn);
    if (theta === null) {
      ctx.restore();
      return;
    }
    const as = camMath.worldToScreen(a, camera, vp);
    const os = camMath.worldToScreen(o, camera, vp);
    const radiusPx = r * camera.zoom;
    const start = Math.atan2(as.y - os.y, as.x - os.x);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#0ea5e9";
    drawAngleSector(ctx, as, os, theta, radiusPx);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "#0284c7";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(os.x, os.y);
    ctx.lineTo(os.x + Math.cos(start) * radiusPx, os.y + Math.sin(start) * radiusPx);
    ctx.stroke();
    drawAngleArcPreview(ctx, as, os, theta, radiusPx);
    const endAng = start - theta;
    ctx.beginPath();
    ctx.moveTo(os.x, os.y);
    ctx.lineTo(os.x + Math.cos(endAng) * radiusPx, os.y + Math.sin(endAng) * radiusPx);
    ctx.stroke();
    ctx.restore();
  }

  if (pendingSelection.tool === "angle_bisector" && pendingSelection.step === 3) {
    const aPoint = scene.points.find((p) => p.id === pendingSelection.first.id);
    const bPoint = scene.points.find((p) => p.id === pendingSelection.second.id);
    const a = aPoint ? getPointWorldPos(aPoint, scene) : null;
    const b = bPoint ? getPointWorldPos(bPoint, scene) : null;
    let c: Vec2 | null = null;
    if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
      const p = scene.points.find((pt) => pt.id === hoverSnap.pointId);
      c = p ? getPointWorldPos(p, scene) : null;
    }
    if (!c && hoveredHit?.type === "point") {
      const p = scene.points.find((pt) => pt.id === hoveredHit.id);
      c = p ? getPointWorldPos(p, scene) : null;
    }
    if (!c) c = cursorWorld;
    if (a && b && c) {
      const ba = sub(a, b);
      const bc = sub(c, b);
      const baLen = Math.hypot(ba.x, ba.y);
      const bcLen = Math.hypot(bc.x, bc.y);
      if (baLen > 1e-12 && bcLen > 1e-12) {
        const u = { x: ba.x / baLen, y: ba.y / baLen };
        const v = { x: bc.x / bcLen, y: bc.y / bcLen };
        const bis = { x: u.x + v.x, y: u.y + v.y };
        const bisLen = Math.hypot(bis.x, bis.y);
        if (bisLen > 1e-12) {
          const dir = { x: bis.x / bisLen, y: bis.y / bisLen };
          const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
          const q1 = camMath.worldToScreen(add(b, mul(dir, -span)), camera, vp);
          const q2 = camMath.worldToScreen(add(b, mul(dir, span)), camera, vp);
          ctx.beginPath();
          ctx.moveTo(q1.x, q1.y);
          ctx.lineTo(q2.x, q2.y);
          ctx.stroke();
        }
      }
    }
  }

  if (pendingSelection.tool === "angle_fixed" && pendingSelection.step === 3) {
    const bPoint = scene.points.find((p) => p.id === pendingSelection.second.id);
    const aPoint = scene.points.find((p) => p.id === pendingSelection.first.id);
    const b = bPoint ? getPointWorldPos(bPoint, scene) : null;
    const a = aPoint ? getPointWorldPos(aPoint, scene) : null;
    if (!a || !b) {
      ctx.restore();
      return;
    }
    const base = sub(a, b);
    const baseLen = Math.hypot(base.x, base.y);
    const evalResult = evaluateAngleExpressionDegrees(scene, angleFixedTool.angleExpr);
    if (baseLen <= 1e-12 || !evalResult.ok) {
      ctx.restore();
      return;
    }
    const deg = evalResult.valueDeg;
    const sign = angleFixedTool.direction === "CCW" ? 1 : -1;
    const theta = (deg * Math.PI) / 180;
    const c = Math.cos(sign * theta);
    const s = Math.sin(sign * theta);
    const rot = { x: base.x * c - base.y * s, y: base.x * s + base.y * c };
    const p = camMath.worldToScreen(b, camera, vp);
    const q = camMath.worldToScreen(add(b, rot), camera, vp);
    const dq = sub(q, p);
    const len = Math.hypot(dq.x, dq.y);
    if (len <= 1e-9) {
      ctx.restore();
      return;
    }
    const dir = { x: dq.x / len, y: dq.y / len };
    const span = Math.max(vp.widthPx, vp.heightPx) * 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + dir.x * span, p.y + dir.y * span);
    ctx.stroke();
  }

  ctx.restore();
}
