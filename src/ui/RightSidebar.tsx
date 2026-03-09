import { useEffect, useState } from "react";
import { isSelectedObjectAlive } from "../domain/geometryGraph";
import { useGeoStore } from "../state/geoStore";
import { ExportPanel } from "./ExportPanel";
import { IconSidebarPanelLeft, IconSidebarPanelRight } from "./icons";
import { ObjectBrowser } from "./ObjectBrowser";
import { PropertiesPanel } from "./PropertiesPanel";
import type { SelectedObject } from "../state/slices/storeTypes";

type RightTab = "algebra" | "export";

type RightSidebarProps = {
  rightCollapsed: boolean;
  setRightCollapsed: (collapsed: boolean) => void;
  rightWidth: number;
  collapsedWidth: number;
};

type SelectedObjectRef = Exclude<SelectedObject, null>;

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
          <div className="rightTopRow">
            <button className="sidebarToggleButton" onClick={() => setRightCollapsed(true)} aria-label="Collapse right sidebar">
              <IconSidebarPanelRight size={16} strokeWidth={2} />
            </button>
          </div>

          <section className="sidebarSection">
            <div className="rightTabs" role="tablist" aria-label="Right panel tabs">
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
          </section>

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
