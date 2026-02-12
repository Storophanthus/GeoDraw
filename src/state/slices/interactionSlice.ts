import type { Vec2 } from "../../geo/vec2";
import type { HoveredHit, PendingSelection, SelectedObject } from "./storeTypes";

export type InteractionSliceState = {
  selectedObject: SelectedObject;
  recentCreatedObject: SelectedObject;
  hoveredHit: HoveredHit;
  cursorWorld: Vec2 | null;
  pendingSelection: PendingSelection;
};

export function createInteractionSliceState(): InteractionSliceState {
  return {
    selectedObject: null,
    recentCreatedObject: null,
    hoveredHit: null,
    cursorWorld: null,
    pendingSelection: null,
  };
}
