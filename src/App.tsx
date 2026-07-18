import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getRecommendedUiProfileForColorProfile, getUiCssVariables } from "./state/colorProfiles";
import { useGeoStore } from "./state/geoStore";
import {
  loadStoredConstructionPreferences,
  captureUiPreferences,
  loadStoredUiPreferences,
  saveStoredUiPreferences,
} from "./state/appPreferences";
import { TikzPreviewWindow } from "./ui/TikzPreviewWindow";
import { WorkspaceShell } from "./ui/WorkspaceShell";
import { useAppShellController } from "./ui/useAppShellController";
import { useDocumentTabs } from "./ui/useDocumentTabs";

export default function App() {
  const previewToken = getPreviewTokenFromLocation();
  if (previewToken) {
    return <TikzPreviewWindow token={previewToken} />;
  }
  return <WorkspaceApp />;
}

function WorkspaceApp() {
  const shell = useAppShellController();
  const documentTabs = useDocumentTabs();
  const applyAppPreferences = useGeoStore((store) => store.applyAppPreferences);
  const uiColorProfileId = useGeoStore((store) => store.uiColorProfileId);
  const uiCssOverrides = useGeoStore((store) => store.uiCssOverrides);
  const [uiPrefsHydrated, setUiPrefsHydrated] = useState(false);
  const uiCssVariables = useMemo(
    () => getUiCssVariables(uiColorProfileId, uiCssOverrides) as CSSProperties,
    [uiColorProfileId, uiCssOverrides]
  );

  useEffect(() => {
    const storedUi = loadStoredUiPreferences();
    const storedConstruction = documentTabs.restoredFromSession ? null : loadStoredConstructionPreferences();
    const merged = (() => {
      if (!storedUi && !storedConstruction) return null;
      if (storedConstruction && !storedUi) {
        return {
          ...storedConstruction,
          uiColorProfileId: getRecommendedUiProfileForColorProfile(storedConstruction.colorProfileId),
        };
      }
      return {
        ...(storedConstruction ?? {}),
        ...(storedUi ?? {}),
      };
    })();
    if (merged) {
      applyAppPreferences(merged);
    }
    const timer = window.setTimeout(() => setUiPrefsHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, [applyAppPreferences, documentTabs.restoredFromSession]);

  useEffect(() => {
    if (!uiPrefsHydrated) return;
    saveStoredUiPreferences(
      captureUiPreferences({
        uiColorProfileId,
        uiCssOverrides,
      })
    );
  }, [uiColorProfileId, uiCssOverrides, uiPrefsHydrated]);

  return (
    <WorkspaceShell
      {...shell}
      uiCssVariables={uiCssVariables}
      documents={documentTabs.documents}
      activeDocumentId={documentTabs.activeDocumentId}
      activeDocumentFile={documentTabs.activeDocument.file}
      onCreateDocument={documentTabs.createDocument}
      onSelectDocument={documentTabs.selectDocument}
      onCloseDocument={documentTabs.closeDocument}
      onRenameDocument={documentTabs.renameDocument}
      onUpdateActiveDocumentFile={documentTabs.updateActiveDocumentFile}
      onOpenSnapshotAsDocument={documentTabs.openSnapshotAsDocument}
      onBuildActiveSnapshotJson={documentTabs.buildActiveSnapshotJson}
    />
  );
}

function getPreviewTokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const token = new URLSearchParams(window.location.search).get("tikzPreview");
  return token && token.trim() ? token : null;
}
