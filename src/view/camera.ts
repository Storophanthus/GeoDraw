import type { Vec2 } from "../geo/vec2";
import { v } from "../geo/vec2";

export type Camera = { pos: Vec2; zoom: number };
export type Viewport = { widthPx: number; heightPx: number };

export const camera = {
  worldToScreen(p: Vec2, cam: Camera, vp: Viewport): Vec2 {
    const c = { x: vp.widthPx / 2, y: vp.heightPx / 2 };
    return {
      x: c.x + (p.x - cam.pos.x) * cam.zoom,
      y: c.y - (p.y - cam.pos.y) * cam.zoom,
    };
  },

  screenToWorld(s: Vec2, cam: Camera, vp: Viewport): Vec2 {
    const c = { x: vp.widthPx / 2, y: vp.heightPx / 2 };
    return {
      x: cam.pos.x + (s.x - c.x) / cam.zoom,
      y: cam.pos.y - (s.y - c.y) / cam.zoom,
    };
  },

  panByScreenDelta(cam: Camera, d: Vec2): Camera {
    return {
      ...cam,
      pos: {
        x: cam.pos.x - d.x / cam.zoom,
        y: cam.pos.y + d.y / cam.zoom,
      },
    };
  },

  zoomAtScreenPoint(cam: Camera, vp: Viewport, pScreen: Vec2, zoomFactor: number): Camera {
    const newZoom = clamp(cam.zoom * zoomFactor, 10, 5000);

    const wBefore = camera.screenToWorld(pScreen, cam, vp);
    const afterZoom = { ...cam, zoom: newZoom };
    const wAfter = camera.screenToWorld(pScreen, afterZoom, vp);

    return { ...afterZoom, pos: v.add(afterZoom.pos, v.sub(wBefore, wAfter)) };
  },
};

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}
