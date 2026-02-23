import { runConstructClickAdapter, type ConstructClickIo } from "../../view/constructClickAdapter";
import type { Camera, Viewport } from "../../view/camera";
import type { ActiveTool, ExportClipWorld, PendingSelection } from "../../state/slices/storeTypes";
import type { SceneModel } from "../points";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const scene: SceneModel = {
  points: [],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};

const camera: Camera = { pos: { x: 0, y: 0 }, zoom: 1 };
const vp: Viewport = { widthPx: 800, heightPx: 600 };

let pending: PendingSelection = null;
let exportClip: ExportClipWorld | null = null;
const getPending = (): PendingSelection => pending;
const getExportClip = (): ExportClipWorld | null => exportClip;

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
  setExportClipWorld(clip) {
    exportClip = clip;
  },
  setSelectedObject() {},
  setCopyStyleSource() {},
  applyCopyStyleTo() {},
  enableObjectLabel() {},
  getPointWorldById() {
    return null;
  },
  gridSnapEnabled: false,
  snapWorldToGrid(world) {
    return world;
  },
};

function click(tool: ActiveTool, x: number, y: number): void {
  runConstructClickAdapter({
    screen: { x, y },
    pointerEvent: { shiftKey: false } as PointerEvent,
    activeTool: tool,
    pendingSelection: pending,
    copyStyleSource: null,
    scene,
    resolvedPoints: [],
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
}

// Polygon clip remains intact.
pending = null;
exportClip = null;
click("export_clip", 100, 100);
{
  const next = getPending();
  assert(!!next && next.tool === "export_clip" && next.points.length === 1, "Polygon clip should start from first vertex.");
}
click("export_clip", 220, 100);
{
  const next = getPending();
  assert(!!next && next.tool === "export_clip" && next.points.length === 2, "Polygon clip should append second vertex.");
}
click("export_clip", 220, 220);
{
  const next = getPending();
  assert(!!next && next.tool === "export_clip" && next.points.length === 3, "Polygon clip should append third vertex.");
}
click("export_clip", 100, 100);
assert(getPending() === null, "Polygon clip should close and clear pending when clicking near first vertex.");
{
  const clip = getExportClip();
  assert(!!clip && clip.kind === "polygon", "Polygon clip should export as polygon.");
  if (!clip || clip.kind !== "polygon") throw new Error("Expected polygon clip.");
  assert(clip.points.length === 3, "Polygon clip should keep the collected vertices.");
}

// Rectangle clip is available as a separate tool.
pending = null;
exportClip = null;
click("export_clip_rect", 300, 300);
{
  const next = getPending();
  assert(!!next && next.tool === "export_clip_rect", "Rectangle clip should start from first corner.");
}
click("export_clip_rect", 500, 100);
assert(getPending() === null, "Rectangle clip should finish after second corner.");
{
  const clip = getExportClip();
  assert(!!clip && clip.kind === "rect", "Rectangle clip should export as rect.");
  if (!clip || clip.kind !== "rect") throw new Error("Expected rect clip.");
  assert(
    clip.xmin === -100 &&
      clip.xmax === 100 &&
      clip.ymin === 0 &&
      clip.ymax === 200,
    "Rectangle clip should use min/max world bounds from the two corners."
  );
}

console.log("export-clip-tools: ok");
