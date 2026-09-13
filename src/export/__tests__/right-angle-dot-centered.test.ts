import fixture from "../__fixtures__/right-angle-dot-centered.json";
import { buildTikzIR, exportTikzWithOptions, exportTikzEfficientWithOptions, type TikzExportOptions } from "../tikz";
import { getPointWorldPos, computeOrientedAngleRad, type SceneModel } from "../../scene/points";
import { drawAngles } from "../../view/renderers/angles";
import { camera } from "../../view/camera";
// @ts-ignore Existing compile harness is an untyped Node module.
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
function close(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
}

const scene = fixture.scene as SceneModel;
const vp = { widthPx: 800, heightPx: 600 };
const cam = { pos: { x: 0, y: 0 }, zoom: 80 };
const entries = scene.angles.map(angle => {
  const world = (id: string) => getPointWorldPos(scene.points.find(p => p.id === id)!, scene)!;
  const a = world(angle.aId), b = world(angle.bId), c = world(angle.cId);
  return { angle, a, b, c, theta: computeOrientedAngleRad(a, b, c)! };
});

// Exercise the actual renderer, including rotated adjacent right angles and
// minimum/maximum arc sizes. The dot belongs halfway along the arc bisector,
// regardless of the much smaller square-marker size or stroke thickness.
for (const rotation of [0, 0.7, -2.1]) {
  const rotate = (p: { x: number; y: number }) => ({
    x: p.x * Math.cos(rotation) - p.y * Math.sin(rotation),
    y: p.x * Math.sin(rotation) + p.y * Math.cos(rotation),
  });
  for (const arcRadius of [0.2, 1.2, 4]) {
    for (const strokeWidth of [0.5, 4]) {
      const arcs: Array<{ x: number; y: number; radius: number }> = [];
      const ctx = {
        save() {}, restore() {}, beginPath() {}, stroke() {}, fill() {}, setLineDash() {},
        arc(x: number, y: number, radius: number) { arcs.push({ x, y, radius }); },
      } as unknown as CanvasRenderingContext2D;
      const rotated = entries.map(entry => ({ ...entry, a: rotate(entry.a), b: rotate(entry.b), c: rotate(entry.c),
        angle: { ...entry.angle, style: { ...entry.angle.style, arcRadius, strokeWidth } },
      }));
      drawAngles(ctx, rotated, cam, vp, null, null, width => width * 1.8);
      assert(arcs.length === 4, "Each right angle draws one arc and one dot");
      rotated.forEach((entry, i) => {
        const vertex = camera.worldToScreen(entry.b, cam, vp);
        const arc = arcs[i * 2], dot = arcs[i * 2 + 1];
        const phi = Math.atan2(entry.a.y - entry.b.y, entry.a.x - entry.b.x) + entry.theta / 2;
        close(Math.hypot(dot.x - vertex.x, dot.y - vertex.y), arc.radius / 2, "Dot is halfway to the arc");
        close(dot.x, vertex.x + Math.cos(phi) * arc.radius / 2, "Dot lies on the bisector (x)");
        close(dot.y, vertex.y - Math.sin(phi) * arc.radius / 2, "Dot lies on the bisector (y)");
      });
    }
  }
}

for (const angleArcSizeScale of [0.7, 1, 1.8]) {
  const radiusWorld = 40.8 / 80 * angleArcSizeScale;
  const options: TikzExportOptions = { ...fixture.exportOptions, drawLayerBackend: "plain", angleArcSizeScale,
    // Square-marker scale must not move an arc's inner dot.
    rightAngleSizeScale: 2,
  };
  const dots = buildTikzIR(scene, options).filter(command => command.kind === "DrawRaw" && command.tex.startsWith("\\fill[") && command.tex.includes("circle[radius="));
  assert(dots.length === 2);
  dots.forEach((command, i) => {
    assert(command.kind === "DrawRaw");
    const coords = command.tex.match(/\(([-+\d.eE]+),([-+\d.eE]+)\)/u);
    assert(coords);
    const phi = Math.PI / 4 + i * Math.PI / 2;
    close(Number(coords[1]), Math.cos(phi) * radiusWorld / 2, "PDF dot bisector x");
    close(Number(coords[2]), Math.sin(phi) * radiusWorld / 2, "PDF dot bisector y");
  });
}

for (const drawLayerBackend of ["plain", "tkz"] as const) {
  for (const efficient of [false, true]) {
    const options: TikzExportOptions = { ...fixture.exportOptions, drawLayerBackend };
    let tex = (efficient ? exportTikzEfficientWithOptions : exportTikzWithOptions)(scene, options);
    if (drawLayerBackend === "tkz") {
      assert(tex.includes("german"), "Semantic backend retains the verified German arc/dot macro");
      // Probe the real compiled tkz dot node: the package places its center at
      // size/2 on the bisector. Compare anchors in the same transformed space.
      let index = 0;
      tex = tex.split("\n").flatMap(line => {
        if (!line.includes("\\tkzMarkRightAngles[")) return [line];
        const phi = Math.PI / 4 + index++ * Math.PI / 2;
        const r = 40.8 / 80 / 2;
        return [line.replace("german", "german,name=gdRightDot"),
          `\\coordinate (gdExpected) at (${Math.cos(phi) * r},${Math.sin(phi) * r});`,
          "\\begingroup",
          "\\pgfextractx{\\dimen0}{\\pgfpointdiff{\\pgfpointanchor{gdRightDot}{center}}{\\pgfpointanchor{gdExpected}{center}}}",
          "\\pgfextracty{\\dimen2}{\\pgfpointdiff{\\pgfpointanchor{gdRightDot}{center}}{\\pgfpointanchor{gdExpected}{center}}}",
          "\\ifdim\\dimen0<0pt\\dimen0=-\\dimen0\\fi\\ifdim\\dimen2<0pt\\dimen2=-\\dimen2\\fi",
          "\\ifdim\\dimen0>0.05pt\\PackageError{GeoDraw}{Right dot x is not centered}{}\\fi",
          "\\ifdim\\dimen2>0.05pt\\PackageError{GeoDraw}{Right dot y is not centered}{}\\fi",
          "\\endgroup"];
      }).join("\n");
      assert(index === 2, "Probe both adjacent right-angle dots");
    }
    await compileTikzSnippet(`right-angle-dot-centered-${drawLayerBackend}-${efficient}`, tex);
  }
}
console.log("right-angle-dot-centered tests: OK");
