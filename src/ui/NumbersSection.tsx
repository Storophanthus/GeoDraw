import type { SceneModel } from "../scene/points";

type NumbersSectionProps = {
  newNumberValue: string;
  setNewNumberValue: (next: string) => void;
  newNumberExpr: string;
  setNewNumberExpr: (next: string) => void;
  ratioNumeratorId: string;
  setRatioNumeratorId: (next: string) => void;
  ratioDenominatorId: string;
  setRatioDenominatorId: (next: string) => void;
  numbers: SceneModel["numbers"];
  selectedSegmentId: string | null;
  selectedCircleId: string | null;
  selectedAngleId: string | null;
  createNumber: (def:
    | { kind: "constant"; value: number }
    | { kind: "segmentLength"; segId: string }
    | { kind: "circleRadius"; circleId: string }
    | { kind: "circleArea"; circleId: string }
    | { kind: "angleDegrees"; angleId: string }
    | { kind: "expression"; expr: string }
    | { kind: "ratio"; numeratorId: string; denominatorId: string }) => string | null;
};

export function NumbersSection({
  newNumberValue,
  setNewNumberValue,
  newNumberExpr,
  setNewNumberExpr,
  ratioNumeratorId,
  setRatioNumeratorId,
  ratioDenominatorId,
  setRatioDenominatorId,
  numbers,
  selectedSegmentId,
  selectedCircleId,
  selectedAngleId,
  createNumber,
}: NumbersSectionProps) {
  return (
    <div className="toolInfo">
      <div className="subSectionTitle">Numbers</div>
      <div className="controlRow">
        <label className="controlLabel">Constant</label>
        <input
          className="renameInput"
          type="text"
          value={newNumberValue}
          onChange={(e) => setNewNumberValue(e.target.value)}
          placeholder="e.g. 2.5"
        />
      </div>
      <div className="actionsRow">
        <button
          className="actionButton secondary"
          onClick={() => {
            const v = Number(newNumberValue);
            if (!Number.isFinite(v)) return;
            createNumber({ kind: "constant", value: v });
          }}
        >
          Add Constant
        </button>
        {selectedSegmentId && (
          <button className="actionButton secondary" onClick={() => createNumber({ kind: "segmentLength", segId: selectedSegmentId })}>
            Store Length
          </button>
        )}
        {selectedCircleId && (
          <button className="actionButton secondary" onClick={() => createNumber({ kind: "circleRadius", circleId: selectedCircleId })}>
            Store Radius
          </button>
        )}
        {selectedCircleId && (
          <button className="actionButton secondary" onClick={() => createNumber({ kind: "circleArea", circleId: selectedCircleId })}>
            Store Area
          </button>
        )}
        {selectedAngleId && (
          <button className="actionButton secondary" onClick={() => createNumber({ kind: "angleDegrees", angleId: selectedAngleId })}>
            Store Angle
          </button>
        )}
      </div>
      <div className="controlRow">
        <label className="controlLabel">Formula</label>
        <input
          className="renameInput"
          type="text"
          value={newNumberExpr}
          onChange={(e) => setNewNumberExpr(e.target.value)}
          placeholder="e.g. n_1+n_2^2"
        />
      </div>
      <div className="actionsRow">
        <button
          className="actionButton secondary"
          onClick={() => {
            const expr = newNumberExpr.trim();
            if (!expr) return;
            createNumber({ kind: "expression", expr });
          }}
        >
          Add Formula
        </button>
      </div>
      {numbers.length >= 2 && (
        <>
          <div className="controlRow">
            <label className="controlLabel">Ratio Num</label>
            <select className="selectInput" value={ratioNumeratorId} onChange={(e) => setRatioNumeratorId(e.target.value)}>
              {numbers.map((num) => (
                <option key={num.id} value={num.id}>
                  {num.name}
                </option>
              ))}
            </select>
          </div>
          <div className="controlRow">
            <label className="controlLabel">Ratio Den</label>
            <select className="selectInput" value={ratioDenominatorId} onChange={(e) => setRatioDenominatorId(e.target.value)}>
              {numbers.map((num) => (
                <option key={num.id} value={num.id}>
                  {num.name}
                </option>
              ))}
            </select>
          </div>
          <div className="actionsRow">
            <button
              className="actionButton secondary"
              onClick={() => {
                if (!ratioNumeratorId || !ratioDenominatorId || ratioNumeratorId === ratioDenominatorId) return;
                createNumber({
                  kind: "ratio",
                  numeratorId: ratioNumeratorId,
                  denominatorId: ratioDenominatorId,
                });
              }}
            >
              Add Ratio
            </button>
          </div>
        </>
      )}
    </div>
  );
}
