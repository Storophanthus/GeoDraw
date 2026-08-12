import { parseCommandInput, type ParseContext } from "../../CommandParser";
import { evaluateAngleExpressionDegrees, evaluateNumberExpression, type SceneModel } from "../points";

function mustExpr(input: string, ctx: ParseContext, expected: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "expr") throw new Error(`Expected expr for '${input}', got ${JSON.stringify(out)}`);
  if (out.value !== expected) throw new Error(`Expected '${expected}' for '${input}', got '${out.value}'`);
}

function mustCmd(input: string, ctx: ParseContext, type: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "cmd") throw new Error(`Expected cmd for '${input}', got ${JSON.stringify(out)}`);
  if (out.cmd.type !== type) throw new Error(`Expected cmd type '${type}', got '${out.cmd.type}'`);
  return out.cmd;
}

function mustAssignScalar(input: string, ctx: ParseContext, name: string, value: number) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "assignScalar") throw new Error(`Expected assignScalar for '${input}', got ${JSON.stringify(out)}`);
  if (out.name !== name) throw new Error(`Expected assignScalar name '${name}', got '${out.name}'`);
  if (Math.abs(out.value - value) > 1e-9) throw new Error(`Expected assignScalar value '${value}', got '${out.value}'`);
}

function mustAssignObject(input: string, ctx: ParseContext, name: string, type: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "assignObject") throw new Error(`Expected assignObject for '${input}', got ${JSON.stringify(out)}`);
  if (out.name !== name) throw new Error(`Expected assignObject name '${name}', got '${out.name}'`);
  if (out.cmd.type !== type) throw new Error(`Expected assignObject cmd type '${type}', got '${out.cmd.type}'`);
  return out.cmd;
}

function mustAssignMap(input: string, ctx: ParseContext, name: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "assignTransformationMap") {
    throw new Error(`Expected assignTransformationMap for '${input}', got ${JSON.stringify(out)}`);
  }
  if (out.name !== name) throw new Error(`Expected map name '${name}', got '${out.name}'`);
  return out.definition;
}

function mustError(input: string, ctx: ParseContext, contains?: string) {
  const out = parseCommandInput(input, ctx);
  if (out.kind !== "error") throw new Error(`Expected error for '${input}', got ${JSON.stringify(out)}`);
  if (contains && !out.message.includes(contains)) {
    throw new Error(`Expected error containing '${contains}', got '${out.message}'`);
  }
}

const baseCtx: ParseContext = {
  ans: 0,
  symbolsByLabel: new Map([
    ["A", [{ kind: "point", id: "pA", label: "A" }]],
    ["B", [{ kind: "point", id: "pB", label: "B" }]],
    ["R", [{ kind: "point", id: "pR", label: "R" }]],
    ["O", [{ kind: "point", id: "pO", label: "O" }]],
  ]),
  pointWorldById: new Map([
    ["pA", { x: 0, y: 0 }],
    ["pB", { x: 3, y: 4 }],
    ["pR", { x: -1, y: 0 }],
    ["pC", { x: 3, y: 0 }],
    ["pO", { x: 1, y: 1 }],
  ]),
  lineWorldAnchorsById: new Map([
    ["lAB", { a: { x: 0, y: 0 }, b: { x: 3, y: 4 } }],
    ["rayAB", { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, ray: true }],
  ]),
  segmentWorldAnchorsById: new Map([
    ["sAB", { a: { x: 0, y: 0 }, b: { x: 3, y: 4 } }],
  ]),
  circleWorldGeometryById: new Map([
    ["c1", { center: { x: 0, y: 0 }, radius: 5 }],
  ]),
  polygonPointIdsById: new Map([
    ["pg1", ["pA", "pB", "pC"]],
  ]),
  scalarsByName: new Map(),
  objectAliases: new Map([
    ["sAB", { type: "segment", id: "sAB" }],
    ["lAB", { type: "line", id: "lAB" }],
    ["rayAB", { type: "line", id: "rayAB" }],
    ["c1", { type: "circle", id: "c1" }],
    ["pg1", { type: "polygon", id: "pg1" }],
  ]),
  objectNames: new Set(),
};
baseCtx.symbolsByLabel.set("C", [{ kind: "point", id: "pC", label: "C" }]);

mustExpr("5*5", baseCtx, "25");
mustExpr("1+2*3", baseCtx, "7");
mustExpr("Pi", baseCtx, "3.14159265359");
mustExpr("sin(pi/2)", baseCtx, "1");
mustExpr("Sin(Pi/2)", baseCtx, "1");
mustExpr("asin(1)", baseCtx, "1.57079632679");
mustExpr("acos(1)", baseCtx, "0");
mustExpr("atan(1)", baseCtx, "0.785398163397");
mustExpr("atan2(1,0)", baseCtx, "1.57079632679");
mustExpr("Atan2(1,1)", baseCtx, "0.785398163397");
mustExpr("sind(30)", baseCtx, "0.5");
mustExpr("cosd(60)", baseCtx, "0.5");
mustExpr("tand(45)", baseCtx, "1");
mustExpr("asind(1)", baseCtx, "90");
mustExpr("acosd(0)", baseCtx, "90");
mustExpr("atand(1)", baseCtx, "45");
mustExpr("atan2d(1,0)", baseCtx, "90");
mustExpr("Atan2d(1,1)", baseCtx, "45");
mustExpr("Angle(A,B,C)+1", baseCtx, "37.8698976458");

mustCmd("Point(1,2)", baseCtx, "CreatePointXY");
mustCmd("Line(0,0,3,4)", baseCtx, "CreateLineXY");
mustCmd("Circle(0,0,5)", baseCtx, "CreateCircleXYR");
mustError("Circle(0,0,-1)", baseCtx, "Circle radius must be > 0");

const lineAB = mustCmd("Line(A,B)", baseCtx, "CreateLineByPoints");
if (lineAB.type !== "CreateLineByPoints" || lineAB.aId !== "pA" || lineAB.bId !== "pB") {
  throw new Error("Line(A,B) IDs mismatch");
}

const rayAB = mustCmd("Ray(A,B)", baseCtx, "CreateRayByPoints");
if (rayAB.type !== "CreateRayByPoints" || rayAB.originId !== "pA" || rayAB.throughId !== "pB") {
  throw new Error("Ray(A,B) IDs mismatch");
}
mustError("Ray(A,A)", baseCtx, "must be distinct");

const segAB = mustCmd("Segment(A,B)", baseCtx, "CreateSegmentByPoints");
if (segAB.type !== "CreateSegmentByPoints" || segAB.aId !== "pA" || segAB.bId !== "pB") {
  throw new Error("Segment(A,B) IDs mismatch");
}

const polyABO = mustCmd("Polygon(A,B,O)", baseCtx, "CreatePolygonByPoints");
if (polyABO.type !== "CreatePolygonByPoints" || polyABO.pointIds.join(",") !== "pA,pB,pO") {
  throw new Error("Polygon(A,B,O) IDs mismatch");
}
const regularPoly = mustCmd("RegularPolygon(A,B,5)", baseCtx, "CreateRegularPolygonFromEdge");
if (
  regularPoly.type !== "CreateRegularPolygonFromEdge" ||
  regularPoly.aId !== "pA" ||
  regularPoly.bId !== "pB" ||
  regularPoly.sides !== 5 ||
  regularPoly.direction !== "CCW"
) {
  throw new Error("RegularPolygon(A,B,5) mismatch");
}
const regularPolyCW = mustCmd("RegularPolygon(A,B,5,CW)", baseCtx, "CreateRegularPolygonFromEdge");
if (regularPolyCW.type !== "CreateRegularPolygonFromEdge" || regularPolyCW.direction !== "CW") {
  throw new Error("RegularPolygon(A,B,5,CW) mismatch");
}
mustError("RegularPolygon(A,B,2)", baseCtx, "side count must be in [3, 64]");

const midAB = mustCmd("Midpoint(A,B)", baseCtx, "CreateMidpointByPoints");
if (midAB.type !== "CreateMidpointByPoints" || midAB.aId !== "pA" || midAB.bId !== "pB") {
  throw new Error("Midpoint(A,B) mismatch");
}

const midSeg = mustCmd("Midpoint(sAB)", baseCtx, "CreateMidpointBySegment");
if (midSeg.type !== "CreateMidpointBySegment" || midSeg.segId !== "sAB") {
  throw new Error("Midpoint(sAB) mismatch");
}

const translated = mustCmd("Translate(A,O,B)", baseCtx, "CreatePointByTranslation");
if (translated.type !== "CreatePointByTranslation" || translated.pointId !== "pA" || translated.fromId !== "pO" || translated.toId !== "pB") {
  throw new Error("Translate(A,O,B) mismatch");
}

const rotated = mustCmd("Rotate(A,O,30,CW)", baseCtx, "CreatePointByRotation");
if (
  rotated.type !== "CreatePointByRotation" ||
  rotated.pointId !== "pA" ||
  rotated.centerId !== "pO" ||
  rotated.angleExpr !== "30" ||
  Math.abs(rotated.angleDeg - 30) > 1e-9 ||
  rotated.direction !== "CW"
) {
  throw new Error("Rotate(A,O,30,CW) mismatch");
}

const dilated = mustCmd("Dilate(B,O,2)", baseCtx, "CreatePointByDilation");
if (dilated.type !== "CreatePointByDilation" || dilated.pointId !== "pB" || dilated.centerId !== "pO" || dilated.factorExpr !== "2") {
  throw new Error("Dilate(B,O,2) mismatch");
}

const homothetic = mustCmd("Homothety(B,O,2)", baseCtx, "CreatePointByDilation");
if (homothetic.type !== "CreatePointByDilation" || homothetic.pointId !== "pB" || homothetic.centerId !== "pO") {
  throw new Error("Homothety(B,O,2) mismatch");
}

const inverted = mustCmd("Inversion(B,c1)", baseCtx, "CreatePointByInversion");
if (inverted.type !== "CreatePointByInversion" || inverted.pointId !== "pB" || inverted.circleId !== "c1") {
  throw new Error("Inversion(B,c1) mismatch");
}

const mapCtx: ParseContext = { ...baseCtx, transformationMaps: new Map() };
const fMap = mustAssignMap("f = Homothety(O,2)", mapCtx, "f");
mapCtx.transformationMaps!.set("f", fMap);
const gMap = mustAssignMap("g = Inversion(c1)", mapCtx, "g");
mapCtx.transformationMaps!.set("g", gMap);
const translationMap = mustAssignMap("trMap = Translation(A,B)", mapCtx, "trMap");
if (translationMap.steps[0]?.kind !== "translation") throw new Error("Translation(A,B) map mismatch");
const rotationMap = mustAssignMap("rotMap = Rotation(O,30,CW)", mapCtx, "rotMap");
if (rotationMap.steps[0]?.kind !== "rotation" || rotationMap.steps[0].direction !== "CW") {
  throw new Error("Rotation(O,30,CW) map mismatch");
}
const dilationMap = mustAssignMap("dilMap = Dilation(O,3)", mapCtx, "dilMap");
if (dilationMap.steps[0]?.kind !== "homothety") throw new Error("Dilation(O,3) map mismatch");
const reflectionMap = mustAssignMap("refMap = Reflection(lAB)", mapCtx, "refMap");
if (reflectionMap.steps[0]?.kind !== "reflection" || reflectionMap.steps[0].axis.type !== "line") {
  throw new Error("Reflection(lAB) map mismatch");
}
const hMap = mustAssignMap("h = Compose(f,g)", mapCtx, "h");
if (hMap.steps.length !== 2 || hMap.steps[0].kind !== "inversion" || hMap.steps[1].kind !== "homothety") {
  throw new Error("Compose(f,g) must apply g first and f second");
}
mapCtx.transformationMaps!.set("h", hMap);
const hInverse = mustAssignMap("hInv = Inverse(h)", mapCtx, "hInv");
if (hInverse.steps.length !== 2 || hInverse.steps[0].kind !== "homothety" || hInverse.steps[1].kind !== "inversion") {
  throw new Error("Inverse(h) must reverse the composed step order");
}
if (hInverse.steps[0].kind !== "homothety" || hInverse.steps[0].factorExpr !== "1/(2)") {
  throw new Error("Inverse(h) must reciprocate the homothety factor");
}
const mapApplied = mustAssignObject("Q = f(B)", mapCtx, "Q", "ApplyPointTransformationMap");
if (mapApplied.type !== "ApplyPointTransformationMap" || mapApplied.pointId !== "pB") {
  throw new Error("f(B) map application mismatch");
}
mustAssignObject("Q2 = Apply(Inverse(f),B)", mapCtx, "Q2", "ApplyPointTransformationMap");

const zeroMapCtx: ParseContext = {
  ...baseCtx,
  transformationMaps: new Map([["z", { steps: [{ kind: "homothety", centerId: "pO", factorExpr: "0" }] }]]),
};
mustError("zInv = Inverse(z)", zeroMapCtx, "zero factor");

const reflected = mustCmd("Reflect(B,lAB)", baseCtx, "CreatePointByReflection");
if (reflected.type !== "CreatePointByReflection" || reflected.pointId !== "pB" || reflected.axis.type !== "line" || reflected.axis.id !== "lAB") {
  throw new Error("Reflect(B,lAB) mismatch");
}
const reflectedCenter = mustCmd("Reflect(B,O)", baseCtx, "CreatePointByReflection");
if (reflectedCenter.type !== "CreatePointByReflection" || reflectedCenter.pointId !== "pB" || reflectedCenter.axis.type !== "point" || reflectedCenter.axis.id !== "pO") {
  throw new Error("Reflect(B,O) mismatch");
}
const reflectedPair = mustCmd("Reflect(B,A,C)", baseCtx, "CreatePointByReflection");
if (reflectedPair.type !== "CreatePointByReflection" || reflectedPair.axis.type !== "pointPair" || reflectedPair.axis.aId !== "pA" || reflectedPair.axis.bId !== "pC") {
  throw new Error("Reflect(B,A,C) mismatch");
}
const reflectedInlineSegment = mustCmd("Reflect(B,Segment(A,C))", baseCtx, "CreatePointByReflection");
if (
  reflectedInlineSegment.type !== "CreatePointByReflection" ||
  reflectedInlineSegment.axis.type !== "pointPair" ||
  reflectedInlineSegment.axis.aId !== "pA" ||
  reflectedInlineSegment.axis.bId !== "pC"
) {
  throw new Error("Reflect(B,Segment(A,C)) mismatch");
}

const projected = mustCmd("Orthoproject(C,A,B)", baseCtx, "CreatePointByProjection");
if (projected.type !== "CreatePointByProjection" || projected.pointId !== "pC" || projected.axisAId !== "pA" || projected.axisBId !== "pB") {
  throw new Error("Orthoproject(C,A,B) mismatch");
}
mustError("Orthoproject(C,A,A)", baseCtx, "axis points must be distinct");

const circleOA = mustCmd("Circle(O,A)", baseCtx, "CreateCircleCenterThrough");
if (circleOA.type !== "CreateCircleCenterThrough" || circleOA.centerId !== "pO" || circleOA.throughId !== "pA") {
  throw new Error("Circle(O,A) mismatch");
}

const circleOR = mustCmd("Circle(O,5)", baseCtx, "CreateCircleCenterRadius");
if (circleOR.type !== "CreateCircleCenterRadius" || circleOR.centerId !== "pO" || circleOR.r !== 5 || circleOR.rExpr !== "5") {
  throw new Error("Circle(O,5) mismatch");
}
const circleODist = mustCmd("Circle(A,Distance(A,B))", baseCtx, "CreateCircleCenterRadius");
if (
  circleODist.type !== "CreateCircleCenterRadius" ||
  circleODist.centerId !== "pA" ||
  Math.abs(circleODist.r - 5) > 1e-9 ||
  circleODist.rExpr !== "Distance(A,B)"
) {
  throw new Error("Circle(A,Distance(A,B)) mismatch");
}
const circleOSymbolic = mustCmd("Circle(O,96*sqrt(5))", baseCtx, "CreateCircleCenterRadius");
if (
  circleOSymbolic.type !== "CreateCircleCenterRadius" ||
  circleOSymbolic.centerId !== "pO" ||
  Math.abs(circleOSymbolic.r - 96 * Math.sqrt(5)) > 1e-9 ||
  circleOSymbolic.rExpr !== "96*sqrt(5)"
) {
  throw new Error("Circle(O,96*sqrt(5)) mismatch");
}

const circle3p = mustCmd("Circle3P(A,B,O)", baseCtx, "CreateCircleThreePoint");
if (circle3p.type !== "CreateCircleThreePoint" || circle3p.aId !== "pA" || circle3p.bId !== "pB" || circle3p.cId !== "pO") {
  throw new Error("Circle3P(A,B,O) mismatch");
}
const ellipseABO = mustCmd("Ellipse(A,B,O)", baseCtx, "CreateEllipseFociPoint");
if (
  ellipseABO.type !== "CreateEllipseFociPoint" ||
  ellipseABO.focusAId !== "pA" ||
  ellipseABO.focusBId !== "pB" ||
  ellipseABO.throughId !== "pO"
) {
  throw new Error("Ellipse(A,B,O) mismatch");
}
mustError("Ellipse(A,A,O)", baseCtx, "foci must be distinct");

const incircle = mustCmd("Incircle(A,B,O)", baseCtx, "CreateIncircle");
if (incircle.type !== "CreateIncircle" || incircle.aId !== "pA" || incircle.bId !== "pB" || incircle.cId !== "pO") {
  throw new Error("Incircle(A,B,O) mismatch");
}

const perp = mustCmd("Perpendicular(A,lAB)", baseCtx, "CreatePerpendicularLine");
if (perp.type !== "CreatePerpendicularLine" || perp.throughId !== "pA" || perp.base.type !== "line" || perp.base.id !== "lAB") {
  throw new Error("Perpendicular(A,lAB) mismatch");
}

const perpBis = mustCmd("PerpBisector(A,B)", baseCtx, "CreatePerpendicularBisector");
if (perpBis.type !== "CreatePerpendicularBisector" || perpBis.aId !== "pA" || perpBis.bId !== "pB") {
  throw new Error("PerpBisector(A,B) mismatch");
}

const perpBisLong = mustCmd("PerpendicularBisector(A,B)", baseCtx, "CreatePerpendicularBisector");
if (perpBisLong.type !== "CreatePerpendicularBisector" || perpBisLong.aId !== "pA" || perpBisLong.bId !== "pB") {
  throw new Error("PerpendicularBisector(A,B) mismatch");
}

const parallel = mustCmd("Parallel(B,sAB)", baseCtx, "CreateParallelLine");
if (parallel.type !== "CreateParallelLine" || parallel.throughId !== "pB" || parallel.base.type !== "segment" || parallel.base.id !== "sAB") {
  throw new Error("Parallel(B,sAB) mismatch");
}

const tangent = mustCmd("Tangent(A,c1)", baseCtx, "CreateTangentLines");
if (tangent.type !== "CreateTangentLines" || tangent.throughId !== "pA" || tangent.circleId !== "c1") {
  throw new Error("Tangent(A,c1) mismatch");
}

const bis = mustCmd("AngleBisector(A,B,O)", baseCtx, "CreateAngleBisector");
if (bis.type !== "CreateAngleBisector" || bis.aId !== "pA" || bis.bId !== "pB" || bis.cId !== "pO") {
  throw new Error("AngleBisector(A,B,O) mismatch");
}

const angle = mustCmd("Angle(A,B,O)", baseCtx, "CreateAngle");
if (angle.type !== "CreateAngle" || angle.aId !== "pA" || angle.bId !== "pB" || angle.cId !== "pO") {
  throw new Error("Angle(A,B,O) mismatch");
}

const markedAngle = mustCmd("MarkedAngle(A,B,O)", baseCtx, "CreateAngle");
if (markedAngle.type !== "CreateAngle" || markedAngle.aId !== "pA" || markedAngle.bId !== "pB" || markedAngle.cId !== "pO") {
  throw new Error("MarkedAngle(A,B,O) mismatch");
}

const angleFixed = mustCmd("AngleFixed(B,A,30,CW)", baseCtx, "CreateAngleFixed");
if (
  angleFixed.type !== "CreateAngleFixed" ||
  angleFixed.vertexId !== "pB" ||
  angleFixed.basePointId !== "pA" ||
  angleFixed.angleExpr !== "30" ||
  angleFixed.direction !== "CW"
) {
  throw new Error("AngleFixed(B,A,30,CW) mismatch");
}

const sector = mustCmd("Sector(O,A,B)", baseCtx, "CreateSector");
if (sector.type !== "CreateSector" || sector.centerId !== "pO" || sector.startId !== "pA" || sector.endId !== "pB") {
  throw new Error("Sector(O,A,B) mismatch");
}

mustExpr("Distance(A,B)", baseCtx, "5");
mustExpr("Distance(O,lAB)", baseCtx, "0.2");
mustExpr("Distance(lAB,O)", baseCtx, "0.2");
mustExpr("Distance(R,rayAB)", baseCtx, "1");
mustExpr("Distance(O,sAB)", baseCtx, "0.2");
mustExpr("Distance(sAB,O)", baseCtx, "0.2");
mustAssignScalar("ac = Area(c1)", baseCtx, "ac", Math.PI * 25);
mustAssignScalar("pc = Perimeter(c1)", baseCtx, "pc", 10 * Math.PI);
mustAssignScalar("ap = Area(pg1)", baseCtx, "ap", 6);
mustAssignScalar("pp = Perimeter(pg1)", baseCtx, "pp", 12);
mustAssignScalar("m = Area(pg1)+Perimeter(c1)", baseCtx, "m", 6 + 10 * Math.PI);

mustAssignScalar("n_1 = 2.023242", baseCtx, "n_1", 2.023242);
mustAssignScalar("r = 5*5", baseCtx, "r", 25);
mustAssignScalar("r = Distance(A,B)", baseCtx, "r", 5);
mustAssignScalar("d=Distance(A,B)^2 - Distance(B,C)*Distance(C,A)", baseCtx, "d", 13);

const sceneDistanceParity: SceneModel = {
  points: [
    {
      id: "pA",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: {} as never,
    },
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 3, y: 4 },
      style: {} as never,
    },
    {
      id: "pO",
      kind: "free",
      name: "O",
      captionTex: "O",
      visible: true,
      showLabel: "name",
      position: { x: 1, y: 1 },
      style: {} as never,
    },
    {
      id: "pC",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: 3, y: 0 },
      style: {} as never,
    },
  ],
  vectors: [],
  segments: [
    {
      id: "sAB",
      aId: "pA",
      bId: "pB",
      visible: true,
      showLabel: false,
      style: {} as never,
    },
  ],
  lines: [
    {
      id: "lAB",
      aId: "pA",
      bId: "pB",
      visible: true,
      style: {} as never,
    },
  ],
  circles: [
    {
      id: "c1",
      kind: "twoPoint",
      centerId: "pA",
      throughId: "pB",
      visible: true,
      style: {} as never,
    },
  ],
  polygons: [
    {
      id: "pg1",
      pointIds: ["pA", "pB", "pC"],
      visible: true,
      style: {} as never,
    },
  ],
  angles: [],
  numbers: [],
  textLabels: [],
};

const sceneDistAB = evaluateNumberExpression(sceneDistanceParity, "Distance(A,B)");
if (!sceneDistAB.ok || Math.abs(sceneDistAB.value - 5) > 1e-9) {
  throw new Error(`Scene Distance(A,B) mismatch: ${JSON.stringify(sceneDistAB)}`);
}
const sceneDistLine = evaluateNumberExpression(sceneDistanceParity, "Distance(O,lAB)");
if (!sceneDistLine.ok || Math.abs(sceneDistLine.value - 0.2) > 1e-9) {
  throw new Error(`Scene Distance(O,lAB) mismatch: ${JSON.stringify(sceneDistLine)}`);
}
const sceneDistSeg = evaluateNumberExpression(sceneDistanceParity, "Distance(sAB,O)");
if (!sceneDistSeg.ok || Math.abs(sceneDistSeg.value - 0.2) > 1e-9) {
  throw new Error(`Scene Distance(sAB,O) mismatch: ${JSON.stringify(sceneDistSeg)}`);
}
const sceneScalarFn = evaluateNumberExpression(sceneDistanceParity, "sin(pi/2)+Distance(A,B)");
if (!sceneScalarFn.ok || Math.abs(sceneScalarFn.value - 6) > 1e-9) {
  throw new Error(`Scene scalar function parity mismatch: ${JSON.stringify(sceneScalarFn)}`);
}
const sceneAngleFn = evaluateNumberExpression(sceneDistanceParity, "Angle(A,B,C)");
if (!sceneAngleFn.ok || Math.abs(sceneAngleFn.value - 36.86989764584402) > 1e-9) {
  throw new Error(`Scene Angle(A,B,C) mismatch: ${JSON.stringify(sceneAngleFn)}`);
}
const sceneAngleExpr = evaluateAngleExpressionDegrees(sceneDistanceParity, "Angle(A,B,C)");
if (!sceneAngleExpr.ok || Math.abs(sceneAngleExpr.valueDeg - 36.86989764584402) > 1e-9) {
  throw new Error(`Scene angle-expression Angle(A,B,C) mismatch: ${JSON.stringify(sceneAngleExpr)}`);
}
const sceneInvTrigFn = evaluateNumberExpression(sceneDistanceParity, "atan2(4,3)+asin(1)-acos(0)");
if (!sceneInvTrigFn.ok || Math.abs(sceneInvTrigFn.value - Math.atan2(4, 3)) > 1e-9) {
  throw new Error(`Scene inverse trig parity mismatch: ${JSON.stringify(sceneInvTrigFn)}`);
}
const sceneDegTrigFn = evaluateNumberExpression(sceneDistanceParity, "atan2d(4,3)+asind(1)-acosd(0)");
if (!sceneDegTrigFn.ok || Math.abs(sceneDegTrigFn.value - Math.atan2(4, 3) * (180 / Math.PI)) > 1e-9) {
  throw new Error(`Scene degree trig parity mismatch: ${JSON.stringify(sceneDegTrigFn)}`);
}
const sceneAreaCircle = evaluateNumberExpression(sceneDistanceParity, "Area(c1)");
if (!sceneAreaCircle.ok || Math.abs(sceneAreaCircle.value - Math.PI * 25) > 1e-9) {
  throw new Error(`Scene Area(c1) mismatch: ${JSON.stringify(sceneAreaCircle)}`);
}
const scenePerimCircle = evaluateNumberExpression(sceneDistanceParity, "Perimeter(c1)");
if (!scenePerimCircle.ok || Math.abs(scenePerimCircle.value - 10 * Math.PI) > 1e-9) {
  throw new Error(`Scene Perimeter(c1) mismatch: ${JSON.stringify(scenePerimCircle)}`);
}
const sceneAreaPoly = evaluateNumberExpression(sceneDistanceParity, "Area(pg1)");
if (!sceneAreaPoly.ok || Math.abs(sceneAreaPoly.value - 6) > 1e-9) {
  throw new Error(`Scene Area(pg1) mismatch: ${JSON.stringify(sceneAreaPoly)}`);
}
const scenePerimPoly = evaluateNumberExpression(sceneDistanceParity, "Perimeter(pg1)");
if (!scenePerimPoly.ok || Math.abs(scenePerimPoly.value - 12) > 1e-9) {
  throw new Error(`Scene Perimeter(pg1) mismatch: ${JSON.stringify(scenePerimPoly)}`);
}

const assignPoint = mustAssignObject("P = Point(1,2)", baseCtx, "P", "CreatePointXY");
if (assignPoint.type !== "CreatePointXY" || assignPoint.x !== 1 || assignPoint.y !== 2) {
  throw new Error("P = Point(1,2) mismatch");
}

const assignPointVec = mustAssignObject("X = A + B", baseCtx, "X", "CreatePointXY");
if (assignPointVec.type !== "CreatePointXY" || assignPointVec.x !== 3 || assignPointVec.y !== 4) {
  throw new Error("X = A + B mismatch");
}

const assignPointAffine = mustAssignObject("Y = A + B/2", baseCtx, "Y", "CreatePointXY");
if (assignPointAffine.type !== "CreatePointXY" || Math.abs(assignPointAffine.x - 1.5) > 1e-9 || Math.abs(assignPointAffine.y - 2) > 1e-9) {
  throw new Error("Y = A + B/2 mismatch");
}

const assignPointTrig = mustAssignObject("W = A + cos(0)*B", baseCtx, "W", "CreatePointXY");
if (assignPointTrig.type !== "CreatePointXY" || Math.abs(assignPointTrig.x - 3) > 1e-9 || Math.abs(assignPointTrig.y - 4) > 1e-9) {
  throw new Error("W = A + cos(0)*B mismatch");
}

const assignPointTrigAtan2 = mustAssignObject("W2 = A + atan2(0,1)*B", baseCtx, "W2", "CreatePointXY");
if (assignPointTrigAtan2.type !== "CreatePointXY" || Math.abs(assignPointTrigAtan2.x) > 1e-9 || Math.abs(assignPointTrigAtan2.y) > 1e-9) {
  throw new Error("W2 = A + atan2(0,1)*B mismatch");
}

const assignPointTrigDeg = mustAssignObject("W3 = A + sind(90)*B", baseCtx, "W3", "CreatePointXY");
if (assignPointTrigDeg.type !== "CreatePointXY" || Math.abs(assignPointTrigDeg.x - 3) > 1e-9 || Math.abs(assignPointTrigDeg.y - 4) > 1e-9) {
  throw new Error("W3 = A + sind(90)*B mismatch");
}

const assignLine = mustAssignObject("l = Line(A,B)", baseCtx, "l", "CreateLineByPoints");
if (assignLine.type !== "CreateLineByPoints" || assignLine.aId !== "pA" || assignLine.bId !== "pB") {
  throw new Error("l = Line(A,B) mismatch");
}
const assignRay = mustAssignObject("r = Ray(A,B)", baseCtx, "r", "CreateRayByPoints");
if (assignRay.type !== "CreateRayByPoints" || assignRay.originId !== "pA" || assignRay.throughId !== "pB") {
  throw new Error("r = Ray(A,B) mismatch");
}
mustAssignScalar("t = Angle(A,B,C)", baseCtx, "t", 36.86989764584402);
const assignMarkedAngle = mustAssignObject("ang = MarkedAngle(A,B,C)", baseCtx, "ang", "CreateAngle");
if (assignMarkedAngle.type !== "CreateAngle" || assignMarkedAngle.aId !== "pA" || assignMarkedAngle.bId !== "pB" || assignMarkedAngle.cId !== "pC") {
  throw new Error("ang = MarkedAngle(A,B,C) mismatch");
}
const assignRegularPolygon = mustAssignObject("rp = RegularPolygon(A,B,6)", baseCtx, "rp", "CreateRegularPolygonFromEdge");
if (
  assignRegularPolygon.type !== "CreateRegularPolygonFromEdge" ||
  assignRegularPolygon.aId !== "pA" ||
  assignRegularPolygon.bId !== "pB" ||
  assignRegularPolygon.sides !== 6 ||
  assignRegularPolygon.direction !== "CCW"
) {
  throw new Error("rp = RegularPolygon(A,B,6) mismatch");
}

const assignMidpoint = mustAssignObject("M = Midpoint(A,B)", baseCtx, "M", "CreateMidpointByPoints");
if (assignMidpoint.type !== "CreateMidpointByPoints" || assignMidpoint.aId !== "pA" || assignMidpoint.bId !== "pB") {
  throw new Error("M = Midpoint(A,B) mismatch");
}

const assignPerpBisector = mustAssignObject("pb = PerpBisector(A,B)", baseCtx, "pb", "CreatePerpendicularBisector");
if (assignPerpBisector.type !== "CreatePerpendicularBisector" || assignPerpBisector.aId !== "pA" || assignPerpBisector.bId !== "pB") {
  throw new Error("pb = PerpBisector(A,B) mismatch");
}

const assignTranslated = mustAssignObject("T = Translate(A,O,B)", baseCtx, "T", "CreatePointByTranslation");
if (assignTranslated.type !== "CreatePointByTranslation" || assignTranslated.pointId !== "pA" || assignTranslated.fromId !== "pO" || assignTranslated.toId !== "pB") {
  throw new Error("T = Translate(A,O,B) mismatch");
}

const assignRotated = mustAssignObject("R = Rotate(A,O,45)", baseCtx, "R", "CreatePointByRotation");
if (assignRotated.type !== "CreatePointByRotation" || assignRotated.pointId !== "pA" || assignRotated.centerId !== "pO" || assignRotated.direction !== "CCW") {
  throw new Error("R = Rotate(A,O,45) mismatch");
}

const assignDilated = mustAssignObject("D = Dilate(B,O,3)", baseCtx, "D", "CreatePointByDilation");
if (assignDilated.type !== "CreatePointByDilation" || assignDilated.pointId !== "pB" || assignDilated.centerId !== "pO" || assignDilated.factorExpr !== "3") {
  throw new Error("D = Dilate(B,O,3) mismatch");
}

const assignReflected = mustAssignObject("Q = Reflect(B,sAB)", baseCtx, "Q", "CreatePointByReflection");
if (assignReflected.type !== "CreatePointByReflection" || assignReflected.pointId !== "pB" || assignReflected.axis.type !== "segment" || assignReflected.axis.id !== "sAB") {
  throw new Error("Q = Reflect(B,sAB) mismatch");
}
const assignReflectedCenter = mustAssignObject("Q2 = Reflect(B,O)", baseCtx, "Q2", "CreatePointByReflection");
if (
  assignReflectedCenter.type !== "CreatePointByReflection" ||
  assignReflectedCenter.pointId !== "pB" ||
  assignReflectedCenter.axis.type !== "point" ||
  assignReflectedCenter.axis.id !== "pO"
) {
  throw new Error("Q2 = Reflect(B,O) mismatch");
}
const assignReflectedInlineSegment = mustAssignObject("Q3 = Reflect(B,Segment(A,C))", baseCtx, "Q3", "CreatePointByReflection");
if (
  assignReflectedInlineSegment.type !== "CreatePointByReflection" ||
  assignReflectedInlineSegment.axis.type !== "pointPair" ||
  assignReflectedInlineSegment.axis.aId !== "pA" ||
  assignReflectedInlineSegment.axis.bId !== "pC"
) {
  throw new Error("Q3 = Reflect(B,Segment(A,C)) mismatch");
}

const assignProjected = mustAssignObject("H = Orthoproject(C,A,B)", baseCtx, "H", "CreatePointByProjection");
if (
  assignProjected.type !== "CreatePointByProjection" ||
  assignProjected.pointId !== "pC" ||
  assignProjected.axisAId !== "pA" ||
  assignProjected.axisBId !== "pB"
) {
  throw new Error("H = Orthoproject(C,A,B) mismatch");
}

const withScalarR: ParseContext = {
  ...baseCtx,
  scalarsByName: new Map([["r", 5]]),
};
const assignCircleThrough = mustAssignObject("c_1 = Circle(O,A)", withScalarR, "c_1", "CreateCircleCenterThrough");
if (assignCircleThrough.type !== "CreateCircleCenterThrough") throw new Error("c_1=Circle(O,A) type mismatch");
const assignCircleRadius = mustAssignObject("c_2 = Circle(O,r)", withScalarR, "c_2", "CreateCircleCenterRadius");
if (assignCircleRadius.type !== "CreateCircleCenterRadius" || assignCircleRadius.r !== 5 || assignCircleRadius.rExpr !== "r") {
  throw new Error("c_2=Circle(O,r) mismatch");
}
const withStoredRadiusLikeSymbol: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([
    ...baseCtx.symbolsByLabel.entries(),
    ["r_1", [{ kind: "other", id: "n_1", label: "r_1", type: "number" }]],
  ]),
  scalarsByName: new Map([["r_1", 5]]),
};
const assignCircleStoredRadius = mustAssignObject(
  "c_3 = Circle(O,r_1)",
  withStoredRadiusLikeSymbol,
  "c_3",
  "CreateCircleCenterRadius"
);
if (
  assignCircleStoredRadius.type !== "CreateCircleCenterRadius" ||
  assignCircleStoredRadius.r !== 5 ||
  assignCircleStoredRadius.rExpr !== "r_1"
) {
  throw new Error("c_3=Circle(O,r_1) mismatch");
}

const assignIncircle = mustAssignObject("ic = Incircle(A,B,O)", baseCtx, "ic", "CreateIncircle");
if (assignIncircle.type !== "CreateIncircle" || assignIncircle.aId !== "pA" || assignIncircle.bId !== "pB" || assignIncircle.cId !== "pO") {
  throw new Error("ic = Incircle(A,B,O) mismatch");
}

mustError("Line(A,Z)", baseCtx, "Unknown point: Z");

const ambiguousCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([
    [
      "A",
      [
        { kind: "point", id: "pA", label: "A" },
        { kind: "point", id: "pA2", label: "A" },
      ],
    ],
    ["B", [{ kind: "point", id: "pB", label: "B" }]],
  ]),
};
mustError("Line(A,B)", ambiguousCtx, "Ambiguous identifier: A");

const nonPointCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([
    ["X", [{ kind: "other", id: "n1", label: "X", type: "number" }]],
    ["A", [{ kind: "point", id: "pA", label: "A" }]],
    ["B", [{ kind: "point", id: "pB", label: "B" }]],
  ]),
};
mustError("Line(X,A)", nonPointCtx, "Not a point: X");
mustError("import('x')", baseCtx, "disallowed token");
mustError("t = Tangent(A,c1)", baseCtx, "Assignment is not supported for Tangent");

const overwriteScalarCtx: ParseContext = {
  ...baseCtx,
  scalarsByName: new Map([["n_1", 10]]),
};
mustAssignScalar("n_1 = 3", overwriteScalarCtx, "n_1", 3);

const overwritePointCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([["B", [{ kind: "point", id: "pB", label: "B" }]]]),
};
const redefinePoint = mustAssignObject("B = Point(1,2)", overwritePointCtx, "B", "CreatePointXY");
if (redefinePoint.type !== "CreatePointXY" || redefinePoint.x !== 1 || redefinePoint.y !== 2) {
  throw new Error("B = Point(1,2) redefine mismatch");
}

const unknownScalarCtx: ParseContext = {
  ...baseCtx,
  symbolsByLabel: new Map([["O", [{ kind: "point", id: "pO", label: "O" }]]]),
};
mustError("Circle(O,r)", unknownScalarCtx, "Unknown scalar: r");
mustError("Z = A + 2", baseCtx, "Unsupported + between point and scalar");

console.log("command-parser tests: OK");
