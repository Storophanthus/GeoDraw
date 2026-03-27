import type { ActiveTool } from "../state/geoStore";

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
