import type { ActiveTool } from "../state/geoStore";
import type { PointerEventHandler } from "react";
import { CanvasView } from "../view/CanvasView";
import { CommandBar } from "../CommandBar";
import { HistoryControls } from "./HistoryControls";
import { RightSidebar } from "./RightSidebar";
import { ToolPalette } from "./ToolPalette";

export type WorkspaceShellProps = {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  leftCollapsed: boolean;
  setLeftCollapsed: (collapsed: boolean) => void;
  leftWidth: number;
  rightCollapsed: boolean;
  setRightCollapsed: (collapsed: boolean) => void;
  rightWidth: number;
  collapsedWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onStartResizeLeft: PointerEventHandler<HTMLDivElement>;
  onStartResizeRight: PointerEventHandler<HTMLDivElement>;
};

export function WorkspaceShell({
  activeTool,
  onSelectTool,
  leftCollapsed,
  setLeftCollapsed,
  leftWidth,
  rightCollapsed,
  setRightCollapsed,
  rightWidth,
  collapsedWidth,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onStartResizeLeft,
  onStartResizeRight,
}: WorkspaceShellProps) {
  return (
    <div className="appShell">
      <ToolPalette
        activeTool={activeTool}
        onSelectTool={onSelectTool}
        leftCollapsed={leftCollapsed}
        setLeftCollapsed={setLeftCollapsed}
        leftWidth={leftWidth}
        collapsedWidth={collapsedWidth}
      />

      <div className="resizeHandle left" onPointerDown={onStartResizeLeft} />

      <main className="canvasPane">
        <div style={{ position: "absolute", inset: "0 0 64px 0" }}>
          <HistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
          <CanvasView />
        </div>
        <CommandBar />
      </main>

      <div className="resizeHandle right" onPointerDown={onStartResizeRight} />

      <RightSidebar
        rightCollapsed={rightCollapsed}
        setRightCollapsed={setRightCollapsed}
        rightWidth={rightWidth}
        collapsedWidth={collapsedWidth}
      />
    </div>
  );
}
