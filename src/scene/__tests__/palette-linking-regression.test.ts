import { getRecommendedUiProfileForColorProfile } from "../../state/colorProfiles";
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

console.log("palette-linking-regression tests: OK");
