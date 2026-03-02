import type { RefObject } from "react";
import type { Vec2 } from "../geo/vec2";
import type { PointShape, ScenePoint } from "../scene/points";
import { formatRoundedDisplay } from "./displayFormat";

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
}: PointPropertiesSectionProps) {
  return (
    <>
      <div className="toolInfo">
        <div className="subSectionTitle">Point</div>
        <div className="detailRow">
          <span className="detailLabel">Position</span>
          <span>
            ({formatRoundedDisplay(selectedPointWorld?.x ?? 0, 3)}, {formatRoundedDisplay(selectedPointWorld?.y ?? 0, 3)})
          </span>
        </div>
      </div>

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

      <div className="fieldBlock">
        <label className="fieldLabel">Caption (TeX)</label>
        <input
          className="renameInput"
          value={selectedPoint.captionTex}
          onChange={(e) => updateSelectedPointFields({ captionTex: e.target.value })}
        />
      </div>

      <div className="fieldBlock">
        <label className="fieldLabel">Show Label</label>
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

      {renameError && <div className="errorText">{renameError}</div>}

      <div className="cosmeticsBlock">
        <label className="checkboxRow" style={{ marginTop: 0 }}>
          <input
            type="checkbox"
            checked={selectedStyleAsDefault}
            onChange={(e) => onMakeStyleDefaultChange(e.target.checked)}
          />
          Make this default for this object
        </label>
        <div className="subSectionTitle">Point Style</div>

        <div className="fieldBlock" ref={shapePickerRef}>
          <label className="fieldLabel">Shape</label>
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

        <div className="controlRow controlRowWithNumeric">
          <label className="controlLabel">Size</label>
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

        <div className="controlRow">
          <label className="controlLabel">Stroke Color</label>
          <input
            className="colorInput"
            type="color"
            value={selectedPoint.style.strokeColor}
            onChange={(e) => updateSelectedPointStyle({ strokeColor: e.target.value })}
          />
        </div>

        <div className="controlRow controlRowWithNumeric">
          <label className="controlLabel">Stroke Width</label>
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

        <div className="controlRow">
          <label className="controlLabel">Stroke Opacity</label>
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

        <div className="controlRow">
          <label className="controlLabel">Fill Color</label>
          <input
            className="colorInput"
            type="color"
            value={selectedPoint.style.fillColor}
            onChange={(e) => updateSelectedPointStyle({ fillColor: e.target.value })}
          />
        </div>

        <div className="controlRow">
          <label className="controlLabel">Fill Opacity</label>
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

      <button className="deleteButton" onClick={deleteSelectedObject}>
        Delete
      </button>
    </>
  );
}

function ShapeGlyph({ shape }: { shape: PointShape }) {
  const cls = `shapeGlyph ${shape}`;
  if (shape === "circle") return <span className={cls} style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", border: "2px solid currentColor", boxSizing: "border-box" }} />;
  if (shape === "dot") return <span className={cls} style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "currentColor" }} />;
  if (shape === "x") return <span className={cls}>×</span>;
  if (shape === "plus") return <span className={cls}>+</span>;
  if (shape === "cross") return <span className={cls}>✚</span>;
  if (shape === "diamond") return <span className={cls}>◆</span>;
  if (shape === "square") return <span className={cls}>■</span>;
  if (shape === "triUp") return <span className={cls}>▲</span>;
  if (shape === "triDown") return <span className={cls}>▼</span>;
  return <span className={cls} />;
}
