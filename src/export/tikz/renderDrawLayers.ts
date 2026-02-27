import type { TikzCommand } from "../tikz";
import { createDrawLayerBackendEmitter } from "./renderDrawBackend";
import type { TikzRendererContext } from "./renderContext";

type MarkAngleCommand = Extract<TikzCommand, { kind: "MarkAngle" }>;

type DrawLayerRendererArgs = {
  ctx: TikzRendererContext;
  drawObjects: TikzCommand[];
  drawPoints: TikzCommand[];
  drawPointLabels: TikzCommand[];
  drawAngleLabels: TikzCommand[];
  drawOtherLabels: TikzCommand[];
};

export function appendRenderedDrawLayers({
  ctx,
  drawObjects,
  drawPoints,
  drawPointLabels,
  drawAngleLabels,
  drawOtherLabels,
}: DrawLayerRendererArgs): void {
  const out = ctx.out;
  const caps = ctx.capabilities;
  const backend = createDrawLayerBackendEmitter(ctx);
  ctx.pushSectionHeader("% Draw objects");
  for (let drawIdx = 0; drawIdx < drawObjects.length; drawIdx += 1) {
    const cmd = drawObjects[drawIdx];
    if (cmd.kind === "DrawSegment") {
      out.push(...backend.emitDrawSegment(cmd));
    } else if (cmd.kind === "MarkSegment") {
      caps.assertTkzMacro("tkzMarkSegment");
      out.push(`\\tkzMarkSegment[${cmd.style}](${cmd.a},${cmd.b})`);
    } else if (cmd.kind === "DrawRaw") {
      out.push(...backend.emitDrawRaw(cmd));
    } else if (cmd.kind === "DrawLine") {
      out.push(...backend.emitDrawLine(cmd));
    } else if (cmd.kind === "FillCircle") {
      out.push(...backend.emitFillCircle(cmd));
    } else if (cmd.kind === "DrawCircle") {
      out.push(...backend.emitDrawCircle(cmd));
    } else if (cmd.kind === "DrawSector") {
      caps.assertTkzMacro("tkzDrawSector");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "FillSector") {
      caps.assertTkzMacro("tkzFillSector");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillSector${opts}(${cmd.o},${cmd.a})(${cmd.b})`);
    } else if (cmd.kind === "DrawCircleRadius") {
      caps.assertCircleFixedMacro("tkzDefCircle");
      caps.assertCircleFixedMacro("tkzGetPoint");
      caps.assertCircleFixedMacro("tkzDrawCircle");
      ctx.state.drawCircleRadiusTmpIdx += 1;
      const tmpThrough = `tkzCircleRDraw_${ctx.state.drawCircleRadiusTmpIdx}`;
      out.push(`\\tkzDefCircle[R](${cmd.o},${caps.fmt(cmd.radius)}) \\tkzGetPoint{${tmpThrough}}`);
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzDrawCircle${opts}(${cmd.o},${tmpThrough})`);
    } else if (cmd.kind === "FillCircleRadius") {
      caps.assertCircleFixedMacro("tkzDefCircle");
      caps.assertCircleFixedMacro("tkzGetPoint");
      caps.assertCircleFixedMacro("tkzFillCircle");
      ctx.state.drawCircleRadiusTmpIdx += 1;
      const tmpThrough = `tkzCircleRFill_${ctx.state.drawCircleRadiusTmpIdx}`;
      out.push(`\\tkzDefCircle[R](${cmd.o},${caps.fmt(cmd.radius)}) \\tkzGetPoint{${tmpThrough}}`);
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzFillCircle${opts}(${cmd.o},${tmpThrough})`);
    } else if (cmd.kind === "FillAngle") {
      caps.assertAngleMacro("tkzFillAngle", "Angle.fill");
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
      const groupedTex = ctx.options.groupMarkAngles ? caps.buildGroupedMarkAngleTex(run) : null;
      if (groupedTex) {
        caps.assertAngleMacro("tkzMarkAngle", "Angle.mark");
        out.push(groupedTex);
        drawIdx = scan - 1;
        continue;
      }
      caps.assertAngleMacro("tkzMarkAngle", "Angle.mark");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkAngle${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    } else if (cmd.kind === "MarkRightAngle") {
      caps.assertAngleMacro("tkzMarkRightAngles", "Angle.markRight");
      const opts = cmd.style ? `[${cmd.style}]` : "";
      out.push(`\\tkzMarkRightAngles${opts}(${cmd.a},${cmd.b},${cmd.c})`);
    }
  }

  ctx.pushSectionHeader("% Draw points");
  for (const cmd of drawPoints) {
    if (cmd.kind !== "DrawPoints") continue;
    if (cmd.points.length === 0) continue;
    caps.assertTkzMacro("tkzDrawPoints");
    out.push(`\\tkzDrawPoints[${cmd.style}](${cmd.points.join(",")})`);
  }

  ctx.pushSectionHeader("% Labels");
  const labelScale = ctx.options.labelScale;
  const shouldScaleLabels = typeof labelScale === "number" && Math.abs(labelScale - 1) > 1e-9;
  if (shouldScaleLabels) {
    out.push(`\\begin{scope}[every node/.style={scale=${caps.fmt(labelScale)}}]`);
  }
  for (const cmd of drawPointLabels) {
    if (cmd.kind === "LabelPoints") {
      if (cmd.points.length === 0) continue;
      caps.assertTkzMacro("tkzLabelPoints");
      out.push(`\\tkzLabelPoints(${cmd.points.join(",")})`);
      continue;
    }
    if (cmd.kind !== "LabelPoint") continue;
    out.push(...backend.emitLabelPoint(cmd));
  }

  for (const cmd of drawAngleLabels) {
    if (cmd.kind !== "LabelAngle") continue;
    caps.assertAngleMacro("tkzLabelAngle", "Angle.label");
    const opts = cmd.style ? `[${cmd.style}]` : "";
    out.push(`\\tkzLabelAngle${opts}(${cmd.a},${cmd.b},${cmd.c}){$${caps.escapeTikzText(cmd.text)}$}`);
  }
  for (const cmd of drawOtherLabels) {
    if (cmd.kind !== "LabelAt") continue;
    out.push(...backend.emitLabelAt(cmd));
  }
  if (shouldScaleLabels) {
    out.push("\\end{scope}");
  }
}
