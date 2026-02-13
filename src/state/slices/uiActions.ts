import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type UiContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
};

export function createUiActions(
  ctx: UiContext
): Pick<
  GeoActions,
  | "setPointDefaults"
  | "setSegmentDefaults"
  | "setLineDefaults"
  | "setCircleDefaults"
  | "setAngleDefaults"
  | "setAngleFixedTool"
  | "setCircleFixedTool"
  | "setDependencyGlowEnabled"
  | "setExportClipRectWorld"
  | "clearExportClipRectWorld"
> {
  return {
    setPointDefaults(next) {
      ctx.setState((prev) => ({
        ...prev,
        pointDefaults: {
          ...prev.pointDefaults,
          ...next,
        },
      }));
    },

    setSegmentDefaults(next) {
      ctx.setState((prev) => ({
        ...prev,
        segmentDefaults: {
          ...prev.segmentDefaults,
          ...next,
        },
      }));
    },

    setLineDefaults(next) {
      ctx.setState((prev) => ({
        ...prev,
        lineDefaults: {
          ...prev.lineDefaults,
          ...next,
        },
      }));
    },

    setCircleDefaults(next) {
      ctx.setState((prev) => ({
        ...prev,
        circleDefaults: {
          ...prev.circleDefaults,
          ...next,
        },
      }));
    },

    setAngleDefaults(next) {
      ctx.setState((prev) => ({
        ...prev,
        angleDefaults: {
          ...prev.angleDefaults,
          ...next,
        },
      }));
    },

    setAngleFixedTool(next) {
      ctx.setState((prev) => ({
        ...prev,
        angleFixedTool: {
          ...prev.angleFixedTool,
          ...next,
        },
      }));
    },

    setCircleFixedTool(next) {
      ctx.setState((prev) => ({
        ...prev,
        circleFixedTool: {
          ...prev.circleFixedTool,
          ...next,
        },
      }));
    },

    setDependencyGlowEnabled(enabled) {
      ctx.setState((prev) => ({
        ...prev,
        dependencyGlowEnabled: enabled,
      }));
    },

    setExportClipRectWorld(rect) {
      ctx.setState((prev) => ({
        ...prev,
        exportClipRectWorld: rect,
      }));
    },

    clearExportClipRectWorld() {
      ctx.setState((prev) => ({
        ...prev,
        exportClipRectWorld: null,
      }));
    },
  };
}
