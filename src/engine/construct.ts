import type { Vec2 } from "../geo/vec2";
import { handleToolClick, type ToolClickHits, type ToolClickIO } from "../tools/toolClick";
import type { ActiveTool, PendingSelection } from "../state/slices/storeTypes";

export type ConstructInput = {
  screen: Vec2;
  activeTool: ActiveTool;
  pendingSelection: PendingSelection;
  hits: ToolClickHits;
  io: ToolClickIO;
};

// Headless construction entrypoint.
// It intentionally delegates to the existing deterministic tool state machine.
export function constructFromClick(input: ConstructInput): void {
  handleToolClick(input.screen, input.activeTool, input.pendingSelection, input.hits, input.io);
}
