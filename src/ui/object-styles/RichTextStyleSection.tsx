import { useEffect, useMemo, useState } from "react";
import type { SceneModel } from "../../scene/points";
import { parseRichTextSourceToDocument, serializeRichTextDocumentToSource } from "../../text-editor/richTextDocument";
import { ColorSwatchInput } from "../ColorField";
import { formatRoundedDisplay } from "../displayFormat";
import { StyleControlGroup, StyleControlTabbedGroups } from "../StyleControlGroup";
import { StyleSectionHeader } from "../StyleSectionHeader";

type RichTextNode = NonNullable<SceneModel["richTextNodes"]>[number];

type RichTextStyleSectionProps = {
  selectedRichText: RichTextNode;
  selectedStyleAsDefault: boolean;
  onMakeStyleDefaultChange: (checked: boolean) => void;
  updateSelectedRichTextFields: (
    patch: Partial<Pick<RichTextNode, "visible" | "name" | "positionWorld" | "boundsPx">>
  ) => void;
  updateSelectedRichTextStyle: (patch: Partial<RichTextNode["style"]>) => void;
  updateSelectedRichTextDocument: (document: RichTextNode["document"]) => void;
  deleteSelectedObject: () => void;
  deleteLabel?: string;
  mode?: "object" | "toolDefault";
};

export function RichTextStyleSection({
  selectedRichText,
  selectedStyleAsDefault,
  onMakeStyleDefaultChange,
  updateSelectedRichTextFields,
  updateSelectedRichTextStyle,
  updateSelectedRichTextDocument,
  deleteSelectedObject,
  deleteLabel = "Delete",
  mode = "object",
}: RichTextStyleSectionProps) {
  const serializedSource = useMemo(
    () => serializeRichTextDocumentToSource(selectedRichText.document),
    [selectedRichText.document]
  );
  const [sourceText, setSourceText] = useState(serializedSource);

  useEffect(() => {
    setSourceText(serializedSource);
  }, [serializedSource, selectedRichText.id]);

  return (
    <div className="toolInfo">
      <StyleSectionHeader
        title="Textbox"
        selectedStyleAsDefault={selectedStyleAsDefault}
        onMakeStyleDefaultChange={onMakeStyleDefaultChange}
        mode={mode}
      />
      <StyleControlTabbedGroups>
        {mode === "object" && (
          <StyleControlGroup title="Object">
            <div className="statusText">
              Position: ({formatRoundedDisplay(selectedRichText.positionWorld.x, 3)}, {formatRoundedDisplay(selectedRichText.positionWorld.y, 3)})
            </div>
            <div className="fieldBlock">
              <label className="fieldLabel">Name</label>
              <input
                className="renameInput"
                value={selectedRichText.name}
                onChange={(event) => updateSelectedRichTextFields({ name: event.target.value })}
              />
            </div>
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={selectedRichText.visible}
                onChange={(event) => updateSelectedRichTextFields({ visible: event.target.checked })}
              />
              Visible
            </label>
          </StyleControlGroup>
        )}

        {mode === "object" && (
          <StyleControlGroup title="Text">
            <div className="fieldBlock">
              <label className="fieldLabel">Text</label>
              <textarea
                className="renameInput textLabelTextareaInput"
                value={sourceText}
                rows={4}
                onChange={(event) => {
                  const next = event.target.value;
                  setSourceText(next);
                  updateSelectedRichTextDocument(parseRichTextSourceToDocument(next));
                }}
              />
            </div>
            <div className="statusText">
              Use <code>$...$</code> inline, <code>$$...$$</code> display.
            </div>
          </StyleControlGroup>
        )}

      <StyleControlGroup title="Style">
        <div className="controlRow">
          <label className="controlLabel">Text Color</label>
          <ColorSwatchInput
            value={selectedRichText.style.textColor}
            onChange={(event) => updateSelectedRichTextStyle({ textColor: event.target.value })}
          />
        </div>

        <label className="checkboxRow">
          <input
            type="checkbox"
            checked={Boolean(selectedRichText.style.labelGlow)}
            onChange={(event) => updateSelectedRichTextStyle({ labelGlow: event.target.checked })}
          />
          Label Glow
        </label>

        <div className="controlRow controlRowWithNumeric">
          <label className="controlLabel">Text Size</label>
          <input
            className="sizeSlider"
            type="range"
            min={8}
            max={96}
            step={1}
            value={selectedRichText.style.textSize}
            onChange={(event) => updateSelectedRichTextStyle({ textSize: Number(event.target.value) })}
          />
          <input
            className="scaleInputCompact"
            type="number"
            min={8}
            max={96}
            step={1}
            value={selectedRichText.style.textSize}
            onChange={(event) => updateSelectedRichTextStyle({ textSize: Number(event.target.value) })}
          />
        </div>

        <div className="controlRow controlRowWithNumeric">
          <label className="controlLabel">Rotation</label>
          <input
            className="sizeSlider"
            type="range"
            min={-180}
            max={180}
            step={1}
            value={selectedRichText.style.rotationDeg ?? 0}
            onChange={(event) => updateSelectedRichTextStyle({ rotationDeg: Number(event.target.value) })}
          />
          <input
            className="scaleInputCompact"
            type="number"
            min={-360}
            max={360}
            step={1}
            value={selectedRichText.style.rotationDeg ?? 0}
            onChange={(event) => updateSelectedRichTextStyle({ rotationDeg: Number(event.target.value) })}
          />
        </div>

        <div className="controlRow">
          <label className="controlLabel">Align</label>
          <select
            className="selectInput"
            value={selectedRichText.style.textAlign}
            onChange={(event) => {
              const nextAlign =
                event.target.value === "right" ? "right" : event.target.value === "center" ? "center" : "left";
              updateSelectedRichTextStyle({ textAlign: nextAlign });
            }}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </StyleControlGroup>
      </StyleControlTabbedGroups>

      {mode === "object" && (
        <button className="deleteButton" onClick={deleteSelectedObject}>
          {deleteLabel}
        </button>
      )}
    </div>
  );
}
