import { createHistorySliceState } from "./historySlice";
import { createInteractionSliceState } from "./interactionSlice";
import { createSceneSliceState } from "./sceneSlice";
import { createUiSliceState } from "./uiSlice";
import type { GeoState } from "./storeTypes";

export function createInitialGeoState(): GeoState {
  return {
    ...createUiSliceState(),
    ...createSceneSliceState(),
    ...createInteractionSliceState(),
    ...createHistorySliceState(),
  };
}
