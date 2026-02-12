import type { NumberExpressionEvalResult } from "../scene/points";
import type { ActiveTool, PendingSelection } from "../state/slices/storeTypes";

type AnglePreview = { ok: true; valueDeg: number } | { ok: false; error: string };

type ToolInfoSectionProps = {
  activeTool: ActiveTool;
  copyStyleHasSource: boolean;
  angleFixedExpr: string;
  angleFixedDirection: "CCW" | "CW";
  setAngleFixedTool: (next: { angleExpr?: string; direction?: "CCW" | "CW" }) => void;
  angleFixedPreview: AnglePreview;
  circleFixedRadius: string;
  setCircleFixedTool: (next: { radius?: string }) => void;
  circleFixedPreview: NumberExpressionEvalResult;
  pendingSelection: PendingSelection;
  pendingCircleFixedCenterLabel: string | null;
  createCircleFixedRadius: (centerId: string, radiusExpr: string) => string | null;
  clearPendingSelection: () => void;
};

export function ToolInfoSection({
  activeTool,
  copyStyleHasSource,
  angleFixedExpr,
  angleFixedDirection,
  setAngleFixedTool,
  angleFixedPreview,
  circleFixedRadius,
  setCircleFixedTool,
  circleFixedPreview,
  pendingSelection,
  pendingCircleFixedCenterLabel,
  createCircleFixedRadius,
  clearPendingSelection,
}: ToolInfoSectionProps) {
  const isCircleFixedPending = pendingSelection && pendingSelection.tool === "circle_fixed";

  return (
    <>
      {activeTool === "copyStyle" && (
        <div className="toolInfo">
          {copyStyleHasSource
            ? "Copy Style: click targets to apply (Shift-click to change source)"
            : "Copy Style: click an object to pick source (Shift-click anytime to change source)"}
        </div>
      )}
      {activeTool === "angle_fixed" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Fixed Angle Tool</div>
          <div className="controlRow">
            <label className="controlLabel">Angle Expr (deg)</label>
            <input
              className="renameInput"
              type="text"
              value={angleFixedExpr}
              onChange={(e) => setAngleFixedTool({ angleExpr: e.target.value })}
              placeholder="e.g. 30, 2*gamma, (ABC+15)/2"
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Direction</label>
            <select
              className="selectInput"
              value={angleFixedDirection}
              onChange={(e) => setAngleFixedTool({ direction: e.target.value as "CCW" | "CW" })}
            >
              <option value="CCW">CCW</option>
              <option value="CW">CW</option>
            </select>
          </div>
          <div className="statusText">
            {angleFixedPreview.ok ? `Resolved: ${angleFixedPreview.valueDeg.toFixed(3)}°` : angleFixedPreview.error}
          </div>
          <div className="statusText">Click A (base point), then B (vertex), then click to confirm.</div>
        </div>
      )}
      {activeTool === "circle_fixed" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Circle with Fixed Radius</div>
          <div className="controlRow">
            <label className="controlLabel">Radius</label>
            <input
              className="renameInput"
              type="text"
              value={circleFixedRadius}
              onChange={(e) => setCircleFixedTool({ radius: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (!pendingSelection || pendingSelection.tool !== "circle_fixed") return;
                const created = createCircleFixedRadius(pendingSelection.first.id, circleFixedRadius);
                if (created) clearPendingSelection();
              }}
              placeholder="e.g. 3.5 or r_1/2"
            />
          </div>
          <div className="actionsRow">
            <button
              className="actionButton secondary"
              disabled={
                !isCircleFixedPending ||
                !circleFixedPreview.ok ||
                !Number.isFinite(circleFixedPreview.value) ||
                circleFixedPreview.value <= 0
              }
              onClick={() => {
                if (!pendingSelection || pendingSelection.tool !== "circle_fixed") return;
                const created = createCircleFixedRadius(pendingSelection.first.id, circleFixedRadius);
                if (created) clearPendingSelection();
              }}
            >
              Create
            </button>
          </div>
          <div className="statusText">
            {isCircleFixedPending
              ? `Center selected: ${pendingCircleFixedCenterLabel ?? pendingSelection.first.id}`
              : "Click center point first."}
          </div>
          <div className="statusText">
            {circleFixedPreview.ok && Number.isFinite(circleFixedPreview.value) && circleFixedPreview.value > 0
              ? `Resolved: r = ${circleFixedPreview.value.toFixed(6)}`
              : "Radius must be > 0 (supports expressions like r_1/2)"}
          </div>
        </div>
      )}
    </>
  );
}
