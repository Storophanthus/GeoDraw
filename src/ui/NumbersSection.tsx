type NumbersSectionProps = {
  newNumberValue: string;
  setNewNumberValue: (next: string) => void;
  newSliderMin: string;
  setNewSliderMin: (next: string) => void;
  newSliderMax: string;
  setNewSliderMax: (next: string) => void;
  newSliderStep: string;
  setNewSliderStep: (next: string) => void;
  newSliderMode: "real" | "degree";
  setNewSliderMode: (next: "real" | "degree") => void;
  selectedSegmentId: string | null;
  selectedCircleId: string | null;
  selectedAngleId: string | null;
  createNumber: (def:
    | { kind: "constant"; value: number }
    | { kind: "slider"; value: number; min: number; max: number; step: number; sliderMode?: "real" | "degree" | "radian" }
    | { kind: "segmentLength"; segId: string }
    | { kind: "circleRadius"; circleId: string }
    | { kind: "circleArea"; circleId: string }
    | { kind: "angleDegrees"; angleId: string }) => string | null;
};

export function NumbersSection({
  newNumberValue,
  setNewNumberValue,
  newSliderMin,
  setNewSliderMin,
  newSliderMax,
  setNewSliderMax,
  newSliderStep,
  setNewSliderStep,
  newSliderMode,
  setNewSliderMode,
  selectedSegmentId,
  selectedCircleId,
  selectedAngleId,
  createNumber,
}: NumbersSectionProps) {
  return (
    <div className="toolInfo" style={{ marginTop: 16 }}>
      <div className="subSectionTitle">Numbers</div>
      <div className="controlRow">
        <label className="controlLabel">Slider Value</label>
        <input
          className="renameInput"
          type="text"
          value={newNumberValue}
          onChange={(e) => setNewNumberValue(e.target.value)}
          placeholder="e.g. 1"
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Slider Type</label>
        <select
          className="selectInput"
          value={newSliderMode}
          onChange={(e) => setNewSliderMode(e.target.value === "degree" ? "degree" : "real")}
        >
          <option value="real">Real</option>
          <option value="degree">Degree</option>
        </select>
      </div>
      <div className="controlRow">
        <label className="controlLabel">Min</label>
        <input
          className="renameInput"
          type="text"
          value={newSliderMin}
          onChange={(e) => setNewSliderMin(e.target.value)}
          placeholder={newSliderMode === "degree" ? "0" : "0"}
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Max</label>
        <input
          className="renameInput"
          type="text"
          value={newSliderMax}
          onChange={(e) => setNewSliderMax(e.target.value)}
          placeholder={newSliderMode === "degree" ? "360" : "10"}
        />
      </div>
      <div className="controlRow">
        <label className="controlLabel">Step</label>
        <input
          className="renameInput"
          type="text"
          value={newSliderStep}
          onChange={(e) => setNewSliderStep(e.target.value)}
          placeholder={newSliderMode === "degree" ? "1" : "0.1"}
        />
      </div>
      <div className="actionsRow">
        <button
          className="actionButton secondary"
          onClick={() => {
            const value = Number(newNumberValue);
            const min = Number(newSliderMin);
            const max = Number(newSliderMax);
            const step = Number(newSliderStep);
            if (![value, min, max, step].every(Number.isFinite)) return;
            if (!(step > 0)) return;
            const lo = Math.min(min, max);
            const hi = Math.max(min, max);
            createNumber({
              kind: "slider",
              value: Math.min(hi, Math.max(lo, value)),
              min: lo,
              max: hi,
              step,
              sliderMode: newSliderMode,
            });
          }}
        >
          Add Slider
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
    </div>
  );
}
