import type { ActiveTool } from "../state/geoStore";
import { useState, type CSSProperties, type PointerEventHandler } from "react";
import { CanvasView } from "../view/CanvasView";
import { CommandBar } from "../CommandBar";
import { DocumentTabs } from "./DocumentTabs";
import { FileControls } from "./FileControls";
import { HistoryControls } from "./HistoryControls";
import { RightSidebar } from "./RightSidebar";
import { ToolPalette } from "./ToolPalette";
import { UpdateChecker } from "./UpdateChecker";
import type { DocumentFilePatch, DocumentFileState, GeoDocumentTab } from "./useDocumentTabs";
import type { HistorySnapshot } from "../state/slices/historySlice";

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
  uiCssVariables?: CSSProperties;
  documents: GeoDocumentTab[];
  activeDocumentId: string;
  activeDocumentFile: DocumentFileState;
  onCreateDocument: () => void;
  onSelectDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onRenameDocument: (id: string, title: string) => void;
  onUpdateActiveDocumentFile: (patch: DocumentFilePatch) => void;
  onOpenSnapshotAsDocument: (snapshot: HistorySnapshot, file?: DocumentFilePatch) => void;
  onBuildActiveSnapshotJson: () => string;
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
  uiCssVariables,
  documents,
  activeDocumentId,
  activeDocumentFile,
  onCreateDocument,
  onSelectDocument,
  onCloseDocument,
  onRenameDocument,
  onUpdateActiveDocumentFile,
  onOpenSnapshotAsDocument,
  onBuildActiveSnapshotJson,
}: WorkspaceShellProps) {
  const [leftFlyoutOpen, setLeftFlyoutOpen] = useState(false);

  return (
    <div className="appShell" style={uiCssVariables}>
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
        <DocumentTabs
          documents={documents}
          activeDocumentId={activeDocumentId}
          onCreateDocument={onCreateDocument}
          onSelectDocument={onSelectDocument}
          onCloseDocument={onCloseDocument}
          onRenameDocument={onRenameDocument}
        />
        <div className="canvasDocumentArea">
          <FileControls
            activeFile={activeDocumentFile}
            updateActiveDocumentFile={onUpdateActiveDocumentFile}
            openSnapshotAsDocument={onOpenSnapshotAsDocument}
            buildActiveSnapshotJson={onBuildActiveSnapshotJson}
          />
          <HistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onFitView={onFitView} />
          <UpdateChecker />
          <CanvasView openSnapshotAsDocument={onOpenSnapshotAsDocument} />
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
