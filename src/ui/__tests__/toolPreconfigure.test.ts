import type { ActiveTool } from "../../state/slices/storeTypes";
import {
  getToolDefaultKind,
  reconcileRecentCreatedPanelClaim,
  shouldShowToolPreconfigurePanel,
  shouldShowToolPreconfigurePanelForState,
} from "../toolPreconfigure";

function fail(message: string): never {
  throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) fail(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const expected: Array<[ActiveTool, ReturnType<typeof getToolDefaultKind>]> = [
  ["point", "point"],
  ["midpoint", "point"],
  ["segment", "segment"],
  ["line2p", "line"],
  ["perp_line", "line"],
  ["parallel_line", "line"],
  ["tangent_line", "line"],
  ["angle_bisector", "line"],
  ["circle_cp", "circle"],
  ["circle_3p", "circle"],
  ["circle_fixed", "circle"],
  ["ellipse_foci_point", "ellipse"],
  ["polygon", "polygon"],
  ["regular_polygon", "polygon"],
  ["angle", "angle"],
  ["angle_fixed", "angle"],
  ["sector", "sector"],
  ["label", "textLabel"],
  ["textbox", "richText"],
  ["move", null],
  ["copyStyle", null],
  ["translate", null],
  ["rotate", null],
  ["reflect", null],
  ["dilate", null],
  ["invert", null],
  ["export_clip", null],
  ["export_clip_rect", null],
];

for (const [tool, kind] of expected) {
  assertEqual(getToolDefaultKind(tool), kind, `${tool} default target`);
}

assertEqual(shouldShowToolPreconfigurePanel("move"), false, "move keeps object properties visible");
assertEqual(shouldShowToolPreconfigurePanel("line2p"), true, "construction tools own the right panel");
assertEqual(shouldShowToolPreconfigurePanel("translate"), true, "setting-only tools still own the right panel");
assertEqual(
  shouldShowToolPreconfigurePanelForState({
    activeTool: "line2p",
    propertiesPanelIntent: "toolDefault",
    recentCreatedOwnsPanel: false,
  }),
  true,
  "tool click shows editable defaults"
);
assertEqual(
  shouldShowToolPreconfigurePanelForState({
    activeTool: "line2p",
    propertiesPanelIntent: "object",
    recentCreatedOwnsPanel: false,
  }),
  false,
  "object click returns the panel to object properties"
);
assertEqual(
  shouldShowToolPreconfigurePanelForState({
    activeTool: "line2p",
    propertiesPanelIntent: "toolDefault",
    recentCreatedOwnsPanel: true,
  }),
  false,
  "newly created objects keep object properties visible"
);

const createdLine = { type: "line" as const, id: "l_1" };
const firstClaim = reconcileRecentCreatedPanelClaim({
  selectedObject: createdLine,
  recentCreatedObject: createdLine,
  previousClaim: null,
  toolActivationVersion: 3,
});
assertEqual(firstClaim.recentCreatedOwnsPanel, true, "newly created selected object owns the panel");
const reopenedDefaults = reconcileRecentCreatedPanelClaim({
  selectedObject: createdLine,
  recentCreatedObject: createdLine,
  previousClaim: firstClaim.claim,
  toolActivationVersion: 4,
});
assertEqual(reopenedDefaults.recentCreatedOwnsPanel, false, "clicking the active tool again reopens tool defaults");
const nextCreatedLine = { type: "line" as const, id: "l_2" };
const nextClaim = reconcileRecentCreatedPanelClaim({
  selectedObject: nextCreatedLine,
  recentCreatedObject: nextCreatedLine,
  previousClaim: reopenedDefaults.claim,
  toolActivationVersion: 4,
});
assertEqual(nextClaim.recentCreatedOwnsPanel, true, "next created object takes the panel back");

console.log("toolPreconfigure: ok");
