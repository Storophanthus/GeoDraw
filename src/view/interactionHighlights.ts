import type { Vec2 } from "../geo/vec2";
import { add, mul, sub } from "../geo/geometry";
import { resolveAngleRightStatus } from "../domain/rightAngleProvenance";
import {
  computeOrientedAngleRad,
  type SceneModel,
  type ScenePoint,
} from "../scene/points";
import { geoStoreHelpers } from "../state/geoStore";
import type { ActiveTool, HoveredHit, PendingSelection } from "../state/geoStore";
import type { Camera } from "./camera";
import { camera as camMath, type Viewport } from "./camera";
import { drawAngleArcPreview } from "./angleRender";

const ANGLE_STROKE_RENDER_SCALE = 3.25 / 1.8;

export function drawInteractionHighlights(
  ctx: CanvasRenderingContext2D,
  activeTool: ActiveTool,
  pendingSelection: PendingSelection,
  hoveredHit: HoveredHit,
  hoveredTargetValid: boolean,
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
) {
  if (pendingSelection) {
    if (
      pendingSelection.tool === "angle" ||
      pendingSelection.tool === "sector" ||
      pendingSelection.tool === "angle_fixed" ||
      pendingSelection.tool === "angle_bisector"
    ) {
      drawHitHighlight(
        ctx,
        { type: "point", id: pendingSelection.first.id },
        resolvedPoints,
        scene,
        camera,
        vp,
        "#22c55e",
        0.95
      );
      if (pendingSelection.step === 3) {
        drawHitHighlight(
          ctx,
          { type: "point", id: pendingSelection.second.id },
          resolvedPoints,
          scene,
          camera,
          vp,
          "#16a34a",
          0.9
        );
      }
      if (hoveredHit && hoveredTargetValid && activeTool !== "move") {
        drawHitHighlight(ctx, hoveredHit, resolvedPoints, scene, camera, vp, "#0ea5e9", 0.9);
      }
      return;
    }
    if (
      (pendingSelection.tool === "perp_line" || pendingSelection.tool === "parallel_line") &&
      pendingSelection.first.type === "lineLike"
    ) {
      drawHitHighlight(
        ctx,
        pendingSelection.first.ref.type === "line"
          ? { type: "line2p", id: pendingSelection.first.ref.id }
          : { type: "segment", id: pendingSelection.first.ref.id },
        resolvedPoints,
        scene,
        camera,
        vp,
        "#22c55e",
        0.95
      );
    } else if (pendingSelection.tool === "tangent_line" && pendingSelection.first.type === "circle") {
      drawHitHighlight(
        ctx,
        { type: "circle", id: pendingSelection.first.id },
        resolvedPoints,
        scene,
        camera,
        vp,
        "#22c55e",
        0.95
      );
    } else {
      if (pendingSelection.first.type !== "point") {
        return;
      }
      drawHitHighlight(
        ctx,
        { type: "point", id: pendingSelection.first.id },
        resolvedPoints,
        scene,
        camera,
        vp,
        "#22c55e",
        0.95
      );
    }
  }

  if (hoveredHit && hoveredTargetValid && activeTool !== "move") {
    drawHitHighlight(ctx, hoveredHit, resolvedPoints, scene, camera, vp, "#0ea5e9", 0.9);
  }
}

function drawHitHighlight(
  ctx: CanvasRenderingContext2D,
  hit: Exclude<HoveredHit, null>,
  resolvedPoints: Array<{ point: ScenePoint; world: Vec2 }>,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  color: string,
  alpha: number
) {
  if (hit.type === "point") {
    const point = resolvedPoints.find((item) => item.point.id === hit.id);
    if (!point || !point.point.visible) return;
    const p = camMath.worldToScreen(point.world, camera, vp);
    const r = Math.max(point.point.style.sizePx + 4, 8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (hit.type === "segment") {
    const seg = scene.segments.find((item) => item.id === hit.id);
    if (!seg || !seg.visible) return;
    const a = geoStoreHelpers.getPointWorldById(scene, seg.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, seg.bId);
    if (!a || !b) return;
    const p1 = camMath.worldToScreen(a, camera, vp);
    const p2 = camMath.worldToScreen(b, camera, vp);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = seg.style.strokeWidth + 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (hit.type === "line2p") {
    const line = scene.lines.find((item) => item.id === hit.id);
    if (!line || !line.visible) return;
    const anchors = geoStoreHelpers.getLineWorldAnchorsById(scene, line.id);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) return;
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) return;
    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 2;
    const p1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const p2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = line.style.strokeWidth + 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (hit.type === "angle") {
    const angle = scene.angles.find((item) => item.id === hit.id);
    if (!angle || !angle.visible) return;
    const a = geoStoreHelpers.getPointWorldById(scene, angle.aId);
    const b = geoStoreHelpers.getPointWorldById(scene, angle.bId);
    const c = geoStoreHelpers.getPointWorldById(scene, angle.cId);
    if (!a || !b || !c) return;
    const as = camMath.worldToScreen(a, camera, vp);
    const bs = camMath.worldToScreen(b, camera, vp);
    const radiusPx = Math.max(16, angle.style.arcRadius * camera.zoom);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, getAngleStrokeRenderWidth(angle.style.strokeWidth) + 2);
    ctx.setLineDash([]);
    const theta = computeOrientedAngleRad(a, b, c);
    if (theta === null) {
      ctx.restore();
      return;
    }
    const right = resolveAngleRightStatus(scene, angle) !== "none";
    const rawMarkStyle = angle.style.markStyle === "right" ? "rightSquare" : angle.style.markStyle;
    const markStyle = right && rawMarkStyle === "arc" ? "rightSquare" : rawMarkStyle;
    if (right && markStyle === "rightSquare") {
      drawRightAngleHighlight(ctx, as, bs, camMath.worldToScreen(c, camera, vp), radiusPx * 0.55);
    } else {
      drawAngleArcPreview(ctx, as, bs, theta, radiusPx);
    }
    ctx.restore();
    return;
  }

  const circle = scene.circles.find((item) => item.id === hit.id);
  if (!circle || !circle.visible) return;
  const geom = geoStoreHelpers.getCircleWorldGeometryById(scene, circle.id);
  if (!geom) return;
  const center = geom.center;
  const c = camMath.worldToScreen(center, camera, vp);
  const r = geom.radius * camera.zoom;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.lineWidth = circle.style.strokeWidth + 2.5;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function getAngleStrokeRenderWidth(rawStrokeWidth: number): number {
  return rawStrokeWidth * ANGLE_STROKE_RENDER_SCALE;
}

function drawRightAngleHighlight(
  ctx: CanvasRenderingContext2D,
  aScreen: Vec2,
  bScreen: Vec2,
  cScreen: Vec2,
  sizePx: number
): void {
  const uLen = Math.hypot(aScreen.x - bScreen.x, aScreen.y - bScreen.y) || 1;
  const vLen = Math.hypot(cScreen.x - bScreen.x, cScreen.y - bScreen.y) || 1;
  const ux = (aScreen.x - bScreen.x) / uLen;
  const uy = (aScreen.y - bScreen.y) / uLen;
  const vx = (cScreen.x - bScreen.x) / vLen;
  const vy = (cScreen.y - bScreen.y) / vLen;
  const p1 = { x: bScreen.x + ux * sizePx, y: bScreen.y + uy * sizePx };
  const p3 = { x: bScreen.x + vx * sizePx, y: bScreen.y + vy * sizePx };
  const p2 = { x: p1.x + vx * sizePx, y: p1.y + vy * sizePx };
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.stroke();
}
