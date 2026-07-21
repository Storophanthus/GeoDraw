import type { RefObject } from "react";
import type { Vec2 } from "../geo/vec2";
import type { PointShape, ScenePoint } from "../scene/points";
import { ColorSwatchInput } from "./ColorField";
import { formatRoundedDisplay } from "./displayFormat";
import { StyleSectionHeader } from "./StyleSectionHeader";

const SHAPES: PointShape[] = [
  "circle",
  "dot",
  "square",
  "diamond",
  "triUp",
  "triDown",
  "plus",
  "x",
  "cross",
];

type PointPropertiesSectionProps = {
  selectedPoint: ScenePoint;
  selectedPointWorld: Vec2 | null;
  selectedStyleAsDefault: boolean;
  onMakeStyleDefaultChange: (checked: boolean) => void;
  nameInput: string;
  setNameInput: (value: string) => void;
  renameError: string;
  setRenameError: (value: string) => void;
  applyRename: () => void;
  shapePickerOpen: boolean;
  setShapePickerOpen: (value: boolean | ((v: boolean) => boolean)) => void;
  shapePickerRef: RefObject<HTMLDivElement | null>;
  updateSelectedPointFields: (
    fields: Partial<Pick<ScenePoint, "captionTex" | "showLabel" | "locked" | "auxiliary">>
  ) => void;
  updateSelectedPointStyle: (style: Partial<ScenePoint["style"]>) => void;
  deleteSelectedObject: () => void;
  deleteLabel?: string;
  mode?: "object" | "toolDefault";
};

export function PointPropertiesSection({
  selectedPoint,
  selectedPointWorld,
  selectedStyleAsDefault,
  onMakeStyleDefaultChange,
  nameInput,
  setNameInput,
  renameError,
  setRenameError,
  applyRename,
  shapePickerOpen,
  setShapePickerOpen,
  shapePickerRef,
  updateSelectedPointFields,
  updateSelectedPointStyle,
  deleteSelectedObject,
  deleteLabel = "Delete",
  mode = "object",
}: PointPropertiesSectionProps) {
  return (
    <>
      {mode === "object" && (
        <div className="toolInfo">
          <div className="subSectionTitle">Point</div>
          <div className="detailRow">
            <span className="detailLabel">Position</span>
            <span>
              ({formatRoundedDisplay(selectedPointWorld?.x ?? 0, 3)}, {formatRoundedDisplay(selectedPointWorld?.y ?? 0, 3)})
            </span>
          </div>
        </div>
      )}

      {mode === "object" && (
        <div className="fieldBlock">
          <label className="fieldLabel">Name</label>
          <div className="renameRow">
            <input
              className="renameInput"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setRenameError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyRename();
                }
              }}
            />
            <button className="actionButton" onClick={applyRename}>
              Apply
            </button>
          </div>
        </div>
      )}

      <div className="propGrid">
        {mode === "object" && (
          <div className="propField">
            <label className="propFieldLabel">Caption (TeX)</label>
            <input
              className="renameInput"
              value={selectedPoint.captionTex}
              onChange={(e) => updateSelectedPointFields({ captionTex: e.target.value })}
            />
          </div>
        )}

        <div className={mode === "object" ? "propField" : "propField propFieldFull"}>
          <label className="propFieldLabel">Show Label</label>
          <select
            className="selectInput"
            value={selectedPoint.showLabel}
            onChange={(e) => updateSelectedPointFields({ showLabel: e.target.value as "none" | "name" | "caption" })}
          >
            <option value="none">None</option>
            <option value="name">Name</option>
            <option value="caption">Caption</option>
          </select>
        </div>

        {selectedPoint.showLabel !== "none" && (
          <>
            <div className="propField">
              <label className="propFieldLabel">Label Color</label>
              <ColorSwatchInput
                value={selectedPoint.style.labelColor}
                onChange={(e) => updateSelectedPointStyle({ labelColor: e.target.value })}
              />
            </div>

            <div className="propField">
              <label className="propFieldLabel">Halo Color</label>
              <ColorSwatchInput
                value={selectedPoint.style.labelHaloColor}
                onChange={(e) => updateSelectedPointStyle({ labelHaloColor: e.target.value })}
              />
            </div>
          </>
        )}

        {mode === "object" && (
          <div className="checkboxRowGroup propFieldFull">
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={Boolean(selectedPoint.locked)}
                onChange={(e) => updateSelectedPointFields({ locked: e.target.checked })}
              />
              Fix Object
            </label>

            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={Boolean(selectedPoint.auxiliary)}
                onChange={(e) => updateSelectedPointFields({ auxiliary: e.target.checked })}
              />
              Auxiliary Object
            </label>
          </div>
        )}
      </div>

      {mode === "object" && renameError && <div className="errorText">{renameError}</div>}

      <div className="cosmeticsBlock pointStyleBlock">
        <StyleSectionHeader
          title="Point Style"
          selectedStyleAsDefault={selectedStyleAsDefault}
          onMakeStyleDefaultChange={onMakeStyleDefaultChange}
          mode={mode}
        />

        <div className="propGrid">
          <div className="propField propFieldFull" ref={shapePickerRef}>
            <label className="propFieldLabel">Shape</label>
            <button className="shapeButton" onClick={() => setShapePickerOpen((v: boolean) => !v)} type="button">
              <ShapeGlyph shape={selectedPoint.style.shape} />
              <span>{selectedPoint.style.shape}</span>
            </button>
            {shapePickerOpen && (
              <div className="shapePopover">
                {SHAPES.map((shape: PointShape) => (
                  <button
                    key={shape}
                    className={shape === selectedPoint.style.shape ? "shapeCell active" : "shapeCell"}
                    onClick={() => {
                      updateSelectedPointStyle({ shape });
                      setShapePickerOpen(false);
                    }}
                    type="button"
                  >
                    <ShapeGlyph shape={shape} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="propField propFieldFull">
            <label className="propFieldLabel">Size</label>
            <div className="propSliderControl">
              <input
                className="sizeSlider"
                type="range"
                min={2}
                max={18}
                value={selectedPoint.style.sizePx}
                onChange={(e) => updateSelectedPointStyle({ sizePx: Number(e.target.value) })}
              />
              <input
                className="scaleInputCompact"
                type="number"
                min={2}
                max={18}
                step={1}
                value={selectedPoint.style.sizePx}
                onChange={(e) => updateSelectedPointStyle({ sizePx: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="propField">
            <label className="propFieldLabel">Stroke Color</label>
            <ColorSwatchInput
              value={selectedPoint.style.strokeColor}
              onChange={(e) => updateSelectedPointStyle({ strokeColor: e.target.value })}
            />
          </div>

          <div className="propField">
            <label className="propFieldLabel">Fill Color</label>
            <ColorSwatchInput
              value={selectedPoint.style.fillColor}
              onChange={(e) => updateSelectedPointStyle({ fillColor: e.target.value })}
            />
          </div>

          <div className="propField propFieldFull">
            <label className="propFieldLabel">Stroke Width</label>
            <div className="propSliderControl">
              <input
                className="sizeSlider"
                type="range"
                min={0.5}
                max={6}
                step={0.1}
                value={selectedPoint.style.strokeWidth}
                onChange={(e) => updateSelectedPointStyle({ strokeWidth: Number(e.target.value) })}
              />
              <input
                className="scaleInputCompact"
                type="number"
                min={0.5}
                max={6}
                step={0.1}
                value={selectedPoint.style.strokeWidth}
                onChange={(e) => updateSelectedPointStyle({ strokeWidth: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="propField propFieldFull">
            <label className="propFieldLabel">Stroke Opacity</label>
            <div className="propSliderControl">
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedPoint.style.strokeOpacity}
                onChange={(e) => updateSelectedPointStyle({ strokeOpacity: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="propField propFieldFull">
            <label className="propFieldLabel">Fill Opacity</label>
            <div className="propSliderControl">
              <input
                className="sizeSlider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedPoint.style.fillOpacity}
                onChange={(e) => updateSelectedPointStyle({ fillOpacity: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </div>

      {mode === "object" && (
        <button className="deleteButton" onClick={deleteSelectedObject}>
          {deleteLabel}
        </button>
      )}
    </>
  );
}

function ShapeGlyph({ shape }: { shape: PointShape }) {
  const cls = `shapeGlyph ${shape}`;
  if (shape === "circle") {
    return (
      <span
        className={cls}
        style={{
          display: "inline-block",
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          border: "2.2px solid currentColor",
          boxSizing: "border-box",
        }}
      />
    );
  }
  if (shape === "dot") {
    return (
      <span
        className={cls}
        style={{
          display: "inline-block",
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          backgroundColor: "currentColor",
        }}
      />
    );
  }
  if (shape === "x") return <span className={cls}>×</span>;
  if (shape === "plus") return <span className={cls}>+</span>;
  if (shape === "cross") return <span className={cls}>✚</span>;
  if (shape === "diamond") return <span className={cls}>◆</span>;
  if (shape === "square") return <span className={cls}>■</span>;
  if (shape === "triUp") return <span className={cls}>▲</span>;
  if (shape === "triDown") return <span className={cls}>▼</span>;
  return <span className={cls} />;
}
