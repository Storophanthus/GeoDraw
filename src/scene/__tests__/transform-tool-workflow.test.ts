import { constructFromClick } from "../../engine";
import type { PendingSelection } from "../../state/slices/storeTypes";
import type { ToolClickHits } from "../../tools/toolClick";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

type TestIO = Parameters<typeof constructFromClick>[0]["io"];

type TransformMode = "translate" | "rotate" | "dilate" | "reflect";

const baseHits: ToolClickHits = {
  hitPointId: null,
  hitSegmentId: null,
  hitObject: null,
  shiftKey: false,
  hasCopyStyleSource: false,
  snap: null,
};

const pointWorldById = new Map<string, { x: number; y: number }>([
  ["pP", { x: 1, y: 2 }],
  ["pA", { x: -1, y: 0 }],
  ["pB", { x: 3, y: 4 }],
  ["pO", { x: 0, y: 0 }],
]);

function makeHarness(mode: TransformMode): {
  click: (hits: Partial<ToolClickHits>) => void;
  getPending: () => PendingSelection;
  logs: {
    rotationExpr: string[];
    translateCalls: Array<{ pointId: string; fromId: string; toId: string }>;
    rotateCalls: Array<{ centerId: string; pointId: string; angleDeg: number; direction: "CCW" | "CW"; angleExpr?: string }>;
    dilateCalls: Array<{ pointId: string; centerId: string; factorExpr: string }>;
    reflectCalls: Array<{ pointId: string; axis: { type: "line" | "segment"; id: string } }>;
  };
} {
  let pending: PendingSelection = null;
  const logs = {
    rotationExpr: [] as string[],
    translateCalls: [] as Array<{ pointId: string; fromId: string; toId: string }>,
    rotateCalls: [] as Array<{ centerId: string; pointId: string; angleDeg: number; direction: "CCW" | "CW"; angleExpr?: string }>,
    dilateCalls: [] as Array<{ pointId: string; centerId: string; factorExpr: string }>,
    reflectCalls: [] as Array<{ pointId: string; axis: { type: "line" | "segment"; id: string } }>,
  };

  const io: TestIO = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      throw new Error("Unexpected free point creation.");
    },
    createSegment() {
      return null;
    },
    createLine() {
      return null;
    },
    createPolygon() {
      return null;
    },
    createRegularPolygon() {
      return null;
    },
    createCircle() {
      return null;
    },
    createAuxiliaryCircle() {
      return null;
    },
    createCircleThreePoint() {
      return null;
    },
    createPerpendicularLine() {
      return null;
    },
    createParallelLine() {
      return null;
    },
    createTangentLines() {
      return [];
    },
    createCircleTangentLines() {
      return [];
    },
    createAngleBisectorLine() {
      return null;
    },
    createAngle() {
      return null;
    },
    createSector() {
      return null;
    },
    createAngleFixed() {
      return null;
    },
    createMidpointFromPoints() {
      return null;
    },
    createMidpointFromSegment() {
      return null;
    },
    createPointOnLine() {
      return null;
    },
    createPointOnSegment() {
      return null;
    },
    createPointOnCircle() {
      return null;
    },
    createPointByRotation(centerId, basePointId, angleDeg, direction, angleExpr) {
      logs.rotateCalls.push({ centerId, pointId: basePointId, angleDeg, direction, angleExpr });
      return "p_rot";
    },
    createPointByTranslation(pointId, fromId, toId) {
      logs.translateCalls.push({ pointId, fromId, toId });
      return "p_trans";
    },
    createPointByDilation(pointId, centerId, factorExpr) {
      logs.dilateCalls.push({ pointId, centerId, factorExpr });
      return "p_dil";
    },
    createPointByReflection(pointId, axis) {
      logs.reflectCalls.push({ pointId, axis });
      return "p_ref";
    },
    createIntersectionPoint() {
      return null;
    },
    createCircleCenterPoint() {
      return null;
    },
    setExportClipWorld() {},
    setSelectedObject() {},
    setCopyStyleSource() {},
    applyCopyStyleTo() {},
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: {
      mode,
      angleExpr: "30+15",
      direction: "CW",
      factorExpr: "1/2",
    },
    evaluateAngleExpressionDegrees(exprRaw) {
      logs.rotationExpr.push(exprRaw);
      return { ok: true, valueDeg: 45 };
    },
    getPointWorldById(id) {
      return pointWorldById.get(id) ?? null;
    },
    gridSnapEnabled: false,
    snapWorldToGrid(world) {
      return world;
    },
    camera: { pos: { x: 0, y: 0 }, zoom: 100 },
    vp: { widthPx: 800, heightPx: 600 },
  };

  const click = (hits: Partial<ToolClickHits>) => {
    constructFromClick({
      screen: { x: 400, y: 300 },
      activeTool: "transform",
      pendingSelection: pending,
      hits: { ...baseHits, ...hits },
      io,
    });
  };

  return {
    click,
    getPending: () => pending,
    logs,
  };
}

{
  const h = makeHarness("translate");
  h.click({ hitPointId: "pP", hitObject: { type: "point", id: "pP" } });
  const step2 = h.getPending();
  assert(!!step2 && step2.tool === "transform" && step2.step === 2 && step2.mode === "translate", "Translate step 1 should select source point.");
  h.click({ hitPointId: "pA", hitObject: { type: "point", id: "pA" } });
  const step3 = h.getPending();
  assert(!!step3 && step3.tool === "transform" && step3.step === 3 && step3.second.id === "pA", "Translate step 2 should select vector start.");
  h.click({ hitPointId: "pB", hitObject: { type: "point", id: "pB" } });
  assert(h.logs.translateCalls.length === 1, "Translate should create exactly one transformed point.");
  assert(
    h.logs.translateCalls[0].pointId === "pP" &&
      h.logs.translateCalls[0].fromId === "pA" &&
      h.logs.translateCalls[0].toId === "pB",
    "Translate should call createPointByTranslation(P,A,B)."
  );
  assert(h.getPending() === null, "Translate should clear pending state after creation.");
}

{
  const h = makeHarness("rotate");
  h.click({ hitPointId: "pP", hitObject: { type: "point", id: "pP" } });
  h.click({ hitPointId: "pO", hitObject: { type: "point", id: "pO" } });
  assert(h.logs.rotationExpr.length === 1 && h.logs.rotationExpr[0] === "30+15", "Rotate should evaluate configured angle expression.");
  assert(h.logs.rotateCalls.length === 1, "Rotate should create exactly one transformed point.");
  const rotate = h.logs.rotateCalls[0];
  assert(
    rotate.centerId === "pO" &&
      rotate.pointId === "pP" &&
      Math.abs(rotate.angleDeg - 45) <= 1e-12 &&
      rotate.direction === "CW" &&
      rotate.angleExpr === "30+15",
    "Rotate should call createPointByRotation(O,P,45,CW,expr)."
  );
  assert(h.getPending() === null, "Rotate should clear pending state after creation.");
}

{
  const h = makeHarness("dilate");
  h.click({ hitPointId: "pP", hitObject: { type: "point", id: "pP" } });
  h.click({ hitPointId: "pO", hitObject: { type: "point", id: "pO" } });
  assert(h.logs.dilateCalls.length === 1, "Dilate should create exactly one transformed point.");
  assert(
    h.logs.dilateCalls[0].pointId === "pP" &&
      h.logs.dilateCalls[0].centerId === "pO" &&
      h.logs.dilateCalls[0].factorExpr === "1/2",
    "Dilate should call createPointByDilation(P,O,factorExpr)."
  );
  assert(h.getPending() === null, "Dilate should clear pending state after creation.");
}

{
  const h = makeHarness("reflect");
  h.click({ hitPointId: "pP", hitObject: { type: "point", id: "pP" } });
  h.click({ hitObject: { type: "line", id: "l_axis" } });
  assert(h.logs.reflectCalls.length === 1, "Reflect should create exactly one transformed point.");
  assert(
    h.logs.reflectCalls[0].pointId === "pP" &&
      h.logs.reflectCalls[0].axis.type === "line" &&
      h.logs.reflectCalls[0].axis.id === "l_axis",
    "Reflect should call createPointByReflection with selected line axis."
  );
  assert(h.getPending() === null, "Reflect should clear pending state after creation.");
}

console.log("transform-tool-workflow: ok");
