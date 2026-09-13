import fixture from "../__fixtures__/preview-preserve-manual-code.json";
import { buildTikzExportText, type TikzExportParams } from "../buildTikzExportText";
import type { SceneModel } from "../../scene/points";
import { mergePreviewTikzCode } from "../../ui/tikzPreviewCodeEdits";
import { extractTikzPicture } from "../../ui/tikzPreviewSession";
import { applyPreviewLabelEdits, listPreviewLabelTargets, nudgePreviewLabel, resetPreviewLabel } from "../../ui/tikzPreviewLabels";
import { exportTikzWithOptions } from "../tikz";
import { buildStandaloneSource, deriveDefaultOptionalPreamble } from "../tikz/standaloneDocument";
// @ts-ignore Existing compile harness is an untyped Node module.
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const captured: TikzExportParams = {
  ...fixture.previewParams,
  scene: fixture.scene as SceneModel,
  drawLayerBackend: "plain",
  clipRectWorld: undefined,
  clipPolygonWorld: undefined,
};
const build = (params: TikzExportParams) => extractTikzPicture(buildTikzExportText(params));
const target = listPreviewLabelTargets(captured.scene).find((label) => label.id === "p_8")!;
const customHalo = "\\newcommand{\\gdLabelText}[1]{\\gdLabelGlow{1pt}{\\thepagecolor}{#1}}";

function customize(code: string, backend: "plain" | "tkz"): string {
  return code
    .replace(/^(\\begin\{tikzpicture\}[^\n]*\n)/mu, "$1% My final figure — retain this comment.\n")
    .replace(backend === "plain"
      ? /\\newcommand\{\\gdLabelText\}\[1\]\{[^\n]+/u
      : /\\contourlength\{[^{}]+pt\}/u,
    backend === "plain" ? customHalo : "\\contourlength{1pt}")
    .replace(/text=black/gu, "text=blue");
}
function merge(base: string, edited: string, generated: string): string {
  const result = mergePreviewTikzCode(base, edited, generated);
  assert(result.ok, result.ok ? "" : result.message);
  return result.code;
}

for (const backend of ["plain", "tkz"] as const) {
  for (const efficient of [false, true]) {
    const params: TikzExportParams = { ...captured, drawLayerBackend: backend, efficient, bakeCoordinates: backend === "plain" };
    const before = build(params);
    let generated = before;
    let edited = customize(before, backend);
    assert(edited !== before && edited.includes(backend === "plain" ? customHalo : "\\contourlength{1pt}"),
      "Reproduce the manual halo override.");
    let edits = params;
    let current = params;
    for (const delta of [{ x: -1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -5 }]) {
      edits = applyPreviewLabelEdits(current, nudgePreviewLabel(edits, target, delta, params.screenPxPerWorld));
      current = applyPreviewLabelEdits(current, edits);
      const next = build(current);
      assert(next !== generated, "Each click must move the label.");
      edited = merge(generated, edited, next);
      generated = next;
      assert(edited === customize(next, backend), "Nudges must retain macros, comments and edited shared label colors exactly.");
    }
    for (const scale of [{ pointScale: 1.5 }, { lineScale: 1.9 }, { labelScale: 1.2 }, { scaleboxScale: 1.1 }]) {
      current = { ...current, ...scale };
      const next = build(current);
      assert(next !== generated, "The fixture must exercise each sizing control.");
      edited = merge(generated, edited, next);
      generated = next;
      assert(edited === customize(next, backend), "Sizing must apply while retaining every unrelated manual edit.");
    }
    current = applyPreviewLabelEdits(current, resetPreviewLabel(edits, params, target));
    edited = merge(generated, edited, build(current));
    assert(edited === customize(build(current), backend), "Reset must preserve custom code and the latest sizes.");

    // A halo adjustment touches the same dimension as the manual override.
    const conflict = mergePreviewTikzCode(build(current), edited, build({ ...current, labelHaloScale: 2 }));
    assert(!conflict.ok && conflict.message.includes("kept"), "Conflicting control edits must fail without replacing any code.");
    const changedAfterConflict = build({ ...current, lineScale: 2.1 });
    assert(merge(build(current), edited, changedAfterConflict) === customize(changedAfterConflict, backend),
      "An unrelated control must still work after a rejected change.");
    await compileTikzSnippet(`preview-manual-code-${backend}-${efficient}`,
      buildStandaloneSource(edited, deriveDefaultOptionalPreamble(edited, undefined)));
  }
}

// Dimensions are indivisible tokens. Never splice digits into a third value.
assert(!mergePreviewTikzCode("\\gdLabelGlow{2.78pt}", "\\gdLabelGlow{1pt}", "\\gdLabelGlow{2.90pt}").ok,
  "Concurrent changes to a dimension must conflict.");
assert(merge("width=2pt, color=black\n", "width=2pt, color=blue\n", "width=3pt, color=black\n") === "width=3pt, color=blue\n",
  "Different options on a single line can merge.");
assert(merge("a\nb\nc\n", "a\n% comment\nb\nc\n", "a\nb\nC\n") === "a\n% comment\nb\nC\n", "Keep inserted lines.");
assert(merge("a\nb\nc\n", "a\nc\n", "a\nb\nC\n") === "a\nC\n", "Keep unrelated deletions.");
assert(merge("a\nb\nc\n", "a\nB\nc\n", "a\nB\nC\n") === "a\nB\nC\n", "Identical edits apply once.");
assert(!mergePreviewTikzCode("a\nb\n", "a\nmanual\nb\n", "a\nauto\nb\n").ok, "Conflicting insertions must be rejected.");
assert(merge("x=1pt\n", "x=2pt\n", "x=1pt\n") === "x=2pt\n", "A generated no-op must never reset manual code.");

// The default contour is 40% of a soft canvas halo, still proportional to
// the per-point width and user multiplier, with no change to the canvas style.
const haloCode = exportTikzWithOptions(captured.scene, {
  drawLayerBackend: "plain", bakePointCoordinates: true,
  screenPxPerWorld: 80, viewport: captured.viewport, labelHaloScale: 1,
  autoScaleToFitCm: { maxWidthCm: 12.4, maxHeightCm: 9.38 },
});
const haloWidth = Number(haloCode.match(/\\gdLabelGlow\{([-+\d.eE]+)pt\}/u)?.[1]);
assert(Math.abs(haloWidth - 3.5 * (72.27 / 2.54 / 80) * 0.4) < 1e-9,
  `Expected a smaller default label halo, got ${haloWidth}.`);
assert(captured.scene.points[0].style.labelHaloWidthPx === 3.5, "Export calibration must not mutate canvas styling.");

console.log("✓ Preview controls preserve manual TikZ edits and reject overlapping changes; reduced halo default");
