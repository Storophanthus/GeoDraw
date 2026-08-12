export {}; // top-level await requires this file to be a module, not a script

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

const memoryStorage = createMemoryStorage();
const STORAGE_KEY = "geodraw.export-preferences.v1";

// Must run before importing appPreferences.ts — its localStorage guard reads
// `window` at call time, but the reference itself is a plain global lookup
// that has to resolve to something before the module's functions are called.
(globalThis as unknown as { window: { localStorage: StorageLike } }).window = {
  localStorage: memoryStorage,
};

const { loadStoredExportPreferences, saveStoredExportPreferences, DEFAULT_EXPORT_PREFERENCES } = await import(
  "../../state/appPreferences"
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Round trip
const custom = {
  useCurrentView: false,
  compactCode: false,
  emitTkzSetup: "on" as const,
  labelGlow: false,
  tikzExportMode: "reconstructible" as const,
  figureTreatment: "veryCloseup" as const,
  scaleboxScale: "0.75",
  trueGlobalScale: "1.25",
  globalScale: "1.5",
  pointScale: "0.8",
  lineScale: "2",
  labelScale: "1.2",
  labelHaloScale: "1.4",
  roundNumbersToTwoDecimals: true,
  preferDvipsNames: true,
};
assert(saveStoredExportPreferences(custom), "save should report success when localStorage is available");
assert(
  JSON.stringify(loadStoredExportPreferences()) === JSON.stringify(custom),
  "round-tripped preferences should match what was saved"
);

// Garbage JSON tolerance
memoryStorage.setItem(STORAGE_KEY, "{not valid json");
assert(
  JSON.stringify(loadStoredExportPreferences()) === JSON.stringify(DEFAULT_EXPORT_PREFERENCES),
  "garbage JSON should fall back to defaults"
);

// Wrong version rejection
memoryStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, value: custom }));
assert(
  JSON.stringify(loadStoredExportPreferences()) === JSON.stringify(DEFAULT_EXPORT_PREFERENCES),
  "wrong envelope version should fall back to defaults"
);

// Per-field fallback: one bad field must not take down the rest
memoryStorage.setItem(
  STORAGE_KEY,
  JSON.stringify({
    version: 1,
    value: {
      useCurrentView: "not-a-boolean",
      compactCode: false,
      emitTkzSetup: "bogus",
      labelGlow: true,
      tikzExportMode: "reconstructible",
      figureTreatment: "not-a-treatment",
      scaleboxScale: "1.8",
      trueGlobalScale: "2",
      globalScale: "999",
      pointScale: "0.5",
      lineScale: "not-a-number",
      labelScale: "1",
      labelHaloScale: "0.75",
      roundNumbersToTwoDecimals: true,
      preferDvipsNames: true,
    },
  })
);
const partial = loadStoredExportPreferences();
assert(partial.useCurrentView === DEFAULT_EXPORT_PREFERENCES.useCurrentView, "invalid useCurrentView should fall back to default");
assert(partial.compactCode === false, "valid compactCode should be preserved");
assert(partial.emitTkzSetup === "auto", "invalid emitTkzSetup should fall back to auto");
assert(partial.labelGlow === true, "valid labelGlow should be preserved");
assert(partial.tikzExportMode === "reconstructible", "valid tikzExportMode should be preserved");
assert(partial.figureTreatment === "canvas", "invalid figure treatment should fall back to Canvas");
assert(partial.scaleboxScale === "1.8", "valid scaleboxScale should be preserved");
assert(partial.trueGlobalScale === "2", "valid trueGlobalScale should be preserved");
assert(partial.globalScale === DEFAULT_EXPORT_PREFERENCES.globalScale, "out-of-range globalScale should fall back to default");
assert(partial.pointScale === "0.5", "valid pointScale should be preserved");
assert(partial.lineScale === DEFAULT_EXPORT_PREFERENCES.lineScale, "non-numeric lineScale should fall back to default");
assert(partial.labelScale === "1", "valid labelScale should be preserved");
assert(partial.labelHaloScale === "0.75", "valid labelHaloScale should be preserved");
assert(partial.roundNumbersToTwoDecimals === true, "valid numeric precision preference should be preserved");
assert(partial.preferDvipsNames === true, "valid dvipsnames preference should be preserved");

// Legacy envelopes predate named treatments. Their numeric baselines must be
// preserved while the missing mode adopts the existing Canvas behavior.
const { figureTreatment: _omittedTreatment, ...legacyCustom } = custom;
memoryStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, value: legacyCustom }));
const legacy = loadStoredExportPreferences();
assert(legacy.figureTreatment === "canvas", "legacy preferences should migrate to Canvas treatment");
assert(legacy.scaleboxScale === custom.scaleboxScale, "legacy outer scale should remain intact");
assert(legacy.globalScale === custom.globalScale, "legacy TikZ scale should remain intact");

// Missing key entirely
memoryStorage.removeItem(STORAGE_KEY);
assert(
  JSON.stringify(loadStoredExportPreferences()) === JSON.stringify(DEFAULT_EXPORT_PREFERENCES),
  "missing key should yield defaults"
);

console.log("export-preferences: ok");
