import type {
  AngleStyle,
  LineStyle,
  PointStyle,
  SceneModel,
} from "../../scene/points.ts";
import {
  listPreviewLabelTargets,
  nudgePreviewLabel,
  resetPreviewLabel,
} from "../../ui/tikzPreviewLabels.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeOpacity: 1,
  fillColor: "#ffffff",
  fillOpacity: 1,
  labelFontPx: 16,
  labelHaloWidthPx: 2,
  labelHaloColor: "#ffffff",
  labelColor: "#000000",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle: LineStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  dash: "solid",
  opacity: 1,
};

const angleStyle: AngleStyle = {
  strokeColor: "#000000",
  strokeWidth: 1,
  strokeOpacity: 1,
  textColor: "#000000",
  textSize: 14,
  fillEnabled: false,
  fillColor: "#ffffff",
  fillOpacity: 0,
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 4,
  markColor: "#000000",
  arcRadius: 0.8,
  labelText: "\\alpha",
  labelPosWorld: { x: 0.35, y: 0.35 },
  showLabel: true,
  showValue: false,
};

const scene: SceneModel = {
  points: [
    {
      id: "a",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: pointStyle,
    },
    {
      id: "b",
      kind: "free",
      name: "B",
      captionTex: "B",
      visible: true,
      showLabel: "none",
      position: { x: 1, y: 0 },
      style: pointStyle,
    },
    {
      id: "c",
      kind: "free",
      name: "C",
      captionTex: "C",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 1 },
      style: pointStyle,
    },
    {
      id: "outside",
      kind: "free",
      name: "Z",
      captionTex: "Z",
      visible: true,
      showLabel: "name",
      position: { x: 9, y: 9 },
      style: pointStyle,
    },
  ],
  vectors: [],
  segments: [
    {
      id: "ab",
      aId: "a",
      bId: "b",
      visible: true,
      showLabel: true,
      labelText: "s",
      labelPosWorld: { x: 0.5, y: 0.2 },
      style: lineStyle,
    },
  ],
  lines: [],
  circles: [],
  polygons: [],
  angles: [
    {
      id: "abc",
      kind: "angle",
      aId: "a",
      bId: "b",
      cId: "c",
      visible: true,
      style: angleStyle,
    },
  ],
  numbers: [],
  textLabels: [
    {
      id: "omega",
      name: "omega",
      text: "\\omega",
      visible: true,
      positionWorld: { x: 0.7, y: 0.7 },
      style: {
        textColor: "#000000",
        textSize: 14,
        useTex: true,
      },
    },
  ],
};

const targets = listPreviewLabelTargets(scene, {
  viewport: { xmin: -1, xmax: 2, ymin: -1, ymax: 2 },
  screenPxPerWorld: 100,
});
assert(
  targets.map((target) => target.key).join(",") ===
    "point:a,point:c,segment:ab,angle:abc,text:omega",
  `Label precision must list every visible exported label in compact scene order: ${targets
    .map((target) => target.key)
    .join(",")}`
);
assert(!targets.some((target) => target.id === "outside"), "Labels outside the export viewport must not be listed.");

const pointTarget = targets.find((target) => target.key === "point:a");
assert(pointTarget, "Missing point label precision target.");
const nudgedPointScene = nudgePreviewLabel(scene, pointTarget, { x: 1, y: -1 }, 100);
const nudgedPoint = nudgedPointScene.points.find((point) => point.id === "a");
assert(
  nudgedPoint?.style.labelOffsetPx.x === 9 && nudgedPoint.style.labelOffsetPx.y === -9,
  "Point-label joystick movement must operate in canvas pixels."
);

const segmentTarget = targets.find((target) => target.key === "segment:ab");
assert(segmentTarget, "Missing object-label precision target.");
const nudgedSegmentScene = nudgePreviewLabel(scene, segmentTarget, { x: 1, y: -1 }, 100);
const nudgedSegment = nudgedSegmentScene.segments.find((segment) => segment.id === "ab");
assert(
  Math.abs((nudgedSegment?.labelPosWorld?.x ?? 0) - 0.51) <= 1e-12 &&
    Math.abs((nudgedSegment?.labelPosWorld?.y ?? 0) - 0.21) <= 1e-12,
  "World-positioned labels must convert one joystick pixel through the captured canvas density."
);

const resetPointScene = resetPreviewLabel(nudgedPointScene, scene, pointTarget);
const resetPoint = resetPointScene.points.find((point) => point.id === "a");
assert(
  resetPoint?.style.labelOffsetPx.x === 8 && resetPoint.style.labelOffsetPx.y === -8,
  "The center joystick button must restore the original point-label position."
);

console.log("✓ TikZ preview label-precision grid test passed");
