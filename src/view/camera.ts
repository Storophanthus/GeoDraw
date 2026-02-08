import type { Vec2 } from "../geo/vec2";
import { v } from "../geo/vec2";

export type Camera = { pos: Vec2; zoom: number };
export type Viewport = { widthPx: number; heightPx: number };

export const camera = {
  worldToScreen(p: Vec2, cam: Camera, vp: Viewport): Vec2 {
    const c = { x: vp.widthPx / 2, y: vp.heightPx / 2 };
    return v.add(v.mul(v.sub(p, cam.pos), cam.zoom), c);
  },

  screenToWorld(s: Vec2, cam: Camera, vp: Viewport): Vec2 {
    const c = { x: vp.widthPx / 2, y: vp.heightPx / 2 };
    return v.add(v.mul(v.sub(s, c), 1 / cam.zoom), cam.pos);
  },

  panByScreenDelta(cam: Camera, d: Vec2): Camera {
    return { ...cam, pos: v.sub(cam.pos, v.mul(d, 1 / cam.zoom)) };
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
