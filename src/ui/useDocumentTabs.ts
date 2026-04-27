import { useCallback, useMemo, useRef, useState } from "react";
import {
  captureGeoDocumentRuntimeState,
  getGeoStore,
  restoreGeoDocumentRuntimeState,
  type GeoDocumentRuntimeState,
} from "../state/geoStore";
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

function createBlankRuntimeState(): GeoDocumentRuntimeState {
  const current = getGeoStore();
  const blank = createInitialGeoState();
  const state = {
    ...blank,
    colorProfileId: current.colorProfileId,
    canvasThemeOverrides: current.canvasThemeOverrides,
    uiColorProfileId: current.uiColorProfileId,
    uiCssOverrides: current.uiCssOverrides,
    gridEnabled: current.gridEnabled,
    axesEnabled: current.axesEnabled,
    gridSnapEnabled: current.gridSnapEnabled,
    pointDefaults: current.pointDefaults,
    segmentDefaults: current.segmentDefaults,
    lineDefaults: current.lineDefaults,
    circleDefaults: current.circleDefaults,
    polygonDefaults: current.polygonDefaults,
    angleDefaults: current.angleDefaults,
    objectLabelDefaults: current.objectLabelDefaults,
    labelToolDefaults: current.labelToolDefaults,
    textboxToolDefaults: current.textboxToolDefaults,
    richTextToolDefaults: current.richTextToolDefaults,
    angleFixedTool: current.angleFixedTool,
    circleFixedTool: current.circleFixedTool,
    regularPolygonTool: current.regularPolygonTool,
    transformTool: current.transformTool,
    dependencyGlowEnabled: current.dependencyGlowEnabled,
  };
  return {
    snapshot: takeHistorySnapshot(state),
    camera: structuredClone(blank.camera),
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
    undoStack: [],
    redoStack: [],
    lastHistoryActionKey: null,
    commandAliases: [],
  };
}

export function useDocumentTabs() {
  const nextIndexRef = useRef(2);
  const initialDocument = useMemo<GeoDocumentTab>(
    () => ({
      id: "doc_1",
      title: "Figure 1",
      file: { ...emptyFileState },
      runtime: captureGeoDocumentRuntimeState(),
    }),
    []
  );
  const [documents, setDocuments] = useState<GeoDocumentTab[]>([initialDocument]);
  const [activeDocumentId, setActiveDocumentId] = useState(initialDocument.id);
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
    createDocument,
    selectDocument,
    closeDocument,
    renameDocument,
    updateActiveDocumentFile,
    openSnapshotAsDocument,
    buildActiveSnapshotJson,
  };
}
