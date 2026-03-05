import { runConstructClickAdapter, type ConstructClickIo } from "../../view/constructClickAdapter";
import type { Camera, Viewport } from "../../view/camera";
import { getPointWorldPos, type SceneModel } from "../points";
import type { ActiveTool } from "../../state/slices/storeTypes";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const pointStyle = {
  shape: "circle" as const,
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const angleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.8,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 14,
  fillEnabled: true,
  fillColor: "#93c5fd",
  fillOpacity: 0.2,
  pattern: "",
  patternColor: "#93c5fd",
  markStyle: "arc" as const,
  markSymbol: "none" as const,
  arcMultiplicity: 1 as const,
  markPos: 0.5,
  markSize: 4,
  markColor: "#334155",
  arcRadius: 2,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: false,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    {
      id: "pB",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "name",
      position: { x: 2, y: 3 },
      style: pointStyle,
      locked: false,
      auxiliary: false,
    },
  ],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const resolvedPoints = [
  {
    point: scene.points[0],
    world: { x: 2, y: 3 },
  },
];

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 100 };
const vp: Viewport = { widthPx: 800, heightPx: 600 };

function resolveWorldPoint(scene: SceneModel, id: string): { x: number; y: number } | null {
  const point = scene.points.find((item) => item.id === id);
  if (!point) return null;
  return getPointWorldPos(point, scene);
}

function runScenario(activeTool: ActiveTool): void {
  let pending: unknown = null;
  let freePointCreates = 0;

  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      freePointCreates += 1;
      return "p_new";
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByRotation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
      return null;
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
    getPointWorldById(id) {
      return id === "pB" ? { x: 2, y: 3 } : null;
    },
    gridSnapEnabled: true,
    snapWorldToGrid() {
      // Simulate magnetic grid snapping to existing point B.
      return { x: 2, y: 3 };
    },
  };

  runConstructClickAdapter({
    // Deliberately outside point hit tolerance from B's screen position.
    screen: { x: 620, y: 0 },
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool,
    pendingSelection: null,
    copyStyleSource: null,
    scene,
    resolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 10,
    },
    io,
  });

  const pendingValue = pending as { tool?: string; first?: { type?: string; id?: string } } | null;
  assert(freePointCreates === 0, `${activeTool}: should reuse existing snapped point instead of creating a duplicate free point`);
  assert(pendingValue?.tool === activeTool, `${activeTool}: should start pending selection for the active tool`);
  assert(
    Boolean(pendingValue && pendingValue.first?.type === "point" && pendingValue.first?.id === "pB"),
    `${activeTool}: first selected point should be existing point B`
  );
}

runScenario("segment");
runScenario("line2p");

{
  // Regression: when geometry snap finds "onCircle", grid fallback must not overwrite it
  // with a snapped point candidate.
  const circleScene: SceneModel = {
    points: [
      {
        id: "pO",
        kind: "free",
        name: "O",
        captionTex: "O",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pR",
        kind: "free",
        name: "R",
        captionTex: "R",
        visible: true,
        showLabel: "name",
        position: { x: 2, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pGrid",
        kind: "free",
        name: "G",
        captionTex: "G",
        visible: true,
        showLabel: "name",
        position: { x: 3, y: 3 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
    ],
    numbers: [],
    lines: [],
    segments: [],
    circles: [
      {
        id: "c1",
        kind: "twoPoint",
        centerId: "pO",
        throughId: "pR",
        visible: true,
        style: {
          strokeColor: "#334155",
          strokeWidth: 1.4,
          strokeDash: "solid",
          strokeOpacity: 1,
        },
      },
    ],
    polygons: [],
    angles: [],
  };

  const circleResolvedPoints = circleScene.points
    .map((point) => {
      const world = getPointWorldPos(point, circleScene);
      return world ? { point, world } : null;
    })
    .filter((item): item is { point: SceneModel["points"][number]; world: { x: number; y: number } } => Boolean(item));
  const clickScreen = { x: 400, y: 100 }; // world (0,2) for camera/vp below
  const gridPointScreen = { x: 700, y: 0 }; // world (3,3)
  let pending: unknown = null;
  let onCircleCreates = 0;
  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      return "p_new";
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
    createPointOnCircle(circleId) {
      onCircleCreates += 1;
      if (circleId !== "c1") {
        throw new Error(`Expected on-circle snap to target c1, got ${circleId}`);
      }
      return "p_on_circle";
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByRotation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
      return null;
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
    getPointWorldById(id) {
      return resolveWorldPoint(circleScene, id);
    },
    gridSnapEnabled: true,
    snapWorldToGrid() {
      // Snap fallback maps to existing point pGrid, but geometric snap should win.
      return { x: 3, y: 3 };
    },
  };

  runConstructClickAdapter({
    screen: clickScreen,
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool: "segment",
    pendingSelection: null,
    copyStyleSource: null,
    scene: circleScene,
    resolvedPoints: circleResolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 12,
    },
    io,
  });

  const pendingValue = pending as { tool?: string; first?: { type?: string; id?: string } } | null;
  assert(onCircleCreates === 1, "Expected on-circle point creation to win over grid-snapped point fallback.");
  assert(pendingValue?.tool === "segment", "Expected segment workflow to continue.");
  assert(
    Boolean(pendingValue && pendingValue.first?.type === "point" && pendingValue.first?.id === "p_on_circle"),
    "Expected first point to come from on-circle snap candidate."
  );
  // Guard to ensure clicked location is far from snapped grid point in screen space.
  assert(Math.hypot(clickScreen.x - gridPointScreen.x, clickScreen.y - gridPointScreen.y) > 12, "Test setup invalid.");
}

{
  // Regression: sector arc snap should behave like circle snap for point creation
  // and not be overridden by grid fallback.
  const sectorScene: SceneModel = {
    points: [
      {
        id: "pO",
        kind: "free",
        name: "O",
        captionTex: "O",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 2, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 2 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pGrid",
        kind: "free",
        name: "G",
        captionTex: "G",
        visible: true,
        showLabel: "name",
        position: { x: 3, y: 3 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
    ],
    numbers: [],
    lines: [],
    segments: [],
    circles: [],
    polygons: [],
    angles: [
      {
        id: "angSector",
        kind: "sector",
        aId: "pA",
        bId: "pO",
        cId: "pB",
        isRightExact: false,
        visible: true,
        style: angleStyle,
      },
    ],
  };

  const sectorResolvedPoints = sectorScene.points
    .map((point) => {
      const world = getPointWorldPos(point, sectorScene);
      return world ? { point, world } : null;
    })
    .filter((item): item is { point: SceneModel["points"][number]; world: { x: number; y: number } } => Boolean(item));
  let pending: unknown = null;
  let auxCircleCreates = 0;
  let onCircleCreates = 0;
  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      return "p_new";
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
      auxCircleCreates += 1;
      return "c_sector_aux";
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
    createPointOnCircle(circleId) {
      onCircleCreates += 1;
      if (circleId !== "c_sector_aux") {
        throw new Error(`Expected sector arc point on helper circle c_sector_aux, got ${circleId}`);
      }
      return "p_on_sector_arc_circle";
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByRotation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
      return null;
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
    getPointWorldById(id) {
      return resolveWorldPoint(sectorScene, id);
    },
    gridSnapEnabled: true,
    snapWorldToGrid() {
      return { x: 3, y: 3 };
    },
  };

  // Click near the middle of quarter-circle arc (about 45 deg).
  runConstructClickAdapter({
    screen: { x: 541, y: 159 },
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool: "segment",
    pendingSelection: null,
    copyStyleSource: null,
    scene: sectorScene,
    resolvedPoints: sectorResolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 12,
    },
    io,
  });

  const pendingValue = pending as { tool?: string; first?: { type?: string; id?: string } } | null;
  assert(auxCircleCreates === 1, "Expected sector-arc snap to create/find helper circle.");
  assert(onCircleCreates === 1, "Expected sector-arc snap to create a draggable pointOnCircle.");
  assert(pendingValue?.tool === "segment", "Expected segment workflow to continue from sector-arc snap.");
  assert(
    Boolean(pendingValue && pendingValue.first?.type === "point" && pendingValue.first?.id === "p_on_sector_arc_circle"),
    "Expected first point to come from sector-arc pointOnCircle creation."
  );
}

{
  // Regression: sector step-3 should reuse an existing endpoint point on the same radius,
  // instead of creating a duplicate projected point.
  const sectorCreateScene: SceneModel = {
    points: [
      {
        id: "pC",
        kind: "free",
        name: "C",
        captionTex: "C",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 2, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: -2, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
    ],
    numbers: [],
    lines: [],
    segments: [],
    circles: [],
    polygons: [],
    angles: [],
  };
  const sectorResolvedPoints = sectorCreateScene.points
    .map((point) => {
      const world = getPointWorldPos(point, sectorCreateScene);
      return world ? { point, world } : null;
    })
    .filter((item): item is { point: SceneModel["points"][number]; world: { x: number; y: number } } => Boolean(item));

  let pending: unknown = { tool: "sector", step: 3, first: { type: "point", id: "pC" }, second: { type: "point", id: "pB" } };
  let createAuxCount = 0;
  let createPointOnCircleCount = 0;
  let createdSectorArgs: [string, string, string] | null = null;
  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      return "p_new";
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
      createAuxCount += 1;
      return "c_aux";
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
    createSector(centerId, startId, endId) {
      createdSectorArgs = [centerId, startId, endId];
      return "a_1";
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
      createPointOnCircleCount += 1;
      return "p_proj";
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByRotation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
      return null;
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
    getPointWorldById(id) {
      return resolveWorldPoint(sectorCreateScene, id);
    },
    gridSnapEnabled: true,
    snapWorldToGrid(world) {
      return world;
    },
  };

  runConstructClickAdapter({
    screen: { x: 200, y: 300 }, // world (-2,0) -> point A
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool: "sector",
    pendingSelection: pending as never,
    copyStyleSource: null,
    scene: sectorCreateScene,
    resolvedPoints: sectorResolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 12,
    },
    io,
  });

  assert(createAuxCount === 0, "Expected sector endpoint reuse to skip auxiliary-circle creation.");
  assert(createPointOnCircleCount === 0, "Expected sector endpoint reuse to skip projected endpoint creation.");
  assert(
    Boolean(createdSectorArgs && createdSectorArgs[0] === "pC" && createdSectorArgs[1] === "pB" && createdSectorArgs[2] === "pA"),
    "Expected sector creation to reuse existing endpoint point A."
  );
  assert(pending === null, "Expected sector pending selection to clear after creation.");
}

{
  // Regression: tangent tool should accept sector arc snap as a circle target.
  const tangentSectorScene: SceneModel = {
    points: [
      {
        id: "pO",
        kind: "free",
        name: "O",
        captionTex: "O",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 2, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 2 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pT",
        kind: "free",
        name: "T",
        captionTex: "T",
        visible: true,
        showLabel: "name",
        position: { x: 4, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
    ],
    numbers: [],
    lines: [],
    segments: [],
    circles: [],
    polygons: [],
    angles: [
      {
        id: "angSector",
        kind: "sector",
        aId: "pA",
        bId: "pO",
        cId: "pB",
        isRightExact: false,
        visible: true,
        style: angleStyle,
      },
    ],
  };
  const tangentResolvedPoints = tangentSectorScene.points
    .map((point) => {
      const world = getPointWorldPos(point, tangentSectorScene);
      return world ? { point, world } : null;
    })
    .filter((item): item is { point: SceneModel["points"][number]; world: { x: number; y: number } } => Boolean(item));
  let pending: unknown = { tool: "tangent_line", step: 2, first: { type: "point", id: "pT" } };
  let auxCircleCreates = 0;
  let tangentCalls = 0;
  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      return "p_new";
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
    createAuxiliaryCircle(centerId, throughId) {
      auxCircleCreates += 1;
      if (centerId !== "pO" || throughId !== "pA") {
        throw new Error(`Unexpected auxiliary circle request: (${centerId}, ${throughId})`);
      }
      return "c_sector_aux";
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
    createTangentLines(throughId, circleId) {
      tangentCalls += 1;
      if (throughId !== "pT") throw new Error(`Unexpected tangent through point: ${throughId}`);
      if (circleId !== "c_sector_aux") throw new Error(`Expected tangent target to be helper circle, got ${circleId}`);
      return ["l_tan"];
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByRotation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
      return null;
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
    getPointWorldById(id) {
      return resolveWorldPoint(tangentSectorScene, id);
    },
    gridSnapEnabled: true,
    snapWorldToGrid(world) {
      return world;
    },
  };

  runConstructClickAdapter({
    screen: { x: 541, y: 159 },
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool: "tangent_line",
    pendingSelection: pending as never,
    copyStyleSource: null,
    scene: tangentSectorScene,
    resolvedPoints: tangentResolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 12,
    },
    io,
  });

  assert(auxCircleCreates === 1, "Expected tangent-on-sector click to resolve/create helper circle.");
  assert(tangentCalls === 1, "Expected tangent tool to create tangent from point to sector support circle.");
  assert(pending === null, "Expected tangent pending selection to clear after successful creation.");
}

{
  // Regression: midpoint tool should accept sector arc snap and select sector center point.
  const midpointSectorScene: SceneModel = {
    points: [
      {
        id: "pO",
        kind: "free",
        name: "O",
        captionTex: "O",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 2, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 2 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
    ],
    numbers: [],
    lines: [],
    segments: [],
    circles: [],
    polygons: [],
    angles: [
      {
        id: "angSector",
        kind: "sector",
        aId: "pA",
        bId: "pO",
        cId: "pB",
        isRightExact: false,
        visible: true,
        style: angleStyle,
      },
    ],
  };
  const midpointResolvedPoints = midpointSectorScene.points
    .map((point) => {
      const world = getPointWorldPos(point, midpointSectorScene);
      return world ? { point, world } : null;
    })
    .filter((item): item is { point: SceneModel["points"][number]; world: { x: number; y: number } } => Boolean(item));
  let selectedPointId: string | null = null;
  let pending: unknown = null;
  let circleCenterCalls = 0;
  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      return "p_new";
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByRotation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
      return null;
    },
    createIntersectionPoint() {
      return null;
    },
    createCircleCenterPoint() {
      circleCenterCalls += 1;
      return "never";
    },
    setExportClipWorld() {},
    setSelectedObject(obj) {
      if (obj?.type === "point") selectedPointId = obj.id;
    },
    setCopyStyleSource() {},
    applyCopyStyleTo() {},
    enableObjectLabel() {},
    getPointWorldById(id) {
      return resolveWorldPoint(midpointSectorScene, id);
    },
    gridSnapEnabled: true,
    snapWorldToGrid(world) {
      return world;
    },
  };

  runConstructClickAdapter({
    screen: { x: 541, y: 159 },
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool: "midpoint",
    pendingSelection: null,
    copyStyleSource: null,
    scene: midpointSectorScene,
    resolvedPoints: midpointResolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 12,
    },
    io,
  });

  assert(circleCenterCalls === 0, "Expected midpoint-on-sector to bypass circle-center creation.");
  assert(selectedPointId === "pO", "Expected midpoint-on-sector to select center point O.");
  assert(pending === null, "Expected midpoint-on-sector to leave no pending selection.");
}

{
  // Regression: perpendicular tool should accept a segment snap even when overlapping sector is the top object.
  const sceneWithSectorAndSegment: SceneModel = {
    points: [
      {
        id: "pO",
        kind: "free",
        name: "O",
        captionTex: "O",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 2, y: 0 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 2 },
        style: pointStyle,
        locked: false,
        auxiliary: false,
      },
    ],
    numbers: [],
    lines: [],
    segments: [
      {
        id: "sOB",
        aId: "pO",
        bId: "pB",
        ownedBySectorIds: ["angSector"],
        visible: true,
        showLabel: false,
        style: {
          strokeColor: "#0f172a",
          strokeWidth: 1.2,
          dash: "solid",
          opacity: 1,
        },
      },
    ],
    circles: [],
    polygons: [],
    angles: [
      {
        id: "angSector",
        kind: "sector",
        aId: "pA",
        bId: "pO",
        cId: "pB",
        isRightExact: false,
        visible: true,
        style: angleStyle,
      },
    ],
  };
  const resolvedPoints = sceneWithSectorAndSegment.points
    .map((point) => {
      const world = getPointWorldPos(point, sceneWithSectorAndSegment);
      return world ? { point, world } : null;
    })
    .filter((item): item is { point: SceneModel["points"][number]; world: { x: number; y: number } } => Boolean(item));
  let pending: unknown = null;
  const io: ConstructClickIo = {
    setPendingSelection(next) {
      pending = next;
    },
    clearPendingSelection() {
      pending = null;
    },
    createFreePoint() {
      return "p_new";
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
    transformObjectByTranslation() {
      return null;
    },
    transformObjectByRotation() {
      return null;
    },
    transformObjectByDilation() {
      return null;
    },
    transformObjectByReflection() {
      return null;
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
    getPointWorldById(id) {
      return resolveWorldPoint(sceneWithSectorAndSegment, id);
    },
    gridSnapEnabled: true,
    snapWorldToGrid(world) {
      return world;
    },
  };

  // Click near OB; sector overlaps this area but on-segment snap should still drive perp_line step-1 target.
  runConstructClickAdapter({
    screen: { x: 400, y: 205 },
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool: "perp_line",
    pendingSelection: null,
    copyStyleSource: null,
    scene: sceneWithSectorAndSegment,
    resolvedPoints,
    camera,
    vp,
    angleFixedTool: { angleExpr: "45", direction: "CCW" },
    regularPolygonTool: { sides: 5, direction: "CCW" },
    transformTool: { mode: "translate", angleExpr: "90", direction: "CCW", factorExpr: "2" },
    tolerances: {
      point: 12,
      angle: 20,
      segment: 10,
      line: 10,
      circle: 12,
    },
    io,
  });

  const pendingValue = pending as
    | { tool?: string; first?: { type?: string; ref?: { type?: string; id?: string } } }
    | null;
  assert(pendingValue?.tool === "perp_line", "Expected perpendicular workflow to start.");
  assert(
    Boolean(
      pendingValue
      && pendingValue.first?.type === "lineLike"
      && pendingValue.first.ref?.type === "segment"
      && pendingValue.first.ref?.id === "sOB"
    ),
    "Expected perpendicular tool to target segment sOB even under overlapping sector."
  );
}

console.log("grid-snap-point-reuse: ok");
