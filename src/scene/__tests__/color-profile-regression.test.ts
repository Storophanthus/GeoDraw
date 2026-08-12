import { type SceneModel } from "../points";
import {
  COLOR_PROFILE_OPTIONS,
  applyProfileColorsToDefaults,
  buildDefaultStylesForProfile,
  normalizeLabelColorForProfile,
  normalizeSceneLabelColors,
  normalizeStyleDefaultsForProfile,
  recolorSceneForProfile,
} from "../../state/colorProfiles";
import {
  defaultAngleStyle,
  defaultCircleStyle,
  defaultEllipseStyle,
  defaultLabelToolStyle,
  defaultLineStyle,
  defaultPointStyle,
  defaultPolygonStyle,
  defaultRichTextToolStyle,
  defaultSegmentStyle,
  defaultTextboxToolStyle,
} from "../../state/slices/sceneSlice";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const defaults = applyProfileColorsToDefaults(
  {
    pointDefaults: { ...defaultPointStyle, labelOffsetPx: { ...defaultPointStyle.labelOffsetPx } },
    segmentDefaults: { ...defaultSegmentStyle },
    lineDefaults: { ...defaultLineStyle },
    circleDefaults: { ...defaultCircleStyle },
    ellipseDefaults: { ...defaultEllipseStyle },
    polygonDefaults: { ...defaultPolygonStyle },
    angleDefaults: { ...defaultAngleStyle, labelPosWorld: { ...defaultAngleStyle.labelPosWorld } },
    labelToolDefaults: { ...defaultLabelToolStyle },
    textboxToolDefaults: { ...defaultTextboxToolStyle },
    richTextToolDefaults: { ...defaultRichTextToolStyle },
  },
  "grayscale_white_dot"
);

assert(defaults.pointDefaults.strokeColor === "#000000", "profile should update default point stroke color");
assert(defaults.pointDefaults.fillColor === "#ffffff", "profile should update default point fill color");
assert(defaults.segmentDefaults.strokeColor === "#000000", "profile should update default segment stroke color");
assert(defaults.segmentDefaults.strokeWidth === defaultSegmentStyle.strokeWidth, "profile should preserve default segment stroke width");
assert(defaults.angleDefaults.fillColor === "#bfbfbf", "profile should update default angle fill color");
assert(defaults.angleDefaults.strokeWidth === defaultAngleStyle.strokeWidth, "profile should preserve default angle stroke width");
assert(defaults.textboxToolDefaults.boxWidthPx === 220, "profile should preserve default textbox width");
const thinDefaults = buildDefaultStylesForProfile("image_palette_vanilla_thin");
const imageDefaults = buildDefaultStylesForProfile("image_palette");
assert(
  !COLOR_PROFILE_OPTIONS.some((profile) => profile.id === "image_palette"),
  "legacy Image Palette must not be offered as a selectable construction profile"
);
assert(
  COLOR_PROFILE_OPTIONS.some(
    (profile) => profile.id === "image_palette_vanilla_thin" && profile.label === "Vanilla Standard"
  ),
  "the retained image-palette construction profile must be labeled Vanilla Standard"
);
assert(thinDefaults.segmentDefaults.strokeWidth < imageDefaults.segmentDefaults.strokeWidth, "thin vanilla profile should reduce segment stroke");
assert(thinDefaults.lineDefaults.strokeWidth < imageDefaults.lineDefaults.strokeWidth, "thin vanilla profile should reduce line stroke");
assert(thinDefaults.circleDefaults.strokeWidth < imageDefaults.circleDefaults.strokeWidth, "thin vanilla profile should reduce circle stroke");
assert(thinDefaults.angleDefaults.strokeWidth < imageDefaults.angleDefaults.strokeWidth, "thin vanilla profile should reduce angle stroke");
assert(thinDefaults.angleDefaults.markSize < imageDefaults.angleDefaults.markSize, "thin vanilla profile should reduce angle mark size");
assert(thinDefaults.pointDefaults.strokeColor === "#ffffff", "Vanilla Standard should keep a white point outline");
assert(thinDefaults.pointDefaults.fillColor === "#000000", "Vanilla Standard should use a black point fill");
assert(thinDefaults.segmentDefaults.strokeColor === "#000000", "Vanilla Standard segments should be black");
assert(thinDefaults.lineDefaults.strokeColor === "#000000", "Vanilla Standard lines should be black");
assert(thinDefaults.circleDefaults.strokeColor === "#000000", "Vanilla Standard circles should be black");
assert(thinDefaults.polygonDefaults.strokeColor === "#000000", "Vanilla Standard polygon edges should be black");
assert(thinDefaults.angleDefaults.strokeColor === "#000000", "Vanilla Standard angle arcs should be black");
const migratedLegacyDefaults = normalizeStyleDefaultsForProfile(imageDefaults, "image_palette_vanilla_thin");
assert(migratedLegacyDefaults.pointDefaults.strokeColor === "#ffffff", "legacy Vanilla point outlines should migrate to white");
assert(migratedLegacyDefaults.pointDefaults.fillColor === "#000000", "legacy Vanilla point fills should migrate to black");
assert(migratedLegacyDefaults.lineDefaults.strokeColor === "#000000", "legacy Vanilla line defaults should migrate to black");
const customLegacyDefaults = normalizeStyleDefaultsForProfile(
  {
    ...imageDefaults,
    lineDefaults: { ...imageDefaults.lineDefaults, strokeColor: "#123456" },
  },
  "image_palette_vanilla_thin"
);
assert(customLegacyDefaults.lineDefaults.strokeColor === "#123456", "Vanilla migration should preserve custom line colors");
assert(
  normalizeLabelColorForProfile("#ffffff", "image_palette_vanilla_thin") === thinDefaults.pointDefaults.labelColor,
  "Vanilla Standard should replace white labels with its readable profile color"
);
assert(
  normalizeLabelColorForProfile("#ffffff", "dark_mode") === "#ffffff",
  "dark profiles should keep white labels"
);

const classicDefaults = buildDefaultStylesForProfile("classic");
const scene: SceneModel = {
  points: [
    {
      id: "p1",
      kind: "free",
      name: "A",
      captionTex: "A",
      visible: true,
      showLabel: "name",
      position: { x: 0, y: 0 },
      style: {
        ...classicDefaults.pointDefaults,
        labelOffsetPx: { ...classicDefaults.pointDefaults.labelOffsetPx },
      },
    },
  ],
  vectors: [],
  segments: [
    {
      id: "s1",
      aId: "p1",
      bId: "p1",
      visible: true,
      showLabel: false,
      style: {
        ...classicDefaults.segmentDefaults,
        strokeColor: "#123456",
      },
    },
  ],
  lines: [
    {
      id: "l1",
      kind: "twoPoint",
      aId: "p1",
      bId: "p1",
      visible: true,
      style: { ...classicDefaults.lineDefaults },
    },
  ],
  circles: [
    {
      id: "c1",
      kind: "twoPoint",
      centerId: "p1",
      throughId: "p1",
      visible: true,
      style: {
        ...classicDefaults.circleDefaults,
        fillColor: classicDefaults.polygonDefaults.fillColor,
      },
    },
  ],
  polygons: [
    {
      id: "pg1",
      pointIds: ["p1", "p1", "p1"],
      visible: true,
      style: { ...classicDefaults.polygonDefaults },
    },
  ],
  angles: [
    {
      id: "a1",
      kind: "angle",
      aId: "p1",
      bId: "p1",
      cId: "p1",
      visible: true,
      style: {
        ...classicDefaults.angleDefaults,
        labelPosWorld: { ...classicDefaults.angleDefaults.labelPosWorld },
      },
    },
  ],
  numbers: [],
};

const whiteLabelScene = structuredClone(scene);
whiteLabelScene.points[0].style.labelColor = "#ffffff";
const normalizedVanillaScene = normalizeSceneLabelColors(whiteLabelScene, "image_palette_vanilla_thin");
assert(
  normalizedVanillaScene.points[0].style.labelColor === thinDefaults.pointDefaults.labelColor,
  "restoring a Vanilla Standard scene should keep point labels visible on the light canvas"
);

const legacyVanillaScene = structuredClone(scene);
legacyVanillaScene.points[0].style = {
  ...imageDefaults.pointDefaults,
  labelOffsetPx: { ...imageDefaults.pointDefaults.labelOffsetPx },
};
legacyVanillaScene.segments[0].style = { ...imageDefaults.segmentDefaults };
legacyVanillaScene.lines[0].style = { ...imageDefaults.lineDefaults };
legacyVanillaScene.circles[0].style = { ...imageDefaults.circleDefaults };
legacyVanillaScene.polygons[0].style = { ...imageDefaults.polygonDefaults };
legacyVanillaScene.angles[0].style = {
  ...imageDefaults.angleDefaults,
  labelPosWorld: { ...imageDefaults.angleDefaults.labelPosWorld },
};
const migratedLegacyScene = normalizeSceneLabelColors(legacyVanillaScene, "image_palette_vanilla_thin");
assert(migratedLegacyScene.points[0].style.strokeColor === "#ffffff", "legacy scene point outlines should migrate to white");
assert(migratedLegacyScene.points[0].style.fillColor === "#000000", "legacy scene point fills should migrate to black");
assert(migratedLegacyScene.segments[0].style.strokeColor === "#000000", "legacy scene segments should migrate to black");
assert(migratedLegacyScene.lines[0].style.strokeColor === "#000000", "legacy scene lines should migrate to black");
assert(migratedLegacyScene.circles[0].style.strokeColor === "#000000", "legacy scene circles should migrate to black");

const recolored = recolorSceneForProfile(scene, "classic", "grayscale_white_dot");

assert(recolored.points[0].style.fillColor === "#ffffff", "point fill should be recolored");
assert(recolored.points[0].style.labelColor === "#000000", "point label color should be recolored");
assert(recolored.lines[0].style.strokeColor === "#000000", "line color should be recolored");
assert(recolored.polygons[0].style.fillColor === "#bfbfbf", "polygon fill should be recolored");
assert(recolored.angles[0].style.markColor === "#000000", "angle mark should be recolored");
assert(recolored.segments[0].style.strokeColor === "#123456", "custom segment color should remain unchanged");

console.log("color-profile-regression tests: OK");
