import { getGeoStore } from "../../state/geoStore";
import { takeHistorySnapshot } from "../../state/slices/historySlice";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const store = getGeoStore();
store.setUiColorProfile("beige");
store.setUiCssVariable("--gd-ui-app-bg", "#112233");
store.setUiCssVariable("--gd-ui-text", "#ddeeff");

const beforeProfile = getGeoStore().uiColorProfileId;
const beforeOverrides = { ...getGeoStore().uiCssOverrides };

const snapshot = takeHistorySnapshot(getGeoStore());
assert(!("uiColorProfileId" in (snapshot as Record<string, unknown>)), "snapshot should not persist uiColorProfileId");
assert(!("uiCssOverrides" in (snapshot as Record<string, unknown>)), "snapshot should not persist uiCssOverrides");

const legacySnapshotWithUi = {
  ...snapshot,
  uiColorProfileId: "grayscale",
  uiCssOverrides: {
    "--gd-ui-app-bg": "#abcdef",
    "--gd-ui-text": "#101010",
  },
};

store.loadSnapshot(legacySnapshotWithUi as typeof snapshot);

const after = getGeoStore();
assert(after.uiColorProfileId === beforeProfile, "loading snapshot should preserve in-app uiColorProfileId");
assert(
  after.uiCssOverrides["--gd-ui-app-bg"] === beforeOverrides["--gd-ui-app-bg"],
  "loading snapshot should preserve in-app uiCssOverrides (app background)"
);
assert(
  after.uiCssOverrides["--gd-ui-text"] === beforeOverrides["--gd-ui-text"],
  "loading snapshot should preserve in-app uiCssOverrides (text)"
);

console.log("ui-theme-file-isolation tests: OK");
