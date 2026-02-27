import type { TikzCommand } from "../tikz";
import type { TikzRendererContext } from "./renderContext";

export function appendRenderedPointConstruction(
  ctx: TikzRendererContext,
  cmd: TikzCommand
): boolean {
  const out = ctx.out;
  const caps = ctx.capabilities;

  if (cmd.kind === "DefMidPoint") {
    caps.assertTkzMacro("tkzDefMidPoint");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefMidPoint(${cmd.a},${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }
  if (cmd.kind === "DefPointOnLine") {
    caps.assertTkzMacro("tkzDefPointBy");
    caps.assertTkzMacro("tkzGetPoint");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tRaw = (cmd as any).t;
    const t = typeof tRaw === "number" && Number.isFinite(tRaw) ? tRaw : 0.5;
    out.push(`\\tkzDefPointBy[homothety=center ${cmd.a} ratio ${caps.fmt(t)}](${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }
  if (cmd.kind === "DefPointByRotation") {
    caps.assertAngleFixedMacro("tkzDefPointBy");
    caps.assertTkzMacro("tkzGetPoint");
    if (cmd.direction !== "CCW" && cmd.direction !== "CW") {
      throw new Error("Unsupported AngleFixed option: direction=CW (no tkz mapping)");
    }
    const signedAngle = cmd.direction === "CW" ? -Math.abs(cmd.angleDeg) : Math.abs(cmd.angleDeg);
    out.push(
      `\\tkzDefPointBy[rotation=center ${cmd.center} angle ${caps.fmt(signedAngle)}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`
    );
    return true;
  }
  if (cmd.kind === "DefPointByTranslation") {
    caps.assertTkzMacro("tkzDefPointBy");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefPointBy[translation= from ${cmd.from} to ${cmd.to}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }
  if (cmd.kind === "DefPointByDilation") {
    caps.assertTkzMacro("tkzDefPointBy");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(
      `\\tkzDefPointBy[homothety=center ${cmd.center} ratio ${caps.fmt(cmd.factor)}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`
    );
    return true;
  }
  if (cmd.kind === "DefPointByProjection") {
    caps.assertTkzMacro("tkzDefPointBy");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefPointBy[projection=onto ${cmd.axisA}--${cmd.axisB}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }
  if (cmd.kind === "DefPointByReflection") {
    caps.assertTkzMacro("tkzDefPointBy");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefPointBy[projection=onto ${cmd.axisA}--${cmd.axisB}](${cmd.point}) \\tkzGetPoint{${cmd.footName}}`);
    out.push(`\\tkzDefPointBy[homothety=center ${cmd.footName} ratio -1](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }
  if (cmd.kind === "DefTriangleCenterPoint") {
    caps.assertTkzMacro("tkzDefTriangleCenter");
    caps.assertTkzMacro("tkzGetPoint");
    const mode = cmd.centerKind === "incenter" ? "in" : cmd.centerKind === "centroid" ? "centroid" : "ortho";
    out.push(`\\tkzDefTriangleCenter[${mode}](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }
  if (cmd.kind === "DefCircleCircumCenter") {
    caps.assertTkzMacro("tkzDefCircle");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefCircle[circum](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.centerName}}`);
    return true;
  }
  if (cmd.kind === "DefPointOnCircle") {
    caps.assertTkzMacro("tkzDefPointOnCircle");
    caps.assertTkzMacro("tkzGetPoint");
    const deg = (cmd.theta * 180) / Math.PI;
    out.push(`\\tkzDefPointOnCircle[through = center ${cmd.center} angle ${caps.fmt(deg)} point ${cmd.through}]`);
    out.push(`\\tkzGetPoint{${cmd.name}}`);
    return true;
  }

  return false;
}
