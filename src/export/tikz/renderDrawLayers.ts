import type { TikzCommand } from "../tikz";

type MarkAngleCommand = Extract<TikzCommand, { kind: "MarkAngle" }>;

type DrawLayerRendererDeps = {
  pushSectionHeader: (title: string) => void;
  fmt: (value: number) => string;
  escapeTikzText: (value: string) => string;
  buildGroupedMarkAngleTex: (run: MarkAngleCommand[]) => string | null;
  assertTkzMacro: (name: string) => void;
  assertCircleFixedMacro: (name: string) => void;
  assertAngleMacro: (name: string, feature: string) => void;
};

type DrawLayerRendererArgs = {
  out: string[];
  drawObjects: TikzCommand[];
  drawPoints: TikzCommand[];
  drawPointLabels: TikzCommand[];
  drawAngleLabels: TikzCommand[];
  drawOtherLabels: TikzCommand[];
  labelScale: number | null;
  groupMarkAngles: boolean;
  deps: DrawLayerRendererDeps;
};

export function appendRenderedDrawLayers({
  out,
  drawObjects,
  drawPoints,
  drawPointLabels,
  drawAngleLabels,
  drawOtherLabels,
  labelScale,
  groupMarkAngles,
  deps,
}: DrawLayerRendererArgs): void {
  deps.pushSectionHeader("% Draw objects");
  let drawCircleRadiusTmpIdx = 0;
  for (let drawIdx = 0; drawIdx < drawObjects.length; drawIdx += 1) {
    const cmd = drawObjects[drawIdx];
    if (cmd.kind === "DrawSegment") {
      deps.assertTkzMacro("tkzDrawSegment");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawSegment${opts}(${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "MarkSegment") {
      deps.assertTkzMacro("tkzMarkSegment");
      out.push(`\\tkzMarkSegment[${cmd.style}](${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawRaw") {
      out.push(cmd.tex);
    } else if (cmd.kind === "DrawLine") {
      deps.assertTkzMacro("tkzDrawLine");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawLine${opts}(${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "FillCircle") {
      deps.assertTkzMacro("tkzFillCircle");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillCircle${opts}(${cmd.o},${cmd.x})`);
    } else if (cmd.kind === "DrawCircle") {
      deps.assertTkzMacro("tkzDrawCircle");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawCircle${opts}(${cmd.o},${cmd.x})`);
    } else if (cmd.kind === "DrawSector") {
      deps.assertTkzMacro("tkzDrawSector");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "FillSector") {
      deps.assertTkzMacro("tkzFillSector");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "DrawCircleRadius") {
      deps.assertCircleFixedMacro("tkzDefCircle");
      deps.assertCircleFixedMacro("tkzGetPoint");
      deps.assertCircleFixedMacro("tkzDrawCircle");
      drawCircleRadiusTmpIdx += 1;
      const tmpThrough = `tkzCircleRDraw_${drawCircleRadiusTmpIdx}`;
      out.push(`\\tkzDefCircle[R](${cmd.o},${deps.fmt(cmd.radius)}) \\tkzGetPoint{${tmpThrough}}`);
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawCircle${opts}(${cmd.o},${tmpThrough})`);
    } else if (cmd.kind === "FillCircleRadius") {
      deps.assertCircleFixedMacro("tkzDefCircle");
      deps.assertCircleFixedMacro("tkzGetPoint");
      deps.assertCircleFixedMacro("tkzFillCircle");
      drawCircleRadiusTmpIdx += 1;
      const tmpThrough = `tkzCircleRFill_${drawCircleRadiusTmpIdx}`;
      out.push(`\\tkzDefCircle[R](${cmd.o},${deps.fmt(cmd.radius)}) \\tkzGetPoint{${tmpThrough}}`);
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillCircle${opts}(${cmd.o},${tmpThrough})`);
    } else if (cmd.kind === "FillAngle") {
      deps.assertAngleMacro("tkzFillAngle", "Angle.fill");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkAngle") {
      const run: MarkAngleCommand[] = [cmd];
      let scan = drawIdx + 1;
      while (scan < drawObjects.length) {
        const next = drawObjects[scan];
        if (next.kind !== "MarkAngle") break;
        if (next.a !== cmd.a || next.b !== cmd.b || next.c !== cmd.c) break;
        run.push(next);
        scan += 1;
      }
      const groupedTex = groupMarkAngles ? deps.buildGroupedMarkAngleTex(run) : null;
      if (groupedTex) {
        deps.assertAngleMacro("tkzMarkAngle", "Angle.mark");
        out.push(groupedTex);
        drawIdx = scan - 1;
        continue;
      }
      deps.assertAngleMacro("tkzMarkAngle", "Angle.mark");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkRightAngle") {
      deps.assertAngleMacro("tkzMarkRightAngles", "Angle.markRight");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkRightAngles${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    }
  }

  deps.pushSectionHeader("% Draw points");
  for (const cmd of drawPoints) {
    if (cmd.kind !== "DrawPoints") continue;
    if (cmd.points.length === 0) continue;
    deps.assertTkzMacro("tkzDrawPoints");
    out.push(`\\tkzDrawPoints[${cmd.style}](${cmd.points.join(",")})`);
  }

  deps.pushSectionHeader("% Labels");
  const shouldScaleLabels = typeof labelScale === "number" && Math.abs(labelScale - 1) > 1e-9;
  if (shouldScaleLabels) {
    out.push(`\\begin{scope}[every node/.style={scale=${deps.fmt(labelScale)}}]`);
  }
  for (const cmd of drawPointLabels) {
    if (cmd.kind === "LabelPoints") {
      if (cmd.points.length === 0) continue;
      deps.assertTkzMacro("tkzLabelPoints");
      out.push(`\\tkzLabelPoints(${cmd.points.join(",")})`);
      continue;
    }
    if (cmd.kind !== "LabelPoint") continue;
    deps.assertTkzMacro("tkzLabelPoint");
    const opts = cmd.options ? `[${cmd.options}]` : "";
    const labelText = cmd.useGlow
      ? `\\gdLabelGlow{$${deps.escapeTikzText(cmd.text)}$}`
      : `$${deps.escapeTikzText(cmd.text)}$`;
    out.push(`\\tkzLabelPoint${opts}(${cmd.name}){${labelText}}`);
  }

  for (const cmd of drawAngleLabels) {
    if (cmd.kind !== "LabelAngle") continue;
    deps.assertAngleMacro("tkzLabelAngle", "Angle.label");
    const opts = cmd.style ? `[${cmd.style}]` : "";
    out.push(`\\tkzLabelAngle${opts}(${cmd.a},${cmd.b},${cmd.c}){$${deps.escapeTikzText(cmd.text)}$}`);
  }
  for (const cmd of drawOtherLabels) {
    if (cmd.kind !== "LabelAt") continue;
    const opts = cmd.options ? `[${cmd.options}]` : "";
    const labelText = cmd.useGlow
      ? `\\gdLabelGlow{$${deps.escapeTikzText(cmd.text)}$}`
      : `$${deps.escapeTikzText(cmd.text)}$`;
    out.push(`\\node${opts} at (${deps.fmt(cmd.x)},${deps.fmt(cmd.y)}){${labelText}};`);
  }
  if (shouldScaleLabels) {
    out.push("\\end{scope}");
  }
}
