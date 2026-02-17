import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import { resolveIntersectionBranchIndexInScene } from "../../domain/intersectionReuse";
import type { GeoState } from "./storeTypes";
import type { HistorySnapshot } from "./historySlice";

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
