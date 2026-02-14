import type { Vec2 } from "../../geo/vec2";
import { getCircleWorldGeometry, getPointWorldPos } from "../../scene/points";
import type { Camera, Viewport } from "../../view/camera";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState, HoveredHit, SelectedObject } from "./storeTypes";

type InteractionContext = {
  getState: () => GeoState;
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
  cameraMath: {
    panByScreenDelta: (camera: Camera, delta: Vec2) => Camera;
    zoomAtScreenPoint: (camera: Camera, vp: Viewport, pScreen: Vec2, zoomFactor: number) => Camera;
  };
};

export function createInteractionActions(
  ctx: InteractionContext
): Pick<
  GeoActions,
  | "setActiveTool"
  | "setSelectedObject"
  | "setHoveredHit"
  | "setCursorWorld"
  | "setPendingSelection"
  | "clearPendingSelection"
  | "panByScreenDelta"
  | "zoomAtScreenPoint"
  | "fitViewToScene"
> {
  return {
    setActiveTool(tool) {
      ctx.setState((prev) => ({
        ...prev,
        activeTool: tool,
        pendingSelection: null,
        copyStyle:
          tool === "copyStyle"
            ? prev.copyStyle
            : {
                source: null,
                pointStyle: null,
                lineStyle: null,
                circleStyle: null,
                polygonStyle: null,
                angleStyle: null,
                showLabel: null,
              },
        circleFixedTool: prev.circleFixedTool,
      }));
    },

    setSelectedObject(selected) {
      if (isSameSelectedObject(ctx.getState().selectedObject, selected)) return;
      ctx.setState((prev) => ({
        ...prev,
        selectedObject: selected,
        recentCreatedObject:
          prev.recentCreatedObject &&
          selected &&
          prev.recentCreatedObject.type === selected.type &&
          prev.recentCreatedObject.id === selected.id
            ? prev.recentCreatedObject
            : null,
      }));
    },

    setHoveredHit(hit) {
      if (isSameHoveredHit(ctx.getState().hoveredHit, hit)) return;
      ctx.setState((prev) => ({ ...prev, hoveredHit: hit }));
    },

    setCursorWorld(world) {
      if (isSameWorld(ctx.getState().cursorWorld, world)) return;
      ctx.setState((prev) => ({ ...prev, cursorWorld: world }));
    },

    setPendingSelection(next) {
      ctx.setState((prev) => ({ ...prev, pendingSelection: next }));
    },

    clearPendingSelection() {
      ctx.setState((prev) => ({ ...prev, pendingSelection: null }));
    },

    panByScreenDelta(delta) {
      ctx.setState((prev) => ({ ...prev, camera: ctx.cameraMath.panByScreenDelta(prev.camera, delta) }));
    },

    zoomAtScreenPoint(vp, pScreen, zoomFactor) {
      ctx.setState((prev) => ({
        ...prev,
        camera: ctx.cameraMath.zoomAtScreenPoint(prev.camera, vp, pScreen, zoomFactor),
      }));
    },

    fitViewToScene(vp) {
      ctx.setState((prev) => {
        const bounds = computeSceneBounds(prev.scene);
        if (!bounds) return prev;
        const width = Math.max(1e-9, bounds.xmax - bounds.xmin);
        const height = Math.max(1e-9, bounds.ymax - bounds.ymin);
        const pad = Math.max(0.25, 0.12 * Math.max(width, height));
        const xmin = bounds.xmin - pad;
        const xmax = bounds.xmax + pad;
        const ymin = bounds.ymin - pad;
        const ymax = bounds.ymax + pad;
        const w = Math.max(1e-9, xmax - xmin);
        const h = Math.max(1e-9, ymax - ymin);
        const zoom = Math.max(1e-12, Math.min(1e12, Math.min(vp.widthPx / w, vp.heightPx / h)));
        return {
          ...prev,
          camera: {
            ...prev.camera,
            pos: { x: (xmin + xmax) * 0.5, y: (ymin + ymax) * 0.5 },
            zoom,
            logZoom: Math.log(zoom),
          },
        };
      });
    },
  };
}

function computeSceneBounds(scene: GeoState["scene"]): { xmin: number; xmax: number; ymin: number; ymax: number } | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (let i = 0; i < scene.points.length; i += 1) {
    const p = getPointWorldPos(scene.points[i], scene);
    if (p) add(p.x, p.y);
  }
  for (let i = 0; i < scene.circles.length; i += 1) {
    const g = getCircleWorldGeometry(scene.circles[i], scene);
    if (!g || !Number.isFinite(g.radius)) continue;
    add(g.center.x - g.radius, g.center.y - g.radius);
    add(g.center.x + g.radius, g.center.y + g.radius);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { xmin: minX, xmax: maxX, ymin: minY, ymax: maxY };
}

function isSameSelectedObject(a: SelectedObject, b: SelectedObject): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id;
}

function isSameHoveredHit(a: HoveredHit, b: HoveredHit): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id;
}

function isSameWorld(a: Vec2 | null, b: Vec2 | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}
