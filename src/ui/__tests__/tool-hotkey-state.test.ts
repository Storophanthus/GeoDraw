import { TOOL_KEY_SHORTCUTS, resolveRecentToolShortcut, shouldTrackRecentNonMoveTool } from "../toolHotkeyState.ts";

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

const shortcutKeys = Object.keys(TOOL_KEY_SHORTCUTS);
assert(shortcutKeys.length === 7, "expected exactly the 7 advertised tool shortcuts");
for (const key of shortcutKeys) {
  assert(/^[a-z]$/.test(key), `shortcut key "${key}" should be a single lowercase letter`);
}
assert(
  new Set(Object.values(TOOL_KEY_SHORTCUTS)).size === shortcutKeys.length,
  "each shortcut key should map to a distinct tool"
);

const expectedShortcuts: Record<string, string> = {
  v: "move",
  p: "point",
  s: "segment",
  l: "line2p",
  m: "midpoint",
  o: "circle_cp",
  c: "copyStyle",
};
for (const [key, tool] of Object.entries(expectedShortcuts)) {
  assert(TOOL_KEY_SHORTCUTS[key] === tool, `expected "${key}" to map to "${tool}"`);
}

// Reserved keys — already bound to other global hotkeys — must not be claimed here.
for (const reserved of ["f", "z", "y", "tab", "escape"]) {
  assert(!(reserved in TOOL_KEY_SHORTCUTS), `"${reserved}" is reserved by another global hotkey`);
}

console.log("tool-hotkey-state: ok");
