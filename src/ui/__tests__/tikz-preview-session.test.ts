import { buildTikzExportText, type TikzExportParams } from "../../export/buildTikzExportText.ts";
import type { SceneModel } from "../../scene/points.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class QuotaStorage implements Storage {
  private readonly values = new Map<string, string>();

  constructor(public maxUnits = Number.POSITIVE_INFINITY) {}

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    const next = new Map(this.values);
    next.set(key, value);
    const units = [...next.entries()].reduce(
      (total, [entryKey, entryValue]) => total + entryKey.length + entryValue.length,
      0
    );
    if (units > this.maxUnits) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    this.values.set(key, value);
  }
}

const localStorage = new QuotaStorage();
const sessionStorage = new QuotaStorage();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage, sessionStorage },
});

const {
  createTikzPreviewSession,
  loadTikzPreviewSession,
  loadTikzPreviewSessionWithDesktopFallback,
} = await import("../tikzPreviewSession.ts");

const scene: SceneModel = {
  points: [],
  vectors: [],
  numbers: [],
  lines: [],
  segments: [],
  circles: [],
  polygons: [],
  angles: [],
};
const params: TikzExportParams = {
  scene,
  viewport: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 },
  clipRectWorld: undefined,
  clipPolygonWorld: undefined,
  screenPxPerWorld: 80,
  emitTkzSetup: true,
  drawLayerBackend: "tkz",
  bakeCoordinates: false,
  labelGlow: false,
  backgroundColor: "#ffffff",
  efficient: false,
  scaleboxScale: 1,
  trueGlobalScale: 1,
  globalScale: 1,
  pointScale: 1,
  lineScale: 1,
  labelScale: 1,
};
const tikz = buildTikzExportText(params);
const treatment = {
  mode: "veryCloseup" as const,
  baseScaleboxScale: 0.9,
  baseGlobalScale: 1.1,
};

const token = await createTikzPreviewSession(tikz, { "--gd-bg": "#fff" }, params, treatment);
const firstKey = localStorage.key(0);
assert(firstKey !== null && firstKey.endsWith(token), "Expected the preview session in localStorage.");
const compactRaw = localStorage.getItem(firstKey);
assert(compactRaw !== null && compactRaw.includes('"regen"'), "A live preview must retain regeneration parameters.");
assert(
  !compactRaw.includes('"tikzPicture"'),
  "A live preview must not duplicate its generated TikZ beside the full scene."
);

const loaded = loadTikzPreviewSession(token);
assert(loaded?.tikzPicture.includes("\\begin{tikzpicture}"), "The compact session must rebuild its TikZ.");
assert(loaded?.regen !== undefined, "The compact session must retain live figure sizing.");
assert(loaded?.treatment?.mode === "veryCloseup", "The preview must retain its named treatment.");
assert(
  loaded?.treatment?.baseScaleboxScale === 0.9 && loaded.treatment.baseGlobalScale === 1.1,
  "The preview must retain its uncompensated sizing baseline."
);
assert(localStorage.length === 1, "A loaded preview must retain a shared recovery copy.");
assert(sessionStorage.length === 1, "A loaded preview must copy into window-local sessionStorage.");
assert(loadTikzPreviewSession(token)?.regen !== undefined, "The window-local preview session must survive reload.");

sessionStorage.clear();
assert(
  loadTikzPreviewSession(token)?.regen !== undefined,
  "The shared recovery copy must survive a recreated WebView with empty sessionStorage."
);

sessionStorage.clear();
localStorage.clear();
const unrelatedKey = "gd:unrelated-user-data";
const unrelatedValue = "keep me";
const oldPreviewKey = "gd:tikz-preview:old";
const oldPreviewValue = JSON.stringify({
  tikzPicture: "x".repeat(1200),
  createdAt: Date.now(),
});
localStorage.setItem(unrelatedKey, unrelatedValue);
localStorage.setItem(oldPreviewKey, oldPreviewValue);
localStorage.maxUnits =
  unrelatedKey.length + unrelatedValue.length + oldPreviewKey.length + oldPreviewValue.length +
  Math.max(1, compactRaw.length - 1);

const replacementToken = await createTikzPreviewSession(tikz, undefined, params, treatment);
assert(
  localStorage.getItem(oldPreviewKey) === null,
  "Quota recovery must evict an older preview session."
);
assert(
  localStorage.getItem(unrelatedKey) === unrelatedValue,
  "Quota recovery must never remove unrelated user data."
);
assert(
  [...Array(localStorage.length).keys()]
    .map((index) => localStorage.key(index))
    .some((key) => key?.endsWith(replacementToken)),
  "Quota recovery must store the replacement preview session."
);

// Reproduce the native WKWebView race: the launcher successfully stores the
// session in the Tauri process, while the newly-created preview WebView sees
// neither the launcher's localStorage nor its sessionStorage yet.
localStorage.maxUnits = Number.POSITIVE_INFINITY;
localStorage.clear();
sessionStorage.clear();
const desktopSessions = new Map<string, string>();
Object.assign(window, {
  __TAURI_INTERNALS__: {
    invoke: async (command: string, args: Record<string, unknown>) => {
      if (command === "store_tikz_preview_session") {
        desktopSessions.set(String(args.token), String(args.session));
        return null;
      }
      if (command === "load_tikz_preview_session") {
        return desktopSessions.get(String(args.token)) ?? null;
      }
      throw new Error(`Unexpected Tauri command: ${command}`);
    },
  },
});
const desktopToken = await createTikzPreviewSession(tikz, undefined, params, treatment);
localStorage.clear();
sessionStorage.clear();
assert(
  loadTikzPreviewSession(desktopToken) === null,
  "The native-race fixture must begin without browser-visible storage."
);
const desktopLoaded = await loadTikzPreviewSessionWithDesktopFallback(desktopToken);
assert(
  desktopLoaded?.regen !== undefined && desktopLoaded.treatment?.mode === "veryCloseup",
  "The preview must recover its complete live session from the Tauri process."
);
assert(sessionStorage.length === 1, "The recovered desktop session must seed the preview WebView.");

console.log("✓ TikZ preview quota recovery test passed");
