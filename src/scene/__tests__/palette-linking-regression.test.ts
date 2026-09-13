import { COLOR_PROFILE_OPTIONS, getCanvasColorTheme, getRecommendedUiProfileForColorProfile } from "../../state/colorProfiles";
import { getGeoStore } from "../../state/geoStore";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const store = getGeoStore();

store.applyAppPreferences({
  colorProfileId: "beige_light",
  uiColorProfileId: "beige",
  uiCssOverrides: {},
});

store.setColorProfile("classic");
let state = getGeoStore();
assert(state.colorProfileId === "classic", "setColorProfile should update construction palette.");
assert(
  state.uiColorProfileId === getRecommendedUiProfileForColorProfile("classic"),
  "setColorProfile should keep UI palette paired when previously paired."
);

store.applyAppPreferences({
  colorProfileId: "beige_light",
  uiColorProfileId: "grayscale",
  uiCssOverrides: {},
});

store.setColorProfile("dark_mode");
state = getGeoStore();
assert(state.colorProfileId === "dark_mode", "setColorProfile should still update construction palette.");
assert(
  state.uiColorProfileId === "grayscale",
  "setColorProfile should preserve custom UI palette when user intentionally unpairs."
);

store.setColorProfile("isl_shortlist");
state = getGeoStore();
assert(state.colorProfileId === "isl_shortlist", "ISL should be selected through the same palette action.");
assert(state.uiColorProfileId === "vanilla", "Selecting ISL must also select the matching Vanilla UI theme.");

// Repair the mismatched state left by the original ISL implementation, even
// when the construction profile itself is already selected.
store.setUiColorProfile("beige");
store.setColorProfile("isl_shortlist");
state = getGeoStore();
assert(state.uiColorProfileId === "vanilla", "Reapplying ISL must repair an existing UI-theme mismatch.");

store.setColorProfile("dark_mode");
state = getGeoStore();
assert(state.uiColorProfileId === "dark", "Switching away from ISL should retain normal palette pairing.");

for (const enabled of [true, false]) {
  store.setGridEnabled(enabled);
  store.setAxesEnabled(enabled);
  store.setGridSnapEnabled(enabled);
  store.setDependencyGlowEnabled(enabled);
  for (const profile of COLOR_PROFILE_OPTIONS) {
    store.setColorProfile(profile.id);
    state = getGeoStore();
    assert(state.gridEnabled === enabled, `${profile.label} must retain grid visibility.`);
    assert(state.axesEnabled === enabled, `${profile.label} must retain axis visibility.`);
    assert(state.gridSnapEnabled === enabled, `${profile.label} must retain snapping.`);
    assert(state.dependencyGlowEnabled === enabled, `${profile.label} must retain dependency glow.`);
  }
  store.setColorProfile("isl_shortlist");
  store.setColorProfile("isl_shortlist");
  assert(getGeoStore().gridEnabled === enabled, "Reapplying ISL must retain grid visibility too.");
}
const islCanvas = getCanvasColorTheme("isl_shortlist");
assert(islCanvas.gridMinorColor === "#000000" && islCanvas.gridMajorColor === "#000000",
  "ISL grid colors need contrast because the renderer already applies low grid opacity.");

const customCanvas = { backgroundColor: "#ffeecc", gridMinorColor: "#aabbcc", gridMajorColor: "#112233", axisColor: "#445566" };
for (const profile of COLOR_PROFILE_OPTIONS) {
  store.applyAppPreferences({ canvasThemeOverrides: customCanvas });
  store.setColorProfile(profile.id);
  state = getGeoStore();
  assert(JSON.stringify(getCanvasColorTheme(profile.id, state.canvasThemeOverrides)) === JSON.stringify(getCanvasColorTheme(profile.id)),
    `${profile.label} must update actual canvas colors, even after custom overrides.`);
  store.undo();
  assert(JSON.stringify(getGeoStore().canvasThemeOverrides) === JSON.stringify(customCanvas),
    "Undo must restore the previous customized canvas colors.");
  store.redo();
  store.applyAppPreferences({ canvasThemeOverrides: customCanvas });
  store.setColorProfile(profile.id);
  assert(Object.keys(getGeoStore().canvasThemeOverrides).length === 0,
    "Explicitly reapplying the same palette must clear stale canvas colors too.");
}

console.log("palette-linking-regression tests: OK");
