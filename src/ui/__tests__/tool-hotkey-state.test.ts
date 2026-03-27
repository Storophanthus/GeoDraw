import { resolveRecentToolShortcut, shouldTrackRecentNonMoveTool } from "../toolHotkeyState.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(!shouldTrackRecentNonMoveTool("move"), "move should not become the remembered non-select tool");
assert(!shouldTrackRecentNonMoveTool("copyStyle"), "copyStyle should not become the remembered non-select tool");
assert(shouldTrackRecentNonMoveTool("segment"), "segment should be tracked as the last non-select tool");

assert(resolveRecentToolShortcut("move", "segment") === "segment", "move should jump back to the last drawing tool");
assert(resolveRecentToolShortcut("segment", "line2p") === "move", "non-move tools should toggle back to move");
assert(resolveRecentToolShortcut("move", null) === null, "move should do nothing when there is no remembered tool");
assert(resolveRecentToolShortcut("move", "copyStyle") === null, "copyStyle should never be recalled as the recent tool");

console.log("tool-hotkey-state: ok");
