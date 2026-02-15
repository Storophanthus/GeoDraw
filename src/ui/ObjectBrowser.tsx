import { useState, useMemo } from "react";
import {
    Copy,
    Hash,
    Layers,
} from "lucide-react";
import type { SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";
import { getNumberValue } from "../scene/points";
import { commandBarApi, useGeoStore } from "../state/geoStore";
import { IconAngle, IconPoint, IconLine, IconCircleRadius } from "./icons";

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

    // Toggles state
    const gridEnabled = useGeoStore((store) => store.gridEnabled);
    const axesEnabled = useGeoStore((store) => store.axesEnabled);
    const gridSnapEnabled = useGeoStore((store) => store.gridSnapEnabled);
    const dependencyGlowEnabled = useGeoStore((store) => store.dependencyGlowEnabled);

    const setGridEnabled = useGeoStore((store) => store.setGridEnabled);
    const setAxesEnabled = useGeoStore((store) => store.setAxesEnabled);
    const setGridSnapEnabled = useGeoStore((store) => store.setGridSnapEnabled);
    const setDependencyGlowEnabled = useGeoStore((store) => store.setDependencyGlowEnabled);

    const pointNameById = useMemo(() => new Map(scene.points.map((p) => [p.id, p.name])), [scene.points]);
    const lineById = useMemo(() => new Map(scene.lines.map((l) => [l.id, l])), [scene.lines]);
    const segmentById = useMemo(() => new Map(scene.segments.map((s) => [s.id, s])), [scene.segments]);
    const circleById = useMemo(() => new Map(scene.circles.map((c) => [c.id, c])), [scene.circles]);
    const commandAliases = useMemo(() => commandBarApi.getCommandObjectAliases(), [scene]);
    const aliasByObjectKey = useMemo(() => {
        const map = new Map<string, string>();
        for (const [alias, target] of Object.entries(commandAliases)) {
            map.set(`${target.type}:${target.id}`, alias);
        }
        return map;
    }, [commandAliases]);

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
        if (l.kind === "circleCircleTangent") return `Tangent(${circleRefText(l.circleAId)},${circleRefText(l.circleBId)})`;
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

    const withAliasPrefix = (objectType: "point" | "segment" | "line" | "circle" | "polygon" | "angle", objectId: string, commandText: string): string => {
        const alias = aliasByObjectKey.get(`${objectType}:${objectId}`);
        return alias ? `${alias} = ${commandText}` : commandText;
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
            icon: IconPoint as React.ElementType,
            label: "Points",
            description: "Filter by Points",
            count: scene.points.length
        },
        { id: "lines", icon: IconLine as React.ElementType, label: "Lines", description: "Filter by Lines & Segments", count: scene.segments.length + scene.lines.length },
        { id: "circles", icon: IconCircleRadius as React.ElementType, label: "Shapes", description: "Filter by Circles/Polygons", count: scene.circles.length + scene.polygons.length },
        { id: "angles", icon: IconAngle as React.ElementType, label: "Angles", description: "Filter by Angles", count: scene.angles.length },
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
                            ? withAliasPrefix("point", point.id, `Point(${point.position.x.toFixed(4)},${point.position.y.toFixed(4)})`)
                            : point.kind === "midpointPoints"
                                ? withAliasPrefix("point", point.id, `Midpoint(${pointLabel(point.aId)},${pointLabel(point.bId)})`)
                                : point.kind === "midpointSegment"
                                    ? withAliasPrefix("point", point.id, `Midpoint(${lineLikeText({ type: "segment", id: point.segId })})`)
                                    : point.kind === "pointByRotation"
                                        ? withAliasPrefix(
                                            "point",
                                            point.id,
                                            `Rotate(${pointLabel(point.pointId)},${pointLabel(point.centerId)},${point.angleExpr ?? point.angleDeg},${point.direction})`
                                        )
                                        : point.kind === "pointOnCircle"
                                            ? withAliasPrefix("point", point.id, `PointOn(${circleRefText(point.circleId)})`)
                                            : point.kind === "pointOnLine"
                                                ? withAliasPrefix("point", point.id, `PointOn(${lineLikeText({ type: "line", id: point.lineId })})`)
                                                : point.kind === "pointOnSegment"
                                                    ? withAliasPrefix("point", point.id, `PointOn(${lineLikeText({ type: "segment", id: point.segId })})`)
                                                    : point.kind === "circleCenter"
                                                        ? withAliasPrefix("point", point.id, `Center(${circleRefText(point.circleId)})`)
                                                        : point.kind === "circleLineIntersectionPoint"
                                                            ? withAliasPrefix(
                                                                "point",
                                                                point.id,
                                                                `Intersect(${circleRefText(point.circleId)},${lineLikeText({ type: "line", id: point.lineId })})`
                                                            )
                                                            : point.kind === "circleSegmentIntersectionPoint"
                                                                ? withAliasPrefix(
                                                                    "point",
                                                                    point.id,
                                                                    `Intersect(${circleRefText(point.circleId)},${lineLikeText({ type: "segment", id: point.segId })})`
                                                                )
                                                                : point.kind === "circleCircleIntersectionPoint"
                                                                    ? withAliasPrefix(
                                                                        "point",
                                                                        point.id,
                                                                        `Intersect(${circleRefText(point.circleAId)},${circleRefText(point.circleBId)})`
                                                                    )
                                                                    : point.kind === "lineLikeIntersectionPoint"
                                                                        ? withAliasPrefix(
                                                                            "point",
                                                                            point.id,
                                                                            `Intersect(${lineLikeText(point.objA)},${lineLikeText(point.objB)})`
                                                                        )
                                                                        : withAliasPrefix("point", point.id, "Point(...)")
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
                        withAliasPrefix("segment", segment.id, `Segment(${pointLabel(segment.aId)},${pointLabel(segment.bId)})`)
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
                        withAliasPrefix("line", line.id, lineLikeText({ type: "line", id: line.id }))
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
                        withAliasPrefix("circle", circle.id, circleRefText(circle.id))
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
                        withAliasPrefix("polygon", polygon.id, `Polygon(${polygon.pointIds.map((id) => pointLabel(id)).join(",")})`)
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
                        withAliasPrefix("angle", angle.id, angle.kind === "sector"
                            ? `Sector(${pointLabel(angle.bId)},${pointLabel(angle.aId)},${pointLabel(angle.cId)})`
                            : `Angle(${pointLabel(angle.aId)},${pointLabel(angle.bId)},${pointLabel(angle.cId)})`)
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
            <div className="objectBrowserHeader">
                <span className="objectBrowserTitle">OBJECTS</span>
                <div className="tinyToggleGroup">
                    <label className="tinyToggle" title="Toggle Grid">
                        <input
                            type="checkbox"
                            checked={gridEnabled}
                            onChange={(e) => setGridEnabled(e.target.checked)}
                        />
                        Grid
                    </label>
                    <label className="tinyToggle" title="Toggle Axes">
                        <input
                            type="checkbox"
                            checked={axesEnabled}
                            onChange={(e) => setAxesEnabled(e.target.checked)}
                        />
                        Axes
                    </label>
                    <label className="tinyToggle" title="Toggle Snap">
                        <input
                            type="checkbox"
                            checked={gridSnapEnabled}
                            onChange={(e) => setGridSnapEnabled(e.target.checked)}
                        />
                        Snap
                    </label>
                    <label className="tinyToggle" title="Toggle Dependency Glow">
                        <input
                            type="checkbox"
                            checked={dependencyGlowEnabled}
                            onChange={(e) => setDependencyGlowEnabled && setDependencyGlowEnabled(e.target.checked)}
                        />
                        Glow
                    </label>
                </div>
            </div>

            <div className="objectBrowserTabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={activeTab === tab.id ? "objectBrowserTab active" : "objectBrowserTab"}
                        onClick={() => setActiveTab(tab.id)}
                        title={tab.description}
                    >
                        <tab.icon size={18} strokeWidth={2} />
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
