import { shouldCancelOnCanvasDoubleClick } from "../pointerInteraction";
import type { PendingSelection } from "../../state/slices/storeTypes";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const pendingPolygon: PendingSelection = {
  tool: "polygon",
  step: 2,
  points: [{ type: "point", id: "p1" }],
};

const pendingExportPolygon: PendingSelection = {
  tool: "export_clip",
  step: 2,
  points: [{ type: "world", world: { x: 0, y: 0 } }],
};

const pendingSegment: PendingSelection = {
  tool: "segment",
  step: 2,
  first: { type: "point", id: "pA" },
};

assert(shouldCancelOnCanvasDoubleClick("move", null), "Move tool should cancel selection on double click.");
assert(!shouldCancelOnCanvasDoubleClick("segment", null), "Non-move tools without pending state should not cancel on double click.");
assert(shouldCancelOnCanvasDoubleClick("polygon", pendingPolygon), "Pending polygon workflow should cancel on double click.");
assert(shouldCancelOnCanvasDoubleClick("export_clip", pendingExportPolygon), "Pending polygon clip should cancel on double click.");
assert(!shouldCancelOnCanvasDoubleClick("segment", pendingSegment), "Pending segment workflow should not cancel on double click.");

console.log("pointer-interaction-double-click: ok");
