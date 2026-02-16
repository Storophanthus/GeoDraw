import { getCircleWorldGeometry, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { resolveCanvasFillStyle } from "../patternFill";
import { applyStrokeDash } from "../strokeStyle";
import {
  arrowCanvasLineWidthFromStoredPt,
  clamp01,
  collectArrowPositions,
  drawArrowPlacements,
  segmentArrowHeadSize,
} from "../pathArrowRender";
import type { DrawableObjectSelection } from "./types";
import type { Vec2 } from "../../geo/vec2";

const HUGE_CIRCLE_RADIUS_PX = 6000;
const VIS_EPS = 2;

export function drawCircles(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  copySource: DrawableObjectSelection
): void {
  ctx.save();
  for (const circle of scene.circles) {
    if (!circle.visible) continue;
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) continue;
    const c = camMath.worldToScreen(geom.center, camera, vp);
    const r = geom.radius * camera.zoom;
    if (!Number.isFinite(r) || r <= 1e-9) continue;
    const vis = circleBoundaryVisibility(c, r, vp.widthPx, vp.heightPx, VIS_EPS);
    if (vis === "none" || vis === "contains") continue;

    applyStrokeDash(ctx, circle.style.strokeDash, circle.style.strokeWidth);
    if (vis === "crosses" && r <= HUGE_CIRCLE_RADIUS_PX && (circle.style.fillOpacity ?? 0) > 0 && circle.style.fillColor) {
      ctx.globalAlpha = circle.style.fillOpacity ?? 0;
      ctx.fillStyle = resolveCanvasFillStyle(
        ctx,
        circle.style.fillColor,
        circle.style.pattern,
        circle.style.patternColor
      );
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = circle.style.strokeColor;
    ctx.globalAlpha = circle.style.strokeOpacity;
    ctx.lineWidth = circle.style.strokeWidth;
    if (r > HUGE_CIRCLE_RADIUS_PX) {
      drawHugeCircleAsClippedLine(ctx, c, r, vp.widthPx, vp.heightPx);
    } else {
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawCircleArrowOverlay(ctx, c, r, circle.style);

    if (selectedObject?.type === "circle" && selectedObject.id === circle.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "circle" && recentCreatedObject.id === circle.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = circle.style.strokeWidth + (isNew ? 1.5 : 1.6);
      if (r > HUGE_CIRCLE_RADIUS_PX) {
        drawHugeCircleAsClippedLine(ctx, c, r, vp.widthPx, vp.heightPx);
      } else {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (copySource?.type === "circle" && copySource.id === circle.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = circle.style.strokeWidth + 3;
      if (r > HUGE_CIRCLE_RADIUS_PX) {
        drawHugeCircleAsClippedLine(ctx, c, r, vp.widthPx, vp.heightPx);
      } else {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawCircleArrowOverlay(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  style: SceneModel["circles"][number]["style"]
): void {
  const arrow = style.arrowMark;
  if (!arrow?.enabled) return;
  if (!Number.isFinite(radius) || radius <= 1e-9) return;
  const color = arrow.color ?? style.strokeColor;
  const fallbackWidth = Number.isFinite(style.strokeWidth) && style.strokeWidth > 0 ? style.strokeWidth : 1;
  const lineWidthPt =
    typeof arrow.lineWidthPt === "number" && Number.isFinite(arrow.lineWidthPt) ? arrow.lineWidthPt : fallbackWidth;
  const lineWidth = arrowCanvasLineWidthFromStoredPt(lineWidthPt);
  const { headSize, separation } = segmentArrowHeadSize(lineWidth, arrow.sizeScale);
  const positions = collectArrowPositions(arrow, 0.5);
  const pathLengthPx = Math.max(1e-6, 2 * Math.PI * radius);
  const pairOffset = Math.max(0.002, Math.min(0.24, separation / pathLengthPx));

  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = Number.isFinite(style.strokeOpacity) ? clamp01(style.strokeOpacity) : 1;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pushPlacement = (
    out: Array<{ tip: Vec2; dirX: number; dirY: number }>,
    tRaw: number,
    reversed: boolean
  ) => {
    const tWrapped = ((tRaw % 1) + 1) % 1;
    const angle = Math.PI * 2 * tWrapped;
    const tip = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    // Canvas full-circle arc is drawn for increasing angle in screen space.
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    out.push({
      tip,
      dirX: reversed ? -tangentX : tangentX,
      dirY: reversed ? -tangentY : tangentY,
    });
  };
  for (let i = 0; i < positions.length; i += 1) {
    const t = clamp01(positions[i]);
    const placements: Array<{ tip: Vec2; dirX: number; dirY: number }> = [];
    if (arrow.direction === "->") {
      pushPlacement(placements, t, false);
    } else if (arrow.direction === "<-") {
      pushPlacement(placements, t, true);
    } else if (arrow.direction === "<->") {
      pushPlacement(placements, t - pairOffset, true);
      pushPlacement(placements, t + pairOffset, false);
    } else {
      pushPlacement(placements, t - pairOffset, false);
      pushPlacement(placements, t + pairOffset, true);
    }
    drawArrowPlacements(ctx, placements, headSize, arrow.tip);
  }
  ctx.restore();
}

function circleBoundaryVisibility(center: Vec2, radius: number, width: number, height: number, eps: number): "none" | "contains" | "crosses" {
  const nearestX = Math.max(0, Math.min(width, center.x));
  const nearestY = Math.max(0, Math.min(height, center.y));
  const dxNear = center.x - nearestX;
  const dyNear = center.y - nearestY;
  const minDist = Math.hypot(dxNear, dyNear);

  const fx = Math.max(Math.abs(center.x), Math.abs(center.x - width));
  const fy = Math.max(Math.abs(center.y), Math.abs(center.y - height));
  const maxDist = Math.hypot(fx, fy);

  if (radius < minDist - eps) return "none";
  if (radius > maxDist + eps) return "contains";
  return "crosses";
}

function drawHugeCircleAsClippedLine(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  width: number,
  height: number
): void {
  const viewportCenter = { x: width * 0.5, y: height * 0.5 };
  const nxRaw = viewportCenter.x - center.x;
  const nyRaw = viewportCenter.y - center.y;
  const nLen = Math.hypot(nxRaw, nyRaw);
  if (nLen <= 1e-6) return;
  const nx = nxRaw / nLen;
  const ny = nyRaw / nLen;
  const px = center.x + nx * radius;
  const py = center.y + ny * radius;
  const dir = { x: -ny, y: nx };
  const clipped = clipInfiniteLineToViewport({ x: px, y: py }, { x: px + dir.x, y: py + dir.y }, width, height);
  if (!clipped) return;
  ctx.beginPath();
  ctx.moveTo(clipped[0].x, clipped[0].y);
  ctx.lineTo(clipped[1].x, clipped[1].y);
  ctx.stroke();
}

function clipInfiniteLineToViewport(a: Vec2, b: Vec2, width: number, height: number): [Vec2, Vec2] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-9) return null;
  const candidates: Vec2[] = [];
  const eps = 1e-9;
  const pushUnique = (p: Vec2) => {
    if (p.x < -eps || p.x > width + eps || p.y < -eps || p.y > height + eps) return;
    for (let i = 0; i < candidates.length; i += 1) {
      if (Math.hypot(candidates[i].x - p.x, candidates[i].y - p.y) < 0.5) return;
    }
    candidates.push({ x: p.x, y: p.y });
  };

  if (Math.abs(dx) > eps) {
    const tLeft = (0 - a.x) / dx;
    const tRight = (width - a.x) / dx;
    pushUnique({ x: 0, y: a.y + tLeft * dy });
    pushUnique({ x: width, y: a.y + tRight * dy });
  }
  if (Math.abs(dy) > eps) {
    const tTop = (0 - a.y) / dy;
    const tBottom = (height - a.y) / dy;
    pushUnique({ x: a.x + tTop * dx, y: 0 });
    pushUnique({ x: a.x + tBottom * dx, y: height });
  }
  if (candidates.length < 2) return null;
  return [candidates[0], candidates[1]];
}
