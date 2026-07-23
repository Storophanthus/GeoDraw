import type { Vec2 } from "../geo/vec2";
import type { ExportClipWorld } from "../state/slices/storeTypes";
import type { Camera, Viewport } from "./camera";
import { camera as camMath } from "./camera";

/**
 * Grab handles for an existing export clip area, so a crop can be adjusted after
 * it is drawn instead of having to redraw it from scratch.
 *
 * Every handle is a discrete square — corners and edge midpoints for a rect,
 * vertices for a polygon. Deliberately not the whole border: a clip usually sits
 * on top of the figure, and treating the full edge (or the interior) as a grab
 * target would swallow clicks meant for the geometry underneath.
 */
export type ExportClipHandle =
  | { kind: "corner"; x: "min" | "max"; y: "min" | "max" }
  | { kind: "edge"; edge: "xmin" | "xmax" | "ymin" | "ymax" }
  | { kind: "vertex"; index: number };

export const EXPORT_CLIP_HANDLE_SIZE_PX = 7;
export const EXPORT_CLIP_HANDLE_HIT_PX = 9;

export function listExportClipHandles(clip: ExportClipWorld | null): ExportClipHandle[] {
  if (!clip) return [];
  if (clip.kind === "rect") {
    return [
      { kind: "corner", x: "min", y: "min" },
      { kind: "corner", x: "min", y: "max" },
      { kind: "corner", x: "max", y: "min" },
      { kind: "corner", x: "max", y: "max" },
      { kind: "edge", edge: "xmin" },
      { kind: "edge", edge: "xmax" },
      { kind: "edge", edge: "ymin" },
      { kind: "edge", edge: "ymax" },
    ];
  }
  return clip.points.map((_, index) => ({ kind: "vertex", index }) as ExportClipHandle);
}

export function exportClipHandleWorld(clip: ExportClipWorld, handle: ExportClipHandle): Vec2 | null {
  if (clip.kind === "rect") {
    const midX = (clip.xmin + clip.xmax) / 2;
    const midY = (clip.ymin + clip.ymax) / 2;
    if (handle.kind === "corner") {
      return {
        x: handle.x === "min" ? clip.xmin : clip.xmax,
        y: handle.y === "min" ? clip.ymin : clip.ymax,
      };
    }
    if (handle.kind === "edge") {
      switch (handle.edge) {
        case "xmin":
          return { x: clip.xmin, y: midY };
        case "xmax":
          return { x: clip.xmax, y: midY };
        case "ymin":
          return { x: midX, y: clip.ymin };
        case "ymax":
          return { x: midX, y: clip.ymax };
      }
    }
    return null;
  }
  if (handle.kind !== "vertex") return null;
  return clip.points[handle.index] ?? null;
}

export function exportClipHandleScreen(
  clip: ExportClipWorld,
  handle: ExportClipHandle,
  camera: Camera,
  vp: Viewport
): Vec2 | null {
  const world = exportClipHandleWorld(clip, handle);
  return world ? camMath.worldToScreen(world, camera, vp) : null;
}

export function hitTestExportClipHandle(
  screen: Vec2,
  clip: ExportClipWorld | null,
  camera: Camera,
  vp: Viewport,
  tolerancePx: number = EXPORT_CLIP_HANDLE_HIT_PX
): ExportClipHandle | null {
  if (!clip) return null;
  let best: ExportClipHandle | null = null;
  let bestDistSq = tolerancePx * tolerancePx;
  for (const handle of listExportClipHandles(clip)) {
    const handleScreen = exportClipHandleScreen(clip, handle, camera, vp);
    if (!handleScreen) continue;
    const dx = screen.x - handleScreen.x;
    const dy = screen.y - handleScreen.y;
    const distSq = dx * dx + dy * dy;
    // Corners sit on top of edge midpoints only in degenerate boxes, but ties
    // should still resolve to whichever handle is genuinely closest.
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      best = handle;
    }
  }
  return best;
}

export type ExportClipDragResult = {
  clip: ExportClipWorld;
  /**
   * The handle the pointer is now holding. Dragging a bound past its opposite
   * swaps the two, so the grabbed handle changes identity mid-drag and the
   * caller must carry this back into its pointer state.
   */
  handle: ExportClipHandle;
};

/**
 * Drag a handle to `world`.
 *
 * Bounds are allowed to cross, flipping the box and re-labelling the dragged
 * handle. Clamping at the opposite bound instead looks safer but traps the user:
 * once an edge is pushed all the way over, the box is degenerate on that axis
 * and every subsequent drag clamps straight back to it, so the crop can never be
 * pulled open again.
 */
export function moveExportClipHandle(
  clip: ExportClipWorld,
  handle: ExportClipHandle,
  world: Vec2
): ExportClipDragResult {
  if (clip.kind === "rect") {
    let { xmin, xmax, ymin, ymax } = clip;

    // Which bound(s) this handle drives. Corners drive one on each axis, edges
    // exactly one, so the same flip logic covers both.
    let boundX: "min" | "max" | null = null;
    let boundY: "min" | "max" | null = null;
    if (handle.kind === "corner") {
      boundX = handle.x;
      boundY = handle.y;
    } else if (handle.kind === "edge") {
      if (handle.edge === "xmin") boundX = "min";
      else if (handle.edge === "xmax") boundX = "max";
      else if (handle.edge === "ymin") boundY = "min";
      else boundY = "max";
    } else {
      return { clip, handle };
    }

    if (boundX === "min") xmin = world.x;
    else if (boundX === "max") xmax = world.x;
    if (boundY === "min") ymin = world.y;
    else if (boundY === "max") ymax = world.y;

    const flip = (bound: "min" | "max" | null) =>
      bound === null ? null : bound === "min" ? "max" : "min";
    if (xmin > xmax) {
      [xmin, xmax] = [xmax, xmin];
      boundX = flip(boundX);
    }
    if (ymin > ymax) {
      [ymin, ymax] = [ymax, ymin];
      boundY = flip(boundY);
    }

    const nextHandle: ExportClipHandle =
      handle.kind === "corner"
        ? { kind: "corner", x: boundX ?? "min", y: boundY ?? "min" }
        : {
            kind: "edge",
            edge: boundX ? (boundX === "min" ? "xmin" : "xmax") : boundY === "min" ? "ymin" : "ymax",
          };

    return { clip: { kind: "rect", xmin, xmax, ymin, ymax }, handle: nextHandle };
  }

  if (handle.kind !== "vertex") return { clip, handle };
  if (handle.index < 0 || handle.index >= clip.points.length) return { clip, handle };
  const points = clip.points.map((point, index) => (index === handle.index ? world : point));
  return { clip: { kind: "polygon", points }, handle };
}

/**
 * Screen-space resize cursor. worldToScreen flips y, so the world-space "ymin"
 * bound is the bottom edge on screen — the diagonal cursors account for that.
 */
export function exportClipHandleCursor(handle: ExportClipHandle): string {
  if (handle.kind === "vertex") return "move";
  if (handle.kind === "edge") {
    return handle.edge === "xmin" || handle.edge === "xmax" ? "ew-resize" : "ns-resize";
  }
  const topLeft = handle.x === "min" && handle.y === "max";
  const bottomRight = handle.x === "max" && handle.y === "min";
  return topLeft || bottomRight ? "nwse-resize" : "nesw-resize";
}
