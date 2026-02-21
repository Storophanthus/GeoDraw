import type { Camera } from "../../view/camera";
import type { ActiveTool, AngleFixedDirection, SelectedObject, TransformToolMode } from "./storeTypes";
import { DEFAULT_COLOR_PROFILE_ID, DEFAULT_UI_COLOR_PROFILE_ID } from "../colorProfiles";

export type UiSliceState = {
  camera: Camera;
  colorProfileId: import("../colorProfiles").ColorProfileId;
  canvasThemeOverrides: Partial<import("../colorProfiles").CanvasColorTheme>;
  uiColorProfileId: import("../colorProfiles").UiColorProfileId;
  uiCssOverrides: Partial<import("../colorProfiles").UiCssVariables>;
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
  regularPolygonTool: {
    sides: number;
    direction: AngleFixedDirection;
  };
  transformTool: {
    mode: TransformToolMode;
    angleExpr: string;
    direction: AngleFixedDirection;
    factorExpr: string;
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
    colorProfileId: DEFAULT_COLOR_PROFILE_ID,
    canvasThemeOverrides: {},
    uiColorProfileId: DEFAULT_UI_COLOR_PROFILE_ID,
    uiCssOverrides: {},
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
    regularPolygonTool: {
      sides: 5,
      direction: "CCW",
    },
    transformTool: {
      mode: "translate",
      angleExpr: "90",
      direction: "CCW",
      factorExpr: "2",
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
