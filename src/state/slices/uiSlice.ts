import type { Camera } from "../../view/camera";
import type { ActiveTool, AngleFixedDirection, SelectedObject } from "./storeTypes";

export type UiSliceState = {
  camera: Camera;
  activeTool: ActiveTool;
  angleFixedTool: {
    angleExpr: string;
    direction: AngleFixedDirection;
  };
  circleFixedTool: {
    radius: string;
  };
  dependencyGlowEnabled: boolean;
  exportClipRectWorld: { xmin: number; xmax: number; ymin: number; ymax: number } | null;
  copyStyle: {
    source: SelectedObject;
    pointStyle: import("../../scene/points").PointStyle | null;
    lineStyle: import("../../scene/points").LineStyle | null;
    circleStyle: import("../../scene/points").CircleStyle | null;
    angleStyle: Partial<import("../../scene/points").AngleStyle> | null;
    showLabel: import("../../scene/points").ShowLabelMode | null;
  };
};

export function createUiSliceState(): UiSliceState {
  return {
    camera: { pos: { x: 0, y: 0 }, zoom: 80 },
    activeTool: "move",
    angleFixedTool: {
      angleExpr: "30",
      direction: "CCW",
    },
    circleFixedTool: {
      radius: "3",
    },
    dependencyGlowEnabled: true,
    exportClipRectWorld: null,
    copyStyle: {
      source: null,
      pointStyle: null,
      lineStyle: null,
      circleStyle: null,
      angleStyle: null,
      showLabel: null,
    },
  };
}
