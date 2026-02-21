import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getUiCssVariables } from "./state/colorProfiles";
import { useGeoStore } from "./state/geoStore";
import {
  loadStoredConstructionPreferences,
  captureUiPreferences,
  loadStoredUiPreferences,
  saveStoredUiPreferences,
} from "./state/appPreferences";
import { WorkspaceShell } from "./ui/WorkspaceShell";
import { useAppShellController } from "./ui/useAppShellController";

export default function App() {
  const shell = useAppShellController();
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
    const storedConstruction = loadStoredConstructionPreferences();
    const merged =
      storedUi || storedConstruction
        ? {
            ...(storedConstruction ?? {}),
            ...(storedUi ?? {}),
          }
        : null;
    if (merged) {
      applyAppPreferences(merged);
    }
    const timer = window.setTimeout(() => setUiPrefsHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, [applyAppPreferences]);

  useEffect(() => {
    if (!uiPrefsHydrated) return;
    saveStoredUiPreferences(
      captureUiPreferences({
        uiColorProfileId,
        uiCssOverrides,
      })
    );
  }, [uiColorProfileId, uiCssOverrides, uiPrefsHydrated]);

  return <WorkspaceShell {...shell} uiCssVariables={uiCssVariables} />;
}
