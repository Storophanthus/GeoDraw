import fixture from "../__fixtures__/preview-scale-preserve-line-weight.json";
import { buildTikzExportText, type TikzExportParams } from "../buildTikzExportText";
import { applyFigureTreatment, resolveSavedFigureTreatment, type FigureTreatmentMode } from "../figureTreatment";
import type { SceneModel } from "../../scene/points";
import { applyPreviewSizingEdits, getCanvasCaptureFigureSizing, getPreviewTreatmentSelection } from "../../ui/tikzPreviewSizing";
import { mergePreviewTikzCode } from "../../ui/tikzPreviewCodeEdits";
// @ts-ignore Existing compile harness is an untyped Node module.
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const captured: TikzExportParams = { ...fixture.previewParams,
  scene: fixture.scene as SceneModel, drawLayerBackend: "tkz", figureTreatmentMode: "canvas",
  clipRectWorld: undefined, clipPolygonWorld: undefined,
};
const widths = (code: string) => [...code.matchAll(/line width=([-+\d.eE]+)pt/gu)].map(m => Number(m[1]));
const widthSignature = (code: string) => JSON.stringify(widths(code));
const tikzScale = (code: string) => Number(code.match(/\\begin\{tikzpicture\}\[scale=([-+\d.eE]+)/u)?.[1]);

// Reproduce the reported 2.4x discontinuity in the old handler: entering 0.95
// cleared Canvas and activated the legacy line multiplier even with Lines=1.
const original = buildTikzExportText(captured);
const oldResult = buildTikzExportText({ ...captured, globalScale: 0.95, figureTreatmentMode: undefined, figureTreatmentFactor: 1 });
assert(widths(original).some((w, i) => Math.abs(widths(oldResult)[i] / w - 1 / 2.4) < 0.02),
  "Fixture must reproduce the reported accidental thinning");

const treatments: Array<[FigureTreatmentMode | undefined, number]> = [["canvas", 1], ["canvas", 2.15], ["general", 1], ["veryCloseup", 2.5], [undefined, 1]];
for (const drawLayerBackend of ["tkz", "plain"] as const) {
  for (const efficient of [false, true]) {
    for (const [figureTreatmentMode, figureTreatmentFactor] of treatments) {
      const params: TikzExportParams = { ...captured, drawLayerBackend, efficient, figureTreatmentMode, figureTreatmentFactor,
        bakeCoordinates: drawLayerBackend === "plain",
        // The preview may display 1; unrelated values must keep full precision.
        lineScale: 1.0000314159,
      };
      const before = buildTikzExportText(params);
      const expectedWidths = widthSignature(before);
      let current = params;
      for (const scale of [fixture.reportedScaleChange.to, 0.5, 1.2, 1]) {
        current = applyPreviewSizingEdits(current, { global: String(scale) });
        const after = buildTikzExportText(current);
        assert(widthSignature(after) === expectedWidths, `${drawLayerBackend}/${efficient}/${figureTreatmentMode}: TikZ scale must retain every stroke width`);
        assert(Math.abs(tikzScale(after) / tikzScale(before) - scale) < 1e-9, "TikZ scale must still change coordinate spacing");
        assert(current.lineScale === params.lineScale, "Unedited Lines value must not round through its displayed field");
        assert(current.figureTreatmentMode === params.figureTreatmentMode && current.figureTreatmentFactor === params.figureTreatmentFactor,
          "Custom sizing retains its captured calibration, including a legacy absent mode");
      }
      const outer = applyPreviewSizingEdits(current, { scalebox: "0.95" });
      const outerCode = buildTikzExportText(outer);
      assert(outerCode.includes("\\scalebox{0.95}"), "Global scale applies to the entire figure");
      assert(widthSignature(outerCode) === expectedWidths, "Global scale must not change internal stroke styles");
      assert(getPreviewTreatmentSelection(outer) === "custom", "Custom is a display state, not a different calibration");
      const roundTrip = JSON.parse(JSON.stringify(outer)) as TikzExportParams;
      assert(buildTikzExportText(roundTrip) === outerCode, "Serialized/redo parameters retain exact styles and custom state");
      assert(getPreviewTreatmentSelection(roundTrip) === "custom", "Redo keeps the Custom indicator");
      assert(getPreviewTreatmentSelection(params) === (figureTreatmentMode ?? "custom"), "Undo restores the original indicator");

      const thicker = applyPreviewSizingEdits(outer, { line: "2" });
      assert(widthSignature(buildTikzExportText(thicker)) !== expectedWidths, "The dedicated Lines control must still change weight");
      const formatted = applyPreviewSizingEdits(params, { twoDecimals: false, dvipsNames: false });
      assert(formatted.lineScale === params.lineScale && formatted.globalScale === params.globalScale,
        "Formatting controls do not change sizing values");

      if (figureTreatmentMode) {
        const saved = resolveSavedFigureTreatment("custom", outer.scaleboxScale, outer.globalScale,
          1, 1, figureTreatmentFactor, figureTreatmentMode);
        const reopened = applyFigureTreatment(saved.scaleboxScale, saved.globalScale, saved.mode, figureTreatmentFactor);
        assert(saved.mode === figureTreatmentMode, "Saved Custom sizing retains its base treatment");
        assert(Math.abs(reopened.scaleboxScale - outer.scaleboxScale) < 1e-9 && Math.abs(reopened.globalScale - outer.globalScale) < 1e-9,
          "Reopening saved defaults preserves the outer/inner scale pair");
      }
      const reset = applyPreviewSizingEdits(outer, { ...getCanvasCaptureFigureSizing(1, true), figureTreatmentMode: "canvas", figureTreatmentFactor: 1 });
      assert(getPreviewTreatmentSelection(reset) === "canvas" && reset.lineScale === 1, "Reset restores the complete Canvas treatment");

      if (figureTreatmentMode === "canvas" && figureTreatmentFactor === 1) {
        const resized = buildTikzExportText(applyPreviewSizingEdits(params, { global: "0.95" }));
        const manual = before.replace(/line width=[-+\d.eE]+pt/u, "line width=2pt");
        const merged = mergePreviewTikzCode(before, manual, resized);
        assert(merged.ok && merged.code.includes("line width=2pt"), "Scaling must preserve an edited stroke width");
        await compileTikzSnippet(`preview-scale-weight-before-${drawLayerBackend}-${efficient}`, before);
        await compileTikzSnippet(`preview-scale-weight-after-${drawLayerBackend}-${efficient}`, resized);
      }
    }
  }
}
console.log("preview scale preserves line weight: OK");
