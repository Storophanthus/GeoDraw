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

const { createTikzPreviewSession, loadTikzPreviewSession } = await import("../tikzPreviewSession.ts");

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

const token = createTikzPreviewSession(tikz, { "--gd-bg": "#fff" }, params);
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
assert(localStorage.length === 0, "A consumed preview must be removed from shared localStorage.");
assert(sessionStorage.length === 1, "A consumed preview must move into window-local sessionStorage.");
assert(loadTikzPreviewSession(token)?.regen !== undefined, "The moved preview session must survive reload.");

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

const replacementToken = createTikzPreviewSession(tikz, undefined, params);
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

console.log("✓ TikZ preview quota recovery test passed");
