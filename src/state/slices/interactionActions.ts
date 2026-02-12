import type { Vec2 } from "../../geo/vec2";
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
  };
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
