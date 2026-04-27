import { renderTikz, type TikzCommand } from "../tikz.ts";

function assertIncludes(value: string, expected: string): void {
  if (!value.includes(expected)) {
    throw new Error(`Expected output to include ${expected}`);
  }
}

function assertNotIncludes(value: string, unexpected: string): void {
  if (value.includes(unexpected)) {
    throw new Error(`Expected output not to include ${unexpected}`);
  }
}

const commands: TikzCommand[] = [
  { kind: "SetupUnits", scale: 1 },
  {
    kind: "DefPoints",
    items: [
      { name: "A", x: 0, y: 0 },
      { name: "B", x: 1, y: 0 },
      { name: "C", x: 2, y: 0 },
      { name: "D", x: 3, y: 0 },
      { name: "E", x: 4, y: 0 },
      { name: "F", x: 5, y: 0 },
    ],
  },
  { kind: "DrawSegment", a: "A", b: "B", style: "color=black, line width=0.31pt" },
  { kind: "DrawSegment", a: "B", b: "C", style: "color=black, line width=0.31pt" },
  { kind: "DrawSegment", a: "C", b: "D", style: "color=black, line width=0.31pt" },
  { kind: "DrawSegment", a: "D", b: "E", style: "color=red, line width=0.31pt" },
  { kind: "DrawSegment", a: "E", b: "F", style: "color=red, line width=0.31pt" },
];

const tikz = renderTikz(commands, { emitTkzSetup: false });

assertIncludes(tikz, "\\tikzset{gdDrawStyle1/.style={color=black, line width=0.31pt}}");
assertIncludes(tikz, "\\tkzDrawSegment[gdDrawStyle1](A,B)");
assertIncludes(tikz, "\\tkzDrawSegment[gdDrawStyle1](B,C)");
assertIncludes(tikz, "\\tkzDrawSegment[gdDrawStyle1](C,D)");
assertIncludes(tikz, "\\tkzDrawSegment[color=red, line width=0.31pt](D,E)");
assertIncludes(tikz, "\\tkzDrawSegment[color=red, line width=0.31pt](E,F)");
assertNotIncludes(tikz, "gdDrawStyle2");

console.log("✓ draw style alias export test passed");
