import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import { resolveIntersectionBranchIndexInScene } from "../../domain/intersectionReuse";
import type { GeoState } from "./storeTypes";
import type { HistorySnapshot } from "./historySlice";
import {
  DEFAULT_COLOR_PROFILE_ID,
  DEFAULT_UI_COLOR_PROFILE_ID,
  type ColorProfileId,
  UI_CSS_VARIABLE_KEYS,
  type UiCssVariableName,
  type UiCssVariables,
  type UiColorProfileId,
} from "../colorProfiles";

export function restoreGeoStateFromSnapshot(prev: GeoState, snapshot: HistorySnapshot): GeoState {
  const normalizedScene = normalizeSceneIntegrity(snapshot.scene);
  const sceneWithBranches = {
    ...normalizedScene,
    points: normalizedScene.points.map((point) => {
      if (
        point.kind !== "intersectionPoint" ||
        (Number.isInteger(point.branchIndex) && (point.branchIndex as number) >= 0)
      ) {
        return point;
      }
      const branchIndex = resolveIntersectionBranchIndexInScene(normalizedScene, point.objA, point.objB, point.preferredWorld);
      if (branchIndex === null) return point;
      return { ...point, branchIndex };
    }),
    segments: normalizedScene.segments.map((seg) => {
      if (seg.style.segmentArrowMarks?.length) return seg;
      if (!seg.style.segmentArrowMark) return seg;
      return {
        ...seg,
        style: {
          ...seg.style,
          segmentArrowMarks: migrateArrowMark(seg.style.segmentArrowMark),
        },
      };
    }),
    circles: normalizedScene.circles.map((c) => {
      if (c.style.arrowMarks?.length) return c;
      if (!c.style.arrowMark) return c;
      return {
        ...c,
        style: {
          ...c.style,
          arrowMarks: migrateArrowMark(c.style.arrowMark),
        },
      };
    }),
    angles: normalizedScene.angles.map((a) => {
      if (a.style.arcArrowMarks?.length) return a;
      if (!a.style.arcArrowMark) return a;
      return {
        ...a,
        style: {
          ...a.style,
          arcArrowMarks: migrateArrowMark(a.style.arcArrowMark),
        },
      };
    }),
  };
  return {
    ...prev,
    colorProfileId: snapshot.colorProfileId ?? DEFAULT_COLOR_PROFILE_ID,
    uiColorProfileId: resolveUiColorProfileId(snapshot.uiColorProfileId, snapshot.colorProfileId),
    uiCssOverrides: normalizeUiCssOverrides(snapshot.uiCssOverrides),
    gridEnabled: snapshot.gridEnabled ?? true,
    axesEnabled: snapshot.axesEnabled ?? true,
    gridSnapEnabled: snapshot.gridSnapEnabled ?? true,
    activeTool: snapshot.activeTool,
    scene: sceneWithBranches,
    selectedObject: snapshot.selectedObject,
    recentCreatedObject: snapshot.recentCreatedObject,
    pendingSelection: null,
    hoveredHit: null,
    cursorWorld: null,
    nextPointId: snapshot.nextPointId,
    nextSegmentId: snapshot.nextSegmentId,
    nextLineId: snapshot.nextLineId,
    nextCircleId: snapshot.nextCircleId,
    nextPolygonId: snapshot.nextPolygonId ?? prev.nextPolygonId,
    nextAngleId: snapshot.nextAngleId,
    nextNumberId: snapshot.nextNumberId,
    nextVectorId: snapshot.nextVectorId ?? prev.nextVectorId,
    pointDefaults: snapshot.pointDefaults,
    segmentDefaults: snapshot.segmentDefaults,
    lineDefaults: snapshot.lineDefaults,
    circleDefaults: snapshot.circleDefaults,
    polygonDefaults: snapshot.polygonDefaults ?? prev.polygonDefaults,
    angleDefaults: snapshot.angleDefaults,
    angleFixedTool: snapshot.angleFixedTool,
    circleFixedTool: snapshot.circleFixedTool,
    transformTool: snapshot.transformTool ?? prev.transformTool,
    exportClipWorld: snapshot.exportClipWorld ?? null,
    copyStyle: snapshot.copyStyle,
  };
}

function resolveUiColorProfileId(
  uiProfileId: HistorySnapshot["uiColorProfileId"] | string | undefined,
  sceneProfileId: ColorProfileId | undefined
): UiColorProfileId {
  if (uiProfileId === "vanilla" || uiProfileId === "grayscale" || uiProfileId === "beige") {
    return uiProfileId;
  }

  // Backward compatibility: older snapshots reused scene profile ids.
  if (uiProfileId === "classic") return "vanilla";
  if (uiProfileId === "grayscale_white_dot") return "grayscale";
  if (uiProfileId === "beige_light") return "beige";

  if (sceneProfileId === "classic") return "vanilla";
  if (sceneProfileId === "grayscale_white_dot") return "grayscale";
  if (sceneProfileId === "beige_light") return "beige";

  return DEFAULT_UI_COLOR_PROFILE_ID;
}

function normalizeUiCssOverrides(raw: HistorySnapshot["uiCssOverrides"] | unknown): Partial<UiCssVariables> {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: Partial<UiCssVariables> = {};
  for (const key of UI_CSS_VARIABLE_KEYS) {
    const value = input[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized) continue;
    out[key as UiCssVariableName] = normalized;
  }
  return out;
}

function migrateArrowMark<T extends { direction: string; pos?: number; pairGapPx?: number }>(arrow: T): T[] {
  if (!arrow) return [];
  const dir = arrow.direction;
  if (dir === "->" || dir === "<-") {
    return [arrow];
  }
  // Split bidirectional arrows into two
  const basePos = arrow.pos ?? 0.5;
  // Estimate gap offset. In the old system, gap separation depended on context (segments vs arcs),
  // but here at data level we don't have geometry. We pick a safe visual default (e.g. +/- 0.05).
  // For segments/arcs this is usually sufficient distinction.
  const offset = 0.05;

  if (dir === "<->") {
    return [
      { ...arrow, direction: "<-", pos: Math.max(0, basePos - offset), pairGapPx: undefined },
      { ...arrow, direction: "->", pos: Math.min(1, basePos + offset), pairGapPx: undefined },
    ];
  }
  if (dir === ">-<") {
    // >-< means incoming to the center. So Left arrow is -> (0 to center), Right arrow is <- (1 to center)
    return [
      { ...arrow, direction: "->", pos: Math.max(0, basePos - offset), pairGapPx: undefined },
      { ...arrow, direction: "<-", pos: Math.min(1, basePos + offset), pairGapPx: undefined },
    ];
  }
  return [arrow];
}
