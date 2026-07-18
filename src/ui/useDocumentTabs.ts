import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  captureGeoDocumentRuntimeState,
  restoreGeoDocumentRuntimeState,
  subscribeGeoStore,
  type GeoDocumentRuntimeState,
} from "../state/geoStore";
import { loadStoredConstructionPreferences } from "../state/appPreferences";
import { createInitialGeoState } from "../state/slices";
import { takeHistorySnapshot, type HistorySnapshot } from "../state/slices/historySlice";

export type DocumentFileState = {
  savedName: string | null;
  fileHandle: FileSystemFileHandle | null;
  tauriPath: string | null;
};

export type DocumentFilePatch = Partial<DocumentFileState>;

export type GeoDocumentTab = {
  id: string;
  title: string;
  file: DocumentFileState;
  runtime: GeoDocumentRuntimeState;
};

const emptyFileState: DocumentFileState = {
  savedName: null,
  fileHandle: null,
  tauriPath: null,
};

const DOCUMENT_TABS_STORAGE_KEY = "geodraw.documentTabs.v1";
const DOCUMENT_TABS_STORAGE_VERSION = 1;

type PersistedDocumentFileState = {
  savedName: string | null;
  tauriPath: string | null;
};

type PersistedDocumentTab = {
  id: string;
  title: string;
  file: PersistedDocumentFileState;
  runtime: GeoDocumentRuntimeState;
};

type PersistedDocumentTabsState = {
  version: typeof DOCUMENT_TABS_STORAGE_VERSION;
  activeDocumentId: string;
  nextIndex: number;
  documents: PersistedDocumentTab[];
};

type InitialDocumentTabsState = {
  documents: GeoDocumentTab[];
  activeDocumentId: string;
  nextIndex: number;
  restoreRuntime: GeoDocumentRuntimeState | null;
};

function baseTitleFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const trimmed = fileName.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\.(geodraw|json)$/i, "") || trimmed;
}

function makeDocumentId(nextIndex: number): string {
  return `doc_${nextIndex}`;
}

function makeUntitledTitle(nextIndex: number): string {
  return `Figure ${nextIndex}`;
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidSnapshot(data: unknown): data is HistorySnapshot {
  if (!isRecord(data)) return false;
  if (!isRecord(data.scene)) return false;
  if (typeof data.activeTool !== "string") return false;
  const scene = data.scene;
  return (
    Array.isArray(scene.points) &&
    Array.isArray(scene.lines) &&
    Array.isArray(scene.circles) &&
    Array.isArray(scene.segments)
  );
}

function sanitizeCamera(raw: unknown): GeoDocumentRuntimeState["camera"] {
  const fallback = structuredClone(createInitialGeoState().camera);
  if (!isRecord(raw) || !isRecord(raw.pos)) return fallback;
  const x = raw.pos.x;
  const y = raw.pos.y;
  const zoom = raw.zoom;
  const logZoom = raw.logZoom;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof zoom !== "number" ||
    typeof logZoom !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(zoom) ||
    !Number.isFinite(logZoom)
  ) {
    return fallback;
  }
  return { pos: { x, y }, zoom, logZoom };
}

function sanitizeRuntime(raw: unknown): GeoDocumentRuntimeState | null {
  if (!isRecord(raw) || !isValidSnapshot(raw.snapshot)) return null;
  const undoStack = Array.isArray(raw.undoStack) ? raw.undoStack.filter(isValidSnapshot) : [];
  const redoStack = Array.isArray(raw.redoStack) ? raw.redoStack.filter(isValidSnapshot) : [];
  return {
    snapshot: structuredClone(raw.snapshot),
    camera: sanitizeCamera(raw.camera),
    propertiesPanelIntent: raw.propertiesPanelIntent === "toolDefault" ? "toolDefault" : "object",
    undoStack: structuredClone(undoStack),
    redoStack: structuredClone(redoStack),
    lastHistoryActionKey: typeof raw.lastHistoryActionKey === "string" ? raw.lastHistoryActionKey : null,
    commandAliases: Array.isArray(raw.commandAliases)
      ? (structuredClone(raw.commandAliases) as GeoDocumentRuntimeState["commandAliases"])
      : [],
  };
}

function sanitizePersistedDocument(raw: unknown): GeoDocumentTab | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : null;
  if (!id) return null;
  const runtime = sanitizeRuntime(raw.runtime);
  if (!runtime) return null;
  const file = isRecord(raw.file) ? raw.file : {};
  const savedName = typeof file.savedName === "string" && file.savedName.trim() ? file.savedName : null;
  const tauriPath = typeof file.tauriPath === "string" && file.tauriPath.trim() ? file.tauriPath : null;
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : baseTitleFromFileName(savedName) ?? "Figure";
  return {
    id,
    title,
    file: { savedName, tauriPath, fileHandle: null },
    runtime,
  };
}

function nextDocumentIndexFromTabs(tabs: GeoDocumentTab[]): number {
  let next = tabs.length + 1;
  for (const tab of tabs) {
    const match = /^doc_(\d+)$/.exec(tab.id);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) next = Math.max(next, value + 1);
  }
  return Math.max(2, next);
}

function loadPersistedDocumentTabsState(): InitialDocumentTabsState | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(DOCUMENT_TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== DOCUMENT_TABS_STORAGE_VERSION || !Array.isArray(parsed.documents)) {
      return null;
    }
    const seen = new Set<string>();
    const documents: GeoDocumentTab[] = [];
    for (const item of parsed.documents) {
      const doc = sanitizePersistedDocument(item);
      if (!doc || seen.has(doc.id)) continue;
      seen.add(doc.id);
      documents.push(doc);
    }
    if (documents.length === 0) return null;
    const activeDocumentId =
      typeof parsed.activeDocumentId === "string" && documents.some((doc) => doc.id === parsed.activeDocumentId)
        ? parsed.activeDocumentId
        : documents[0].id;
    const activeDocument = documents.find((doc) => doc.id === activeDocumentId) ?? documents[0];
    const storedNextIndex = typeof parsed.nextIndex === "number" && Number.isFinite(parsed.nextIndex)
      ? parsed.nextIndex
      : 2;
    return {
      documents,
      activeDocumentId,
      nextIndex: Math.max(storedNextIndex, nextDocumentIndexFromTabs(documents)),
      restoreRuntime: activeDocument.runtime,
    };
  } catch (err) {
    console.warn("Failed to restore GeoDraw canvas tabs:", err);
    return null;
  }
}

function createInitialDocumentTabsState(): InitialDocumentTabsState {
  const persisted = loadPersistedDocumentTabsState();
  if (persisted) return persisted;
  const initialDocument: GeoDocumentTab = {
    id: "doc_1",
    title: "Figure 1",
    file: { ...emptyFileState },
    runtime: captureGeoDocumentRuntimeState(),
  };
  return {
    documents: [initialDocument],
    activeDocumentId: initialDocument.id,
    nextIndex: 2,
    restoreRuntime: null,
  };
}

function toPersistedDocument(tab: GeoDocumentTab): PersistedDocumentTab {
  return {
    id: tab.id,
    title: tab.title,
    file: {
      savedName: tab.file.savedName,
      tauriPath: tab.file.tauriPath,
    },
    runtime: tab.runtime,
  };
}

function savePersistedDocumentTabsState(
  documents: GeoDocumentTab[],
  activeDocumentId: string,
  nextIndex: number
): void {
  if (!canUseLocalStorage()) return;
  try {
    const payload: PersistedDocumentTabsState = {
      version: DOCUMENT_TABS_STORAGE_VERSION,
      activeDocumentId,
      nextIndex,
      documents: documents.map(toPersistedDocument),
    };
    window.localStorage.setItem(DOCUMENT_TABS_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to save GeoDraw canvas tabs:", err);
  }
}

function createBlankRuntimeState(): GeoDocumentRuntimeState {
  const blank = createInitialGeoState();
  const constructionPreset = loadStoredConstructionPreferences();
  const state = constructionPreset
    ? {
        ...blank,
        ...structuredClone(constructionPreset),
      }
    : blank;
  return {
    snapshot: takeHistorySnapshot(state),
    camera: structuredClone(blank.camera),
    propertiesPanelIntent: "object",
    undoStack: [],
    redoStack: [],
    lastHistoryActionKey: null,
    commandAliases: [],
  };
}

function createRuntimeStateFromSnapshot(snapshot: HistorySnapshot): GeoDocumentRuntimeState {
  const blank = createInitialGeoState();
  return {
    snapshot: structuredClone(snapshot),
    camera: structuredClone(blank.camera),
    propertiesPanelIntent: snapshot.selectedObject || snapshot.activeTool === "move" ? "object" : "toolDefault",
    undoStack: [],
    redoStack: [],
    lastHistoryActionKey: null,
    commandAliases: [],
  };
}

export function useDocumentTabs() {
  const initialState = useMemo(createInitialDocumentTabsState, []);
  const nextIndexRef = useRef(initialState.nextIndex);
  const initialRestoreRuntimeRef = useRef(initialState.restoreRuntime);
  const persistTimerRef = useRef<number | null>(null);
  const [documents, setDocuments] = useState<GeoDocumentTab[]>(initialState.documents);
  const [activeDocumentId, setActiveDocumentId] = useState(initialState.activeDocumentId);
  const documentsRef = useRef(documents);
  const activeDocumentIdRef = useRef(activeDocumentId);
  documentsRef.current = documents;
  activeDocumentIdRef.current = activeDocumentId;

  const captureActiveDocument = useCallback((tabs: GeoDocumentTab[]): GeoDocumentTab[] => {
    const activeId = activeDocumentIdRef.current;
    return tabs.map((tab) =>
      tab.id === activeId ? { ...tab, runtime: captureGeoDocumentRuntimeState() } : tab
    );
  }, []);

  const persistCurrentDocuments = useCallback(() => {
    const captured = captureActiveDocument(documentsRef.current);
    savePersistedDocumentTabsState(captured, activeDocumentIdRef.current, nextIndexRef.current);
  }, [captureActiveDocument]);

  const schedulePersistCurrentDocuments = useCallback(() => {
    if (!canUseLocalStorage()) return;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistCurrentDocuments();
    }, 250);
  }, [persistCurrentDocuments]);

  useEffect(() => {
    const runtime = initialRestoreRuntimeRef.current;
    if (!runtime) return;
    initialRestoreRuntimeRef.current = null;
    restoreGeoDocumentRuntimeState(runtime);
  }, []);

  useEffect(() => {
    schedulePersistCurrentDocuments();
  }, [activeDocumentId, documents, schedulePersistCurrentDocuments]);

  useEffect(() => {
    const unsubscribe = subscribeGeoStore(schedulePersistCurrentDocuments);
    const handleBeforeUnload = () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistCurrentDocuments();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [persistCurrentDocuments, schedulePersistCurrentDocuments]);

  const activeDocument = useMemo(
    () => documents.find((tab) => tab.id === activeDocumentId) ?? documents[0],
    [activeDocumentId, documents]
  );

  const selectDocument = useCallback(
    (id: string) => {
      if (id === activeDocumentIdRef.current) return;
      const captured = captureActiveDocument(documentsRef.current);
      const nextActive = captured.find((tab) => tab.id === id);
      if (!nextActive) return;
      setDocuments(captured);
      setActiveDocumentId(id);
      restoreGeoDocumentRuntimeState(nextActive.runtime);
    },
    [captureActiveDocument]
  );

  const createDocument = useCallback(() => {
    const index = nextIndexRef.current;
    nextIndexRef.current += 1;
    const tab: GeoDocumentTab = {
      id: makeDocumentId(index),
      title: makeUntitledTitle(index),
      file: { ...emptyFileState },
      runtime: createBlankRuntimeState(),
    };
    const captured = captureActiveDocument(documentsRef.current);
    setDocuments([...captured, tab]);
    setActiveDocumentId(tab.id);
    restoreGeoDocumentRuntimeState(tab.runtime);
  }, [captureActiveDocument]);

  const openSnapshotAsDocument = useCallback(
    (snapshot: HistorySnapshot, file: DocumentFilePatch = {}) => {
      const index = nextIndexRef.current;
      nextIndexRef.current += 1;
      const fileState = { ...emptyFileState, ...file };
      const title = baseTitleFromFileName(fileState.savedName) ?? makeUntitledTitle(index);
      const tab: GeoDocumentTab = {
        id: makeDocumentId(index),
        title,
        file: fileState,
        runtime: createRuntimeStateFromSnapshot(snapshot),
      };
      const captured = captureActiveDocument(documentsRef.current);
      setDocuments([...captured, tab]);
      setActiveDocumentId(tab.id);
      restoreGeoDocumentRuntimeState(tab.runtime);
    },
    [captureActiveDocument]
  );

  const closeDocument = useCallback(
    (id: string) => {
      const captured = captureActiveDocument(documentsRef.current);
      const closingIndex = captured.findIndex((tab) => tab.id === id);
      if (closingIndex < 0) return;
      if (captured.length <= 1) {
        const runtime = createBlankRuntimeState();
        const replacement: GeoDocumentTab = {
          id,
          title: "Figure 1",
          file: { ...emptyFileState },
          runtime,
        };
        setDocuments([replacement]);
        setActiveDocumentId(replacement.id);
        restoreGeoDocumentRuntimeState(runtime);
        return;
      }

      const nextTabs = captured.filter((tab) => tab.id !== id);
      const nextActive =
        id === activeDocumentIdRef.current
          ? nextTabs[Math.min(closingIndex, nextTabs.length - 1)]
          : nextTabs.find((tab) => tab.id === activeDocumentIdRef.current) ?? nextTabs[0];
      setDocuments(nextTabs);
      setActiveDocumentId(nextActive.id);
      if (id === activeDocumentIdRef.current) {
        restoreGeoDocumentRuntimeState(nextActive.runtime);
      }
    },
    [captureActiveDocument]
  );

  const renameDocument = useCallback((id: string, titleRaw: string) => {
    const title = titleRaw.trim();
    if (!title) return;
    setDocuments((prev) => prev.map((tab) => (tab.id === id ? { ...tab, title } : tab)));
  }, []);

  const updateActiveDocumentFile = useCallback((patch: DocumentFilePatch) => {
    const activeId = activeDocumentIdRef.current;
    setDocuments((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeId) return tab;
        const file = { ...tab.file, ...patch };
        return {
          ...tab,
          title: baseTitleFromFileName(file.savedName) ?? tab.title,
          file,
        };
      })
    );
  }, []);

  const buildActiveSnapshotJson = useCallback(() => {
    return JSON.stringify(captureGeoDocumentRuntimeState().snapshot, null, 2);
  }, []);

  return {
    documents,
    activeDocument,
    activeDocumentId,
    restoredFromSession: Boolean(initialState.restoreRuntime),
    createDocument,
    selectDocument,
    closeDocument,
    renameDocument,
    updateActiveDocumentFile,
    openSnapshotAsDocument,
    buildActiveSnapshotJson,
  };
}
