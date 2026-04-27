import { useState, useMemo, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
    ArrowDown,
    ArrowUp,
    Copy,
    Hash,
    Link2,
    Layers,
    Lock,
    LockOpen,
    Type as TypeIcon,
} from "lucide-react";
import type { ReflectionObjectRef, SceneGeometryLayerRef, SceneModel } from "../scene/points";
import { geometryLayerKey, geometryLayerOrderForTab, geometryLayerRefMatchesTab, type GeometryLayerDropPosition } from "../scene/geometryLayerOrder";
import { serializeRichTextDocumentToSource } from "../text-editor/richTextDocument";
import type { SelectedObject } from "../state/slices/storeTypes";
import { getNumberValue } from "../scene/points";
import { commandBarApi, useGeoStore } from "../state/geoStore";
import { IconAngle, IconPoint, IconLine, IconCircleRadius } from "./icons";
import { formatRoundedDisplay } from "./displayFormat";
import { GeoContextMenu, type GeoContextMenuState } from "./GeoContextMenu";

type ObjectBrowserProps = {
    scene: SceneModel;
    selectedObject: SelectedObject | null;
    setSelectedObject: (obj: SelectedObject) => void;
    multiSelectedObjects: Array<Exclude<SelectedObject, null>>;
    setMultiSelectedObjects: (next: Array<Exclude<SelectedObject, null>>) => void;
};

type TabId = "all" | "points" | "lines" | "circles" | "angles" | "text" | "numbers";
type SelectedObjectRef = Exclude<SelectedObject, null>;
type ObjectRowDescriptor = {
    key: string;
    object: SelectedObjectRef;
    title: string;
    commandText: string;
    visible: boolean;
    reorderable: boolean;
};

type DragPreviewState = {
    left: number;
    top: number;
    width: number;
    title: string;
    commandText: string;
};

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
        type !== "richText" &&
        type !== "number"
    ) {
        return null;
    }
    return { type, id };
}

function geometryLayerRefFromSelectedObject(obj: SelectedObjectRef): SceneGeometryLayerRef | null {
    if (
        obj.type === "segment" ||
        obj.type === "line" ||
        obj.type === "circle" ||
        obj.type === "polygon" ||
        obj.type === "angle"
    ) {
        return { type: obj.type, id: obj.id };
    }
    return null;
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
        case "richText":
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
    const [draggedGeometryKey, setDraggedGeometryKey] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ key: string; position: GeometryLayerDropPosition } | null>(null);
    const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
    const [contextMenu, setContextMenu] = useState<GeoContextMenuState | null>(null);
    const objectRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const lastSelectionKeyRef = useRef<string | null>(null);
    const pointerDragRef = useRef<{
        key: string;
        pointerId: number;
        startX: number;
        startY: number;
        started: boolean;
        offsetX: number;
        offsetY: number;
        width: number;
        title: string;
        commandText: string;
    } | null>(null);
    const suppressRowClickRef = useRef(false);
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
    const reorderGeometryLayerInTab = useGeoStore((store) => store.reorderGeometryLayerInTab);
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

    useEffect(() => {
        setDraggedGeometryKey(null);
        setDropIndicator(null);
        setDragPreview(null);
        pointerDragRef.current = null;
    }, [activeTab]);

    useEffect(() => {
        document.body.classList.toggle("object-browser-dragging", draggedGeometryKey !== null);
        return () => document.body.classList.remove("object-browser-dragging");
    }, [draggedGeometryKey]);

    const bindObjectRowRef = useCallback(
        (key: string) => (el: HTMLDivElement | null) => {
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
    const polygonById = useMemo(() => new Map(scene.polygons.map((p) => [p.id, p])), [scene.polygons]);
    const angleById = useMemo(() => new Map(scene.angles.map((a) => [a.id, a])), [scene.angles]);
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

    const reflectionTargetText = (ref: ReflectionObjectRef): string =>
        ref.type === "point"
            ? pointLabel(ref.id)
            : ref.type === "pointPair"
                ? `Line(${pointLabel(ref.aId)},${pointLabel(ref.bId)})`
                : lineLikeText(ref);

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
        if (suppressRowClickRef.current) {
            suppressRowClickRef.current = false;
            return;
        }
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

    const handleRowKeyDown = (e: ReactKeyboardEvent<HTMLElement>, currentKey: string) => {
        if (!e.shiftKey && (e.key === "Enter" || e.key === " ")) {
            const current = objectFromRowKey(currentKey);
            if (!current) return;
            e.preventDefault();
            selectObject(current);
            return;
        }
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
        commandText: string,
        reorderable = false,
        dragging = false,
        dropPosition: GeometryLayerDropPosition | null = null,
        canMoveUp = false,
        canMoveDown = false,
        onMoveUp?: () => void,
        onMoveDown?: () => void,
        onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void,
        onContextMenu?: (e: ReactMouseEvent<HTMLDivElement>) => void
    ) => (
        <div
            key={key}
            ref={bindObjectRowRef(key)}
            className={`objectItem${active ? " active" : ""}${selected ? " selected" : ""}${reorderable ? " reorderable" : ""}${dragging ? " dragging" : ""}${dropPosition === "before" ? " dropBefore" : ""}${dropPosition === "after" ? " dropAfter" : ""}`}
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => handleRowKeyDown(e, key)}
            onPointerDown={onPointerDown}
            onContextMenu={onContextMenu}
            aria-grabbed={reorderable && dragging ? true : undefined}
        >
            <div className="objectItemText">
                <span className="objectItemLabel">{title}</span>
                <span className="objectItemCommand" title={commandText}>{commandText}</span>
            </div>
            <div className="objectItemActions">
                {reorderable && (
                    <>
                        <button
                            type="button"
                            className="objectLayerMove"
                            title="Move layer up"
                            aria-label="Move layer up"
                            disabled={!canMoveUp}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveUp?.();
                            }}
                        >
                            <ArrowUp size={12} strokeWidth={2.1} />
                        </button>
                        <button
                            type="button"
                            className="objectLayerMove"
                            title="Move layer down"
                            aria-label="Move layer down"
                            disabled={!canMoveDown}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveDown?.();
                            }}
                        >
                            <ArrowDown size={12} strokeWidth={2.1} />
                        </button>
                    </>
                )}
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
        </div>
    );

    const tabs: Array<{ id: TabId; icon: React.ElementType; label: string; description: string; count: number }> = [
        { id: "all", icon: Layers, label: "All", description: "Show all objects", count: scene.points.length + scene.segments.length + scene.lines.length + scene.circles.length + scene.polygons.length + scene.angles.length + (scene.textLabels?.length ?? 0) + (scene.richTextNodes?.length ?? 0) + scene.numbers.length },
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
        {
            id: "text",
            icon: TypeIcon,
            label: "Labels",
            description: "Filter by Text Objects",
            count: (scene.textLabels?.length ?? 0) + (scene.richTextNodes?.length ?? 0),
        },
        { id: "numbers", icon: Hash, label: "Numbers", description: "Filter by Numbers & Values", count: scene.numbers.length },
    ];

    const filteredRows = useMemo<ObjectRowDescriptor[]>(() => {
        const buildPointRow = (point: SceneModel["points"][number]): ObjectRowDescriptor => ({
            key: `point:${point.id}`,
            object: { type: "point", id: point.id },
            title: `Point ${point.name}`,
            commandText:
                point.kind === "free"
                    ? withAliasPrefix("point", point.id, `Point(${formatRoundedDisplay(point.position.x, 4)},${formatRoundedDisplay(point.position.y, 4)})`)
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
                                            ? withAliasPrefix("point", point.id, `Reflect(${pointLabel(point.pointId)},${reflectionTargetText(point.axis)})`)
                                            : point.kind === "pointByProjection"
                                                ? withAliasPrefix(
                                                    "point",
                                                    point.id,
                                                    `Orthoproject(${pointLabel(point.pointId)},${pointLabel(point.axisAId)},${pointLabel(point.axisBId)})`
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
                                                                ? withAliasPrefix("point", point.id, `Intersect(${circleRefText(point.circleId)},${lineLikeText({ type: "line", id: point.lineId })})`)
                                                                : point.kind === "circleSegmentIntersectionPoint"
                                                                    ? withAliasPrefix("point", point.id, `Intersect(${circleRefText(point.circleId)},${lineLikeText({ type: "segment", id: point.segId })})`)
                                                                    : point.kind === "circleCircleIntersectionPoint"
                                                                        ? withAliasPrefix("point", point.id, `Intersect(${circleRefText(point.circleAId)},${circleRefText(point.circleBId)})`)
                                                                        : point.kind === "lineLikeIntersectionPoint"
                                                                            ? withAliasPrefix("point", point.id, `Intersect(${lineLikeText(point.objA)},${lineLikeText(point.objB)})`)
                                                                            : withAliasPrefix("point", point.id, "Point(...)"),
            visible: point.visible,
            reorderable: false,
        });

        const buildSegmentRow = (segment: SceneModel["segments"][number]): ObjectRowDescriptor => ({
            key: `segment:${segment.id}`,
            object: { type: "segment", id: segment.id },
            title: `Segment ${pointLabel(segment.aId)}${pointLabel(segment.bId)}`,
            commandText: withAliasPrefix("segment", segment.id, `Segment(${pointLabel(segment.aId)},${pointLabel(segment.bId)})`),
            visible: segment.visible,
            reorderable: activeTab === "lines",
        });

        const buildLineRow = (line: SceneModel["lines"][number]): ObjectRowDescriptor => ({
            key: `line:${line.id}`,
            object: { type: "line", id: line.id },
            title: line.kind === "twoPoint" ? `Line ${pointLabel(line.aId)}${pointLabel(line.bId)}` : `Line ${line.id}`,
            commandText: withAliasPrefix("line", line.id, lineLikeText({ type: "line", id: line.id })),
            visible: line.visible,
            reorderable: activeTab === "lines",
        });

        const buildCircleRow = (circle: SceneModel["circles"][number]): ObjectRowDescriptor => ({
            key: `circle:${circle.id}`,
            object: { type: "circle", id: circle.id },
            title: `Circle ${circle.id}`,
            commandText: withAliasPrefix("circle", circle.id, circleRefText(circle.id)),
            visible: circle.visible,
            reorderable: activeTab === "circles",
        });

        const buildPolygonRow = (polygon: SceneModel["polygons"][number]): ObjectRowDescriptor => ({
            key: `polygon:${polygon.id}`,
            object: { type: "polygon", id: polygon.id },
            title: `Polygon ${polygon.id}`,
            commandText: withAliasPrefix("polygon", polygon.id, `Polygon(${polygon.pointIds.map((id) => pointLabel(id)).join(",")})`),
            visible: polygon.visible,
            reorderable: activeTab === "circles",
        });

        const buildAngleRow = (angle: SceneModel["angles"][number]): ObjectRowDescriptor => ({
            key: `angle:${angle.id}`,
            object: { type: "angle", id: angle.id },
            title: angle.kind === "sector"
                ? `Sector ${pointLabel(angle.aId)}${pointLabel(angle.bId)}${pointLabel(angle.cId)}`
                : `Angle ${pointLabel(angle.aId)}${pointLabel(angle.bId)}${pointLabel(angle.cId)}`,
            commandText: angle.kind === "sector"
                ? withAliasPrefix("angle", angle.id, `Sector(${pointLabel(angle.bId)},${pointLabel(angle.aId)},${pointLabel(angle.cId)})`)
                : withAliasPrefix("angle", angle.id, `MarkedAngle(${pointLabel(angle.aId)},${pointLabel(angle.bId)},${pointLabel(angle.cId)})`),
            visible: angle.visible,
            reorderable: activeTab === "circles" ? angle.kind === "sector" : activeTab === "angles",
        });

        const buildTextLabelRow = (label: NonNullable<SceneModel["textLabels"]>[number]): ObjectRowDescriptor => ({
            key: `textLabel:${label.id}`,
            object: { type: "textLabel", id: label.id },
            title: `Label ${label.name}`,
            commandText: `Text(${JSON.stringify(label.text)})`,
            visible: label.visible,
            reorderable: false,
        });

        const buildRichTextRow = (node: NonNullable<SceneModel["richTextNodes"]>[number]): ObjectRowDescriptor => ({
            key: `richText:${node.id}`,
            object: { type: "richText", id: node.id },
            title: `Textbox ${node.name}`,
            commandText: `Textbox(${JSON.stringify(serializeRichTextDocumentToSource(node.document))})`,
            visible: node.visible,
            reorderable: false,
        });

        const buildNumberRow = (num: SceneModel["numbers"][number]): ObjectRowDescriptor => ({
            key: `number:${num.id}`,
            object: { type: "number", id: num.id },
            title: `Number ${num.name}`,
            commandText: (() => {
                const value = getNumberValue(num.id, scene);
                return value === null ? `${num.name} = undefined` : `${num.name} = ${value.toFixed(6)}`;
            })(),
            visible: num.visible,
            reorderable: false,
        });

        const buildGeometryRow = (ref: SceneGeometryLayerRef): ObjectRowDescriptor | null => {
            if (ref.type === "segment") {
                const segment = segmentById.get(ref.id);
                return segment ? buildSegmentRow(segment) : null;
            }
            if (ref.type === "line") {
                const line = lineById.get(ref.id);
                return line ? buildLineRow(line) : null;
            }
            if (ref.type === "circle") {
                const circle = circleById.get(ref.id);
                return circle ? buildCircleRow(circle) : null;
            }
            if (ref.type === "polygon") {
                const polygon = polygonById.get(ref.id);
                return polygon ? buildPolygonRow(polygon) : null;
            }
            const angle = angleById.get(ref.id);
            return angle ? buildAngleRow(angle) : null;
        };

        const buildGeometryRowsForTab = (tab: "all" | "lines" | "circles" | "angles") =>
            geometryLayerOrderForTab(scene, tab)
                .map(buildGeometryRow)
                .filter((row): row is ObjectRowDescriptor => Boolean(row));

        if (activeTab === "all") {
            return [
                ...scene.points.map(buildPointRow),
                ...buildGeometryRowsForTab("all"),
                ...(scene.textLabels ?? []).map(buildTextLabelRow),
                ...(scene.richTextNodes ?? []).map(buildRichTextRow),
                ...scene.numbers.map(buildNumberRow),
            ];
        }
        if (activeTab === "points") return scene.points.map(buildPointRow);
        if (activeTab === "lines" || activeTab === "circles" || activeTab === "angles") {
            return buildGeometryRowsForTab(activeTab);
        }
        if (activeTab === "text") return [...(scene.textLabels ?? []).map(buildTextLabelRow), ...(scene.richTextNodes ?? []).map(buildRichTextRow)];
        return scene.numbers.map(buildNumberRow);
    }, [activeTab, angleById, circleById, lineById, polygonById, scene, segmentById]);

    const reorderableTab = activeTab === "lines" || activeTab === "circles" || activeTab === "angles" ? activeTab : null;
    const reorderableRowKeys = useMemo(
        () => filteredRows.filter((row) => row.reorderable).map((row) => row.key),
        [filteredRows]
    );

    const computePointerDropIndicator = useCallback((clientY: number, draggedKey: string) => {
        const candidates = reorderableRowKeys.filter((key) => key !== draggedKey);
        if (candidates.length === 0) return null;
        for (const key of candidates) {
            const row = objectRowRefs.current.get(key);
            if (!row) continue;
            const rect = row.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (clientY < midpoint) {
                return { key, position: "before" as GeometryLayerDropPosition };
            }
        }
        const lastKey = candidates[candidates.length - 1];
        return { key: lastKey, position: "after" as GeometryLayerDropPosition };
    }, [reorderableRowKeys]);

    useEffect(() => {
        const clearPointerDrag = () => {
            pointerDragRef.current = null;
            setDraggedGeometryKey(null);
            setDropIndicator(null);
            setDragPreview(null);
        };

        const onPointerMove = (e: PointerEvent) => {
            const drag = pointerDragRef.current;
            if (!drag || drag.pointerId !== e.pointerId || !reorderableTab) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            if (!drag.started) {
                if (Math.hypot(dx, dy) < 5) return;
                drag.started = true;
                suppressRowClickRef.current = true;
                setDraggedGeometryKey(drag.key);
                setDragPreview({
                    left: e.clientX - drag.offsetX,
                    top: e.clientY - drag.offsetY,
                    width: drag.width,
                    title: drag.title,
                    commandText: drag.commandText,
                });
            }
            setDragPreview({
                left: e.clientX - drag.offsetX,
                top: e.clientY - drag.offsetY,
                width: drag.width,
                title: drag.title,
                commandText: drag.commandText,
            });
            setDropIndicator(computePointerDropIndicator(e.clientY, drag.key));
        };

        const onPointerEnd = (e: PointerEvent) => {
            const drag = pointerDragRef.current;
            if (!drag || drag.pointerId !== e.pointerId) return;
            if (drag.started && reorderableTab && dropIndicator) {
                const dragged = objectFromRowKey(drag.key);
                const draggedRef = dragged ? geometryLayerRefFromSelectedObject(dragged) : null;
                const targetObj = objectFromRowKey(dropIndicator.key);
                const targetRef = targetObj ? geometryLayerRefFromSelectedObject(targetObj) : null;
                if (draggedRef && targetRef) {
                    reorderGeometryLayerInTab(draggedRef, targetRef, reorderableTab, dropIndicator.position);
                }
            }
            clearPointerDrag();
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onPointerEnd);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerEnd);
            window.removeEventListener("pointercancel", onPointerEnd);
        };
    }, [computePointerDropIndicator, dropIndicator, reorderGeometryLayerInTab, reorderableTab]);

    const moveRowByStep = (row: ObjectRowDescriptor, direction: -1 | 1) => {
        if (!reorderableTab || !row.reorderable) return;
        const currentIndex = reorderableRowKeys.indexOf(row.key);
        if (currentIndex < 0) return;
        const targetKey = reorderableRowKeys[currentIndex + direction];
        if (!targetKey) return;
        const draggedRef = geometryLayerRefFromSelectedObject(row.object);
        const targetObject = objectFromRowKey(targetKey);
        const targetRef = targetObject ? geometryLayerRefFromSelectedObject(targetObject) : null;
        if (!draggedRef || !targetRef) return;
        reorderGeometryLayerInTab(draggedRef, targetRef, reorderableTab, direction < 0 ? "before" : "after");
    };

    const handlePointerDown = (row: ObjectRowDescriptor) => (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!reorderableTab || !row.reorderable) return;
        if (e.button !== 0) return;
        const target = e.target;
        if (target instanceof HTMLElement && target.closest(".objectItemActions")) return;
        const ref = geometryLayerRefFromSelectedObject(row.object);
        if (!ref || !geometryLayerRefMatchesTab(scene, ref, reorderableTab)) return;
        const rect = e.currentTarget.getBoundingClientRect();
        e.preventDefault();
        pointerDragRef.current = {
            key: geometryLayerKey(ref),
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            started: false,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            width: rect.width,
            title: row.title,
            commandText: row.commandText,
        };
        setDropIndicator(null);
    };

    const isEmpty =
        (activeTab === "all" &&
            scene.points.length === 0 &&
            scene.segments.length === 0 &&
            scene.lines.length === 0 &&
            scene.circles.length === 0 &&
            scene.polygons.length === 0 &&
            scene.angles.length === 0 &&
            (scene.textLabels?.length ?? 0) === 0 &&
            (scene.richTextNodes?.length ?? 0) === 0 &&
            scene.numbers.length === 0) ||
        (activeTab === "points" && scene.points.length === 0) ||
        (activeTab === "lines" && scene.segments.length === 0 && scene.lines.length === 0) ||
        (activeTab === "circles" && scene.circles.length === 0 && scene.polygons.length === 0 && !scene.angles.some((angle) => angle.kind === "sector")) ||
        (activeTab === "angles" && !scene.angles.some((angle) => angle.kind !== "sector")) ||
        (activeTab === "text" && (scene.textLabels?.length ?? 0) === 0 && (scene.richTextNodes?.length ?? 0) === 0) ||
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
                    {filteredRows.map((row) => renderObjectRow(
                        row.key,
                        selectedObject?.type === row.object.type && selectedObject.id === row.object.id,
                        multiSelectedKeySet.has(row.key),
                        () => selectObject(row.object),
                        () => toggleBatchSelection(row.object),
                        row.visible,
                        (next) => setObjectVisibility(row.object, next),
                        row.title,
                        row.commandText,
                        Boolean(reorderableTab && row.reorderable),
                        draggedGeometryKey === row.key,
                        dropIndicator?.key === row.key ? dropIndicator.position : null,
                        row.reorderable && reorderableRowKeys.indexOf(row.key) > 0,
                        row.reorderable && reorderableRowKeys.indexOf(row.key) >= 0 && reorderableRowKeys.indexOf(row.key) < reorderableRowKeys.length - 1,
                        () => moveRowByStep(row, -1),
                        () => moveRowByStep(row, 1),
                        handlePointerDown(row),
                        (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectObject(row.object);
                            setContextMenu({ x: e.clientX, y: e.clientY, target: row.object });
                        }
                    ))}
                </div>
            </div>
            <GeoContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
            {dragPreview && (
                <div
                    className="objectBrowserDragGhost"
                    style={{
                        left: `${dragPreview.left}px`,
                        top: `${dragPreview.top}px`,
                        width: `${dragPreview.width}px`,
                    }}
                >
                    <div className="objectItemText">
                        <span className="objectItemLabel">{dragPreview.title}</span>
                        <span className="objectItemCommand" title={dragPreview.commandText}>{dragPreview.commandText}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
