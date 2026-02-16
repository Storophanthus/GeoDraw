import type { ActiveTool } from "../state/geoStore";
import { useState, type PointerEventHandler } from "react";
import { CanvasView } from "../view/CanvasView";
import { CommandBar } from "../CommandBar";
import { FileControls } from "./FileControls";
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
  onFitView: () => void;
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
  onFitView,
  onStartResizeLeft,
  onStartResizeRight,
}: WorkspaceShellProps) {
  const [leftFlyoutOpen, setLeftFlyoutOpen] = useState(false);

  return (
    <div className="appShell">
      <ToolPalette
        activeTool={activeTool}
        onSelectTool={onSelectTool}
        leftCollapsed={leftCollapsed}
        setLeftCollapsed={setLeftCollapsed}
        leftWidth={leftWidth}
        collapsedWidth={collapsedWidth}
        onFlyoutVisibilityChange={setLeftFlyoutOpen}
      />

      <div
        className={leftFlyoutOpen ? "resizeHandle left disabled" : "resizeHandle left"}
        onPointerDown={leftFlyoutOpen ? undefined : onStartResizeLeft}
      />

      <main className="canvasPane">
        <div style={{ position: "absolute", inset: "0 0 64px 0" }}>
          <FileControls />
          <HistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onFitView={onFitView} />
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
