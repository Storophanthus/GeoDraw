import { constructFromClick } from "../../engine";
import type { ActiveTool, PendingSelection } from "../../state/slices/storeTypes";
import type { ToolClickHits } from "../../tools/toolClick";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

type TestIO = Parameters<typeof constructFromClick>[0]["io"];

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

function makeHarness(activeTool: ActiveTool): {
  click: (hits: Partial<ToolClickHits>) => void;
  getPending: () => PendingSelection;
  logs: {
    translate: Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; fromId: string; toId: string }>;
    rotate: Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; centerId: string; angleExpr: string; direction: "CCW" | "CW" }>;
    dilate: Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; centerId: string; factorExpr: string }>;
    reflect: Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; axis: { type: "line" | "segment"; id: string } }>;
  };
} {
  let pending: PendingSelection = null;
  const logs = {
    translate: [] as Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; fromId: string; toId: string }>,
    rotate: [] as Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; centerId: string; angleExpr: string; direction: "CCW" | "CW" }>,
    dilate: [] as Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; centerId: string; factorExpr: string }>,
    reflect: [] as Array<{ source: { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }; axis: { type: "line" | "segment"; id: string } }>,
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
    createTextLabel() {
      return "txt_new";
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
    createPointByRotation() {
      return null;
    },
    createPointByTranslation() {
      return null;
    },
    createPointByDilation() {
      return null;
    },
    createPointByReflection() {
      return null;
    },
    transformObjectByTranslation(source, fromId, toId) {
      logs.translate.push({ source, fromId, toId });
      return "obj_t";
    },
    transformObjectByRotation(source, centerId, angleExpr, direction) {
      logs.rotate.push({ source, centerId, angleExpr, direction });
      return "obj_rot";
    },
    transformObjectByDilation(source, centerId, factorExpr) {
      logs.dilate.push({ source, centerId, factorExpr });
      return "obj_d";
    },
    transformObjectByReflection(source, axis) {
      logs.reflect.push({ source, axis });
      return "obj_r";
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
    enableObjectLabel() {},
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: {
      mode: "translate",
      angleExpr: "30+15",
      direction: "CW",
      factorExpr: "1/2",
    },
    evaluateAngleExpressionDegrees() {
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
      activeTool,
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
  h.click({ hitObject: { type: "point", id: "pP" }, hitPointId: "pP" });
  const step2 = h.getPending();
  assert(!!step2 && step2.tool === "translate" && step2.step === 2 && step2.source.id === "pP", "Translate step 1 should pick source object.");
  h.click({ hitObject: { type: "point", id: "pA" }, hitPointId: "pA" });
  const step3 = h.getPending();
  assert(!!step3 && step3.tool === "translate" && step3.step === 3 && step3.from.id === "pA", "Translate step 2 should pick vector start.");
  h.click({ hitObject: { type: "point", id: "pB" }, hitPointId: "pB" });
  assert(h.logs.translate.length === 1, "Translate should invoke object transform once.");
  assert(
    h.logs.translate[0].source.type === "point" &&
      h.logs.translate[0].source.id === "pP" &&
      h.logs.translate[0].fromId === "pA" &&
      h.logs.translate[0].toId === "pB",
    "Translate should call transformObjectByTranslation(point, A, B)."
  );
  assert(h.getPending() === null, "Translate should clear pending state.");
}

{
  const h = makeHarness("translate");
  h.click({ hitObject: { type: "segment", id: "sAB" } });
  h.click({ hitObject: { type: "point", id: "pA" }, hitPointId: "pA" });
  h.click({ hitObject: { type: "point", id: "pB" }, hitPointId: "pB" });
  assert(h.logs.translate.length === 1, "Segment translate should invoke object transform.");
  assert(
    h.logs.translate[0].source.type === "segment" &&
      h.logs.translate[0].source.id === "sAB",
    "Translate should preserve segment source identity."
  );
}

{
  const h = makeHarness("translate");
  h.click({ hitObject: { type: "line", id: "lAB" } });
  h.click({ hitObject: { type: "point", id: "pA" }, hitPointId: "pA" });
  h.click({ hitObject: { type: "point", id: "pB" }, hitPointId: "pB" });
  assert(h.logs.translate.length === 1, "Line translate should invoke object transform.");
  assert(
    h.logs.translate[0].source.type === "line" &&
      h.logs.translate[0].source.id === "lAB",
    "Translate should preserve line source identity."
  );
}

{
  const h = makeHarness("rotate");
  h.click({ hitObject: { type: "polygon", id: "poly1" } });
  const step2 = h.getPending();
  assert(!!step2 && step2.tool === "rotate" && step2.step === 2 && step2.source.id === "poly1", "Rotate step 1 should pick source object.");
  h.click({ hitObject: { type: "point", id: "pO" }, hitPointId: "pO" });
  assert(h.logs.rotate.length === 1, "Rotate should invoke object transform once.");
  assert(
    h.logs.rotate[0].source.type === "polygon" &&
      h.logs.rotate[0].source.id === "poly1" &&
      h.logs.rotate[0].centerId === "pO" &&
      h.logs.rotate[0].angleExpr === "30+15" &&
      h.logs.rotate[0].direction === "CW",
    "Rotate should call transformObjectByRotation(polygon, O, angleExpr, direction)."
  );
  assert(h.getPending() === null, "Rotate should clear pending state.");
}

{
  const h = makeHarness("dilate");
  h.click({ hitObject: { type: "circle", id: "c1" } });
  const step2 = h.getPending();
  assert(!!step2 && step2.tool === "dilate" && step2.step === 2 && step2.source.id === "c1", "Dilate step 1 should pick source object.");
  h.click({ hitObject: { type: "point", id: "pO" }, hitPointId: "pO" });
  assert(h.logs.dilate.length === 1, "Dilate should invoke object transform once.");
  assert(
    h.logs.dilate[0].source.type === "circle" &&
      h.logs.dilate[0].source.id === "c1" &&
      h.logs.dilate[0].centerId === "pO" &&
      h.logs.dilate[0].factorExpr === "1/2",
    "Dilate should call transformObjectByDilation(circle, O, factorExpr)."
  );
  assert(h.getPending() === null, "Dilate should clear pending state.");
}

{
  const h = makeHarness("reflect");
  h.click({ hitObject: { type: "polygon", id: "poly1" } });
  const step2 = h.getPending();
  assert(!!step2 && step2.tool === "reflect" && step2.step === 2 && step2.source.id === "poly1", "Reflect step 1 should pick source object.");
  h.click({ hitObject: { type: "line", id: "l_axis" } });
  assert(h.logs.reflect.length === 1, "Reflect should invoke object transform once.");
  assert(
    h.logs.reflect[0].source.type === "polygon" &&
      h.logs.reflect[0].source.id === "poly1" &&
      h.logs.reflect[0].axis.type === "line" &&
      h.logs.reflect[0].axis.id === "l_axis",
    "Reflect should call transformObjectByReflection(polygon, axis)."
  );
  assert(h.getPending() === null, "Reflect should clear pending state.");
}

console.log("transform-tool-workflow: ok");
