import type { TikzCommand } from "../tikz";

type ConstructionRendererDeps = {
  pushSectionHeader: (title: string) => void;
  fmt: (value: number) => string;
  assertTkzMacro: (name: string) => void;
  assertPerpendicularMacro: (name: string) => void;
  assertParallelMacro: (name: string) => void;
  assertAngleBisectorMacro: (name: string) => void;
  assertAngleFixedMacro: (name: string) => void;
};

export function appendRenderedConstructions(
  out: string[],
  constructions: TikzCommand[],
  deps: ConstructionRendererDeps
): void {
  deps.pushSectionHeader("% Constructions");
  let interLCTmpIdx = 0;
  for (const cmd of constructions) {
    if (cmd.kind === "ConstructionComment") {
      out.push(`% ${cmd.text}`);
      continue;
    }
    if (cmd.kind === "DefMidPoint") {
      deps.assertTkzMacro("tkzDefMidPoint");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefMidPoint(${cmd.a},${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnLine") {
      deps.assertTkzMacro("tkzDefPointBy");
      deps.assertTkzMacro("tkzGetPoint");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tRaw = (cmd as any).t;
      const t = typeof tRaw === "number" && Number.isFinite(tRaw) ? tRaw : 0.5;
      out.push(`\\tkzDefPointBy[homothety=center ${cmd.a} ratio ${deps.fmt(t)}](${cmd.b}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointByRotation") {
      deps.assertAngleFixedMacro("tkzDefPointBy");
      deps.assertTkzMacro("tkzGetPoint");
      if (cmd.direction !== "CCW" && cmd.direction !== "CW") {
        throw new Error("Unsupported AngleFixed option: direction=CW (no tkz mapping)");
      }
      const signedAngle = cmd.direction === "CW" ? -Math.abs(cmd.angleDeg) : Math.abs(cmd.angleDeg);
      out.push(
        `\\tkzDefPointBy[rotation=center ${cmd.center} angle ${deps.fmt(signedAngle)}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`
      );
      continue;
    }
    if (cmd.kind === "DefPointByTranslation") {
      deps.assertTkzMacro("tkzDefPointBy");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefPointBy[translation= from ${cmd.from} to ${cmd.to}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointByDilation") {
      deps.assertTkzMacro("tkzDefPointBy");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(
        `\\tkzDefPointBy[homothety=center ${cmd.center} ratio ${deps.fmt(cmd.factor)}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`
      );
      continue;
    }
    if (cmd.kind === "DefPointByProjection") {
      deps.assertTkzMacro("tkzDefPointBy");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefPointBy[projection=onto ${cmd.axisA}--${cmd.axisB}](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPointByReflection") {
      deps.assertTkzMacro("tkzDefPointBy");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefPointBy[projection=onto ${cmd.axisA}--${cmd.axisB}](${cmd.point}) \\tkzGetPoint{${cmd.footName}}`);
      out.push(`\\tkzDefPointBy[homothety=center ${cmd.footName} ratio -1](${cmd.point}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefPerpendicularLine") {
      deps.assertPerpendicularMacro("tkzDefLine");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefLine[perpendicular=through ${cmd.through}](${cmd.baseA},${cmd.baseB}) \\tkzGetPoint{${cmd.auxName}}`);
      continue;
    }
    if (cmd.kind === "DefParallelLine") {
      deps.assertParallelMacro("tkzDefLine");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefLine[parallel=through ${cmd.through}](${cmd.baseA},${cmd.baseB}) \\tkzGetPoint{${cmd.auxName}}`);
      continue;
    }
    if (cmd.kind === "DefCircleSimilitudeCenter") {
      const macro = cmd.mode === "outer" ? "tkzDefExtSimilitudeCenter" : "tkzDefIntSimilitudeCenter";
      deps.assertTkzMacro(macro);
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\${macro}(${cmd.circleAO},${cmd.circleAX})(${cmd.circleBO},${cmd.circleBX}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefCircleTangentsFromPoint") {
      deps.assertTkzMacro("tkzDefLine");
      deps.assertTkzMacro("tkzGetPoints");
      out.push(
        `\\tkzDefLine[tangent from = ${cmd.from}](${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${cmd.firstName}}{${cmd.secondName}}`
      );
      continue;
    }
    if (cmd.kind === "DefAngleBisectorLine") {
      deps.assertAngleBisectorMacro("tkzDefTriangleCenter");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefTriangleCenter[in](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.auxName}}`);
      continue;
    }
    if (cmd.kind === "DefTriangleCenterPoint") {
      deps.assertTkzMacro("tkzDefTriangleCenter");
      deps.assertTkzMacro("tkzGetPoint");
      const mode = cmd.centerKind === "incenter" ? "in" : cmd.centerKind === "centroid" ? "centroid" : "ortho";
      out.push(`\\tkzDefTriangleCenter[${mode}](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "DefCircleCircumCenter") {
      deps.assertTkzMacro("tkzDefCircle");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzDefCircle[circum](${cmd.a},${cmd.b},${cmd.c}) \\tkzGetPoint{${cmd.centerName}}`);
      continue;
    }
    if (cmd.kind === "DefPointOnCircle") {
      deps.assertTkzMacro("tkzDefPointOnCircle");
      deps.assertTkzMacro("tkzGetPoint");
      const deg = (cmd.theta * 180) / Math.PI;
      out.push(`\\tkzDefPointOnCircle[through = center ${cmd.center} angle ${deps.fmt(deg)} point ${cmd.through}]`);
      out.push(`\\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLL") {
      deps.assertTkzMacro("tkzInterLL");
      deps.assertTkzMacro("tkzGetPoint");
      out.push(`\\tkzInterLL(${cmd.a1},${cmd.a2})(${cmd.b1},${cmd.b2}) \\tkzGetPoint{${cmd.name}}`);
      continue;
    }
    if (cmd.kind === "InterLC") {
      interLCTmpIdx += 1;
      const otherName = `tkzInterLC_${interLCTmpIdx}_other`;

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

      deps.assertTkzMacro("tkzInterLC");
      deps.assertTkzMacro("tkzGetPoints");
      out.push(`\\tkzInterLC${opt}(${cmd.lineA},${cmd.lineB})(${cmd.circleO},${cmd.circleX}) \\tkzGetPoints{${p1}}{${p2}}`);
      continue;
    }
    if (cmd.kind === "InterCC") {
      interLCTmpIdx += 1;
      const otherName = `tkzInterCC_${interLCTmpIdx}_other`;

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

      deps.assertTkzMacro("tkzInterCC");
      deps.assertTkzMacro("tkzGetPoints");
      out.push(`\\tkzInterCC${opt}(${cmd.circleAO},${cmd.circleAX})(${cmd.circleBO},${cmd.circleBX}) \\tkzGetPoints{${p1}}{${p2}}`);
      continue;
    }
  }
}
