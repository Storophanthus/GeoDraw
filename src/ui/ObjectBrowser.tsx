import { useState, useMemo } from "react";
import {
    Circle,
    Hash,
    Layers,
    Minus,
    Triangle
} from "lucide-react";
import type { SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";
import { getNumberValue } from "../scene/points";
import { useGeoStore } from "../state/geoStore";

type ObjectBrowserProps = {
    scene: SceneModel;
    selectedObject: SelectedObject | null;
    setSelectedObject: (obj: SelectedObject) => void;
};

type TabId = "all" | "points" | "lines" | "circles" | "angles" | "numbers";

export function ObjectBrowser({ scene, selectedObject, setSelectedObject }: ObjectBrowserProps) {
    const [activeTab, setActiveTab] = useState<TabId>("all");
    const setObjectVisibility = useGeoStore((store) => store.setObjectVisibility);

    const tabs: Array<{ id: TabId; icon: React.ElementType; label: string; description: string; count: number }> = [
        { id: "all", icon: Layers, label: "All", description: "Show all objects", count: scene.points.length + scene.segments.length + scene.lines.length + scene.circles.length + scene.angles.length + scene.numbers.length },
        {
            id: "points",
            icon: (props) => <Circle {...props} fill="currentColor" />,
            label: "Points",
            description: "Filter by Points",
            count: scene.points.length
        },
        { id: "lines", icon: Minus, label: "Lines", description: "Filter by Lines & Segments", count: scene.segments.length + scene.lines.length },
        { id: "circles", icon: Circle, label: "Circles", description: "Filter by Circles", count: scene.circles.length },
        { id: "angles", icon: Triangle, label: "Angles", description: "Filter by Angles", count: scene.angles.length },
        { id: "numbers", icon: Hash, label: "Numbers", description: "Filter by Numbers & Values", count: scene.numbers.length },
    ];

    const filteredContent = useMemo(() => {
        const showPoints = activeTab === "all" || activeTab === "points";
        const showSegments = activeTab === "all" || activeTab === "lines";
        const showLines = activeTab === "all" || activeTab === "lines";
        const showCircles = activeTab === "all" || activeTab === "circles";
        const showAngles = activeTab === "all" || activeTab === "angles";
        const showNumbers = activeTab === "all" || activeTab === "numbers";

        return (
            <>
                {showPoints && scene.points.map((point) => (
                    <button
                        key={point.id}
                        className={
                            selectedObject?.type === "point" && selectedObject.id === point.id
                                ? "objectItem active"
                                : "objectItem"
                        }
                        onClick={() => setSelectedObject({ type: "point", id: point.id })}
                    >
                        <span className="objectItemLabel">Point {point.name}</span>
                        <input
                            type="checkbox"
                            className="objectVisibilityToggle"
                            checked={point.visible}
                            title={point.visible ? "Hide object" : "Show object"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setObjectVisibility({ type: "point", id: point.id }, e.target.checked)}
                        />
                    </button>
                ))}

                {showSegments && scene.segments.map((segment) => (
                    <button
                        key={segment.id}
                        className={
                            selectedObject?.type === "segment" && selectedObject.id === segment.id
                                ? "objectItem active"
                                : "objectItem"
                        }
                        onClick={() => setSelectedObject({ type: "segment", id: segment.id })}
                    >
                        <span className="objectItemLabel">Segment {segment.id}</span>
                        <input
                            type="checkbox"
                            className="objectVisibilityToggle"
                            checked={segment.visible}
                            title={segment.visible ? "Hide object" : "Show object"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setObjectVisibility({ type: "segment", id: segment.id }, e.target.checked)}
                        />
                    </button>
                ))}

                {showLines && scene.lines.map((line) => (
                    <button
                        key={line.id}
                        className={
                            selectedObject?.type === "line" && selectedObject.id === line.id
                                ? "objectItem active"
                                : "objectItem"
                        }
                        onClick={() => setSelectedObject({ type: "line", id: line.id })}
                    >
                        <span className="objectItemLabel">Line {line.id}</span>
                        <input
                            type="checkbox"
                            className="objectVisibilityToggle"
                            checked={line.visible}
                            title={line.visible ? "Hide object" : "Show object"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setObjectVisibility({ type: "line", id: line.id }, e.target.checked)}
                        />
                    </button>
                ))}

                {showCircles && scene.circles.map((circle) => (
                    <button
                        key={circle.id}
                        className={
                            selectedObject?.type === "circle" && selectedObject.id === circle.id
                                ? "objectItem active"
                                : "objectItem"
                        }
                        onClick={() => setSelectedObject({ type: "circle", id: circle.id })}
                    >
                        <span className="objectItemLabel">Circle {circle.id}</span>
                        <input
                            type="checkbox"
                            className="objectVisibilityToggle"
                            checked={circle.visible}
                            title={circle.visible ? "Hide object" : "Show object"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setObjectVisibility({ type: "circle", id: circle.id }, e.target.checked)}
                        />
                    </button>
                ))}

                {showAngles && scene.angles.map((angle) => (
                    <button
                        key={angle.id}
                        className={
                            selectedObject?.type === "angle" && selectedObject.id === angle.id
                                ? "objectItem active"
                                : "objectItem"
                        }
                        onClick={() => setSelectedObject({ type: "angle", id: angle.id })}
                    >
                        <span className="objectItemLabel">Angle {angle.id}</span>
                        <input
                            type="checkbox"
                            className="objectVisibilityToggle"
                            checked={angle.visible}
                            title={angle.visible ? "Hide object" : "Show object"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setObjectVisibility({ type: "angle", id: angle.id }, e.target.checked)}
                        />
                    </button>
                ))}

                {showNumbers && scene.numbers.map((num) => (
                    <button
                        key={num.id}
                        className={
                            selectedObject?.type === "number" && selectedObject.id === num.id
                                ? "objectItem active"
                                : "objectItem"
                        }
                        onClick={() => setSelectedObject({ type: "number", id: num.id })}
                    >
                        <span className="objectItemLabel">
                          Number {num.name}
                          {(() => {
                            const value = getNumberValue(num.id, scene);
                            return value === null ? " = undefined" : ` = ${value.toFixed(6)}`;
                          })()}
                        </span>
                        <input
                            type="checkbox"
                            className="objectVisibilityToggle"
                            checked={num.visible}
                            title={num.visible ? "Hide object" : "Show object"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setObjectVisibility({ type: "number", id: num.id }, e.target.checked)}
                        />
                    </button>
                ))}
            </>
        );
    }, [activeTab, scene, selectedObject, setSelectedObject, setObjectVisibility]);

    const isEmpty =
        (activeTab === "all" &&
            scene.points.length === 0 &&
            scene.segments.length === 0 &&
            scene.lines.length === 0 &&
            scene.circles.length === 0 &&
            scene.angles.length === 0 &&
            scene.numbers.length === 0) ||
        (activeTab === "points" && scene.points.length === 0) ||
        (activeTab === "lines" && scene.segments.length === 0 && scene.lines.length === 0) ||
        (activeTab === "circles" && scene.circles.length === 0) ||
        (activeTab === "angles" && scene.angles.length === 0) ||
        (activeTab === "numbers" && scene.numbers.length === 0);

    return (
        <div className="objectBrowser">
            <div className="objectBrowserTabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={activeTab === tab.id ? "objectBrowserTab active" : "objectBrowserTab"}
                        onClick={() => setActiveTab(tab.id)}
                        title={tab.description}
                    >
                        <tab.icon size={16} />
                        {/* Optional: <span className="tabCount">{tab.count}</span> */}
                    </button>
                ))}
            </div>

            <div className="objectListScrollArea">
                <div className="objectList">
                    {isEmpty && <div className="emptyState">No objects</div>}
                    {filteredContent}
                </div>
            </div>
        </div>
    );
}
