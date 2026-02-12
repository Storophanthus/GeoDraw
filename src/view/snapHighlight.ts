import { add, mul, sub } from "../geo/geometry";
import type { GeometryObjectRef, SceneModel } from "../scene/points";
import { getCircleWorldGeometry, getLineWorldAnchors, getPointWorldPos } from "../scene/points";
import { camera as camMath, type Camera, type Viewport } from "./camera";

export function highlightSnapObject(
  ctx: CanvasRenderingContext2D,
  obj: GeometryObjectRef,
  scene: SceneModel,
  camera: Camera,
  vp: Viewport
): void {
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(249, 115, 22, 0.9)";
  ctx.lineWidth = 2;

  if (obj.type === "line") {
    const line = scene.lines.find((item) => item.id === obj.id);
    if (!line) {
      ctx.restore();
      return;
    }
    const anchors = getLineWorldAnchors(line, scene);
    const a = anchors?.a ?? null;
    const b = anchors?.b ?? null;
    if (!a || !b) {
      ctx.restore();
      return;
    }
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) {
      ctx.restore();
      return;
    }
    const dir = { x: d.x / len, y: d.y / len };
    const span = (Math.max(vp.widthPx, vp.heightPx) / camera.zoom) * 1.8;
    const p1 = camMath.worldToScreen(add(a, mul(dir, -span)), camera, vp);
    const p2 = camMath.worldToScreen(add(a, mul(dir, span)), camera, vp);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (obj.type === "segment") {
    const seg = scene.segments.find((item) => item.id === obj.id);
    if (!seg) {
      ctx.restore();
      return;
    }
    const aPoint = scene.points.find((p) => p.id === seg.aId);
    const bPoint = scene.points.find((p) => p.id === seg.bId);
    if (!aPoint || !bPoint) {
      ctx.restore();
      return;
    }
    const a = getPointWorldPos(aPoint, scene);
    const b = getPointWorldPos(bPoint, scene);
    if (!a || !b) {
      ctx.restore();
      return;
    }
    const p1 = camMath.worldToScreen(a, camera, vp);
    const p2 = camMath.worldToScreen(b, camera, vp);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const circle = scene.circles.find((item) => item.id === obj.id);
  if (!circle) {
    ctx.restore();
    return;
  }
  const geom = getCircleWorldGeometry(circle, scene);
  if (!geom) {
    ctx.restore();
    return;
  }
  const c = camMath.worldToScreen(geom.center, camera, vp);
  const r = geom.radius * camera.zoom;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
