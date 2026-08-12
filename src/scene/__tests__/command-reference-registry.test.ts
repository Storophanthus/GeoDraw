import { parseCommandInput, type ParseContext, type Symbol } from "../../CommandParser";
import {
  COMMAND_SPECS,
  FUNCTION_SPECS,
  type CommandSpec,
  type FunctionSpec,
} from "../../ui/commandReference/commandReferenceData";
import { listRegisteredScalarFunctionNames } from "../eval/scalarFunctionRegistry";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function point(id: string, label: string): [string, Symbol[]] {
  return [label, [{ kind: "point", id, label }]];
}

const symbolsByLabel = new Map<string, Symbol[]>([
  point("pA", "A"),
  point("pB", "B"),
  point("pC", "C"),
  point("pD", "D"),
  point("pO", "O"),
  point("pP", "P"),
  point("pV", "V"),
  point("pX", "X"),
  point("pF1", "F1"),
  point("pF2", "F2"),
]);

const pointWorldById = new Map([
  ["pA", { x: 0, y: 0 }],
  ["pB", { x: 4, y: 0 }],
  ["pC", { x: 0, y: 3 }],
  ["pD", { x: 4, y: 3 }],
  ["pO", { x: 2, y: 2 }],
  ["pP", { x: 1, y: 1 }],
  ["pV", { x: 5, y: 5 }],
  ["pX", { x: 3, y: 3 }],
  ["pF1", { x: -2, y: 0 }],
  ["pF2", { x: 2, y: 0 }],
]);

// Fixture context mirroring buildParseContext (CommandBar.tsx) — every point,
// alias, and scalar referenced by a COMMAND_SPECS/FUNCTION_SPECS example or
// call-form variant must be declared here.
const ctx: ParseContext = {
  symbolsByLabel,
  pointWorldById,
  lineWorldAnchorsById: new Map([["lAC", { a: { x: 0, y: 0 }, b: { x: 0, y: 3 } }]]),
  segmentWorldAnchorsById: new Map([["sAB", { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }]]),
  circleWorldGeometryById: new Map([["c1", { center: { x: 2, y: 2 }, radius: 2 }]]),
  polygonPointIdsById: new Map([["poly1", ["pA", "pB", "pC"]]]),
  scalarsByName: new Map([["r_1", 3]]),
  objectAliases: new Map([
    ["s", { type: "segment", id: "sAB" }],
    ["l", { type: "line", id: "lAC" }],
    ["c", { type: "circle", id: "c1" }],
    ["poly", { type: "polygon", id: "poly1" }],
  ]),
  objectNames: new Set(["s", "l", "c", "poly"]),
  transformationMaps: new Map([
    ["f", { steps: [{ kind: "homothety", centerId: "pO", factorExpr: "2" }] }],
    ["g", { steps: [{ kind: "inversion", circleId: "c1" }] }],
  ]),
  ans: 1,
};

const CALL_FORM_RE = /^[A-Za-z][A-Za-z0-9_]*\s*\(.*\)$/;

function assertParses(input: string, sourceLabel: string): void {
  const result = parseCommandInput(input, ctx);
  if (result.kind === "error") {
    throw new Error(`${sourceLabel}: "${input}" failed to parse — ${result.message}`);
  }
}

// Every command spec's example must parse, and so must every variant that is
// itself a full call form (as opposed to a bare alias name like "Homothety").
for (const spec of COMMAND_SPECS as readonly CommandSpec[]) {
  assertParses(spec.example, `${spec.name} example`);
  for (const variant of spec.variants ?? []) {
    if (CALL_FORM_RE.test(variant)) {
      assertParses(variant, `${spec.name} variant`);
    }
  }
}

// Every function spec's example must also parse — nothing in the Functions
// tab should error if a teacher clicks it.
for (const spec of FUNCTION_SPECS as readonly FunctionSpec[]) {
  assertParses(spec.example, `${spec.name} function example`);
}

// Every non-constant FUNCTION_SPECS name must be a real key in the live
// scalar function registry — catches a typo'd or renamed function name.
const registeredNames = new Set(listRegisteredScalarFunctionNames());
for (const spec of FUNCTION_SPECS as readonly FunctionSpec[]) {
  if (spec.category === "Constants") continue;
  assert(registeredNames.has(spec.name), `FUNCTION_SPECS entry "${spec.name}" is not a registered scalar function`);
}

// Reverse coverage: every function actually in the registry must be
// represented in FUNCTION_SPECS, collapsing same-function case variants
// (Sin/sin, Angle/angle) down to one canonical name. This is a one-way
// check — it catches a future registry addition with no reference entry,
// but not a parser command added without one (see docs/handoff.md).
const CASE_SENSITIVE_EXACT = new Set(["Distance", "Area", "Perimeter", "Inradius", "Circumradius"]);

function canonicalRegistryName(rawName: string): string {
  if (CASE_SENSITIVE_EXACT.has(rawName)) return rawName;
  if (rawName.toLowerCase() === "angle") return "Angle";
  return rawName.toLowerCase();
}

const canonicalRegistryNames = new Set(listRegisteredScalarFunctionNames().map(canonicalRegistryName));
const functionSpecNames = new Set(
  (FUNCTION_SPECS as readonly FunctionSpec[]).filter((spec) => spec.category !== "Constants").map((spec) => spec.name)
);

for (const canonicalName of canonicalRegistryNames) {
  assert(functionSpecNames.has(canonicalName), `Registered function "${canonicalName}" is missing from FUNCTION_SPECS`);
}

// Basic sanity: no duplicate names within either list.
const commandNames = (COMMAND_SPECS as readonly CommandSpec[]).map((spec) => spec.name);
assert(new Set(commandNames).size === commandNames.length, "COMMAND_SPECS has duplicate command names");

const allFunctionNames = (FUNCTION_SPECS as readonly FunctionSpec[]).map((spec) => spec.name);
assert(new Set(allFunctionNames).size === allFunctionNames.length, "FUNCTION_SPECS has duplicate names");

console.log("command-reference-registry: ok");
