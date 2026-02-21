import { add, mul, sub } from "../../geo/geometry";
import type { Vec2 } from "../../geo/vec2";
import { hitTestLineId, hitTestSegmentId } from "../../engine";
import {
  evalPointByDilation,
  evalPointByReflection,
  evalPointByTranslation,
} from "../../scene/eval/pointGeometryEval";
import {
  computeOrientedAngleRad,
  evaluateAngleExpressionDegrees,
  evaluateNumberExpression,
  getCircleWorldGeometry,
  getLineWorldAnchors,
  getPointWorldPos,
  isRightAngle,
  type LineLikeObjectRef,
  type SceneModel,
} from "../../scene/points";
import type { HoveredHit, PendingSelection } from "../../state/geoStore";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import type { SnapCandidate } from "../snapEngine";
import { isRightExactByProvenance } from "../../domain/rightAngleProvenance";
import {
  computeRightMarkSizePx,
  drawAngleArcPreview,
  drawAngleSector,
  drawRightAngleMark,
  nonSectorAngleRadiusPx,
} from "../angleRender";

export type AngleFixedToolState = { angleExpr: string; direction: "CCW" | "CW" };
export type CircleFixedToolState = { radius: string };
export type RegularPolygonToolState = { sides: number; direction: "CCW" | "CW" };
export type TransformToolState = {
  mode: "translate" | "rotate" | "dilate" | "reflect";
  angleExpr: string;
  direction: "CCW" | "CW";
  factorExpr: string;
};
export type PendingPreviewTheme = {
  stroke: string;
  strokeStrong: string;
  fillSoft: string;
  fill: string;
  fillStrong: string;
  snapStroke: string;
  lineWidthPx: number;
};

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

function rotateAround(center: Vec2, p: Vec2, angleRad: number): Vec2 {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const cs = Math.cos(angleRad);
  const sn = Math.sin(angleRad);
  return {
    x: center.x + dx * cs - dy * sn,
    y: center.y + dx * sn + dy * cs,
  };
}

function signedAngleRad(toolDirection: "CCW" | "CW", interiorAngleRad: number): number {
  // pointByRotation rotates previous vertex around current one; due reversed edge
  // vector, requested polygon orientation requires flipped rotation sign.
  const rotationDirection = toolDirection === "CCW" ? "CW" : "CCW";
  return rotationDirection === "CCW" ? interiorAngleRad : -interiorAngleRad;
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
  regularPolygonTool: RegularPolygonToolState,
  circleFixedTool: CircleFixedToolState,
  transformTool: TransformToolState,
  anglePreviewArcRadius: number,
  tolerances: { linePx: number; segmentPx: number },
  previewTheme: PendingPreviewTheme
): void {
  if (!pendingSelection) return;
  const firstSelection = "first" in pendingSelection ? pendingSelection.first : null;
  const firstPointId = firstSelection?.type === "point" ? firstSelection.id : null;
  const firstPoint = firstPointId ? scene.points.find((p) => p.id === firstPointId) : null;
  const firstWorld = firstPoint ? getPointWorldPos(firstPoint, scene) : null;
  const p1 = firstWorld ? camMath.worldToScreen(firstWorld, camera, vp) : null;

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = previewTheme.stroke;
  ctx.lineWidth = previewTheme.lineWidthPx;

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
  const drawPreviewSegment = (a: Vec2, b: Vec2): void => {
    const pA = camMath.worldToScreen(a, camera, vp);
    const pB = camMath.worldToScreen(b, camera, vp);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  };
  const drawPreviewPoint = (world: Vec2): void => {
    const screen = camMath.worldToScreen(world, camera, vp);
    ctx.save();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = previewTheme.fillStrong;
    ctx.strokeStyle = previewTheme.strokeStrong;
    ctx.lineWidth = previewTheme.lineWidthPx;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  const getHoveredPointWorld = (): Vec2 | null => {
    if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
      const point = scene.points.find((item) => item.id === hoverSnap.pointId);
      return point ? getPointWorldPos(point, scene) : null;
    }
    if (hoveredHit?.type === "point") {
      const point = scene.points.find((item) => item.id === hoveredHit.id);
      return point ? getPointWorldPos(point, scene) : null;
    }
    return cursorWorld;
  };

  if (pendingSelection.tool === "export_clip" && pendingSelection.step === 2) {
    const points = pendingSelection.points.map((entry) => entry.world);
    if (points.length >= 1) {
      const first = camMath.worldToScreen(points[0], camera, vp);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = previewTheme.stroke;
      ctx.fillStyle = previewTheme.fillSoft;
      ctx.lineWidth = previewTheme.lineWidthPx;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < points.length; i += 1) {
        const p = camMath.worldToScreen(points[i], camera, vp);
        ctx.lineTo(p.x, p.y);
      }
      if (cursorWorld) {
        const c = camMath.worldToScreen(cursorWorld, camera, vp);
        ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();

      // Show the first vertex explicitly so users can close the clip path easily.
      ctx.setLineDash([]);
      const canClose = points.length >= 3 && cursorScreen && Math.hypot(cursorScreen.x - first.x, cursorScreen.y - first.y) <= 14;
      ctx.beginPath();
      ctx.fillStyle = previewTheme.fillStrong;
      ctx.arc(first.x, first.y, 4, 0, Math.PI * 2);
      ctx.fill();
      if (canClose) {
        ctx.beginPath();
        ctx.strokeStyle = previewTheme.fillStrong;
        ctx.lineWidth = Math.max(previewTheme.lineWidthPx, 1.4);
        ctx.arc(first.x, first.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (pendingSelection.tool === "export_clip_rect" && pendingSelection.step === 2 && cursorWorld) {
    const a = pendingSelection.first.world;
    const minX = Math.min(a.x, cursorWorld.x);
    const maxX = Math.max(a.x, cursorWorld.x);
    const minY = Math.min(a.y, cursorWorld.y);
    const maxY = Math.max(a.y, cursorWorld.y);
    const pMin = camMath.worldToScreen({ x: minX, y: minY }, camera, vp);
    const pMax = camMath.worldToScreen({ x: maxX, y: maxY }, camera, vp);
    const x = Math.min(pMin.x, pMax.x);
    const y = Math.min(pMin.y, pMax.y);
    const w = Math.abs(pMax.x - pMin.x);
    const h = Math.abs(pMax.y - pMin.y);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = previewTheme.stroke;
    ctx.fillStyle = previewTheme.fillSoft;
    ctx.lineWidth = previewTheme.lineWidthPx;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (p1 && (pendingSelection.tool === "segment" || pendingSelection.tool === "midpoint") && cursorWorld) {
    const p2 = camMath.worldToScreen(cursorWorld, camera, vp);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (pendingSelection.tool === "polygon" && pendingSelection.points.length > 0) {
    const polyWorld = pendingSelection.points
      .map((entry) => scene.points.find((point) => point.id === entry.id))
      .map((point) => (point ? getPointWorldPos(point, scene) : null))
      .filter((world): world is Vec2 => Boolean(world));
    if (polyWorld.length > 0) {
      const polyScreen = polyWorld.map((world) => camMath.worldToScreen(world, camera, vp));
      const previewPath = [...polyScreen];
      if (cursorWorld) {
        previewPath.push(camMath.worldToScreen(cursorWorld, camera, vp));
      }
      if (previewPath.length >= 3) {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = previewTheme.fill;
        ctx.beginPath();
        ctx.moveTo(previewPath[0].x, previewPath[0].y);
        for (let i = 1; i < previewPath.length; i += 1) {
          ctx.lineTo(previewPath[i].x, previewPath[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prevAlpha;
      }
      ctx.beginPath();
      ctx.moveTo(polyScreen[0].x, polyScreen[0].y);
      for (let i = 1; i < polyScreen.length; i += 1) {
        ctx.lineTo(polyScreen[i].x, polyScreen[i].y);
      }
      if (cursorWorld) {
        const cursor = camMath.worldToScreen(cursorWorld, camera, vp);
        ctx.lineTo(cursor.x, cursor.y);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (pendingSelection.tool === "regular_polygon" && p1 && cursorWorld) {
    const n = Math.max(3, Math.min(64, Math.round(regularPolygonTool.sides)));
    const first = firstWorld;
    const second = cursorWorld;
    if (!first) {
      ctx.restore();
      return;
    }
    if (Math.hypot(second.x - first.x, second.y - first.y) <= 1e-9) {
      ctx.restore();
      return;
    }
    const interior = Math.PI - (Math.PI * 2) / n;
    const angleStep = signedAngleRad(regularPolygonTool.direction, interior);
    const poly: Vec2[] = [first, second];
    while (poly.length < n) {
      const center = poly[poly.length - 1];
      const base = poly[poly.length - 2];
      poly.push(rotateAround(center, base, angleStep));
    }
    const polyScreen = poly.map((world) => camMath.worldToScreen(world, camera, vp));
    ctx.beginPath();
    ctx.moveTo(polyScreen[0].x, polyScreen[0].y);
    for (let i = 1; i < polyScreen.length; i += 1) {
      ctx.lineTo(polyScreen[i].x, polyScreen[i].y);
    }
    ctx.closePath();
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
    ctx.lineWidth = previewTheme.lineWidthPx;
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
        ctx.lineWidth = previewTheme.lineWidthPx;
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
      ctx.lineWidth = previewTheme.lineWidthPx;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (
    pendingSelection.tool === "translate" ||
    pendingSelection.tool === "dilate" ||
    pendingSelection.tool === "reflect"
  ) {
    const source = pendingSelection.source;
    const sourceAnchor = (): Vec2 | null => {
      if (source.type === "point") return geoPointWorld(scene, source.id);
      if (source.type === "segment") {
        const seg = scene.segments.find((item) => item.id === source.id);
        if (!seg) return null;
        const a = geoPointWorld(scene, seg.aId);
        const b = geoPointWorld(scene, seg.bId);
        if (!a || !b) return null;
        return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      }
      if (source.type === "line") {
        const line = scene.lines.find((item) => item.id === source.id);
        if (!line) return null;
        const anchors = getLineWorldAnchors(line, scene);
        if (!anchors) return null;
        return { x: (anchors.a.x + anchors.b.x) * 0.5, y: (anchors.a.y + anchors.b.y) * 0.5 };
      }
      if (source.type === "polygon") {
        const polygon = scene.polygons.find((item) => item.id === source.id);
        if (!polygon || polygon.pointIds.length === 0) return null;
        let sx = 0;
        let sy = 0;
        let count = 0;
        for (const pointId of polygon.pointIds) {
          const world = geoPointWorld(scene, pointId);
          if (!world) continue;
          sx += world.x;
          sy += world.y;
          count += 1;
        }
        if (count === 0) return null;
        return { x: sx / count, y: sy / count };
      }
      if (source.type === "circle") {
        const circle = scene.circles.find((item) => item.id === source.id);
        if (!circle) return null;
        const geom = getCircleWorldGeometry(circle, scene);
        return geom?.center ?? null;
      }
      const angle = scene.angles.find((item) => item.id === source.id);
      if (!angle) return null;
      return geoPointWorld(scene, angle.bId);
    };

    const resolveAxisRef =
      hoverSnap?.kind === "onLine" && hoverSnap.lineId
        ? ({ type: "line", id: hoverSnap.lineId } as const)
        : hoverSnap?.kind === "onSegment" && hoverSnap.segId
          ? ({ type: "segment", id: hoverSnap.segId } as const)
          : hoveredHit?.type === "line2p"
            ? ({ type: "line", id: hoveredHit.id } as const)
            : hoveredHit?.type === "segment"
              ? ({ type: "segment", id: hoveredHit.id } as const)
              : cursorScreen
                ? (() => {
                    const lineId = hitTestLineId(cursorScreen, scene, camera, vp, tolerances.linePx);
                    if (lineId) return { type: "line", id: lineId } as const;
                    const segId = hitTestSegmentId(cursorScreen, scene, camera, vp, tolerances.segmentPx);
                    if (segId) return { type: "segment", id: segId } as const;
                    return null;
                  })()
                : null;

    let transformPointWorld: ((world: Vec2) => Vec2 | null) | null = null;
    if (pendingSelection.tool === "translate") {
      if (pendingSelection.step === 2) {
        const anchor = sourceAnchor();
        const fromWorld = getHoveredPointWorld();
        if (anchor && fromWorld) drawPreviewSegment(anchor, fromWorld);
        ctx.restore();
        return;
      }
      const fromWorld = geoPointWorld(scene, pendingSelection.from.id);
      const toWorld = getHoveredPointWorld();
      if (!fromWorld || !toWorld) {
        ctx.restore();
        return;
      }
      drawPreviewSegment(fromWorld, toWorld);
      transformPointWorld = (world) => evalPointByTranslation(world, fromWorld, toWorld);
    } else if (pendingSelection.tool === "dilate") {
      const center = getHoveredPointWorld();
      if (!center) {
        ctx.restore();
        return;
      }
      const factor = evaluateNumberExpression(scene, transformTool.factorExpr);
      if (!factor.ok || !Number.isFinite(factor.value)) {
        ctx.restore();
        return;
      }
      transformPointWorld = (world) => evalPointByDilation(world, center, factor.value);
    } else {
      if (!resolveAxisRef) {
        ctx.restore();
        return;
      }
      const axisAnchors =
        resolveAxisRef.type === "line"
          ? (() => {
              const line = scene.lines.find((item) => item.id === resolveAxisRef.id);
              if (!line) return null;
              return getLineWorldAnchors(line, scene);
            })()
          : (() => {
              const seg = scene.segments.find((item) => item.id === resolveAxisRef.id);
              if (!seg) return null;
              const a = geoPointWorld(scene, seg.aId);
              const b = geoPointWorld(scene, seg.bId);
              if (!a || !b) return null;
              return { a, b };
            })();
      if (!axisAnchors) {
        ctx.restore();
        return;
      }
      drawInfinitePreviewLine(axisAnchors.a, sub(axisAnchors.b, axisAnchors.a));
      transformPointWorld = (world) => evalPointByReflection(world, axisAnchors.a, axisAnchors.b);
    }

    if (!transformPointWorld) {
      ctx.restore();
      return;
    }

    const drawWorldPolyline = (worldPoints: Vec2[], close = false, fillAlpha = 0): void => {
      if (worldPoints.length < 2) return;
      const screenPoints = worldPoints.map((world) => camMath.worldToScreen(world, camera, vp));
      if (close && screenPoints.length >= 3 && fillAlpha > 0) {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = fillAlpha;
        ctx.fillStyle = previewTheme.fill;
        ctx.beginPath();
        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i += 1) ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prevAlpha;
      }
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i += 1) ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      if (close) ctx.closePath();
      ctx.stroke();
    };

    if (source.type === "point") {
      const world = geoPointWorld(scene, source.id);
      if (!world) {
        ctx.restore();
        return;
      }
      const transformed = transformPointWorld(world);
      if (!transformed) {
        ctx.restore();
        return;
      }
      drawPreviewSegment(world, transformed);
      drawPreviewPoint(transformed);
      ctx.restore();
      return;
    }

    if (source.type === "segment") {
      const seg = scene.segments.find((item) => item.id === source.id);
      if (!seg) {
        ctx.restore();
        return;
      }
      const a = geoPointWorld(scene, seg.aId);
      const b = geoPointWorld(scene, seg.bId);
      if (!a || !b) {
        ctx.restore();
        return;
      }
      const ta = transformPointWorld(a);
      const tb = transformPointWorld(b);
      if (!ta || !tb) {
        ctx.restore();
        return;
      }
      drawPreviewSegment(ta, tb);
      ctx.restore();
      return;
    }

    if (source.type === "line") {
      const line = scene.lines.find((item) => item.id === source.id);
      if (!line) {
        ctx.restore();
        return;
      }
      const anchors = getLineWorldAnchors(line, scene);
      if (!anchors) {
        ctx.restore();
        return;
      }
      const ta = transformPointWorld(anchors.a);
      const tb = transformPointWorld(anchors.b);
      if (!ta || !tb) {
        ctx.restore();
        return;
      }
      const dir = sub(tb, ta);
      if (dir.x * dir.x + dir.y * dir.y <= 1e-12) {
        ctx.restore();
        return;
      }
      drawInfinitePreviewLine(ta, dir);
      ctx.restore();
      return;
    }

    if (source.type === "polygon") {
      const polygon = scene.polygons.find((item) => item.id === source.id);
      if (!polygon || polygon.pointIds.length < 3) {
        ctx.restore();
        return;
      }
      const transformed: Vec2[] = [];
      for (const pointId of polygon.pointIds) {
        const world = geoPointWorld(scene, pointId);
        if (!world) continue;
        const out = transformPointWorld(world);
        if (!out) continue;
        transformed.push(out);
      }
      if (transformed.length >= 3) {
        drawWorldPolyline(transformed, true, 0.14);
      }
      ctx.restore();
      return;
    }

    if (source.type === "circle") {
      const circle = scene.circles.find((item) => item.id === source.id);
      if (!circle) {
        ctx.restore();
        return;
      }
      if (circle.kind === "threePoint") {
        const a = geoPointWorld(scene, circle.aId);
        const b = geoPointWorld(scene, circle.bId);
        const c = geoPointWorld(scene, circle.cId);
        if (!a || !b || !c) {
          ctx.restore();
          return;
        }
        const ta = transformPointWorld(a);
        const tb = transformPointWorld(b);
        const tc = transformPointWorld(c);
        if (!ta || !tb || !tc) {
          ctx.restore();
          return;
        }
        const geom = circumcircleFromThreePoints(ta, tb, tc);
        if (!geom) {
          ctx.restore();
          return;
        }
        const cs = camMath.worldToScreen(geom.center, camera, vp);
        ctx.beginPath();
        ctx.arc(cs.x, cs.y, geom.radius * camera.zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      const geom = getCircleWorldGeometry(circle, scene);
      if (!geom) {
        ctx.restore();
        return;
      }
      const center = geom.center;
      const through =
        circle.kind === "twoPoint"
          ? geoPointWorld(scene, circle.throughId)
          : { x: center.x + geom.radius, y: center.y };
      if (!through) {
        ctx.restore();
        return;
      }
      const transformedCenter = transformPointWorld(center);
      const transformedThrough = transformPointWorld(through);
      if (!transformedCenter || !transformedThrough) {
        ctx.restore();
        return;
      }
      const radius = Math.hypot(transformedThrough.x - transformedCenter.x, transformedThrough.y - transformedCenter.y);
      if (!Number.isFinite(radius) || radius <= 1e-12) {
        ctx.restore();
        return;
      }
      const cs = camMath.worldToScreen(transformedCenter, camera, vp);
      ctx.beginPath();
      ctx.arc(cs.x, cs.y, radius * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const angle = scene.angles.find((item) => item.id === source.id);
    if (!angle) {
      ctx.restore();
      return;
    }
    const a = geoPointWorld(scene, angle.aId);
    const b = geoPointWorld(scene, angle.bId);
    const c = geoPointWorld(scene, angle.cId);
    if (!a || !b || !c) {
      ctx.restore();
      return;
    }
    const ta = transformPointWorld(a);
    const tb = transformPointWorld(b);
    const tc = transformPointWorld(c);
    if (!ta || !tb || !tc) {
      ctx.restore();
      return;
    }
    drawPreviewSegment(tb, ta);
    drawPreviewSegment(tb, tc);
    if (angle.kind === "sector") {
      const as = camMath.worldToScreen(ta, camera, vp);
      const bs = camMath.worldToScreen(tb, camera, vp);
      const theta = computeOrientedAngleRad(ta, tb, tc);
      if (theta !== null) {
        const radiusPx = Math.max(2, Math.hypot(as.x - bs.x, as.y - bs.y));
        drawAngleArcPreview(ctx, as, bs, theta, radiusPx);
      }
    }
    ctx.restore();
    return;
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
      const hoveredCircleId =
        hoverSnap?.kind === "onCircle" && hoverSnap.circleId
          ? hoverSnap.circleId
          : hoveredHit?.type === "circle"
            ? hoveredHit.id
            : null;
      if (hoveredCircleId && hoveredCircleId !== pendingSelection.first.id) {
        const fallbackStyle = { strokeColor: "#334155", strokeWidth: 1.2, dash: "solid" as const, opacity: 1 };
        const previewStyle = scene.lines[0]?.style ?? fallbackStyle;
        const signatures = new Set<string>();
        const signatureFor = (a: Vec2, b: Vec2): string => {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy);
          if (len <= 1e-12) return "";
          let nx = -dy / len;
          let ny = dx / len;
          let c = nx * a.x + ny * a.y;
          if (nx < -1e-12 || (Math.abs(nx) <= 1e-12 && ny < -1e-12)) {
            nx = -nx;
            ny = -ny;
            c = -c;
          }
          const q = (v: number) => Math.round(v * 1e9);
          return `${q(nx)}:${q(ny)}:${q(c)}`;
        };
        const candidates: Array<{ family: "outer" | "inner"; branchIndex: 0 | 1 }> = [
          { family: "outer", branchIndex: 0 },
          { family: "outer", branchIndex: 1 },
          { family: "inner", branchIndex: 0 },
          { family: "inner", branchIndex: 1 },
        ];
        for (let i = 0; i < candidates.length; i += 1) {
          const candidate = candidates[i];
          const anchors = getLineWorldAnchors(
            {
              id: `__preview_tangent_${candidate.family}_${candidate.branchIndex}__`,
              kind: "circleCircleTangent",
              circleAId: pendingSelection.first.id,
              circleBId: hoveredCircleId,
              family: candidate.family,
              branchIndex: candidate.branchIndex,
              visible: true,
              style: previewStyle,
            },
            scene
          );
          if (!anchors) continue;
          const signature = signatureFor(anchors.a, anchors.b);
          if (!signature || signatures.has(signature)) continue;
          signatures.add(signature);
          drawInfinitePreviewLine(anchors.a, sub(anchors.b, anchors.a));
        }
        ctx.restore();
        return;
      }

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
    let cId: string | null = null;
    if (hoverSnap?.kind === "point" && hoverSnap.pointId) {
      const p = scene.points.find((pt) => pt.id === hoverSnap.pointId);
      if (p) {
        c = getPointWorldPos(p, scene);
        cId = p.id;
      }
    }
    if (!c && hoveredHit?.type === "point") {
      const p = scene.points.find((pt) => pt.id === hoveredHit.id);
      if (p) {
        c = getPointWorldPos(p, scene);
        cId = p.id;
      }
    }
    if (!c) c = cursorWorld;
    if (a && b && c) {
      const theta = computeOrientedAngleRad(a, b, c);
      if (theta !== null) {
        const as = camMath.worldToScreen(a, camera, vp);
        const bs = camMath.worldToScreen(b, camera, vp);
        const cs = camMath.worldToScreen(c, camera, vp);
        const radiusPx = nonSectorAngleRadiusPx(anglePreviewArcRadius);
        const rightStatus: "none" | "approx" | "exact" = cId
          ? isRightExactByProvenance(scene, pendingSelection.first.id, pendingSelection.second.id, cId)
            ? "exact"
            : isRightAngle(a, b, c, 1e-2)
              ? "approx"
              : "none"
          : isRightAngle(a, b, c, 1e-2)
            ? "approx"
            : "none";
        if (rightStatus === "none") {
          drawAngleArcPreview(ctx, as, bs, theta, radiusPx);
        } else {
          const rightMarkSizePx = computeRightMarkSizePx(radiusPx, previewTheme.lineWidthPx);
          ctx.save();
          ctx.setLineDash(rightStatus === "approx" ? [5, 4] : []);
          drawRightAngleMark(ctx, as, bs, cs, rightMarkSizePx);
          ctx.stroke();
          ctx.restore();
        }
        const start = Math.atan2(as.y - bs.y, as.x - bs.x);
        const mid = start - theta * 0.5;
        const lx = bs.x + Math.cos(mid) * (radiusPx + 16);
        const ly = bs.y + Math.sin(mid) * (radiusPx + 16);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([]);
        ctx.fillStyle = previewTheme.strokeStrong;
        ctx.font = "12px system-ui";
        const deg = (theta * 180) / Math.PI;
        ctx.fillText(`${formatPreviewAngleDegrees(deg)}°`, lx, ly);
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
    ctx.fillStyle = previewTheme.fill;
    drawAngleSector(ctx, as, os, theta, radiusPx);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = previewTheme.strokeStrong;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = previewTheme.lineWidthPx;
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

function formatPreviewAngleDegrees(degRaw: number): string {
  if (!Number.isFinite(degRaw)) return "0";
  const deg = ((degRaw % 360) + 360) % 360;
  const nearest5 = Math.round(deg / 5) * 5;
  if (Math.abs(deg - nearest5) <= 1e-3) return String(nearest5);
  return deg.toFixed(2);
}

function geoPointWorld(scene: SceneModel, pointId: string): Vec2 | null {
  const point = scene.points.find((item) => item.id === pointId);
  return point ? getPointWorldPos(point, scene) : null;
}
