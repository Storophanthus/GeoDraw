import type { Vec2 } from "../geo/vec2";
import { v } from "../geo/vec2";

export type Camera = {
  pos: Vec2;
  zoom: number;
  logZoom?: number;
  /** Visual scale accumulated by True Zoom. Ordinary zoom leaves this unchanged. */
  trueZoom?: number;
};
export type Viewport = { widthPx: number; heightPx: number };

// Wide practical bounds for "infinite-feel" zoom without hitting exp overflow.
const ZOOM_MIN = 1e-30;
const ZOOM_MAX = 1e30;
const LOG_ZOOM_MIN = Math.log(ZOOM_MIN);
const LOG_ZOOM_MAX = Math.log(ZOOM_MAX);
export const TRUE_ZOOM_MIN = 0.25;
export const TRUE_ZOOM_MAX = 4;

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

function getLogZoom(cam: Camera): number {
  if (Number.isFinite(cam.logZoom)) {
    return clamp(cam.logZoom as number, LOG_ZOOM_MIN, LOG_ZOOM_MAX);
  }
  const base = Number.isFinite(cam.zoom) && cam.zoom > 0 ? cam.zoom : 80;
  return clamp(Math.log(base), LOG_ZOOM_MIN, LOG_ZOOM_MAX);
}

function getZoom(cam: Camera): number {
  return Math.exp(getLogZoom(cam));
}

function withLogZoom(cam: Camera, nextLogZoom: number): Camera {
  const logZoom = clamp(nextLogZoom, LOG_ZOOM_MIN, LOG_ZOOM_MAX);
  return { ...cam, logZoom, zoom: Math.exp(logZoom) };
}

export function getCameraTrueZoom(cam: Camera): number {
  const value = cam.trueZoom;
  return Number.isFinite(value)
    ? clamp(value as number, TRUE_ZOOM_MIN, TRUE_ZOOM_MAX)
    : 1;
}

export const camera = {
  worldToScreen(p: Vec2, cam: Camera, vp: Viewport): Vec2 {
    const zoom = getZoom(cam);
    const c = { x: vp.widthPx / 2, y: vp.heightPx / 2 };
    return {
      x: c.x + (p.x - cam.pos.x) * zoom,
      y: c.y - (p.y - cam.pos.y) * zoom,
    };
  },

  screenToWorld(s: Vec2, cam: Camera, vp: Viewport): Vec2 {
    const zoom = getZoom(cam);
    const c = { x: vp.widthPx / 2, y: vp.heightPx / 2 };
    return {
      x: cam.pos.x + (s.x - c.x) / zoom,
      y: cam.pos.y - (s.y - c.y) / zoom,
    };
  },

  panByScreenDelta(cam: Camera, d: Vec2): Camera {
    const zoom = getZoom(cam);
    return {
      ...cam,
      zoom,
      logZoom: getLogZoom(cam),
      pos: {
        x: cam.pos.x - d.x / zoom,
        y: cam.pos.y + d.y / zoom,
      },
    };
  },

  zoomAtScreenPoint(cam: Camera, vp: Viewport, pScreen: Vec2, zoomFactor: number): Camera {
    const baseLogZoom = getLogZoom(cam);
    const delta = Number.isFinite(zoomFactor) && zoomFactor > 0 ? Math.log(zoomFactor) : 0;
    const afterZoom = withLogZoom(cam, baseLogZoom + delta);

    const wBefore = camera.screenToWorld(pScreen, cam, vp);
    const wAfter = camera.screenToWorld(pScreen, afterZoom, vp);

    return { ...afterZoom, pos: v.add(afterZoom.pos, v.sub(wBefore, wAfter)) };
  },

  trueZoomAtScreenPoint(cam: Camera, vp: Viewport, pScreen: Vec2, zoomFactor: number): Camera {
    const beforeTrueZoom = getCameraTrueZoom(cam);
    const requestedFactor = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
    const nextTrueZoom = clamp(beforeTrueZoom * requestedFactor, TRUE_ZOOM_MIN, TRUE_ZOOM_MAX);
    const appliedFactor = nextTrueZoom / beforeTrueZoom;
    const nextCamera = camera.zoomAtScreenPoint(cam, vp, pScreen, appliedFactor);
    return { ...nextCamera, trueZoom: nextTrueZoom };
  },

  trueZoomRenderSpace(cam: Camera, vp: Viewport): { camera: Camera; viewport: Viewport; scale: number } {
    const scale = getCameraTrueZoom(cam);
    const zoom = getZoom(cam) / scale;
    return {
      scale,
      camera: { ...cam, zoom, logZoom: Math.log(zoom), trueZoom: 1 },
      viewport: {
        widthPx: vp.widthPx / scale,
        heightPx: vp.heightPx / scale,
      },
    };
  },
};
