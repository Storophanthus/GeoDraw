import { exportTikz } from "../src/export/tikz";
import type { SceneModel, ScenePoint } from "../src/scene/points";

const pointStyle: ScenePoint["style"] = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.4,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 18,
  labelHaloWidthPx: 3.5,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const mkFree = (id: string, name: string, x: number, y: number): ScenePoint => ({
  id,
  kind: "free",
  name,
  captionTex: name,
  visible: true,
  showLabel: "name",
  position: { x, y },
  style: pointStyle,
});

const scene: SceneModel = {
  points: [
    mkFree("p_1", "A", -6, 3), mkFree("p_2", "B", 2, 5), mkFree("p_3", "C", 8, 2),
    mkFree("p_4", "D", -2, -1), mkFree("p_5", "E", 6, -3), mkFree("p_6", "F", -8, -4),
    mkFree("p_7", "O1", -2, 2), mkFree("p_8", "X1", 1, 2),
    mkFree("p_9", "O2", 4, 1), mkFree("p_10", "X2", 6, 1),
    mkFree("p_11", "O3", 0, -3), mkFree("p_12", "X3", 2, -3),
    {
      id: "p_13", kind: "intersectionPoint", name: "G", captionTex: "G", visible: true, showLabel: "name", locked: true, auxiliary: true,
      objA: { type: "circle", id: "c_1" }, objB: { type: "circle", id: "c_2" }, preferredWorld: { x: 1.5, y: 3.5 }, style: pointStyle,
    },
    {
      id: "p_14", kind: "intersectionPoint", name: "H", captionTex: "H", visible: true, showLabel: "name", locked: true, auxiliary: true,
      objA: { type: "circle", id: "c_2" }, objB: { type: "circle", id: "c_3" }, preferredWorld: { x: 3.2, y: -0.6 }, style: pointStyle,
    },
  ],
  segments: [],
  lines: [
    { id: "l_1", aId: "p_1", bId: "p_3", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_2", aId: "p_2", bId: "p_4", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_3", aId: "p_3", bId: "p_5", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_4", aId: "p_4", bId: "p_6", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_5", aId: "p_1", bId: "p_5", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_6", aId: "p_2", bId: "p_6", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_7", aId: "p_3", bId: "p_4", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_8", aId: "p_5", bId: "p_6", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_9", aId: "p_1", bId: "p_4", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
    { id: "l_10", aId: "p_2", bId: "p_5", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, dash: "solid", opacity: 1 } },
  ],
  circles: [
    { id: "c_1", centerId: "p_7", throughId: "p_8", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, strokeDash: "solid", strokeOpacity: 1, fillOpacity: 0 } },
    { id: "c_2", centerId: "p_9", throughId: "p_10", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, strokeDash: "solid", strokeOpacity: 1, fillOpacity: 0 } },
    { id: "c_3", centerId: "p_11", throughId: "p_12", visible: true, style: { strokeColor: "#334155", strokeWidth: 1.6, strokeDash: "solid", strokeOpacity: 1, fillOpacity: 0 } },
  ],
};

console.log(exportTikz(scene));
