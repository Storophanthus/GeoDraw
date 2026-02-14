import { sub } from "../../geo/geometry";
import { getLineWorldAnchors, type SceneModel } from "../../scene/points";
import { camera as camMath, type Camera, type Viewport } from "../camera";
import { applyStrokeDash } from "../strokeStyle";
import type { DrawableObjectSelection } from "./types";
import type { Vec2 } from "../../geo/vec2";

export function drawLines(
  ctx: CanvasRenderingContext2D,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport,
  selectedObject: DrawableObjectSelection,
  recentCreatedObject: DrawableObjectSelection,
  copySource: DrawableObjectSelection
): void {
  ctx.save();

  for (const line of scene.lines) {
    if (!line.visible) continue;
    const anchors = getLineWorldAnchors(line, scene);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) continue;

    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) continue;

    const sa = camMath.worldToScreen(a, camera, vp);
    const sb = camMath.worldToScreen(b, camera, vp);
    const clipped = clipInfiniteLineToViewport(sa, sb, vp.widthPx, vp.heightPx);
    if (!clipped) continue;
    const [p1, p2] = clipped;

    applyStrokeDash(ctx, line.style.dash, line.style.strokeWidth);
    ctx.strokeStyle = line.style.strokeColor;
    ctx.globalAlpha = line.style.opacity;
    ctx.lineWidth = line.style.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    if (selectedObject?.type === "line" && selectedObject.id === line.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const isNew = recentCreatedObject?.type === "line" && recentCreatedObject.id === line.id;
      ctx.strokeStyle = isNew ? "rgba(20,184,166,0.72)" : "rgba(245,158,11,0.62)";
      ctx.lineWidth = line.style.strokeWidth + (isNew ? 1.5 : 1.6);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    if (copySource?.type === "line" && copySource.id === line.id) {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = line.style.strokeWidth + 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
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
  let bestI = 0;
  let bestJ = 1;
  let bestD2 = -1;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const ddx = candidates[i].x - candidates[j].x;
      const ddy = candidates[i].y - candidates[j].y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 > bestD2) {
        bestD2 = d2;
        bestI = i;
        bestJ = j;
      }
    }
  }
  return [candidates[bestI], candidates[bestJ]];
}
