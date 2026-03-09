import { useState, useMemo, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
    Copy,
    Hash,
    Link2,
    Layers,
    Lock,
    LockOpen,
    Type as TypeIcon,
} from "lucide-react";
import type { SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";
import { getNumberValue } from "../scene/points";
import { commandBarApi, useGeoStore } from "../state/geoStore";
import { IconAngle, IconPoint, IconLine, IconCircleRadius } from "./icons";
import { formatRoundedDisplay } from "./displayFormat";

type ObjectBrowserProps = {
    scene: SceneModel;
    selectedObject: SelectedObject | null;
    setSelectedObject: (obj: SelectedObject) => void;
    multiSelectedObjects: Array<Exclude<SelectedObject, null>>;
    setMultiSelectedObjects: (next: Array<Exclude<SelectedObject, null>>) => void;
};

type TabId = "all" | "points" | "lines" | "circles" | "angles" | "text" | "numbers";
type SelectedObjectRef = Exclude<SelectedObject, null>;

function selectedObjectKey(obj: SelectedObjectRef): string {
    return `${obj.type}:${obj.id}`;
}

function objectFromRowKey(key: string): SelectedObjectRef | null {
    const sep = key.indexOf(":");
    if (sep <= 0 || sep >= key.length - 1) return null;
    const type = key.slice(0, sep);
    const id = key.slice(sep + 1);
    if (
        type !== "point" &&
        type !== "segment" &&
        type !== "line" &&
        type !== "circle" &&
        type !== "polygon" &&
        type !== "angle" &&
        type !== "textLabel" &&
        type !== "number"
    ) {
        return null;
    }
    return { type, id };
}

function isTextInputLike(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.isContentEditable;
}

function tabForSelectedObject(selected: SelectedObject | null, scene?: SceneModel): TabId | null {
    if (!selected) return null;
    switch (selected.type) {
        case "point":
            return "points";
        case "segment":
        case "line":
            return "lines";
        case "circle":
        case "polygon":
            return "circles";
        case "angle": {
            if (scene) {
                const angle = scene.angles.find((item) => item.id === selected.id);
                if (angle?.kind === "sector") return "circles";
            }
            return "angles";
        }
        case "textLabel":
            return "text";
        case "number":
            return "numbers";
        default:
            return null;
    }
}

export function ObjectBrowser({
    scene,
    selectedObject,
    setSelectedObject,
    multiSelectedObjects,
    setMultiSelectedObjects,
}: ObjectBrowserProps) {
    const [activeTab, setActiveTab] = useState<TabId>("all");
    const [tabPinned, setTabPinned] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const objectRowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const lastSelectionKeyRef = useRef<string | null>(null);
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
    const multiSelectedKeySet = useMemo(
        () => new Set(multiSelectedObjects.map((obj) => selectedObjectKey(obj))),
        [multiSelectedObjects]
    );

    useEffect(() => {
        if (tabPinned) return;
        const selectionKey = selectedObject ? `${selectedObject.type}:${selectedObject.id}` : null;
        if (selectionKey === lastSelectionKeyRef.current) return;
        lastSelectionKeyRef.current = selectionKey;
        const targetTab = tabForSelectedObject(selectedObject, scene);
        if (!targetTab) return;
        setActiveTab((prev) => (prev === targetTab ? prev : targetTab));
    }, [selectedObject, scene, tabPinned]);

    useEffect(() => {
        if (!selectedObject) return;
        const targetTab = tabForSelectedObject(selectedObject, scene);
        if (!targetTab || activeTab !== targetTab) return;
        const key = `${selectedObject.type}:${selectedObject.id}`;
        const row = objectRowRefs.current.get(key);
        if (!row) return;
        row.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [selectedObject, activeTab]);

    const bindObjectRowRef = useCallback(
        (key: string) => (el: HTMLButtonElement | null) => {
            if (el) objectRowRefs.current.set(key, el);
            else objectRowRefs.current.delete(key);
        },
        []
    );

    const focusObjectRow = (key: string) => {
        const row = objectRowRefs.current.get(key);
        if (!row) return;
        row.focus();
        row.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const getOrderedRowKeys = useCallback((): string[] => {
        return Array.from(objectRowRefs.current.entries())
            .sort((a, b) => {
                const da = a[1].getBoundingClientRect();
                const db = b[1].getBoundingClientRect();
                if (Math.abs(da.top - db.top) > 0.5) return da.top - db.top;
                return da.left - db.left;
            })
            .map(([key]) => key);
    }, []);

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

    const reflectionTargetText = (ref: { type: "line" | "segment" | "point"; id: string }): string =>
        ref.type === "point" ? pointLabel(ref.id) : lineLikeText(ref as { type: "line" | "segment"; id: string });

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

    const toggleBatchSelection = (obj: SelectedObjectRef) => {
        const key = selectedObjectKey(obj);
        if (multiSelectedKeySet.has(key)) {
            const next = multiSelectedObjects.filter((item) => selectedObjectKey(item) !== key);
            setMultiSelectedObjects(next.length === 0 && selectedObject ? [selectedObject] : next);
            return;
        }
        const linkedType = multiSelectedObjects[0]?.type ?? selectedObject?.type ?? obj.type;
        if (linkedType !== obj.type) {
            setSelectedObject(obj);
            setMultiSelectedObjects([obj]);
            return;
        }
        const next = [...multiSelectedObjects, obj];
        if (selectedObject && !next.some((item) => selectedObjectKey(item) === selectedObjectKey(selectedObject))) {
            next.unshift(selectedObject);
        }
        setMultiSelectedObjects(next);
    };

    const selectObject = (obj: SelectedObjectRef) => {
        setSelectedObject(obj);
        const key = selectedObjectKey(obj);
        if (multiSelectedKeySet.size === 0 || multiSelectedKeySet.has(key)) return;
        setMultiSelectedObjects([obj]);
    };

    const extendLinkedSelectionByArrow = useCallback((direction: 1 | -1, currentKey: string) => {
        const current = objectFromRowKey(currentKey);
        if (!current) return false;
        const orderedKeys = getOrderedRowKeys();
        const curIdx = orderedKeys.indexOf(currentKey);
        if (curIdx < 0) return false;
        let nextIdx = curIdx + direction;
        while (nextIdx >= 0 && nextIdx < orderedKeys.length) {
            const candidate = objectFromRowKey(orderedKeys[nextIdx]);
            if (candidate && candidate.type === current.type) break;
            nextIdx += direction;
        }
        if (nextIdx < 0 || nextIdx >= orderedKeys.length) return false;
        const nextObj = objectFromRowKey(orderedKeys[nextIdx]);
        if (!nextObj) return false;

        const nextLinked = multiSelectedObjects.filter((item) => item.type === current.type);
        if (!nextLinked.some((item) => selectedObjectKey(item) === selectedObjectKey(current))) {
            nextLinked.unshift(current);
        }
        if (!nextLinked.some((item) => selectedObjectKey(item) === selectedObjectKey(nextObj))) {
            nextLinked.push(nextObj);
        }
        setMultiSelectedObjects(nextLinked);
        setSelectedObject(nextObj);
        focusObjectRow(orderedKeys[nextIdx]);
        return true;
    }, [focusObjectRow, getOrderedRowKeys, multiSelectedObjects, setMultiSelectedObjects, setSelectedObject]);

    const handleRowKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentKey: string) => {
        if (!e.shiftKey) return;
        const isUp = e.key === "ArrowUp" || e.key === "Up";
        const isDown = e.key === "ArrowDown" || e.key === "Down";
        if (!isUp && !isDown) return;
        const changed = extendLinkedSelectionByArrow(isDown ? 1 : -1, currentKey);
        if (!changed) return;
        e.preventDefault();
        e.stopPropagation();
    };

    useEffect(() => {
        const onWindowKeyDown = (e: KeyboardEvent) => {
            if (!e.shiftKey) return;
            const isUp = e.key === "ArrowUp" || e.key === "Up";
            const isDown = e.key === "ArrowDown" || e.key === "Down";
            if (!isUp && !isDown) return;
            if (isTextInputLike(e.target)) return;
            if (!selectedObject) return;
            const currentKey = `${selectedObject.type}:${selectedObject.id}`;
            const changed = extendLinkedSelectionByArrow(isDown ? 1 : -1, currentKey);
            if (!changed) return;
            e.preventDefault();
            e.stopPropagation();
        };
        window.addEventListener("keydown", onWindowKeyDown);
        return () => window.removeEventListener("keydown", onWindowKeyDown);
    }, [extendLinkedSelectionByArrow, selectedObject]);

    const renderObjectRow = (
        key: string,
        active: boolean,
        selected: boolean,
        onSelect: () => void,
        onToggleSelected: () => void,
        visible: boolean,
        onToggleVisible: (next: boolean) => void,
        title: string,
        commandText: string
    ) => (
        <button
            key={key}
            ref={bindObjectRowRef(key)}
            className={`objectItem${active ? " active" : ""}${selected ? " selected" : ""}`}
            onClick={onSelect}
            onKeyDown={(e) => handleRowKeyDown(e, key)}
        >
            <div className="objectItemText">
                <span className="objectItemLabel">{title}</span>
                <span className="objectItemCommand" title={commandText}>{commandText}</span>
            </div>
            <div className="objectItemActions">
                <button
                    type="button"
                    className={selected ? "objectLinkToggle active" : "objectLinkToggle"}
                    title={selected ? "Unlink from batch styling/deletion" : "Link for batch styling/deletion"}
                    aria-label={selected ? "Unlink from batch styling/deletion" : "Link for batch styling/deletion"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelected();
                    }}
                >
                    <Link2 size={12} strokeWidth={2.1} />
                </button>
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
        { id: "all", icon: Layers, label: "All", description: "Show all objects", count: scene.points.length + scene.segments.length + scene.lines.length + scene.circles.length + scene.polygons.length + scene.angles.length + (scene.textLabels?.length ?? 0) + scene.numbers.length },
        {
            id: "points",
            icon: IconPoint as React.ElementType,
            label: "Points",
            description: "Filter by Points",
            count: scene.points.length
        },
        { id: "lines", icon: IconLine as React.ElementType, label: "Lines", description: "Filter by Lines & Segments", count: scene.segments.length + scene.lines.length },
        {
            id: "circles",
            icon: IconCircleRadius as React.ElementType,
            label: "Shapes",
            description: "Filter by Circles/Polygons/Sectors",
            count: scene.circles.length + scene.polygons.length + scene.angles.filter((angle) => angle.kind === "sector").length,
        },
        {
            id: "angles",
            icon: IconAngle as React.ElementType,
            label: "Angles",
            description: "Filter by Angles",
            count: scene.angles.filter((angle) => angle.kind !== "sector").length,
        },
        { id: "text", icon: TypeIcon, label: "Labels", description: "Filter by Text Labels", count: scene.textLabels?.length ?? 0 },
        { id: "numbers", icon: Hash, label: "Numbers", description: "Filter by Numbers & Values", count: scene.numbers.length },
    ];

    const filteredContent = useMemo(() => {
        const showPoints = activeTab === "all" || activeTab === "points";
        const showSegments = activeTab === "all" || activeTab === "lines";
        const showLines = activeTab === "all" || activeTab === "lines";
        const showCircles = activeTab === "all" || activeTab === "circles";
        const showAngles = activeTab === "all" || activeTab === "angles";
        const showTextLabels = activeTab === "all" || activeTab === "text";
        const showNumbers = activeTab === "all" || activeTab === "numbers";

        return (
            <>
                {showPoints && scene.points.map((point) => (
                    renderObjectRow(
                        `point:${point.id}`,
                        selectedObject?.type === "point" && selectedObject.id === point.id,
                        multiSelectedKeySet.has(`point:${point.id}`),
                        () => selectObject({ type: "point", id: point.id }),
                        () => toggleBatchSelection({ type: "point", id: point.id }),
                        point.visible,
                        (next) => setObjectVisibility({ type: "point", id: point.id }, next),
                        `Point ${point.name}`,
                        point.kind === "free"
                            ? withAliasPrefix(
                                "point",
                                point.id,
                                `Point(${formatRoundedDisplay(point.position.x, 4)},${formatRoundedDisplay(point.position.y, 4)})`
                              )
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
                                        : point.kind === "pointByTranslation"
                                            ? withAliasPrefix(
                                                "point",
                                                point.id,
                                                `Translate(${pointLabel(point.pointId)},${pointLabel(point.fromId)},${pointLabel(point.toId)})`
                                            )
                                            : point.kind === "pointByDilation"
                                                ? withAliasPrefix(
                                                    "point",
                                                    point.id,
                                                    `Dilate(${pointLabel(point.pointId)},${pointLabel(point.centerId)},${point.factorExpr ?? point.factor ?? "?"})`
                                                )
                                                : point.kind === "pointByReflection"
                                                    ? withAliasPrefix(
                                                        "point",
                                                        point.id,
                                                        `Reflect(${pointLabel(point.pointId)},${reflectionTargetText(point.axis)})`
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
                        multiSelectedKeySet.has(`segment:${segment.id}`),
                        () => selectObject({ type: "segment", id: segment.id }),
                        () => toggleBatchSelection({ type: "segment", id: segment.id }),
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
                        multiSelectedKeySet.has(`line:${line.id}`),
                        () => selectObject({ type: "line", id: line.id }),
                        () => toggleBatchSelection({ type: "line", id: line.id }),
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
                        multiSelectedKeySet.has(`circle:${circle.id}`),
                        () => selectObject({ type: "circle", id: circle.id }),
                        () => toggleBatchSelection({ type: "circle", id: circle.id }),
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
                        multiSelectedKeySet.has(`polygon:${polygon.id}`),
                        () => selectObject({ type: "polygon", id: polygon.id }),
                        () => toggleBatchSelection({ type: "polygon", id: polygon.id }),
                        polygon.visible,
                        (next) => setObjectVisibility({ type: "polygon", id: polygon.id }, next),
                        `Polygon ${polygon.id}`,
                        withAliasPrefix("polygon", polygon.id, `Polygon(${polygon.pointIds.map((id) => pointLabel(id)).join(",")})`)
                    )
                ))}

                {showCircles && scene.angles.filter((angle) => angle.kind === "sector").map((angle) => (
                    renderObjectRow(
                        `angle:${angle.id}`,
                        selectedObject?.type === "angle" && selectedObject.id === angle.id,
                        multiSelectedKeySet.has(`angle:${angle.id}`),
                        () => selectObject({ type: "angle", id: angle.id }),
                        () => toggleBatchSelection({ type: "angle", id: angle.id }),
                        angle.visible,
                        (next) => setObjectVisibility({ type: "angle", id: angle.id }, next),
                        `Sector ${pointLabel(angle.aId)}${pointLabel(angle.bId)}${pointLabel(angle.cId)}`,
                        withAliasPrefix("angle", angle.id, `Sector(${pointLabel(angle.bId)},${pointLabel(angle.aId)},${pointLabel(angle.cId)})`)
                    )
                ))}

                {showAngles && scene.angles.filter((angle) => angle.kind !== "sector").map((angle) => (
                    renderObjectRow(
                        `angle:${angle.id}`,
                        selectedObject?.type === "angle" && selectedObject.id === angle.id,
                        multiSelectedKeySet.has(`angle:${angle.id}`),
                        () => selectObject({ type: "angle", id: angle.id }),
                        () => toggleBatchSelection({ type: "angle", id: angle.id }),
                        angle.visible,
                        (next) => setObjectVisibility({ type: "angle", id: angle.id }, next),
                        `Angle ${pointLabel(angle.aId)}${pointLabel(angle.bId)}${pointLabel(angle.cId)}`,
                        withAliasPrefix("angle", angle.id, `Angle(${pointLabel(angle.aId)},${pointLabel(angle.bId)},${pointLabel(angle.cId)})`)
                    )
                ))}

                {showTextLabels && (scene.textLabels ?? []).map((label) => (
                    renderObjectRow(
                        `textLabel:${label.id}`,
                        selectedObject?.type === "textLabel" && selectedObject.id === label.id,
                        multiSelectedKeySet.has(`textLabel:${label.id}`),
                        () => selectObject({ type: "textLabel", id: label.id }),
                        () => toggleBatchSelection({ type: "textLabel", id: label.id }),
                        label.visible,
                        (next) => setObjectVisibility({ type: "textLabel", id: label.id }, next),
                        `Label ${label.name}`,
                        `Text(${JSON.stringify(label.text)})`
                    )
                ))}

                {showNumbers && scene.numbers.map((num) => (
                    renderObjectRow(
                        `number:${num.id}`,
                        selectedObject?.type === "number" && selectedObject.id === num.id,
                        multiSelectedKeySet.has(`number:${num.id}`),
                        () => selectObject({ type: "number", id: num.id }),
                        () => toggleBatchSelection({ type: "number", id: num.id }),
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
    }, [
        activeTab,
        multiSelectedKeySet,
        multiSelectedObjects,
        scene,
        setMultiSelectedObjects,
        setObjectVisibility,
        setSelectedObject,
    ]);

    const isEmpty =
        (activeTab === "all" &&
            scene.points.length === 0 &&
            scene.segments.length === 0 &&
            scene.lines.length === 0 &&
            scene.circles.length === 0 &&
            scene.polygons.length === 0 &&
            scene.angles.length === 0 &&
            (scene.textLabels?.length ?? 0) === 0 &&
            scene.numbers.length === 0) ||
        (activeTab === "points" && scene.points.length === 0) ||
        (activeTab === "lines" && scene.segments.length === 0 && scene.lines.length === 0) ||
        (activeTab === "circles" && scene.circles.length === 0 && scene.polygons.length === 0 && !scene.angles.some((angle) => angle.kind === "sector")) ||
        (activeTab === "angles" && !scene.angles.some((angle) => angle.kind !== "sector")) ||
        (activeTab === "text" && (scene.textLabels?.length ?? 0) === 0) ||
        (activeTab === "numbers" && scene.numbers.length === 0);
    const multiSelectionCount = multiSelectedObjects.length;

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
            {multiSelectionCount > 1 && (
                <div className="objectMultiSelectSummary">
                    <span>{multiSelectionCount} selected</span>
                    <button
                        type="button"
                        className="objectMultiSelectClear"
                        onClick={() => setMultiSelectedObjects(selectedObject ? [selectedObject] : [])}
                    >
                        Clear extras
                    </button>
                </div>
            )}

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
                <button
                    type="button"
                    className={tabPinned ? "objectBrowserTab objectBrowserTabPin active" : "objectBrowserTab objectBrowserTabPin"}
                    title={tabPinned ? "Unpin tab (resume auto-follow)" : "Pin current tab (pause auto-follow)"}
                    aria-label={tabPinned ? "Unpin current object tab" : "Pin current object tab"}
                    aria-pressed={tabPinned}
                    onClick={() => setTabPinned((prev) => !prev)}
                >
                    {tabPinned ? <Lock size={16} strokeWidth={2.1} /> : <LockOpen size={16} strokeWidth={2.1} />}
                </button>
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
