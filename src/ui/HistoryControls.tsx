import { Redo2, Undo2 } from "lucide-react";

type HistoryControlsProps = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function HistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
    </div>
  );
}
