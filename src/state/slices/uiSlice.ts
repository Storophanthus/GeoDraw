import type { Camera } from "../../view/camera";
import type { ActiveTool, AngleFixedDirection, SelectedObject } from "./storeTypes";

export type UiSliceState = {
  camera: Camera;
  gridEnabled: boolean;
  axesEnabled: boolean;
  gridSnapEnabled: boolean;
  activeTool: ActiveTool;
  angleFixedTool: {
    angleExpr: string;
    direction: AngleFixedDirection;
  };
  circleFixedTool: {
    radius: string;
  };
  dependencyGlowEnabled: boolean;
  exportClipWorld: import("./storeTypes").ExportClipWorld | null;
  copyStyle: {
    source: SelectedObject;
    pointStyle: import("../../scene/points").PointStyle | null;
    lineStyle: import("../../scene/points").LineStyle | null;
    circleStyle: import("../../scene/points").CircleStyle | null;
    polygonStyle: import("../../scene/points").PolygonStyle | null;
    angleStyle: Partial<import("../../scene/points").AngleStyle> | null;
    showLabel: import("../../scene/points").ShowLabelMode | null;
  };
};

export function createUiSliceState(): UiSliceState {
  const initialZoom = 80;
  return {
    camera: { pos: { x: 0, y: 0 }, zoom: initialZoom, logZoom: Math.log(initialZoom) },
    gridEnabled: true,
    axesEnabled: true,
    gridSnapEnabled: true,
    activeTool: "move",
    angleFixedTool: {
      angleExpr: "30",
      direction: "CCW",
    },
    circleFixedTool: {
      radius: "3",
    },
    dependencyGlowEnabled: true,
    exportClipWorld: null,
    copyStyle: {
      source: null,
      pointStyle: null,
      lineStyle: null,
      circleStyle: null,
      polygonStyle: null,
      angleStyle: null,
      showLabel: null,
    },
  };
}
