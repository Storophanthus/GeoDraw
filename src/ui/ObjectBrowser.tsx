import { useState, useMemo } from "react";
import {
    Circle,
    CircleDot,
    Hash,
    Layers,
    Minus,
    Triangle
} from "lucide-react";
import type { SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";
import { getNumberValue } from "../scene/points";

type ObjectBrowserProps = {
    scene: SceneModel;
    selectedObject: SelectedObject | null;
    setSelectedObject: (obj: SelectedObject) => void;
};

type TabId = "all" | "points" | "lines" | "circles" | "angles" | "numbers";

export function ObjectBrowser({ scene, selectedObject, setSelectedObject }: ObjectBrowserProps) {
    const [activeTab, setActiveTab] = useState<TabId>("all");

    const tabs: Array<{ id: TabId; icon: React.ElementType; label: string; description: string; count: number }> = [
        { id: "all", icon: Layers, label: "All", description: "Show all objects", count: scene.points.length + scene.segments.length + scene.lines.length + scene.circles.length + scene.angles.length + scene.numbers.length },
        { id: "points", icon: CircleDot, label: "Points", description: "Filter by Points", count: scene.points.length },
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
                        Point {point.name}
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
                        Segment {segment.id}
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
                        Line {line.id}
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
                        Circle {circle.id}
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
                        Angle {angle.id}
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
                        Number {num.name}
                        {(() => {
                            const value = getNumberValue(num.id, scene);
                            return value === null ? " = undefined" : ` = ${value.toFixed(6)}`;
                        })()}
                    </button>
                ))}
            </>
        );
    }, [activeTab, scene, selectedObject, setSelectedObject]);

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
