import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useGeoStore } from "../state/geoStore";
import { ExportPanel } from "./ExportPanel";
import { ObjectBrowser } from "./ObjectBrowser";
import { PropertiesPanel } from "./PropertiesPanel";

type RightTab = "algebra" | "export";

type RightSidebarProps = {
  rightCollapsed: boolean;
  setRightCollapsed: (collapsed: boolean) => void;
  rightWidth: number;
  collapsedWidth: number;
};

export function RightSidebar({
  rightCollapsed,
  setRightCollapsed,
  rightWidth,
  collapsedWidth,
}: RightSidebarProps) {
  const scene = useGeoStore((store) => store.scene);
  const selectedObject = useGeoStore((store) => store.selectedObject);
  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const [rightTab, setRightTab] = useState<RightTab>("algebra");

  return (
    <aside
      className={rightCollapsed ? "rightSidebar collapsed" : "rightSidebar"}
      style={{ width: rightCollapsed ? collapsedWidth : rightWidth }}
    >
      {rightCollapsed ? (
        <button className="collapseButton" onClick={() => setRightCollapsed(false)} aria-label="Expand right sidebar">
          <ChevronLeft size={14} />
        </button>
      ) : (
        <>
          <div className="rightTopRow">
            <button className="collapseButton" onClick={() => setRightCollapsed(true)} aria-label="Collapse right sidebar">
              <ChevronRight size={14} />
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
              <h2 className="sectionTitle">Objects</h2>
              <ObjectBrowser scene={scene} selectedObject={selectedObject} setSelectedObject={setSelectedObject} />
            </section>
          )}

          <ExportPanel visible={rightTab === "export"} />
          <PropertiesPanel visible={rightTab === "algebra"} />
        </>
      )}
    </aside>
  );
}
