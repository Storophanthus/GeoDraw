import { useSyncExternalStore } from "react";
import { camera as cameraMath } from "../view/camera";
import {
  type SetStateOptions,
} from "./slices/historySlice";
import { createInitialGeoState } from "./slices";
import { createHistoryActions } from "./slices/historyActions";
import { createInteractionActions } from "./slices/interactionActions";
import { createSceneCreationActions } from "./slices/sceneCreationActions";
import { createSceneCoreActions } from "./slices/sceneCoreActions";
import { createSceneLineAngleActions } from "./slices/sceneLineAngleActions";
import { createSceneMutationActions } from "./slices/sceneMutationActions";
import { normalizeSceneIntegrity } from "../domain/sceneIntegrity";
import {
  createStableLineCircleIntersectionPoint,
  findExistingIntersectionPointId,
  getLineCircleRefs,
} from "../domain/intersectionReuse";
import {
  isValidNumberDefinition,
  nextAvailableNumberName,
  numberPrefixForDefinition,
} from "../domain/numberDefinitions";
import { restoreGeoStateFromSnapshot } from "./slices/historyRestore";
import type {
  ActiveTool,
  AngleFixedDirection,
  GeoActions,
  GeoState,
  GeoStore,
  HoveredHit,
  PendingSelection,
  RenameResult,
  SelectedObject,
} from "./slices/storeTypes";
import { createUiActions } from "./slices/uiActions";
import { createSceneRenameActions } from "./slices/sceneRenameActions";
import { createStoreRuntime } from "./slices/storeRuntime";
import { geoStoreHelpers } from "./geoStoreHelpers";

export type {
  ActiveTool,
  AngleFixedDirection,
  GeoActions,
  GeoState,
  GeoStore,
  HoveredHit,
  PendingSelection,
  RenameResult,
  SelectedObject,
};
const initialState: GeoState = createInitialGeoState();
const runtime = createStoreRuntime({
  initialState,
  normalizeScene: normalizeSceneIntegrity,
});
const setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void = runtime.setState;

const actions: GeoActions = {
  ...createInteractionActions({
    getState: runtime.getState,
    setState,
    cameraMath,
  }),
  ...createUiActions({
    setState,
  }),
  ...createHistoryActions({
    setState,
    undoStack: runtime.history.undoStack,
    redoStack: runtime.history.redoStack,
    getLastHistoryActionKey: runtime.history.getLastHistoryActionKey,
    setLastHistoryActionKey: runtime.history.setLastHistoryActionKey,
    getIsRestoringHistory: runtime.history.getIsRestoringHistory,
    setIsRestoringHistory: runtime.history.setIsRestoringHistory,
    restoreFromSnapshot: restoreGeoStateFromSnapshot,
  }),
  ...createSceneCoreActions({
    setState,
  }),
  ...createSceneLineAngleActions({
    setState,
  }),
  ...createSceneCreationActions({
    setState,
    findExistingIntersectionPointId,
    getLineCircleRefs,
    createStableLineCircleIntersectionPoint,
    isValidNumberDefinition,
    numberPrefixForDefinition,
    nextAvailableNumberName,
  }),
  ...createSceneMutationActions({
    setState,
  }),
  ...createSceneRenameActions({
    setState,
  }),
};

function getStore(): GeoStore {
  return { ...runtime.getState(), ...actions };
}

export function useGeoStore<T>(selector: (store: GeoStore) => T): T {
  return useSyncExternalStore(runtime.subscribe, () => selector(getStore()), () => selector(getStore()));
}

export { geoStoreHelpers };
