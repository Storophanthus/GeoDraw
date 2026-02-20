import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";
import {
  applyProfileColorsToDefaults,
  recolorSceneForProfile,
  type SceneStyleDefaults,
} from "../colorProfiles";

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
  | "setPolygonDefaults"
  | "setAngleDefaults"
  | "setAngleFixedTool"
  | "setCircleFixedTool"
  | "setRegularPolygonTool"
  | "setTransformTool"
  | "setGridEnabled"
  | "setAxesEnabled"
  | "setGridSnapEnabled"
  | "setColorProfile"
  | "setDependencyGlowEnabled"
  | "setExportClipWorld"
  | "clearExportClipWorld"
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

    setPolygonDefaults(next) {
      ctx.setState((prev) => ({
        ...prev,
        polygonDefaults: {
          ...prev.polygonDefaults,
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

    setRegularPolygonTool(next) {
      ctx.setState((prev) => ({
        ...prev,
        regularPolygonTool: {
          ...prev.regularPolygonTool,
          ...next,
        },
      }));
    },

    setTransformTool(next) {
      ctx.setState((prev) => ({
        ...prev,
        transformTool: {
          ...prev.transformTool,
          ...next,
        },
      }));
    },

    setGridEnabled(enabled) {
      ctx.setState((prev) => ({
        ...prev,
        gridEnabled: enabled,
      }));
    },

    setAxesEnabled(enabled) {
      ctx.setState((prev) => ({
        ...prev,
        axesEnabled: enabled,
      }));
    },

    setGridSnapEnabled(enabled) {
      ctx.setState((prev) => ({
        ...prev,
        gridSnapEnabled: enabled,
      }));
    },

    setColorProfile(profileId) {
      ctx.setState((prev) => {
        if (prev.colorProfileId === profileId) return prev;
        const nextDefaults = applyProfileColorsToDefaults(
          {
            pointDefaults: prev.pointDefaults,
            segmentDefaults: prev.segmentDefaults,
            lineDefaults: prev.lineDefaults,
            circleDefaults: prev.circleDefaults,
            polygonDefaults: prev.polygonDefaults,
            angleDefaults: prev.angleDefaults,
          } satisfies SceneStyleDefaults,
          profileId
        );
        return {
          ...prev,
          colorProfileId: profileId,
          scene: recolorSceneForProfile(prev.scene, prev.colorProfileId, profileId),
          pointDefaults: nextDefaults.pointDefaults,
          segmentDefaults: nextDefaults.segmentDefaults,
          lineDefaults: nextDefaults.lineDefaults,
          circleDefaults: nextDefaults.circleDefaults,
          polygonDefaults: nextDefaults.polygonDefaults,
          angleDefaults: nextDefaults.angleDefaults,
        };
      });
    },

    setDependencyGlowEnabled(enabled) {
      ctx.setState((prev) => ({
        ...prev,
        dependencyGlowEnabled: enabled,
      }));
    },

    setExportClipWorld(clip) {
      ctx.setState((prev) => ({
        ...prev,
        exportClipWorld: clip,
      }));
    },

    clearExportClipWorld() {
      ctx.setState((prev) => ({
        ...prev,
        exportClipWorld: null,
      }));
    },
  };
}
