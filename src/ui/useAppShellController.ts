import { useState } from "react";
import { useGeoStore } from "../state/geoStore";
import { useGlobalCanvasHotkeys } from "./useGlobalCanvasHotkeys";
import { useSidebarResize } from "./useSidebarResize";
import type { WorkspaceShellProps } from "./WorkspaceShell";

const LEFT_MIN = 86;
const LEFT_MAX = 240;
const RIGHT_MIN = 240;
const RIGHT_MAX = 560;
const COLLAPSED_W = 40;

export function useAppShellController(): WorkspaceShellProps {
  const activeTool = useGeoStore((store) => store.activeTool);
  const setActiveTool = useGeoStore((store) => store.setActiveTool);
  const deleteSelectedObject = useGeoStore((store) => store.deleteSelectedObject);
  const clearCopyStyle = useGeoStore((store) => store.clearCopyStyle);
  const undo = useGeoStore((store) => store.undo);
  const redo = useGeoStore((store) => store.redo);
  const canUndo = useGeoStore((store) => store.canUndo);
  const canRedo = useGeoStore((store) => store.canRedo);
  const fitViewToScene = useGeoStore((store) => store.fitViewToScene);

  const [leftWidth, setLeftWidth] = useState(96);
  const [rightWidth, setRightWidth] = useState(312);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const doFitView = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".drawingCanvas");
    const rect = canvas?.getBoundingClientRect();
    const widthPx = rect?.width && rect.width > 1 ? rect.width : window.innerWidth;
    const heightPx = rect?.height && rect.height > 1 ? rect.height : window.innerHeight;
    fitViewToScene({ widthPx, heightPx });
  };

  useGlobalCanvasHotkeys({
    activeTool,
    onSetMoveTool: () => setActiveTool("move"),
    onClearCopyStyle: clearCopyStyle,
    onDeleteSelectedObject: deleteSelectedObject,
    onUndo: undo,
    onRedo: redo,
    onFitView: doFitView,
  });

  const { startResize } = useSidebarResize({
    leftCollapsed,
    rightCollapsed,
    leftWidth,
    rightWidth,
    setLeftWidth,
    setRightWidth,
    leftMin: LEFT_MIN,
    leftMax: LEFT_MAX,
    rightMin: RIGHT_MIN,
    rightMax: RIGHT_MAX,
  });

  return {
    activeTool,
    onSelectTool: setActiveTool,
    leftCollapsed,
    setLeftCollapsed,
    leftWidth,
    rightCollapsed,
    setRightCollapsed,
    rightWidth,
    collapsedWidth: COLLAPSED_W,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    onFitView: doFitView,
    onStartResizeLeft: startResize("left"),
    onStartResizeRight: startResize("right"),
  };
}
