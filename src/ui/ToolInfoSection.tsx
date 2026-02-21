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
  regularPolygonSides: number;
  regularPolygonDirection: "CCW" | "CW";
  setRegularPolygonTool: (next: { sides?: number; direction?: "CCW" | "CW" }) => void;
  transformFactorExpr: string;
  setTransformTool: (next: { factorExpr?: string }) => void;
  transformFactorPreview: NumberExpressionEvalResult;
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
  regularPolygonSides,
  regularPolygonDirection,
  setRegularPolygonTool,
  transformFactorExpr,
  setTransformTool,
  transformFactorPreview,
  pendingSelection,
  pendingCircleFixedCenterLabel,
  createCircleFixedRadius,
  clearPendingSelection,
}: ToolInfoSectionProps) {
  const isCircleFixedPending = pendingSelection && pendingSelection.tool === "circle_fixed";
  const translatePending = pendingSelection && pendingSelection.tool === "translate" ? pendingSelection : null;
  const reflectPending = pendingSelection && pendingSelection.tool === "reflect" ? pendingSelection : null;
  const dilatePending = pendingSelection && pendingSelection.tool === "dilate" ? pendingSelection : null;

  return (
    <>
      {activeTool === "copyStyle" && (
        <div className="toolInfo">
          {copyStyleHasSource
            ? "Copy Style: click targets to apply (Shift-click to change source)"
            : "Copy Style: click an object to pick source (Shift-click anytime to change source)"}
        </div>
      )}
      {activeTool === "label" && (
        <div className="toolInfo">
          Label: click object to show/select label, then drag label anchor to reposition.
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
      {activeTool === "regular_polygon" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Regular Polygon</div>
          <div className="controlRow">
            <label className="controlLabel">Sides</label>
            <input
              className="renameInput"
              type="number"
              min={3}
              max={64}
              step={1}
              value={regularPolygonSides}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(parsed)) return;
                setRegularPolygonTool({ sides: Math.max(3, Math.min(64, parsed)) });
              }}
            />
          </div>
          <div className="controlRow">
            <label className="controlLabel">Direction</label>
            <select
              className="selectInput"
              value={regularPolygonDirection}
              onChange={(e) => setRegularPolygonTool({ direction: e.target.value as "CCW" | "CW" })}
            >
              <option value="CCW">CCW</option>
              <option value="CW">CW</option>
            </select>
          </div>
          <div className="statusText">Click first vertex, then second vertex (first side).</div>
        </div>
      )}
      {activeTool === "translate" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Translate Object</div>
          <div className="statusText">
            {!translatePending
              ? "Step 1: click source object."
              : translatePending.step === 2
                ? "Step 2: click vector start point A."
                : "Step 3: click vector end point B."}
          </div>
        </div>
      )}
      {activeTool === "reflect" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Reflect Object</div>
          <div className="statusText">
            {!reflectPending
              ? "Step 1: click source object."
              : "Step 2: click axis line or segment."}
          </div>
        </div>
      )}
      {activeTool === "dilate" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Dilate Object</div>
          <div className="controlRow">
            <label className="controlLabel">Factor Expr</label>
            <input
              className="renameInput"
              type="text"
              value={transformFactorExpr}
              onChange={(e) => setTransformTool({ factorExpr: e.target.value })}
              placeholder="e.g. 2, 1/3, k_1"
            />
          </div>
          <div className="statusText">
            {transformFactorPreview.ok && Number.isFinite(transformFactorPreview.value)
              ? `Resolved: k = ${transformFactorPreview.value.toFixed(6)}`
              : "Factor must resolve to a finite number."}
          </div>
          <div className="statusText">
            {!dilatePending
              ? "Step 1: click source object."
              : "Step 2: click center point O."}
          </div>
        </div>
      )}
      {activeTool === "export_clip" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Export Clip Polygon</div>
          <div className="statusText">Click vertices, then click near the first vertex to close the clip path.</div>
        </div>
      )}
      {activeTool === "export_clip_rect" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Export Clip Rectangle</div>
          <div className="statusText">Click first corner, then second corner to set TikZ clip rectangle.</div>
        </div>
      )}
    </>
  );
}
