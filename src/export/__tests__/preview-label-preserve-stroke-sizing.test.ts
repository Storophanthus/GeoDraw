import fixture from "../__fixtures__/preview-label-preserve-stroke-sizing.json";
import { buildTikzExportText, type TikzExportParams } from "../buildTikzExportText";
import type { SceneModel } from "../../scene/points";
import {
  applyPreviewLabelEdits,
  listPreviewLabelTargets,
  nudgePreviewLabel,
  resetPreviewLabel,
} from "../../ui/tikzPreviewLabels";
// @ts-ignore Existing compile harness is an untyped Node module.
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const captured: TikzExportParams = {
  ...fixture.previewParams,
  scene: fixture.scene as SceneModel,
  drawLayerBackend: "tkz",
  clipRectWorld: undefined,
  clipPolygonWorld: undefined,
};
const target = listPreviewLabelTargets(captured.scene).find((label) => label.id === "p_8")!;
assert(target, "Fixture must expose label I beside Ap.");

function drawingCommands(text: string): string {
  return text.split("\n").filter((line) =>
    /line width=|minimum size=|\\(?:tkzDef|tkzGet|tkzDraw|tkzInit|tkzClip|tkzSetUp|draw\[|begin\{|end\{|scalebox)/u.test(line)
  ).join("\n");
}

// Legacy captures can retain a Canvas dropdown with an absent effective mode.
// Replacing that mode during a label nudge caused the earlier reported jump.
assert(fixture.previewTreatment.mode === "canvas" && captured.figureTreatmentMode === undefined,
  "Reproduce distinct dropdown metadata and effective export calibration.");
assert(drawingCommands(buildTikzExportText(captured)) !== drawingCommands(buildTikzExportText({
  ...captured, figureTreatmentMode: "canvas",
})), "The fixture must distinguish the two stroke calibrations.");

for (const drawLayerBackend of ["tkz", "plain"] as const) {
  for (const efficient of [false, true]) {
    for (const figureTreatmentMode of [undefined, "canvas", "general", "veryCloseup"] as const) {
      const params: TikzExportParams = {
        ...captured, drawLayerBackend, efficient, figureTreatmentMode,
        bakeCoordinates: drawLayerBackend === "plain",
        figureTreatmentFactor: figureTreatmentMode === "veryCloseup" ? 2.5 : 1,
        // Display formatting may round these; nudges must keep their full values.
        globalScale: 1.0031415926,
        lineScale: 1.4031415926,
      };
      const before = buildTikzExportText(params);
      let edits = nudgePreviewLabel(params, target, { x: -1, y: 0 }, params.screenPxPerWorld);
      let current = applyPreviewLabelEdits(params, edits);
      for (let click = 1; click <= 2; click += 1) {
        const after = buildTikzExportText(current);
        assert(after !== before, "A joystick click must move the label.");
        assert(drawingCommands(after) === drawingCommands(before),
          `${drawLayerBackend}/${efficient}/${figureTreatmentMode}: label clicks must preserve every drawing command and width.`);
        assert(current.globalScale === params.globalScale && current.lineScale === params.lineScale,
          "Label clicks must not round captured sizing through the displayed fields.");
        assert(current.figureTreatmentMode === params.figureTreatmentMode,
          "Label clicks must preserve an absent effective mode as well as a named mode.");
        if (click === 1) {
          edits = nudgePreviewLabel(edits, target, { x: -1, y: 0 }, params.screenPxPerWorld);
          current = applyPreviewLabelEdits(current, edits);
        }
      }
      const restored = applyPreviewLabelEdits(current, resetPreviewLabel(edits, params, target));
      assert(buildTikzExportText(restored) === before, "Reset must restore the exact original export.");

      // The label state may carry stale full params. A sizing change followed
      // by another nudge must keep the newly selected sizing and calibration.
      const resized: TikzExportParams = { ...current, lineScale: 2.25, figureTreatmentMode: "general" };
      const moreEdits = nudgePreviewLabel(edits, target, { x: 0, y: -5 }, params.screenPxPerWorld);
      const afterResizing = applyPreviewLabelEdits(resized, moreEdits);
      assert(afterResizing.lineScale === 2.25 && afterResizing.figureTreatmentMode === "general",
        "Stale label-state metadata must not overwrite the current export settings.");
      assert(drawingCommands(buildTikzExportText(afterResizing)) === drawingCommands(buildTikzExportText(resized)),
        "Nudging after an intentional size change must preserve the new drawing style.");

      if (figureTreatmentMode === undefined) {
        await compileTikzSnippet(`preview-stroke-before-${drawLayerBackend}-${efficient}`, before);
        await compileTikzSnippet(`preview-stroke-after-${drawLayerBackend}-${efficient}`, buildTikzExportText(current));
      }
    }
  }
}

console.log("✓ Preview label nudges preserve captured stroke sizing and calibration");
