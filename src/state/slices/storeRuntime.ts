import {
  cloneHistorySnapshot,
  hasHistoryDiff,
  MAX_HISTORY,
  takeHistorySnapshot,
  type SetStateOptions,
  type HistorySnapshot,
} from "./historySlice";
import type { GeoState } from "./storeTypes";

type StoreRuntimeOptions = {
  initialState: GeoState;
  normalizeScene: (scene: GeoState["scene"]) => GeoState["scene"];
};

export type StoreRuntime = {
  getState: () => GeoState;
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
  subscribe: (listener: () => void) => () => void;
  history: {
    undoStack: HistorySnapshot[];
    redoStack: HistorySnapshot[];
    getLastHistoryActionKey: () => string | null;
    setLastHistoryActionKey: (key: string | null) => void;
    getIsRestoringHistory: () => boolean;
    setIsRestoringHistory: (value: boolean) => void;
  };
};

export function createStoreRuntime(options: StoreRuntimeOptions): StoreRuntime {
  let state: GeoState = options.initialState;
  const listeners = new Set<() => void>();

  const undoStack: HistorySnapshot[] = [];
  const redoStack: HistorySnapshot[] = [];
  let lastHistoryActionKey: string | null = null;
  let isRestoringHistory = false;

  function emit() {
    for (const listener of listeners) listener();
  }

  function setState(updater: (prev: GeoState) => GeoState, opts: SetStateOptions = { history: "auto" }) {
    const prev = state;
    let next = updater(prev);
    if (next === prev) return;

    if (next.scene !== prev.scene) {
      const normalizedScene = options.normalizeScene(next.scene);
      if (normalizedScene !== next.scene) {
        next = { ...next, scene: normalizedScene };
      }
    }

    const mode = opts.history ?? "auto";
    const changed = hasHistoryDiff(prev, next);
    if (!isRestoringHistory && changed && mode !== "skip") {
      const snapshot = cloneHistorySnapshot(takeHistorySnapshot(prev));
      if (mode === "coalesce" && opts.actionKey && lastHistoryActionKey === opts.actionKey && undoStack.length > 0) {
        undoStack[undoStack.length - 1] = snapshot;
      } else {
        undoStack.push(snapshot);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
      }
      redoStack.length = 0;
      lastHistoryActionKey = opts.actionKey ?? null;
    } else if (mode !== "coalesce") {
      lastHistoryActionKey = null;
    }

    next = {
      ...next,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    };
    state = next;
    emit();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    getState: () => state,
    setState,
    subscribe,
    history: {
      undoStack,
      redoStack,
      getLastHistoryActionKey: () => lastHistoryActionKey,
      setLastHistoryActionKey: (key: string | null) => {
        lastHistoryActionKey = key;
      },
      getIsRestoringHistory: () => isRestoringHistory,
      setIsRestoringHistory: (value: boolean) => {
        isRestoringHistory = value;
      },
    },
  };
}
