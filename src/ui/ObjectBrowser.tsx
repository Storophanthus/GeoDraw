import { useState, useMemo } from "react";
import {
    Circle,
    Copy,
    Hash,
    Layers,
    Minus
} from "lucide-react";
import type { SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";
import { getNumberValue } from "../scene/points";
import { useGeoStore } from "../state/geoStore";
import { IconAngle } from "./icons";

type ObjectBrowserProps = {
    scene: SceneModel;
    selectedObject: SelectedObject | null;
    setSelectedObject: (obj: SelectedObject) => void;
};

type TabId = "all" | "points" | "lines" | "circles" | "angles" | "numbers";

export function ObjectBrowser({ scene, selectedObject, setSelectedObject }: ObjectBrowserProps) {
    const [activeTab, setActiveTab] = useState<TabId>("all");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const setObjectVisibility = useGeoStore((store) => store.setObjectVisibility);

    const pointNameById = useMemo(() => new Map(scene.points.map((p) => [p.id, p.name])), [scene.points]);
    const lineById = useMemo(() => new Map(scene.lines.map((l) => [l.id, l])), [scene.lines]);
    const segmentById = useMemo(() => new Map(scene.segments.map((s) => [s.id, s])), [scene.segments]);
    const circleById = useMemo(() => new Map(scene.circles.map((c) => [c.id, c])), [scene.circles]);

    const pointLabel = (id: string): string => pointNameById.get(id) ?? id;

    const circleRefText = (id: string): string => {
        const c = circleById.get(id);
        if (!c) return id;
        if (c.kind === "threePoint") return `Circle3P(${pointLabel(c.aId)},${pointLabel(c.bId)},${pointLabel(c.cId)})`;
        if (c.kind === "fixedRadius") return `Circle(${pointLabel(c.centerId)},${c.radiusExpr ?? c.radius})`;
        return `Circle(${pointLabel(c.centerId)},${pointLabel(c.throughId)})`;
    };

    const lineLikeText = (ref: { type: "line" | "segment"; id: string }): string => {
        if (ref.type === "segment") {
            const s = segmentById.get(ref.id);
            return s ? `Segment(${pointLabel(s.aId)},${pointLabel(s.bId)})` : `Segment(${ref.id})`;
        }
        const l = lineById.get(ref.id);
        if (!l) return `Line(${ref.id})`;
        if (l.kind === "twoPoint") return `Line(${pointLabel(l.aId)},${pointLabel(l.bId)})`;
        if (l.kind === "angleBisector") return `AngleBisector(${pointLabel(l.aId)},${pointLabel(l.bId)},${pointLabel(l.cId)})`;
        if (l.kind === "tangent") return `Tangent(${pointLabel(l.throughId)},${circleRefText(l.circleId)})`;
        if (l.kind === "perpendicular") return `Perpendicular(${pointLabel(l.throughId)},${lineLikeText(l.base)})`;
        if (l.kind === "parallel") return `Parallel(${pointLabel(l.throughId)},${lineLikeText(l.base)})`;
        return `Line(${ref.id})`;
    };

    const copyCommand = async (value: string, key: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 900);
        } catch {
            setCopiedKey(null);
        }
    };

    const renderObjectRow = (
        key: string,
        selected: boolean,
        onSelect: () => void,
        visible: boolean,
        onToggleVisible: (next: boolean) => void,
        title: string,
        commandText: string
    ) => (
        <button key={key} className={selected ? "objectItem active" : "objectItem"} onClick={onSelect}>
            <div className="objectItemText">
                <span className="objectItemLabel">{title}</span>
                <span className="objectItemCommand" title={commandText}>{commandText}</span>
            </div>
            <div className="objectItemActions">
                <button
                    type="button"
                    className="objectCommandCopy"
                    title={copiedKey === key ? "Copied" : "Copy command"}
                    aria-label="Copy command"
                    onClick={(e) => {
                        e.stopPropagation();
                        void copyCommand(commandText, key);
                    }}
                >
                    <Copy size={12} />
                </button>
                <input
                    type="checkbox"
                    className="objectVisibilityToggle"
                    checked={visible}
                    title={visible ? "Hide object" : "Show object"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleVisible(e.target.checked)}
                />
            </div>
        </button>
    );

    const tabs: Array<{ id: TabId; icon: React.ElementType; label: string; description: string; count: number }> = [
        { id: "all", icon: Layers, label: "All", description: "Show all objects", count: scene.points.length + scene.segments.length + scene.lines.length + scene.circles.length + scene.polygons.length + scene.angles.length + scene.numbers.length },
        {
            id: "points",
            icon: (props) => <Circle {...props} fill="currentColor" />,
            label: "Points",
            description: "Filter by Points",
            count: scene.points.length
        },
        { id: "lines", icon: Minus, label: "Lines", description: "Filter by Lines & Segments", count: scene.segments.length + scene.lines.length },
        { id: "circles", icon: Circle, label: "Shapes", description: "Filter by Circles/Polygons", count: scene.circles.length + scene.polygons.length },
        { id: "angles", icon: IconAngle, label: "Angles", description: "Filter by Angles", count: scene.angles.length },
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
                    renderObjectRow(
                        `point:${point.id}`,
                        selectedObject?.type === "point" && selectedObject.id === point.id,
                        () => setSelectedObject({ type: "point", id: point.id }),
                        point.visible,
                        (next) => setObjectVisibility({ type: "point", id: point.id }, next),
                        `Point ${point.name}`,
                        point.kind === "free"
                            ? `Point(${point.position.x.toFixed(4)},${point.position.y.toFixed(4)})`
                            : point.kind === "midpointPoints"
                                ? `Midpoint(${pointLabel(point.aId)},${pointLabel(point.bId)})`
                                : point.kind === "midpointSegment"
                                    ? `Midpoint(${lineLikeText({ type: "segment", id: point.segId })})`
                                    : point.kind === "pointByRotation"
                                        ? `Rotate(${pointLabel(point.pointId)},${pointLabel(point.centerId)},${point.angleExpr ?? point.angleDeg},${point.direction})`
                                        : point.kind === "pointOnCircle"
                                            ? `PointOn(${circleRefText(point.circleId)})`
                                            : point.kind === "pointOnLine"
                                                ? `PointOn(${lineLikeText({ type: "line", id: point.lineId })})`
                                                : point.kind === "pointOnSegment"
                                                    ? `PointOn(${lineLikeText({ type: "segment", id: point.segId })})`
                                                    : point.kind === "circleCenter"
                                                        ? `Center(${circleRefText(point.circleId)})`
                                                        : point.kind === "circleLineIntersectionPoint"
                                                            ? `Intersect(${circleRefText(point.circleId)},${lineLikeText({ type: "line", id: point.lineId })})`
                                                            : point.kind === "circleSegmentIntersectionPoint"
                                                                ? `Intersect(${circleRefText(point.circleId)},${lineLikeText({ type: "segment", id: point.segId })})`
                                                                : point.kind === "circleCircleIntersectionPoint"
                                                                    ? `Intersect(${circleRefText(point.circleAId)},${circleRefText(point.circleBId)})`
                                                                    : point.kind === "lineLikeIntersectionPoint"
                                                                        ? `Intersect(${lineLikeText(point.objA)},${lineLikeText(point.objB)})`
                                                                        : "Point(...)"
                    )
                ))}

                {showSegments && scene.segments.map((segment) => (
                    renderObjectRow(
                        `segment:${segment.id}`,
                        selectedObject?.type === "segment" && selectedObject.id === segment.id,
                        () => setSelectedObject({ type: "segment", id: segment.id }),
                        segment.visible,
                        (next) => setObjectVisibility({ type: "segment", id: segment.id }, next),
                        `Segment ${pointLabel(segment.aId)}${pointLabel(segment.bId)}`,
                        `Segment(${pointLabel(segment.aId)},${pointLabel(segment.bId)})`
                    )
                ))}

                {showLines && scene.lines.map((line) => (
                    renderObjectRow(
                        `line:${line.id}`,
                        selectedObject?.type === "line" && selectedObject.id === line.id,
                        () => setSelectedObject({ type: "line", id: line.id }),
                        line.visible,
                        (next) => setObjectVisibility({ type: "line", id: line.id }, next),
                        line.kind === "twoPoint" ? `Line ${pointLabel(line.aId)}${pointLabel(line.bId)}` : `Line ${line.id}`,
                        lineLikeText({ type: "line", id: line.id })
                    )
                ))}

                {showCircles && scene.circles.map((circle) => (
                    renderObjectRow(
                        `circle:${circle.id}`,
                        selectedObject?.type === "circle" && selectedObject.id === circle.id,
                        () => setSelectedObject({ type: "circle", id: circle.id }),
                        circle.visible,
                        (next) => setObjectVisibility({ type: "circle", id: circle.id }, next),
                        `Circle ${circle.id}`,
                        circleRefText(circle.id)
                    )
                ))}

                {showCircles && scene.polygons.map((polygon) => (
                    renderObjectRow(
                        `polygon:${polygon.id}`,
                        selectedObject?.type === "polygon" && selectedObject.id === polygon.id,
                        () => setSelectedObject({ type: "polygon", id: polygon.id }),
                        polygon.visible,
                        (next) => setObjectVisibility({ type: "polygon", id: polygon.id }, next),
                        `Polygon ${polygon.id}`,
                        `Polygon(${polygon.pointIds.map((id) => pointLabel(id)).join(",")})`
                    )
                ))}

                {showAngles && scene.angles.map((angle) => (
                    renderObjectRow(
                        `angle:${angle.id}`,
                        selectedObject?.type === "angle" && selectedObject.id === angle.id,
                        () => setSelectedObject({ type: "angle", id: angle.id }),
                        angle.visible,
                        (next) => setObjectVisibility({ type: "angle", id: angle.id }, next),
                        angle.kind === "sector"
                            ? `Sector ${pointLabel(angle.aId)}${pointLabel(angle.bId)}${pointLabel(angle.cId)}`
                            : `Angle ${pointLabel(angle.aId)}${pointLabel(angle.bId)}${pointLabel(angle.cId)}`,
                        angle.kind === "sector"
                            ? `Sector(${pointLabel(angle.bId)},${pointLabel(angle.aId)},${pointLabel(angle.cId)})`
                            : `Angle(${pointLabel(angle.aId)},${pointLabel(angle.bId)},${pointLabel(angle.cId)})`
                    )
                ))}

                {showNumbers && scene.numbers.map((num) => (
                    renderObjectRow(
                        `number:${num.id}`,
                        selectedObject?.type === "number" && selectedObject.id === num.id,
                        () => setSelectedObject({ type: "number", id: num.id }),
                        num.visible,
                        (next) => setObjectVisibility({ type: "number", id: num.id }, next),
                        `Number ${num.name}`,
                        (() => {
                            const value = getNumberValue(num.id, scene);
                            return value === null ? `${num.name} = undefined` : `${num.name} = ${value.toFixed(6)}`;
                        })()
                    )
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
            scene.polygons.length === 0 &&
            scene.angles.length === 0 &&
            scene.numbers.length === 0) ||
        (activeTab === "points" && scene.points.length === 0) ||
        (activeTab === "lines" && scene.segments.length === 0 && scene.lines.length === 0) ||
        (activeTab === "circles" && scene.circles.length === 0 && scene.polygons.length === 0) ||
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
