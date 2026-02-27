import type { TikzCommand } from "../tikz";
import type { TikzRendererContext } from "./renderContext";

export function appendRenderedGeometryHelperConstruction(
  ctx: TikzRendererContext,
  cmd: TikzCommand
): boolean {
  const out = ctx.out;
  const caps = ctx.capabilities;

  if (cmd.kind === "DefPerpendicularLine") {
    caps.assertPerpendicularMacro("tkzDefLine");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefLine[perpendicular=through ${cmd.through}](${cmd.baseA},${cmd.baseB}) \\tkzGetPoint{${cmd.auxName}}`);
    return true;
  }
  if (cmd.kind === "DefParallelLine") {
    caps.assertParallelMacro("tkzDefLine");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefLine[parallel=through ${cmd.through}](${cmd.baseA},${cmd.baseB}) \\tkzGetPoint{${cmd.auxName}}`);
    return true;
  }
  if (cmd.kind === "DefCircleSimilitudeCenter") {
    const macro = cmd.mode === "outer" ? "tkzDefExtSimilitudeCenter" : "tkzDefIntSimilitudeCenter";
    caps.assertTkzMacro(macro);
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\${macro}(${cmd.circleAO},${cmd.circleAX})(${cmd.circleBO},${cmd.circleBX}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }
  if (cmd.kind === "DefCircleTangentsFromPoint") {
    caps.assertTkzMacro("tkzDefLine");
    caps.assertTkzMacro("tkzGetPoints");
    out.push(
      `\\tkzDefLine[tangent from = ${cmd.from}](${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${cmd.firstName}}{${cmd.secondName}}`
    );
    return true;
  }
  if (cmd.kind === "DefAngleBisectorLine") {
    caps.assertAngleBisectorMacro("tkzDefTriangleCenter");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzDefTriangleCenter[in](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.auxName}}`);
    return true;
  }
  if (cmd.kind === "InterLL") {
    caps.assertTkzMacro("tkzInterLL");
    caps.assertTkzMacro("tkzGetPoint");
    out.push(`\\tkzInterLL(${cmd.a1},${cmd.a2})(${cmd.b1},${cmd.b2}) \\tkzGetPoint{${cmd.name}}`);
    return true;
  }

  return false;
}
