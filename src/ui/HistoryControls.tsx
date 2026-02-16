import { Redo2, Undo2 } from "lucide-react";
import { IconFitView } from "./icons";

type HistoryControlsProps = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
};

export function HistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFitView,
}: HistoryControlsProps) {
  return (
    <div className="canvasTopActions" aria-label="History controls">
      <button
        className="iconActionButton"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        aria-label="Undo"
      >
        <Undo2 size={16} />
      </button>
      <button
        className="iconActionButton"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Shift+Ctrl/Cmd+Z or Ctrl/Cmd+Y)"
        aria-label="Redo"
      >
        <Redo2 size={16} />
      </button>
      <button
        className="iconActionButton"
        onClick={onFitView}
        title="Fit View"
        aria-label="Fit view"
      >
        <IconFitView size={16} />
      </button>
    </div>
  );
}
