import { useEffect, useState } from "react";
import { isSelectedObjectAlive } from "../domain/geometryGraph";
import { useGeoStore } from "../state/geoStore";
import { ExportPanel } from "./ExportPanel";
import { IconSidebarPanelLeft, IconSidebarPanelRight } from "./icons";
import { ObjectBrowser } from "./ObjectBrowser";
import { PropertiesPanel } from "./PropertiesPanel";
import type { SelectedObject } from "../state/slices/storeTypes";
import { CircleHelp } from "lucide-react";

type RightTab = "algebra" | "export";

type RightSidebarProps = {
  rightCollapsed: boolean;
  setRightCollapsed: (collapsed: boolean) => void;
  rightWidth: number;
  collapsedWidth: number;
};

type SelectedObjectRef = Exclude<SelectedObject, null>;

const HELP_ROWS = [
  { combo: "Esc", description: "Back to Select / Move" },
  { combo: "Tab", description: "Toggle Select and recent tool" },
  { combo: "Delete", description: "Delete selection" },
  { combo: "Cmd/Ctrl + Z", description: "Undo" },
  { combo: "Cmd/Ctrl + Y", description: "Redo" },
  { combo: "Shift + F", description: "Fit view" },
  { combo: "Shift + Up / Down", description: "Extend linked Object Browser selection" },
  { combo: "Double Click", description: "Edit textbox in Select tool" },
] as const;

function selectedObjectKey(obj: SelectedObjectRef): string {
  return `${obj.type}:${obj.id}`;
}

function dedupeSelection(objs: SelectedObjectRef[]): SelectedObjectRef[] {
  const out: SelectedObjectRef[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < objs.length; i += 1) {
    const obj = objs[i];
    const key = selectedObjectKey(obj);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(obj);
  }
  return out;
}

function sameSelection(a: SelectedObjectRef[], b: SelectedObjectRef[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (selectedObjectKey(a[i]) !== selectedObjectKey(b[i])) return false;
  }
  return true;
}

export function RightSidebar({
  rightCollapsed,
  setRightCollapsed,
  rightWidth,
  collapsedWidth,
}: RightSidebarProps) {
  const scene = useGeoStore((store) => store.scene);
  const activeTool = useGeoStore((store) => store.activeTool);
  const copyStyle = useGeoStore((store) => store.copyStyle);
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const setCopyStyleSource = useGeoStore((store) => store.setCopyStyleSource);
  const applyCopyStyleTo = useGeoStore((store) => store.applyCopyStyleTo);
  const [rightTab, setRightTab] = useState<RightTab>("algebra");
  const [multiSelectedObjects, setMultiSelectedObjects] = useState<SelectedObjectRef[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setMultiSelectedObjects((prev) => {
      const alive = dedupeSelection(prev.filter((obj) => isSelectedObjectAlive(scene, obj)));
      const sameTypeAlive = selectedObject ? alive.filter((obj) => obj.type === selectedObject.type) : alive;
      const next = selectedObject
        ? sameTypeAlive.some((obj) => selectedObjectKey(obj) === selectedObjectKey(selectedObject))
          ? sameTypeAlive
          : [selectedObject]
        : [];
      return sameSelection(prev, next) ? prev : next;
    });
  }, [scene, selectedObject]);

  useEffect(() => {
    if (rightCollapsed) {
      setHelpOpen(false);
    }
  }, [rightCollapsed]);

  useEffect(() => {
    if (!helpOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  const handleBrowserSelect = (obj: SelectedObject) => {
    setSelectedObject(obj);
    if (!obj) return;
    if (activeTool !== "copyStyle") return;
    // Number objects do not carry drawable style payloads for copy-style.
    if (obj.type === "number") return;
    if (!copyStyle.source) {
      setCopyStyleSource(obj);
      return;
    }
    applyCopyStyleTo(obj);
  };

  const handleBrowserBatchSelectionChange = (next: SelectedObjectRef[]) => {
    setMultiSelectedObjects(dedupeSelection(next));
  };

  return (
    <aside
      className={rightCollapsed ? "rightSidebar collapsed" : "rightSidebar"}
      style={{ width: rightCollapsed ? collapsedWidth : rightWidth }}
    >
      {rightCollapsed ? (
        <button className="sidebarToggleButton" onClick={() => setRightCollapsed(false)} aria-label="Expand right sidebar">
          <IconSidebarPanelLeft size={16} strokeWidth={2} />
        </button>
      ) : (
        <>
          <section className="sidebarHeaderBar">
            <div className="rightTabs rightTabsHeader" role="tablist" aria-label="Right panel tabs">
              <button
                type="button"
                role="tab"
                className={rightTab === "algebra" ? "rightTabButton active" : "rightTabButton"}
                aria-selected={rightTab === "algebra"}
                onClick={() => setRightTab("algebra")}
              >
                Objects
              </button>
              <button
                type="button"
                role="tab"
                className={rightTab === "export" ? "rightTabButton active" : "rightTabButton"}
                aria-selected={rightTab === "export"}
                onClick={() => setRightTab("export")}
              >
                Export
              </button>
            </div>
            <div className="rightHeaderActions">
              <button
                type="button"
                className={helpOpen ? "sidebarToggleButton active" : "sidebarToggleButton"}
                aria-label="Show shortcut help"
                aria-expanded={helpOpen}
                onClick={() => setHelpOpen((prev) => !prev)}
              >
                <CircleHelp size={16} strokeWidth={2} />
              </button>
              <button className="sidebarToggleButton" onClick={() => setRightCollapsed(true)} aria-label="Collapse right sidebar">
                <IconSidebarPanelRight size={16} strokeWidth={2} />
              </button>
            </div>
          </section>

          {helpOpen && (
            <section className="sidebarHelpCard" aria-label="Shortcut help">
              <div className="sidebarHelpTitle">Quick Help</div>
              <div className="sidebarHelpList">
                {HELP_ROWS.map((item) => (
                  <div key={`${item.combo}-${item.description}`} className="sidebarHelpRow">
                    <kbd className="sidebarHelpKey">{item.combo}</kbd>
                    <span className="sidebarHelpText">{item.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {rightTab === "algebra" && (
            <section className="sidebarSection">
              <ObjectBrowser
                scene={scene}
                selectedObject={selectedObject}
                setSelectedObject={handleBrowserSelect}
                multiSelectedObjects={multiSelectedObjects}
                setMultiSelectedObjects={handleBrowserBatchSelectionChange}
              />
            </section>
          )}

          <ExportPanel visible={rightTab === "export"} />
          <PropertiesPanel
            visible={rightTab === "algebra"}
            multiSelectedObjects={multiSelectedObjects}
            setMultiSelectedObjects={handleBrowserBatchSelectionChange}
          />
        </>
      )}
    </aside>
  );
}
