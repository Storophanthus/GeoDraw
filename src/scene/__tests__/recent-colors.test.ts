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
const STORAGE_KEY = "geodraw.recent-colors.v1";

// Must run before importing appPreferences.ts — its localStorage guard reads
// `window` at call time, but the reference itself is a plain global lookup
// that has to resolve to something before the module's functions are called.
(globalThis as unknown as { window: { localStorage: StorageLike } }).window = {
  localStorage: memoryStorage,
};

const { loadStoredRecentColors, saveStoredRecentColors, MAX_RECENT_COLORS } = await import(
  "../../state/appPreferences"
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Missing key
memoryStorage.removeItem(STORAGE_KEY);
assert(loadStoredRecentColors().length === 0, "Expected no stored key to yield an empty list.");

// Round trip
saveStoredRecentColors(["#0a64c8", "#ff0000"]);
assert(
  JSON.stringify(loadStoredRecentColors()) === JSON.stringify(["#0a64c8", "#ff0000"]),
  "Expected round-tripped colors to match what was saved, in order."
);

// Cap at MAX_RECENT_COLORS
const overCap = Array.from({ length: MAX_RECENT_COLORS + 5 }, (_, i) => `#${(i + 1).toString(16).padStart(6, "0")}`);
saveStoredRecentColors(overCap);
assert(
  loadStoredRecentColors().length === MAX_RECENT_COLORS,
  `Expected list to cap at ${MAX_RECENT_COLORS}, got ${loadStoredRecentColors().length}.`
);
assert(
  loadStoredRecentColors()[0] === overCap[0],
  "Expected the cap to keep the front of the list (most recent), not the tail."
);

// Garbage entries are dropped, not just the whole envelope
memoryStorage.setItem(
  STORAGE_KEY,
  JSON.stringify({ version: 1, value: ["#123456", "not-a-color", "#abcdef", 42, null, "#GGGGGG"] })
);
assert(
  JSON.stringify(loadStoredRecentColors()) === JSON.stringify(["#123456", "#abcdef"]),
  `Expected only valid lowercase 6-digit hex entries to survive, got ${JSON.stringify(loadStoredRecentColors())}.`
);

// Duplicate entries in stored data are deduped on load
memoryStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, value: ["#111111", "#222222", "#111111"] }));
assert(
  JSON.stringify(loadStoredRecentColors()) === JSON.stringify(["#111111", "#222222"]),
  "Expected duplicate hex entries to be deduped, keeping the first occurrence."
);

// Malformed envelope falls back to empty, not a crash
memoryStorage.setItem(STORAGE_KEY, "{not json");
assert(loadStoredRecentColors().length === 0, "Expected malformed JSON to yield an empty list, not throw.");

memoryStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, value: "not-an-array" }));
assert(loadStoredRecentColors().length === 0, "Expected a non-array value to yield an empty list, not throw.");

console.log("✓ recent-colors persistence test passed");
