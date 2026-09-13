import fixture from "../__fixtures__/circle-radius-edit.json";
import { buildTikzIR, exportTikzWithOptions, exportTikzEfficientWithOptions, type TikzExportOptions } from "../tikz";
import type { SceneModel } from "../../scene/points";
// @ts-ignore Existing compile harness is an untyped Node module.
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

// E is the topmost object and uses a canvas name's middle baseline. Its
// baseline offset is smaller than the TeX glyph's ascent: text height=offset
// used to under-report the PDF bounds and cut off the top of the letter.
const scene: SceneModel = { ...fixture.scene as SceneModel,
  circles: fixture.scene.circles.map(c => ({ ...c, visible: false, showLabel: false })) as SceneModel["circles"],
  lines: fixture.scene.lines.map(l => ({ ...l, visible: false })) as SceneModel["lines"],
};
for (const drawLayerBackend of ["plain", "tkz"] as const) {
  const options: TikzExportOptions = { ...fixture.exportOptions as TikzExportOptions, drawLayerBackend,
    visualTreatmentFactor: drawLayerBackend === "tkz" ? 2 : 1,
  };
  const label = buildTikzIR(scene, options).find(c => c.kind === "LabelPoint" && c.name === "E");
  assert(label?.kind === "LabelPoint");
  const labelOptions = label.options;
  assert(labelOptions);
  assert(labelOptions.includes("anchor=base west"), "Place measured labels by their actual baseline");
  assert(!labelOptions.includes("text height="), "Keep the real glyph height for PDF bounds");
  const font = labelOptions.match(/font=(\\fontsize\{[^}]+\}\{[^}]+\}\\selectfont)/u)?.[1];
  assert(font);
  for (const efficient of [false, true]) {
    let tex = (efficient ? exportTikzEfficientWithOptions : exportTikzWithOptions)(scene, options);
    tex = tex.split("\n").map(line => line.includes("at (E){")
      ? line.replace("\\node[", "\\node[name=gdBoundsProbe,") : line).join("\n");
    assert(tex.includes("name=gdBoundsProbe"));
    const probe = [
      "\\begingroup\\pgftransformreset",
      `\\setbox0=\\hbox{${font}$E$}`,
      "\\pgfextracty{\\dimen0}{\\pgfpointdiff{\\pgfpointanchor{gdBoundsProbe}{base west}}{\\pgfpointanchor{gdBoundsProbe}{north west}}}",
      "\\advance\\dimen0 by 0.02pt",
      "\\ifdim\\dimen0<\\ht0\\PackageError{GeoDraw}{Point label glyph exceeds its PDF bounds}{Keep natural text dimensions}\\fi",
      "\\endgroup",
    ].join("\n");
    tex = tex.replace("\\end{tikzpicture}", `${probe}\n\\end{tikzpicture}`);
    await compileTikzSnippet(`point-label-natural-bounds-${drawLayerBackend}-${efficient}`, tex);
  }
}
console.log("point-label-natural-bounds tests: OK");
