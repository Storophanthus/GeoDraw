import { useMemo, type CSSProperties } from "react";
import { getUiCssVariables } from "./state/colorProfiles";
import { useGeoStore } from "./state/geoStore";
import { WorkspaceShell } from "./ui/WorkspaceShell";
import { useAppShellController } from "./ui/useAppShellController";

export default function App() {
  const shell = useAppShellController();
  const uiColorProfileId = useGeoStore((store) => store.uiColorProfileId);
  const uiCssOverrides = useGeoStore((store) => store.uiCssOverrides);
  const uiCssVariables = useMemo(
    () => getUiCssVariables(uiColorProfileId, uiCssOverrides) as CSSProperties,
    [uiColorProfileId, uiCssOverrides]
  );
  return <WorkspaceShell {...shell} uiCssVariables={uiCssVariables} />;
}
