import fixture from "../__fixtures__/isl-shortlist-style.json";
import type { SceneModel } from "../../scene/points";
import { getPointWorldPos } from "../../scene/points";
import { getGeoStore } from "../../state/geoStore";
import { takeHistorySnapshot } from "../../state/slices/historySlice";
import { buildDefaultStylesForProfile, COLOR_PROFILE_OPTIONS } from "../../state/colorProfiles";
import { captureConstructionPreferences, loadStoredConstructionPreferences, saveStoredConstructionPreferences } from "../../state/appPreferences";
import { createPointLabelOverlays } from "../../view/labelOverlays";
import { exportTikzWithOptions, exportTikzEfficientWithOptions } from "../tikz";
// @ts-ignore Existing compile harness is an untyped Node module.
import { compileTikzSnippet } from "../../../scripts/compile-tex.mjs";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

const store = getGeoStore();
store.loadSnapshot({ ...takeHistorySnapshot(store), scene: fixture.scene as unknown as SceneModel });
store.applyAppPreferences({ canvasThemeOverrides: { backgroundColor: "#ffeecc" }, gridEnabled: true, axesEnabled: true });
store.setDependencyGlowEnabled(true);
const before = takeHistorySnapshot(getGeoStore());
store.setColorProfile("isl_shortlist");
const applied = takeHistorySnapshot(getGeoStore());
const scene = getGeoStore().scene;
assert(COLOR_PROFILE_OPTIONS.some((profile) => profile.id === "isl_shortlist"), "ISL is selectable");
equal(getGeoStore().uiColorProfileId, "vanilla", "The ISL palette selects its matching Vanilla UI theme");
assert(getGeoStore().gridEnabled && getGeoStore().axesEnabled, "Changing palette preserves enabled grid and axes");
assert(getGeoStore().dependencyGlowEnabled, "Changing palette preserves dependency glow");
equal(getGeoStore().canvasThemeOverrides, {}, "Old canvas overrides cannot tint the ISL paper");
const defaults = buildDefaultStylesForProfile("isl_shortlist");
assert(defaults.pointDefaults.sizePx === 3.5 && defaults.pointDefaults.fillColor === "#000000", "ISL uses balanced 7 px solid black dots");
assert(defaults.pointDefaults.labelFontPx === 28, "Point labels balance the heavier ISL 2018 dots");
assert(defaults.segmentDefaults.strokeWidth === 2.2 && defaults.circleDefaults.strokeWidth === 2.2,
  "Segments and circles use the firm, consistent strokes of the 2018 G1 reference");
assert(defaults.polygonDefaults.fillOpacity === 0 && !defaults.angleDefaults.fillEnabled, "Unfilled shapes");
assert(!defaults.angleDefaults.showValue, "New angle marks do not add unsolicited degree values");
equal(getGeoStore().objectLabelDefaults.point, "caption", "New points use math labels");
for (const point of scene.points) {
  const original = before.scene.points.find((candidate) => candidate.id === point.id)!;
  equal(getPointWorldPos(point, scene), getPointWorldPos(original, before.scene), "Restyling preserves dependent geometry");
  equal(point.style.labelOffsetPx, original.style.labelOffsetPx, "Manual label positions survive");
  equal(point.visible, original.visible, "Hidden helpers stay hidden");
  equal(point.style.sizePx, defaults.pointDefaults.sizePx, "Existing points receive ISL sizing");
}
const accent = scene.segments.find((segment) => segment.style.strokeColor === "#0000ff");
assert(accent?.style.dash === "dashed", "Custom blue auxiliary line and dash survive");
const overlays = createPointLabelOverlays(
  scene.points.filter((point) => point.visible).map((point) => ({ point, world: getPointWorldPos(point, scene)! })),
  { pos: { x: 0, y: 0 }, zoom: 80 }, { widthPx: 800, heightPx: 600 }
);
assert(overlays.length === 4 && overlays.every((overlay) => overlay.html.includes("katex")), "Existing point names render as math captions");

store.undo();
equal(takeHistorySnapshot(getGeoStore()), before, "One undo restores diagram, styles, labels, and paper settings");
store.redo();
equal(takeHistorySnapshot(getGeoStore()), applied, "One redo reapplies the complete preset");

// A later user customization must survive document reopen and preferred settings.
store.setPointDefaults({ sizePx: 3.1 });
store.updatePointStyleByIds([scene.points[0].id], { sizePx: 4.2 });
const customized = takeHistorySnapshot(getGeoStore());
store.loadSnapshot(customized);
equal(getGeoStore().pointDefaults.sizePx, 3.1, "Reopen retains customized ISL defaults");
equal(getGeoStore().scene.points[0].style.sizePx, 4.2, "Reopen does not force preset sizes on saved objects");
const storage = new Map<string, string>();
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} } });
try {
  const preferred = captureConstructionPreferences(getGeoStore());
  assert(saveStoredConstructionPreferences(preferred), "ISL preferred settings save");
  equal(loadStoredConstructionPreferences(), preferred, "ISL ID and all settings round-trip through persistence");
} finally {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
}

for (const drawLayerBackend of ["plain", "tkz"] as const) {
  for (const efficient of [false, true]) {
    const exportScene = efficient ? exportTikzEfficientWithOptions : exportTikzWithOptions;
    const tikz = exportScene(scene, { drawLayerBackend, emitTkzSetup: true });
    assert(tikz.includes("dash pattern="), "Export retains auxiliary dashes");
    assert(tikz.includes("color=blue"), "Export retains the blue highlight using a TeX color");
    assert(tikz.includes("fill=black"), "Export keeps solid black dots");
    await compileTikzSnippet(`isl-shortlist-${drawLayerBackend}-${efficient}`, tikz);
  }
}
console.log("isl-shortlist-style tests: OK");
