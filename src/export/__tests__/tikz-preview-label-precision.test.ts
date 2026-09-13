import fixtureJson from "../__fixtures__/point-label-nudge-through-zero.json";
import { buildTikzIR, type TikzCommand, type TikzExportOptions } from "../tikz.ts";
import { buildTikzExportText, type TikzExportParams } from "../buildTikzExportText.ts";
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";
import type {
  AngleStyle,
  LineStyle,
  PointStyle,
  SceneModel,
} from "../../scene/points.ts";
import {
  listPreviewLabelTargets,
  nudgePreviewLabel,
  resetPreviewLabel,
  type PreviewLabelEdits,
} from "../../ui/tikzPreviewLabels.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 16,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#000000",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle: LineStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  dash: "solid",
  opacity: 1,
};

const angleStyle: AngleStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeOpacity: 1,
  textColor: "#000000",
  textSize: 14,
  fillEnabled: false,
  fillColor: "#ffffff",
  fillOpacity: 0,
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 4,
  markColor: "#000000",
  arcRadius: 0.8,
  labelText: "\\alpha",
  labelPosWorld: { x: 0.35, y: 0.35 },
  showLabel: true,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    {
      id: "a",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: pointStyle,
    },
    {
      id: "b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "none",
      position: { x: 1, y: 0 },
      style: pointStyle,
    },
    {
      id: "c",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 1 },
      style: pointStyle,
    },
    {
      id: "outside",
      kind: "free",
      name: "Z",
      captionTex: "Z",
      visible: true,
      showLabel: "name",
      position: { x: 9, y: 9 },
      style: pointStyle,
    },
  ],
  vectors: [],
  segments: [
    {
      id: "ab",
      aId: "a",
      bId: "b",
      visible: true,
      showLabel: true,
      labelText: "s",
      labelPosWorld: { x: 0.5, y: 0.2 },
      style: lineStyle,
    },
  ],
  lines: [],
  circles: [],
  polygons: [],
  angles: [
    {
      id: "abc",
      kind: "angle",
      aId: "a",
      bId: "b",
      cId: "c",
      visible: true,
      style: angleStyle,
    },
  ],
  numbers: [],
  textLabels: [
    {
      id: "omega",
      name: "omega",
      text: "\\omega",
      visible: true,
      positionWorld: { x: 0.7, y: 0.7 },
      style: {
        textColor: "#000000",
        textSize: 14,
        useTex: true,
      },
    },
  ],
};

const targets = listPreviewLabelTargets(scene, {
  viewport: { xmin: -1, xmax: 2, ymin: -1, ymax: 2 },
  screenPxPerWorld: 100,
});
assert(
  targets.map((target) => target.key).join(",") ===
    "point:a,point:c,segment:ab,angle:abc,text:omega",
  `Label precision must list every visible exported label in compact scene order: ${targets
    .map((target) => target.key)
    .join(",")}`
);
assert(!targets.some((target) => target.id === "outside"), "Labels outside the export viewport must not be listed.");

const pointTarget = targets.find((target) => target.key === "point:a");
assert(pointTarget, "Missing point label precision target.");
const originalEdits: PreviewLabelEdits = { scene };
const nudgedPointEdits = nudgePreviewLabel(originalEdits, pointTarget, { x: 1, y: -1 }, 100);
assert(
  nudgedPointEdits.pointLabelNudgesPx?.a.x === 1 && nudgedPointEdits.pointLabelNudgesPx.a.y === -1 &&
    nudgedPointEdits.scene === scene,
  "Point-label nudges must be separate translations, preserving automatic placement inputs."
);

const segmentTarget = targets.find((target) => target.key === "segment:ab");
assert(segmentTarget, "Missing object-label precision target.");
const nudgedSegmentEdits = nudgePreviewLabel(nudgedPointEdits, segmentTarget, { x: 1, y: -1 }, 100);
const nudgedSegment = nudgedSegmentEdits.scene.segments.find((segment) => segment.id === "ab");
assert(
  Math.abs((nudgedSegment?.labelPosWorld?.x ?? 0) - 0.51) <= 1e-12 &&
    Math.abs((nudgedSegment?.labelPosWorld?.y ?? 0) - 0.21) <= 1e-12,
  "World-positioned labels must convert one joystick pixel through the captured canvas density."
);

const resetPointEdits = resetPreviewLabel(nudgedSegmentEdits, originalEdits, pointTarget);
assert(
  !resetPointEdits.pointLabelNudgesPx?.a && resetPointEdits.scene === nudgedSegmentEdits.scene,
  "Reset must clear only the selected point's translation and preserve other edits."
);

const fixture = fixtureJson as {
  scene: SceneModel;
  exportOptions: TikzExportOptions;
};
const fixtureOptions = { ...fixture.exportOptions, pointLabelNudgesPx: undefined };
const eTarget = listPreviewLabelTargets(fixture.scene).find((target) => target.id === "e");
assert(eTarget, "Missing E precision target.");

function exportedLabel(edits: PreviewLabelEdits, options: TikzExportOptions) {
  const ir = buildTikzIR(edits.scene, { ...options, pointLabelNudgesPx: edits.pointLabelNudgesPx });
  const label = ir.find((command): command is Extract<TikzCommand, { kind: "LabelPoint" }> =>
    command.kind === "LabelPoint" && command.name === "E"
  );
  assert(label, "Expected exported label E.");
  return label;
}

function shift(label: Extract<TikzCommand, { kind: "LabelPoint" }>, axis: "x" | "y"): number {
  return Number(label.options?.match(new RegExp(`${axis}shift=([-+\\d.eE]+)pt`))?.[1] ?? 0);
}

const initial: PreviewLabelEdits = { scene: fixture.scene };
for (const options of [
  fixtureOptions,
  { ...fixtureOptions, drawLayerBackend: "plain" as const },
  { ...fixtureOptions, viewport: undefined },
  { ...fixtureOptions, visualTreatmentFactor: 3, pointLabelOffsetScale: 0.947, worldToTikzScale: 0.5, labelScale: 2 },
]) {
  const originalLabel = exportedLabel(initial, options);
  const ir = buildTikzIR(initial.scene, options);
  const setup = ir.find((command) => command.kind === "SetupUnits");
  assert(setup?.kind === "SetupUnits", "Expected coordinate scale.");
  const expectedStepPt = setup.scale * (72.27 / 2.54) / 100;
  let edits = initial;
  let previous = originalLabel;
  // Cross both the raw-offset zero and the actual rendered label's zero.
  for (let click = 1; click <= 40; click += 1) {
    edits = nudgePreviewLabel(edits, eTarget, { x: -1, y: 0 }, 100);
    const current = exportedLabel(edits, options);
    assert(Math.abs(shift(current, "x") - shift(previous, "x") + expectedStepPt) < 1e-9,
      `Left click ${click} must translate E by exactly one canvas pixel (${options.drawLayerBackend}).`);
    assert(shift(current, "y") === shift(originalLabel, "y"), "Horizontal clicks must not move E vertically.");
    const placement = (label: typeof current) => label.options?.replace(/,?\s*[xy]shift=[^,]+/gu, "");
    assert(placement(current) === placement(originalLabel), "Nudging must preserve the original anchor and styling.");
    previous = current;
  }
  for (const delta of [{ x: 5, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 5 }]) {
    edits = nudgePreviewLabel(edits, eTarget, delta, 100);
    const current = exportedLabel(edits, options);
    assert(Math.abs(shift(current, "x") - shift(previous, "x") - delta.x * expectedStepPt) < 1e-9,
      "Right and coarse clicks must preserve their exact horizontal distance.");
    assert(Math.abs(shift(current, "y") - shift(previous, "y") + delta.y * expectedStepPt) < 1e-9,
      "Up must increase TikZ y; down must decrease it.");
    previous = current;
  }
  const restored = resetPreviewLabel(edits, initial, eTarget);
  assert(JSON.stringify(exportedLabel(restored, options)) === JSON.stringify(originalLabel), "Reset must restore the exact exported label.");
}

const twiceLeft = nudgePreviewLabel(nudgePreviewLabel(initial, eTarget, { x: -1, y: 0 }, 100), eTarget, { x: -1, y: 0 }, 100);
const baseParams: TikzExportParams = {
  ...initial, viewport: fixtureOptions.viewport, clipRectWorld: undefined, clipPolygonWorld: undefined,
  screenPxPerWorld: 100, emitTkzSetup: true, drawLayerBackend: "tkz", bakeCoordinates: false,
  labelGlow: true, backgroundColor: undefined, efficient: false,
  scaleboxScale: 1, trueGlobalScale: 1, globalScale: 1, pointScale: 1, lineScale: 1, labelScale: 1,
};
for (const drawLayerBackend of ["tkz", "plain"] as const) {
  for (const efficient of [false, true]) {
    const params = { ...baseParams, drawLayerBackend, efficient };
    const before = buildTikzExportText(params);
    const after = buildTikzExportText({ ...params, ...twiceLeft });
    assert(before !== after, "Both shared export-builder paths must retain preview nudges.");
    assert(before === buildTikzExportText({ ...params, ...resetPreviewLabel(twiceLeft, initial, eTarget) }),
      "Reset must restore byte-identical TikZ.");
    await compileTikzSnippet(`point-label-nudge-${drawLayerBackend}-${efficient}`, after);
  }
}

console.log("✓ TikZ preview label-precision grid test passed");
