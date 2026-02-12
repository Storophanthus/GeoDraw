import { normalizeSceneIntegrity } from "../../domain/sceneIntegrity";
import type { GeoState } from "./storeTypes";
import type { HistorySnapshot } from "./historySlice";

export function restoreGeoStateFromSnapshot(prev: GeoState, snapshot: HistorySnapshot): GeoState {
  const normalizedScene = normalizeSceneIntegrity(snapshot.scene);
  return {
    ...prev,
    activeTool: snapshot.activeTool,
    scene: normalizedScene,
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
    copyStyle: snapshot.copyStyle,
  };
}
