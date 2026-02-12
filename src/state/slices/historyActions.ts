import {
  cloneHistorySnapshot,
  MAX_HISTORY,
  takeHistorySnapshot,
  type HistorySnapshot,
  type SetStateOptions,
} from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type HistoryActionsContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  getLastHistoryActionKey: () => string | null;
  setLastHistoryActionKey: (key: string | null) => void;
  getIsRestoringHistory: () => boolean;
  setIsRestoringHistory: (value: boolean) => void;
  restoreFromSnapshot: (prev: GeoState, snapshot: HistorySnapshot) => GeoState;
};

export function createHistoryActions(ctx: HistoryActionsContext): Pick<GeoActions, "undo" | "redo"> {
  return {
    undo() {
      if (ctx.undoStack.length === 0) return;
      ctx.setState(
        (prev) => {
          const snapshot = ctx.undoStack.pop();
          if (!snapshot) return prev;
          ctx.redoStack.push(cloneHistorySnapshot(takeHistorySnapshot(prev)));
          if (ctx.redoStack.length > MAX_HISTORY) ctx.redoStack.shift();
          ctx.setLastHistoryActionKey(null);
          ctx.setIsRestoringHistory(true);
          const restored = ctx.restoreFromSnapshot(prev, snapshot);
          ctx.setIsRestoringHistory(false);
          return restored;
        },
        { history: "skip" }
      );
    },

    redo() {
      if (ctx.redoStack.length === 0) return;
      ctx.setState(
        (prev) => {
          const snapshot = ctx.redoStack.pop();
          if (!snapshot) return prev;
          ctx.undoStack.push(cloneHistorySnapshot(takeHistorySnapshot(prev)));
          if (ctx.undoStack.length > MAX_HISTORY) ctx.undoStack.shift();
          ctx.setLastHistoryActionKey(null);
          ctx.setIsRestoringHistory(true);
          const restored = ctx.restoreFromSnapshot(prev, snapshot);
          ctx.setIsRestoringHistory(false);
          return restored;
        },
        { history: "skip" }
      );
    },
  };
}
