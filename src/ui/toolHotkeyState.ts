import type { ActiveTool } from "../state/geoStore";

export const TOOL_KEY_SHORTCUTS: Readonly<Record<string, ActiveTool>> = {
  v: "move",
  p: "point",
  s: "segment",
  l: "line2p",
  m: "midpoint",
  o: "circle_cp",
  c: "copyStyle",
};

export function shouldTrackRecentNonMoveTool(tool: ActiveTool): boolean {
  return tool !== "move" && tool !== "copyStyle";
}

export function resolveRecentToolShortcut(
  activeTool: ActiveTool,
  recentNonMoveTool: ActiveTool | null
): ActiveTool | null {
  if (activeTool === "move") {
    return recentNonMoveTool && shouldTrackRecentNonMoveTool(recentNonMoveTool) ? recentNonMoveTool : null;
  }
  return "move";
}
