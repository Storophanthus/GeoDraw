import type { TikzCommand } from "../tikz";
import type { TikzRendererContext } from "./renderContext";

export function appendRenderedIntersectionConstruction(
  ctx: TikzRendererContext,
  cmd: TikzCommand
): boolean {
  const out = ctx.out;
  const caps = ctx.capabilities;

  if (cmd.kind === "InterLC") {
    ctx.state.interLCTmpIdx += 1;
    const otherName = `tkzInterLC_${ctx.state.interLCTmpIdx}_other`;

    let opt = "";
    let p1;
    let p2;
    if (cmd.common) {
      opt = `[common=${cmd.common}]`;
      // common is the 2nd result point in tkz-euclide
      p1 = cmd.name;
      p2 = cmd.common;
    } else {
      opt = "[near]";
      p1 = cmd.swap ? otherName : cmd.name;
      p2 = cmd.swap ? cmd.name : otherName;
    }

    caps.assertTkzMacro("tkzInterLC");
    caps.assertTkzMacro("tkzGetPoints");
    out.push(`\\tkzInterLC${opt}(${cmd.lineA},${cmd.lineB})(${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${p1}}{${p2}}`);
    return true;
  }

  if (cmd.kind === "InterCC") {
    ctx.state.interLCTmpIdx += 1;
    const otherName = `tkzInterCC_${ctx.state.interLCTmpIdx}_other`;

    let opt = "";
    let p1;
    let p2;
    if (cmd.common) {
      opt = `[common=${cmd.common}]`;
      // common is the 2nd result point
      p1 = cmd.name;
      p2 = cmd.common;
    } else {
      p1 = cmd.swap ? otherName : cmd.name;
      p2 = cmd.swap ? cmd.name : otherName;
    }

    caps.assertTkzMacro("tkzInterCC");
    caps.assertTkzMacro("tkzGetPoints");
    out.push(`\\tkzInterCC${opt}(${cmd.circleAO},${cmd.circleAX})(${cmd.circleBO},${cmd.circleBX}) \\tkzGetPoints{${p1}}{${p2}}`);
    return true;
  }

  return false;
}
