import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import { resolveIntersectionBranchIndexInScene } from "../../domain/intersectionReuse";
import type { GeoState } from "./storeTypes";
import type { HistorySnapshot } from "./historySlice";

export function restoreGeoStateFromSnapshot(prev: GeoState, snapshot: HistorySnapshot): GeoState {
  const normalizedScene = normalizeSceneIntegrity(snapshot.scene);
  const sceneWithBranches = {
    ...normalizedScene,
    points: normalizedScene.points.map((point) => {
      if (point.kind !== "intersectionPoint" || point.branchIndex === 0 || point.branchIndex === 1) {
        return point;
      }
      const branchIndex = resolveIntersectionBranchIndexInScene(normalizedScene, point.objA, point.objB, point.preferredWorld);
      if (branchIndex === null) return point;
      return { ...point, branchIndex };
    }),
  };
  return {
    ...prev,
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
    nextAngleId: snapshot.nextAngleId,
    nextNumberId: snapshot.nextNumberId,
    pointDefaults: snapshot.pointDefaults,
    segmentDefaults: snapshot.segmentDefaults,
    lineDefaults: snapshot.lineDefaults,
    circleDefaults: snapshot.circleDefaults,
    angleDefaults: snapshot.angleDefaults,
    angleFixedTool: snapshot.angleFixedTool,
    circleFixedTool: snapshot.circleFixedTool,
    exportClipRectWorld: snapshot.exportClipRectWorld ?? null,
    copyStyle: snapshot.copyStyle,
  };
}
