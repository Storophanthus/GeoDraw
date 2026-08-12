import { invoke } from "@tauri-apps/api/core";
import { buildTikzExportText, type TikzExportParams } from "../export/buildTikzExportText";
import {
  normalizeFigureTreatmentMode,
  type FigureTreatmentMode,
} from "../export/figureTreatment";

const STORAGE_PREFIX = "gd:tikz-preview:";
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Everything the preview window needs to regenerate the figure when a sizing
 * scale changes. It is exactly the exporter's params — the sizing fields double
 * as the initial slider values.
 */
export type TikzPreviewRegenParams = TikzExportParams;

export type TikzPreviewTreatmentState = {
  mode: FigureTreatmentMode;
  /** Manual outer scale before Canvas/General/Very-close-up treatment. */
  baseScaleboxScale: number;
  /** Manual TikZ coordinate scale before reciprocal treatment compensation. */
  baseGlobalScale: number;
};

export type TikzPreviewSession = {
  tikzPicture: string;
  createdAt: number;
  uiCssVariables?: Record<string, string>;
  /** Absent for web popups or legacy sessions; present enables live figure sizing. */
  regen?: TikzPreviewRegenParams;
  /** Preview-only treatment metadata; the TikZ exporter receives resolved scales. */
  treatment?: TikzPreviewTreatmentState;
};

type StoredTikzPreviewSession = Omit<TikzPreviewSession, "tikzPicture"> & {
  /** Omitted when regen can reproduce the exact generated TikZ. */
  tikzPicture?: string;
};

export async function createTikzPreviewSession(
  source: string,
  uiCssVariables?: Record<string, string>,
  regen?: TikzPreviewRegenParams,
  treatment?: TikzPreviewTreatmentState
): Promise<string> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const key = `${STORAGE_PREFIX}${token}`;
  const session: StoredTikzPreviewSession = {
    createdAt: Date.now(),
    uiCssVariables: sanitizeUiVariables(uiCssVariables),
    regen,
    treatment: sanitizePreviewTreatment(treatment),
  };
  // When regen is present, storing the generated TikZ as well would duplicate
  // the entire construction. The preview can rebuild that exact string.
  if (!regen) session.tikzPicture = extractTikzPicture(source);
  const serialized = JSON.stringify(session);
  let storedInBrowser = false;
  if (typeof window !== "undefined") {
    pruneOldSessions();
    storedInBrowser = storePreviewSessionWithEviction(key, serialized);
    if (!storedInBrowser) {
      // If the scene alone is still too large, retain just the generated TikZ.
      // The preview remains usable, though live sizing is unavailable.
      const fallback: StoredTikzPreviewSession = {
        tikzPicture: extractTikzPicture(source),
        createdAt: session.createdAt,
        uiCssVariables: session.uiCssVariables,
      };
      storedInBrowser = storePreviewSessionWithEviction(key, JSON.stringify(fallback));
    }
  }

  let storedInDesktopApp = false;
  if (isTauriRuntime()) {
    try {
      // A newly-created WKWebView does not always observe localStorage writes
      // from the main window immediately. Deposit the same payload in the
      // Rust process before opening the preview so its first render has a
      // synchronization-independent source of truth.
      await invoke("store_tikz_preview_session", { token, session: serialized });
      storedInDesktopApp = true;
    } catch {
      // Browser storage remains the web build and desktop recovery fallback.
    }
  }

  if (typeof window !== "undefined" && !storedInBrowser && !storedInDesktopApp) {
    throw new Error("TikZ preview storage is full. Close old preview windows and try again.");
  }
  return token;
}

export function loadTikzPreviewSession(token: string): TikzPreviewSession | null {
  if (!token || typeof window === "undefined") return null;
  const key = `${STORAGE_PREFIX}${token}`;
  const sessionStorage = getSessionStorage();
  const sessionRaw = safeStorageGet(sessionStorage, key);
  const localRaw = safeStorageGet(window.localStorage, key);
  const raw = sessionRaw ?? localRaw;
  if (!raw) return null;
  const parsedSession = parseStoredPreviewSession(raw);
  if (!parsedSession) return null;
  // Keep a window-local copy for quick reloads, but retain the shared copy as
  // well. Tauri can recreate a WebView during development or after a process
  // refresh, which clears that WebView's sessionStorage. Removing the shared
  // copy here made an otherwise healthy preview reopen as "session not found".
  // Old shared entries are already pruned and quota recovery evicts only
  // preview entries, so retaining this compact recovery copy is bounded.
  if (!sessionRaw && localRaw && sessionStorage) {
    try {
      sessionStorage.setItem(key, localRaw);
    } catch {
      // The durable local copy remains available when sessionStorage fails.
    }
  }
  return parsedSession;
}

export async function loadTikzPreviewSessionWithDesktopFallback(
  token: string
): Promise<TikzPreviewSession | null> {
  const browserSession = loadTikzPreviewSession(token);
  if (browserSession || !token || !isTauriRuntime()) return browserSession;
  try {
    const raw = await invoke<string | null>("load_tikz_preview_session", { token });
    if (!raw) return null;
    const session = parseStoredPreviewSession(raw);
    if (!session) return null;
    const key = `${STORAGE_PREFIX}${token}`;
    const sessionStorage = getSessionStorage();
    try {
      sessionStorage?.setItem(key, raw);
    } catch {
      // The app-level store remains available for later reads.
    }
    return session;
  } catch {
    return null;
  }
}

function parseStoredPreviewSession(raw: string): TikzPreviewSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTikzPreviewSession>;
    const regen = isRegenParams(parsed.regen) ? parsed.regen : undefined;
    const treatment = sanitizePreviewTreatment(parsed.treatment);
    const tikzPicture = typeof parsed.tikzPicture === "string"
      ? parsed.tikzPicture
      : regen
        ? extractTikzPicture(buildTikzExportText(regen))
        : null;
    if (tikzPicture === null) return null;
    return {
      tikzPicture,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
      uiCssVariables: sanitizeUiVariables(parsed.uiCssVariables),
      regen,
      treatment,
    };
  } catch {
    return null;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object);
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.sessionStorage
      ? window.sessionStorage
      : null;
  } catch {
    return null;
  }
}

function safeStorageGet(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storePreviewSessionWithEviction(key: string, serialized: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, serialized);
    return true;
  } catch {
    // Continue below and reclaim older preview-only entries. Never remove
    // saved documents, preferences, or any unrelated localStorage data.
  }

  for (const candidate of previewSessionKeysOldestFirst(key)) {
    try {
      window.localStorage.removeItem(candidate);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch {
      // Remove another preview entry and retry.
    }
  }
  return false;
}

function previewSessionKeysOldestFirst(excludedKey: string): string[] {
  if (typeof window === "undefined") return [];
  const entries: Array<{ key: string; createdAt: number }> = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || key === excludedKey || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      let createdAt = 0;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { createdAt?: number };
          createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
        } catch {
          createdAt = 0;
        }
      }
      entries.push({ key, createdAt });
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => a.createdAt - b.createdAt).map((entry) => entry.key);
}

function isRegenParams(value: unknown): value is TikzPreviewRegenParams {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TikzExportParams>;
  return (
    typeof candidate.scene === "object" &&
    candidate.scene !== null &&
    typeof candidate.globalScale === "number" &&
    typeof candidate.pointScale === "number" &&
    typeof candidate.lineScale === "number" &&
    typeof candidate.labelScale === "number"
  );
}

function sanitizePreviewTreatment(value: unknown): TikzPreviewTreatmentState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<TikzPreviewTreatmentState>;
  if (
    typeof candidate.baseScaleboxScale !== "number" ||
    !Number.isFinite(candidate.baseScaleboxScale) ||
    candidate.baseScaleboxScale <= 0 ||
    typeof candidate.baseGlobalScale !== "number" ||
    !Number.isFinite(candidate.baseGlobalScale) ||
    candidate.baseGlobalScale <= 0
  ) {
    return undefined;
  }
  return {
    mode: normalizeFigureTreatmentMode(candidate.mode),
    baseScaleboxScale: candidate.baseScaleboxScale,
    baseGlobalScale: candidate.baseGlobalScale,
  };
}

function pruneOldSessions(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    keys.push(key);
  }
  for (const key of keys) {
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { createdAt?: number };
      const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
      if (createdAt <= 0 || now - createdAt > MAX_SESSION_AGE_MS) {
        window.localStorage.removeItem(key);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }
}

function extractTikzPicture(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "\\begin{tikzpicture}\n\\end{tikzpicture}";

  const begin = trimmed.indexOf("\\begin{tikzpicture}");
  const end = trimmed.lastIndexOf("\\end{tikzpicture}");
  if (begin >= 0 && end > begin) {
    // Keep an outer \scalebox wrapper; it is part of the figure sizing rather
    // than document preamble noise.
    const scalebox = trimmed.lastIndexOf("\\scalebox", begin);
    if (scalebox >= 0) return trimmed.slice(scalebox);
    return trimmed.slice(begin, end + "\\end{tikzpicture}".length).trim();
  }

  if (trimmed.includes("\\begin{tikzpicture}")) {
    return trimmed;
  }

  return `\\begin{tikzpicture}\n${trimmed}\n\\end{tikzpicture}`;
}

function sanitizeUiVariables(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
