import type { AngleStyle, CircleStyle, LineStyle, PointStyle, PolygonStyle, SceneModel } from "../../scene/points";
import type { ActiveTool, GeoState, SelectedObject } from "./storeTypes";

export type SetStateOptions = {
  history?: "auto" | "push" | "coalesce" | "skip";
  actionKey?: string;
};

export type HistorySnapshot = {
  gridEnabled: boolean;
  axesEnabled: boolean;
  gridSnapEnabled: boolean;
  activeTool: ActiveTool;
  scene: SceneModel;
  selectedObject: SelectedObject;
  recentCreatedObject: SelectedObject;
  nextPointId: number;
  nextSegmentId: number;
  nextLineId: number;
  nextCircleId: number;
  nextPolygonId: number;
  nextAngleId: number;
  nextNumberId: number;
  nextVectorId?: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  polygonDefaults: PolygonStyle;
  angleDefaults: AngleStyle;
  angleFixedTool: GeoState["angleFixedTool"];
  circleFixedTool: GeoState["circleFixedTool"];
  transformTool?: GeoState["transformTool"];
  exportClipWorld?: GeoState["exportClipWorld"];
  copyStyle: GeoState["copyStyle"];
};

export type HistorySliceState = {
  canUndo: boolean;
  canRedo: boolean;
};

export function createHistorySliceState(): HistorySliceState {
  return {
    canUndo: false,
    canRedo: false,
  };
}

export const MAX_HISTORY = 200;

export function takeHistorySnapshot(prev: GeoState): HistorySnapshot {
  return {
    gridEnabled: prev.gridEnabled,
    axesEnabled: prev.axesEnabled,
    gridSnapEnabled: prev.gridSnapEnabled,
    activeTool: prev.activeTool,
    scene: prev.scene,
    selectedObject: prev.selectedObject,
    recentCreatedObject: prev.recentCreatedObject,
    nextPointId: prev.nextPointId,
    nextSegmentId: prev.nextSegmentId,
    nextLineId: prev.nextLineId,
    nextCircleId: prev.nextCircleId,
    nextPolygonId: prev.nextPolygonId,
    nextAngleId: prev.nextAngleId,
    nextNumberId: prev.nextNumberId,
    nextVectorId: prev.nextVectorId,
    pointDefaults: prev.pointDefaults,
    segmentDefaults: prev.segmentDefaults,
    lineDefaults: prev.lineDefaults,
    circleDefaults: prev.circleDefaults,
    polygonDefaults: prev.polygonDefaults,
    angleDefaults: prev.angleDefaults,
    angleFixedTool: prev.angleFixedTool,
    circleFixedTool: prev.circleFixedTool,
    transformTool: prev.transformTool,
    exportClipWorld: prev.exportClipWorld,
    copyStyle: prev.copyStyle,
  };
}

export function cloneHistorySnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return structuredClone(snapshot);
}

export function hasHistoryDiff(prev: GeoState, next: GeoState): boolean {
  return (
    prev.scene !== next.scene ||
    prev.nextPointId !== next.nextPointId ||
    prev.nextSegmentId !== next.nextSegmentId ||
    prev.nextLineId !== next.nextLineId ||
    prev.nextCircleId !== next.nextCircleId ||
    prev.nextPolygonId !== next.nextPolygonId ||
    prev.nextAngleId !== next.nextAngleId ||
    prev.nextNumberId !== next.nextNumberId ||
    prev.nextVectorId !== next.nextVectorId ||
    prev.pointDefaults !== next.pointDefaults ||
    prev.segmentDefaults !== next.segmentDefaults ||
    prev.lineDefaults !== next.lineDefaults ||
    prev.circleDefaults !== next.circleDefaults ||
    prev.polygonDefaults !== next.polygonDefaults ||
    prev.angleDefaults !== next.angleDefaults
    || prev.exportClipWorld !== next.exportClipWorld
  );
}
