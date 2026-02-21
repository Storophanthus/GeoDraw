import { buildDefaultStylesForProfile } from "../../state/colorProfiles";
import { getGeoStore } from "../../state/geoStore";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const store = getGeoStore();
const createdPointId = store.createFreePoint({ x: 0, y: 0 });

store.applyAppPreferences({
  uiColorProfileId: "beige",
  uiCssOverrides: { "--gd-ui-app-bg": "#112233" },
  canvasThemeOverrides: { backgroundColor: "#faf3e0", gridMinorColor: "#111111" },
  gridEnabled: false,
  axesEnabled: false,
  gridSnapEnabled: false,
  pointDefaults: {
    ...store.pointDefaults,
    sizePx: 11,
    labelOffsetPx: { ...store.pointDefaults.labelOffsetPx },
  },
});

let current = getGeoStore();
assert(current.uiColorProfileId === "beige", "applyAppPreferences should update UI profile");
assert(current.uiCssOverrides["--gd-ui-app-bg"] === "#112233", "applyAppPreferences should update UI overrides");
assert(
  current.canvasThemeOverrides.backgroundColor === "#faf3e0",
  "applyAppPreferences should update canvas theme overrides"
);
assert(current.gridEnabled === false, "applyAppPreferences should update grid toggle");
assert(current.axesEnabled === false, "applyAppPreferences should update axes toggle");
assert(current.gridSnapEnabled === false, "applyAppPreferences should update snap toggle");
assert(current.pointDefaults.sizePx === 11, "applyAppPreferences should update point defaults");

store.applyAppPreferences({ colorProfileId: "grayscale_white_dot" });
current = getGeoStore();
const expected = buildDefaultStylesForProfile("grayscale_white_dot");
assert(current.colorProfileId === "grayscale_white_dot", "applyAppPreferences should update color profile");
assert(
  current.pointDefaults.strokeColor === expected.pointDefaults.strokeColor,
  "applyAppPreferences should remap default colors when profile changes"
);
assert(
  current.pointDefaults.sizePx === 11,
  "applyAppPreferences should preserve default geometry sizes when remapping palette colors"
);
const point = current.scene.points.find((p) => p.id === createdPointId);
assert(Boolean(point), "created point should exist");
assert(
  point!.style.strokeColor === expected.pointDefaults.strokeColor,
  "scene object styles should recolor when profile changes via applyAppPreferences"
);

console.log("app-preferences-regression tests: OK");
