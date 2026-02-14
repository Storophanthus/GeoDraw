import type { AngleStyle, CircleStyle, LineStyle, PointStyle, SceneModel } from "../../scene/points";
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
  nextAngleId: number;
  nextNumberId: number;
  pointDefaults: PointStyle;
  segmentDefaults: LineStyle;
  lineDefaults: LineStyle;
  circleDefaults: CircleStyle;
  angleDefaults: AngleStyle;
  angleFixedTool: GeoState["angleFixedTool"];
  circleFixedTool: GeoState["circleFixedTool"];
  exportClipRectWorld?: GeoState["exportClipRectWorld"];
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
    nextAngleId: prev.nextAngleId,
    nextNumberId: prev.nextNumberId,
    pointDefaults: prev.pointDefaults,
    segmentDefaults: prev.segmentDefaults,
    lineDefaults: prev.lineDefaults,
    circleDefaults: prev.circleDefaults,
    angleDefaults: prev.angleDefaults,
    angleFixedTool: prev.angleFixedTool,
    circleFixedTool: prev.circleFixedTool,
    exportClipRectWorld: prev.exportClipRectWorld,
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
    prev.nextAngleId !== next.nextAngleId ||
    prev.nextNumberId !== next.nextNumberId ||
    prev.pointDefaults !== next.pointDefaults ||
    prev.segmentDefaults !== next.segmentDefaults ||
    prev.lineDefaults !== next.lineDefaults ||
    prev.circleDefaults !== next.circleDefaults ||
    prev.angleDefaults !== next.angleDefaults
    || prev.exportClipRectWorld !== next.exportClipRectWorld
  );
}
