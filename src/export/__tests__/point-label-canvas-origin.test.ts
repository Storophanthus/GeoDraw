import fixture from "../__fixtures__/point-label-canvas-origin.json";
import { buildTikzIR, exportTikzWithOptions, exportTikzEfficientWithOptions, type TikzExportOptions } from "../tikz";
import type { SceneModel } from "../../scene/points";
import { createPointLabelOverlays } from "../../view/labelOverlays";
import { camera as cameraMath } from "../../view/camera";
import { getPointWorldPos } from "../../scene/points";
// @ts-ignore Existing compile harness is an untyped Node module.
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function near(actual: number, expected: number, message: string): void {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`);
}
const scene = fixture.scene as SceneModel;
const options = fixture.exportOptions as TikzExportOptions;
const fontPx = 18 * 0.95;
// Fix auto-fit at 1 so one unzoomed canvas pixel has a known physical length.
const pxToPt = 72.27 / 2.54 / 80;
const fixedOptions = { ...options, autoScaleToFitCm: { maxWidthCm: 6, maxHeightCm: 4 } };

for (const drawLayerBackend of ["plain", "tkz"] as const) {
  for (const trueZoom of [0.5, 1, 2.5]) {
    const zoomOptions = {
      ...fixedOptions, drawLayerBackend, canvasTrueZoom: trueZoom,
      viewport: { xmin: -2 / trueZoom, xmax: 4 / trueZoom, ymin: -2 / trueZoom, ymax: 2 / trueZoom },
    };
    const labels = buildTikzIR(scene, zoomOptions).filter((command) => command.kind === "LabelPoint");
    for (const label of labels) {
      const point = scene.points.find((point) => point.name === label.name)!;
      const text = label.options ?? "";
      assert(text.includes("anchor=base west") && text.includes("outer sep=0pt"), "Keep the canvas baseline with no implicit outer padding.");
      near(Number(text.match(/xshift=([-+\d.eE]+)pt/u)?.[1]), point.style.labelOffsetPx.x * pxToPt, "Retain the exact horizontal offset at any True Zoom");
      const metrics = options.pointLabelCanvasMetrics![point.id];
      near(Number(text.match(/yshift=([-+\d.eE]+)pt/u)?.[1]), -(point.style.labelOffsetPx.y + metrics.baselineOffsetPx) * pxToPt, "Retain the offset and browser baseline");
      assert(!text.includes("text height="), "Natural glyph bounds must contain the full label");
      near(Number(text.match(/\\fontsize\{([-+\d.eE]+)pt/u)?.[1]), fontPx * pxToPt, "Keep captured font sizing proportional");
    }
  }

  // Cross former compass thresholds, all quadrants, and the point itself.
  // Neither text length nor marker size may re-position a manually placed label.
  for (const offset of [{x:-25.953125,y:5.046875},{x:0,y:0},{x:-20,y:6.99},{x:-20,y:7.01},{x:1,y:25},{x:1,y:-25},{x:20,y:-0.1}]) {
    for (const captionTex of ["C_2", "A^{\\prime}", "\\frac{AB}{CD}"]) {
      const changed: SceneModel = {...scene, points:scene.points.map(point=>point.id==='p_9'?{
        ...point, captionTex, style:{...point.style,sizePx:20,labelOffsetPx:offset},
      }:point)};
      const label = buildTikzIR(changed, { ...fixedOptions, drawLayerBackend }).find(command=>command.kind==='LabelPoint' && command.name==='C_2');
      assert(label?.kind==='LabelPoint', "C_2 label missing.");
      near(Number(label.options?.match(/xshift=([-+\d.eE]+)pt/u)?.[1]), offset.x * pxToPt, "No width estimate, quadrant snap or marker clearance may change x");
      const baseline = captionTex === "C_2" ? options.pointLabelCanvasMetrics!.p_9.baselineOffsetPx : 0;
      near(Number(label.options?.match(/yshift=([-+\d.eE]+)pt/u)?.[1]), -(offset.y + baseline) * pxToPt, "Only the captured baseline may adjust y");
      if (captionTex !== "C_2") assert(!label.options?.includes("text height="), "Do not reuse baseline measurements from different text.");
    }
  }

  // Compile and have TeX itself assert the final label baseline relative to
  // the named point. This catches wrong anchor/padding/font-unit semantics
  // even if the exported option strings look right.
  let output = exportTikzWithOptions(scene, { ...fixedOptions, drawLayerBackend });
  const checks: string[] = [];
  for (const [index, point] of scene.points.entries()) {
    const probe = `gdOriginProbe${index}`;
    output = output.split("\n").map(line=>line.includes(`at (${point.name}){`)
      ? line.replace("\\node[", `\\node[name=${probe},`) : line).join("\n");
    assert(output.includes(`name=${probe}`), "The compiled test must instrument each actual label node.");
    const metrics = options.pointLabelCanvasMetrics![point.id];
    const dx = point.style.labelOffsetPx.x * pxToPt;
    const dy = -(point.style.labelOffsetPx.y + metrics.baselineOffsetPx) * pxToPt;
    for (const [axis, expected] of [["x",dx],["y",dy]] as const) {
      checks.push(
        `\\pgfextract${axis}{\\dimen0}{\\pgfpointdiff{\\pgfpointanchor{${point.name}}{center}}{\\pgfpointanchor{${probe}}{base west}}}`,
        `\\advance\\dimen0 by ${-expected}pt`,
        "\\ifdim\\dimen0<0pt\\dimen0=-\\dimen0\\fi",
        `\\ifdim\\dimen0>0.02pt\\PackageError{GeoDraw}{Label ${index} ${axis} baseline differs from canvas}{Check label origins}\\fi`
      );
    }
  }
  output = output.replace("\\end{tikzpicture}", checks.join("\n")+"\n\\end{tikzpicture}");
  await compileTikzSnippet(`point-label-canvas-origin-${drawLayerBackend}`, output);
  await compileTikzSnippet(`point-label-canvas-origin-efficient-${drawLayerBackend}`,
    exportTikzEfficientWithOptions(scene, { ...fixedOptions, drawLayerBackend }));
}

// The saved file's offsets are already top-left canvas origins, not edge gaps.
// Ordinary zoom and True Zoom must agree on those same model-space offsets.
for (const zoom of [40, 80, 200]) {
  const camera = {pos:{x:0,y:0},zoom};
  const vp = {widthPx:900,heightPx:600};
  const resolved = scene.points.map(point=>({point,world:getPointWorldPos(point,scene)!}));
  const overlays = createPointLabelOverlays(resolved,camera,vp);
  for (const overlay of overlays) {
    const point = resolved.find(item=>item.point.id===overlay.id)!;
    const anchor = cameraMath.worldToScreen(point.world,camera,vp);
    near(overlay.x-anchor.x,point.point.style.labelOffsetPx.x,"Canvas x origin contract");
    near(overlay.y-anchor.y,point.point.style.labelOffsetPx.y,"Canvas y origin contract");
  }
}
console.log("✓ Point-label canvas origins and compiled TeX baselines agree, including C_1/C_2");
