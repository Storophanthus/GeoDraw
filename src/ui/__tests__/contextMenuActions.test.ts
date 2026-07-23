import type { SceneModel } from "../../scene/points";
import { getContextActionsForTarget } from "../contextMenuActions";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function actionIds(scene: SceneModel, target: Parameters<typeof getContextActionsForTarget>[1]): string[] {
  return getContextActionsForTarget(scene, target).map((action) => action.id);
}

const lineStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  dash: "solid" as const,
  opacity: 1,
};

const circleStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
};

const polygonStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeDash: "solid" as const,
  strokeOpacity: 1,
};

const angleStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeOpacity: 1,
  textColor: "#000000",
  textSize: 16,
  fillEnabled: false,
  fillColor: "#808080",
  fillOpacity: 0.2,
  markStyle: "arc" as const,
  markSymbol: "none" as const,
  arcMultiplicity: 1 as const,
  markPos: 0.5,
  markSize: 7.4,
  markColor: "#000000",
  arcRadius: 2,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: false,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    {
      id: "p_a",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: {
        shape: "circle",
        sizePx: 6,
        strokeColor: "#000000",
        strokeWidth: 1,
        strokeOpacity: 1,
        fillColor: "#ffffff",
        fillOpacity: 1,
        labelFontPx: 12,
        labelHaloWidthPx: 2,
        labelHaloColor: "#ffffff",
        labelColor: "#000000",
        labelOffsetPx: { x: 8, y: -8 },
      },
    },
  ],
  vectors: [],
  segments: [{ id: "s_1", aId: "p_a", bId: "p_b", visible: true, showLabel: false, style: lineStyle }],
  lines: [],
  circles: [{ id: "c_1", centerId: "p_a", throughId: "p_b", visible: true, showLabel: false, style: circleStyle }],
  polygons: [{ id: "poly_1", pointIds: ["p_a", "p_b", "p_c"], visible: true, showLabel: false, style: polygonStyle }],
  angles: [{ id: "ang_1", aId: "p_a", bId: "p_b", cId: "p_c", visible: true, style: angleStyle }],
  numbers: [],
  textLabels: [
    {
      id: "txt_1",
      name: "T1",
      text: "hello",
      toolKind: "label",
      contentMode: "static",
      visible: true,
      positionWorld: { x: 0, y: 0 },
      style: {
        textColor: "#000000",
        textSize: 16,
        useTex: false,
      },
    },
  ],
  richTextNodes: [
    {
      id: "rt_1",
      type: "richText",
      name: "rt_1",
      visible: true,
      positionWorld: { x: 0, y: 0 },
      style: {
        textColor: "#000000",
        textSize: 16,
        rotationDeg: 0,
        textAlign: "left",
      },
      document: {
        kind: "document",
        blocks: [{ kind: "paragraph", children: [{ kind: "text", text: "hello" }] }],
      },
      boundsPx: { widthPx: 100, heightPx: 20 },
    },
  ],
};

{
  const ids = actionIds(scene, { type: "segment", id: "s_1" });
  assert(ids.includes("create-variable-length"), "Segment context menu should offer length variable extraction.");
  assert(!ids.includes("create-variable-area"), "Segment context menu should not offer area extraction.");
}

{
  const ids = actionIds(scene, { type: "circle", id: "c_1" });
  assert(ids.includes("create-variable-radius"), "Circle context menu should offer radius variable extraction.");
  assert(ids.includes("create-variable-area"), "Circle context menu should offer area variable extraction.");
}

{
  const ids = actionIds(scene, { type: "angle", id: "ang_1" });
  assert(ids.includes("toggle-angle-promote-solid"), "Angle context menu should offer promote-to-solid.");
  assert(ids.includes("create-variable-angle"), "Angle context menu should offer angle variable extraction.");
}

{
  const ids = actionIds(scene, { type: "polygon", id: "poly_1" });
  assert(ids.includes("create-variable-perimeter"), "Polygon context menu should offer perimeter variable extraction.");
  assert(ids.includes("create-variable-area"), "Polygon context menu should offer area variable extraction.");
}

{
  const actions = getContextActionsForTarget(scene, { type: "empty", world: { x: 1, y: 2 } });
  const ids = actions.map((action) => action.id);
  assert(ids.includes("create-point"), "Empty canvas context menu should offer point creation.");
  assert(ids.includes("create-textbox"), "Empty canvas context menu should offer textbox creation.");
  const paste = actions.find((action) => action.id === "paste-clipboard");
  assert(Boolean(paste?.disabled), "Empty canvas paste should be disabled when the app clipboard is empty.");
}

{
  const actions = getContextActionsForTarget(scene, { type: "empty", world: { x: 1, y: 2 } }, { canPaste: true });
  const paste = actions.find((action) => action.id === "paste-clipboard");
  assert(Boolean(paste && !paste.disabled), "Empty canvas paste should be enabled when the app clipboard has content.");
}

{
  const ids = actionIds(scene, { type: "textLabel", id: "txt_1" });
  assert(ids.includes("edit-text"), "Text label context menu should offer editing.");
  assert(ids.includes("copy-object"), "Text label context menu should offer copying.");
  assert(ids.includes("duplicate-object"), "Text label context menu should offer duplication.");
}

{
  const ids = actionIds(scene, { type: "richText", id: "rt_1" });
  assert(ids.includes("edit-text"), "Rich textbox context menu should offer editing.");
  assert(ids.includes("copy-object"), "Rich textbox context menu should offer copying.");
  assert(ids.includes("duplicate-object"), "Rich textbox context menu should offer duplication.");
}

console.log("contextMenuActions: ok");
