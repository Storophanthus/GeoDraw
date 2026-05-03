import type { ActiveTool, PropertiesPanelIntent, SelectedObject } from "../state/slices/storeTypes";

export type ToolDefaultKind =
  | "point"
  | "segment"
  | "line"
  | "circle"
  | "polygon"
  | "angle"
  | "sector"
  | "textLabel"
  | "richText";

export function getToolDefaultKind(activeTool: ActiveTool): ToolDefaultKind | null {
  switch (activeTool) {
    case "point":
    case "midpoint":
      return "point";

    case "segment":
      return "segment";

    case "line2p":
    case "perp_line":
    case "parallel_line":
    case "tangent_line":
    case "angle_bisector":
      return "line";

    case "circle_cp":
    case "circle_3p":
    case "circle_fixed":
      return "circle";

    case "polygon":
    case "regular_polygon":
      return "polygon";

    case "angle":
    case "angle_fixed":
      return "angle";

    case "sector":
      return "sector";

    case "label":
      return "textLabel";

    case "textbox":
      return "richText";

    default:
      return null;
  }
}

export function shouldShowToolPreconfigurePanel(activeTool: ActiveTool): boolean {
  return activeTool !== "move";
}

export function shouldShowToolPreconfigurePanelForState({
  activeTool,
  propertiesPanelIntent,
  recentCreatedOwnsPanel,
}: {
  activeTool: ActiveTool;
  propertiesPanelIntent: PropertiesPanelIntent;
  recentCreatedOwnsPanel: boolean;
}): boolean {
  return (
    shouldShowToolPreconfigurePanel(activeTool)
    && propertiesPanelIntent === "toolDefault"
    && !recentCreatedOwnsPanel
  );
}

export type RecentCreatedPanelClaim = {
  key: string;
  toolActivationVersion: number;
};

export function selectedObjectPanelKey(obj: Exclude<SelectedObject, null>): string {
  return `${obj.type}:${obj.id}`;
}

export function reconcileRecentCreatedPanelClaim({
  selectedObject,
  recentCreatedObject,
  previousClaim,
  toolActivationVersion,
}: {
  selectedObject: SelectedObject;
  recentCreatedObject: SelectedObject;
  previousClaim: RecentCreatedPanelClaim | null;
  toolActivationVersion: number;
}): { claim: RecentCreatedPanelClaim | null; recentCreatedOwnsPanel: boolean } {
  if (!selectedObject || !recentCreatedObject) {
    return { claim: previousClaim, recentCreatedOwnsPanel: false };
  }
  const selectedKey = selectedObjectPanelKey(selectedObject);
  if (selectedKey !== selectedObjectPanelKey(recentCreatedObject)) {
    return { claim: previousClaim, recentCreatedOwnsPanel: false };
  }
  const claim =
    previousClaim?.key === selectedKey
      ? previousClaim
      : { key: selectedKey, toolActivationVersion };
  return {
    claim,
    recentCreatedOwnsPanel: claim.toolActivationVersion === toolActivationVersion,
  };
}
