import { useMemo, useState, type KeyboardEvent } from "react";
import { parseCommandInput, type ParseContext, type Symbol } from "./CommandParser";
import { getCircleWorldGeometry, getLineWorldAnchors, getPointWorldPos } from "./scene/points";
import type { SceneModel } from "./scene/points";
import { commandBarApi, useGeoStore } from "./state/geoStore";

type StatusKind = "idle" | "ok" | "error";

type Status = {
  kind: StatusKind;
  text: string;
};

const MAX_HISTORY = 20;

function buildParseContext(
  scene: SceneModel,
  ans: number | null,
  scalarVars: Record<string, number>,
  objectAliases: Record<string, { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }>
): ParseContext {
  const symbolsByLabel = new Map<string, Symbol[]>();
  const add = (symbol: Symbol) => {
    const list = symbolsByLabel.get(symbol.label);
    if (!list) symbolsByLabel.set(symbol.label, [symbol]);
    else list.push(symbol);
  };

  for (let i = 0; i < scene.points.length; i += 1) {
    const p = scene.points[i];
    add({ kind: "point", id: p.id, label: p.name });
  }
  for (let i = 0; i < scene.numbers.length; i += 1) {
    const n = scene.numbers[i];
    add({ kind: "other", id: n.id, label: n.name, type: "number" });
  }

  const pointWorldById = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < scene.points.length; i += 1) {
    const p = scene.points[i];
    const w = getPointWorldPos(p, scene);
    if (w) pointWorldById.set(p.id, w);
  }

  const segmentWorldAnchorsById = new Map<string, { a: { x: number; y: number }; b: { x: number; y: number } }>();
  for (let i = 0; i < scene.segments.length; i += 1) {
    const seg = scene.segments[i];
    const a = pointWorldById.get(seg.aId);
    const b = pointWorldById.get(seg.bId);
    if (a && b) segmentWorldAnchorsById.set(seg.id, { a, b });
  }

  const lineWorldAnchorsById = new Map<string, { a: { x: number; y: number }; b: { x: number; y: number } }>();
  for (let i = 0; i < scene.lines.length; i += 1) {
    const line = scene.lines[i];
    const anchors = getLineWorldAnchors(line, scene);
    if (anchors) lineWorldAnchorsById.set(line.id, anchors);
  }

  const circleWorldGeometryById = new Map<string, { center: { x: number; y: number }; radius: number }>();
  for (let i = 0; i < scene.circles.length; i += 1) {
    const circle = scene.circles[i];
    const geom = getCircleWorldGeometry(circle, scene);
    if (geom) circleWorldGeometryById.set(circle.id, geom);
  }

  const polygonPointIdsById = new Map<string, string[]>();
  for (let i = 0; i < scene.polygons.length; i += 1) {
    const polygon = scene.polygons[i];
    polygonPointIdsById.set(polygon.id, [...polygon.pointIds]);
  }

  return {
    symbolsByLabel,
    pointWorldById,
    lineWorldAnchorsById,
    segmentWorldAnchorsById,
    circleWorldGeometryById,
    polygonPointIdsById,
    scalarsByName: new Map(Object.entries(scalarVars)),
    objectAliases: new Map(Object.entries(objectAliases)),
    objectNames: new Set(Object.keys(objectAliases)),
    ans: ans ?? undefined,
  };
}

export function CommandBar() {
  const scene = useGeoStore((store) => store.scene);
  const createFreePoint = useGeoStore((store) => store.createFreePoint);
  const createLine = useGeoStore((store) => store.createLine);
  const createSegment = useGeoStore((store) => store.createSegment);
  const createPolygon = useGeoStore((store) => store.createPolygon);
  const createRegularPolygon = useGeoStore((store) => store.createRegularPolygon);
  const createCircle = useGeoStore((store) => store.createCircle);
  const createCircleThreePoint = useGeoStore((store) => store.createCircleThreePoint);
  const createCircleFixedRadius = useGeoStore((store) => store.createCircleFixedRadius);
  const createMidpointFromPoints = useGeoStore((store) => store.createMidpointFromPoints);
  const createMidpointFromSegment = useGeoStore((store) => store.createMidpointFromSegment);
  const createTriangleCenterPoint = useGeoStore((store) => store.createTriangleCenterPoint);
  const createPointByTranslation = useGeoStore((store) => store.createPointByTranslation);
  const createPointByRotation = useGeoStore((store) => store.createPointByRotation);
  const createPointByDilation = useGeoStore((store) => store.createPointByDilation);
  const createPointByReflection = useGeoStore((store) => store.createPointByReflection);
  const createPerpendicularLine = useGeoStore((store) => store.createPerpendicularLine);
  const createParallelLine = useGeoStore((store) => store.createParallelLine);
  const createTangentLines = useGeoStore((store) => store.createTangentLines);
  const createAngleBisectorLine = useGeoStore((store) => store.createAngleBisectorLine);
  const createAngle = useGeoStore((store) => store.createAngle);
  const createAngleFixed = useGeoStore((store) => store.createAngleFixed);
  const createSector = useGeoStore((store) => store.createSector);

  const [input, setInput] = useState("");
  const [ans, setAns] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "Ready" });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [collapsed, setCollapsed] = useState(false);

  const statusColor = useMemo(() => {
    if (status.kind === "ok") return "var(--gd-ui-success-text, #166534)";
    if (status.kind === "error") return "var(--gd-ui-danger-text, #b91c1c)";
    return "var(--gd-ui-text-muted, #475569)";
  }, [status.kind]);

  const pushHistory = (entry: string) => {
    setHistory((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_HISTORY) return next.slice(next.length - MAX_HISTORY);
      return next;
    });
    setHistoryIndex(-1);
  };

  const runCommand = () => {
    const raw = input.trim();
    if (!raw) {
      setStatus({ kind: "error", text: "Input is empty" });
      return;
    }

    const parseCtx = buildParseContext(scene, ans, commandBarApi.getScalarVars(), commandBarApi.getCommandObjectAliases());
    const parsed = parseCommandInput(raw, parseCtx);
    if (parsed.kind === "error") {
      setStatus({ kind: "error", text: parsed.message });
      return;
    }

    pushHistory(raw);

    if (parsed.kind === "expr") {
      if (typeof parsed.numeric === "number" && Number.isFinite(parsed.numeric)) {
        setAns(parsed.numeric);
      }
      setStatus({ kind: "ok", text: `= ${parsed.value}` });
      return;
    }

    if (parsed.kind === "assignScalar") {
      const out = commandBarApi.setScalarVar(parsed.name, parsed.value, parsed.expr);
      if (!out.ok) {
        setStatus({ kind: "error", text: out.error });
        return;
      }
      setStatus({ kind: "ok", text: `${parsed.name} = ${parsed.value}${out.mode === "updated" ? " (updated)" : ""}` });
      return;
    }

    if (parsed.kind === "assignObject") {
      const { name, cmd } = parsed;
      const out = commandBarApi.applyObjectAssignment(name, cmd);
      if (!out.ok) {
        setStatus({ kind: "error", text: out.error });
        return;
      }
      const noun =
        out.objectType === "point"
          ? "Point"
          : out.objectType === "line"
            ? "Line"
            : out.objectType === "segment"
              ? "Segment"
              : out.objectType === "circle"
                ? "Circle"
                : out.objectType === "polygon"
                  ? "Polygon"
                  : "Angle";
      setStatus({ kind: "ok", text: `${name}: ${noun} ${out.mode === "updated" ? "updated" : "created"}` });
      return;
    }

    const cmd = parsed.cmd;
    if (cmd.type === "CreatePointXY") {
      const id = createFreePoint({ x: cmd.x, y: cmd.y });
      setStatus({ kind: "ok", text: `Created point ${id}` });
      return;
    }

    if (cmd.type === "CreateLineXY") {
      const aId = createFreePoint({ x: cmd.x1, y: cmd.y1 });
      const bId = createFreePoint({ x: cmd.x2, y: cmd.y2 });
      const lineId = createLine(aId, bId);
      if (!lineId) {
        setStatus({ kind: "error", text: "Cannot construct line" });
        return;
      }
      setStatus({ kind: "ok", text: `Created line ${lineId}` });
      return;
    }

    if (cmd.type === "CreateLineByPoints") {
      const lineId = createLine(cmd.aId, cmd.bId);
      if (!lineId) {
        setStatus({ kind: "error", text: "Cannot construct line" });
        return;
      }
      setStatus({ kind: "ok", text: `Created line ${lineId}` });
      return;
    }

    if (cmd.type === "CreateSegmentByPoints") {
      const segId = createSegment(cmd.aId, cmd.bId);
      if (!segId) {
        setStatus({ kind: "error", text: "Cannot construct segment" });
        return;
      }
      setStatus({ kind: "ok", text: `Created segment ${segId}` });
      return;
    }

    if (cmd.type === "CreatePolygonByPoints") {
      const polygonId = createPolygon(cmd.pointIds);
      if (!polygonId) {
        setStatus({ kind: "error", text: "Cannot construct polygon" });
        return;
      }
      setStatus({ kind: "ok", text: `Created polygon ${polygonId}` });
      return;
    }

    if (cmd.type === "CreateRegularPolygonFromEdge") {
      const polygonId = createRegularPolygon(cmd.aId, cmd.bId, cmd.sides, cmd.direction);
      if (!polygonId) {
        setStatus({ kind: "error", text: "Cannot construct regular polygon" });
        return;
      }
      setStatus({ kind: "ok", text: `Created polygon ${polygonId}` });
      return;
    }

    if (cmd.type === "CreateMidpointByPoints") {
      const pointId = createMidpointFromPoints(cmd.aId, cmd.bId);
      if (!pointId) {
        setStatus({ kind: "error", text: "Cannot construct midpoint" });
        return;
      }
      setStatus({ kind: "ok", text: `Created point ${pointId}` });
      return;
    }

    if (cmd.type === "CreateMidpointBySegment") {
      const pointId = createMidpointFromSegment(cmd.segId);
      if (!pointId) {
        setStatus({ kind: "error", text: "Cannot construct midpoint" });
        return;
      }
      setStatus({ kind: "ok", text: `Created point ${pointId}` });
      return;
    }

    if (cmd.type === "CreateTriangleCenterPoint") {
      const pointId = createTriangleCenterPoint(cmd.centerKind, cmd.aId, cmd.bId, cmd.cId);
      if (!pointId) {
        setStatus({ kind: "error", text: "Cannot construct triangle center" });
        return;
      }
      setStatus({ kind: "ok", text: `Created point ${pointId}` });
      return;
    }

    if (cmd.type === "CreatePointByTranslation") {
      const pointId = createPointByTranslation(cmd.pointId, cmd.fromId, cmd.toId);
      if (!pointId) {
        setStatus({ kind: "error", text: "Cannot construct translated point" });
        return;
      }
      setStatus({ kind: "ok", text: `Created point ${pointId}` });
      return;
    }

    if (cmd.type === "CreatePointByRotation") {
      const pointId = createPointByRotation(cmd.centerId, cmd.pointId, cmd.angleDeg, cmd.direction, cmd.angleExpr);
      if (!pointId) {
        setStatus({ kind: "error", text: "Cannot construct rotated point" });
        return;
      }
      setStatus({ kind: "ok", text: `Created point ${pointId}` });
      return;
    }

    if (cmd.type === "CreatePointByDilation") {
      const pointId = createPointByDilation(cmd.pointId, cmd.centerId, cmd.factorExpr);
      if (!pointId) {
        setStatus({ kind: "error", text: "Cannot construct dilated point" });
        return;
      }
      setStatus({ kind: "ok", text: `Created point ${pointId}` });
      return;
    }

    if (cmd.type === "CreatePointByReflection") {
      const pointId = createPointByReflection(cmd.pointId, cmd.axis);
      if (!pointId) {
        setStatus({ kind: "error", text: "Cannot construct reflected point" });
        return;
      }
      setStatus({ kind: "ok", text: `Created point ${pointId}` });
      return;
    }

    if (cmd.type === "CreatePerpendicularLine") {
      const lineId = createPerpendicularLine(cmd.throughId, cmd.base);
      if (!lineId) {
        setStatus({ kind: "error", text: "Cannot construct line" });
        return;
      }
      setStatus({ kind: "ok", text: `Created line ${lineId}` });
      return;
    }

    if (cmd.type === "CreateParallelLine") {
      const lineId = createParallelLine(cmd.throughId, cmd.base);
      if (!lineId) {
        setStatus({ kind: "error", text: "Cannot construct line" });
        return;
      }
      setStatus({ kind: "ok", text: `Created line ${lineId}` });
      return;
    }

    if (cmd.type === "CreateTangentLines") {
      const lineIds = createTangentLines(cmd.throughId, cmd.circleId);
      if (lineIds.length === 0) {
        setStatus({ kind: "error", text: "Cannot construct tangent line" });
        return;
      }
      setStatus({ kind: "ok", text: `Created tangent line${lineIds.length > 1 ? "s" : ""} ${lineIds.join(", ")}` });
      return;
    }

    if (cmd.type === "CreateAngleBisector") {
      const lineId = createAngleBisectorLine(cmd.aId, cmd.bId, cmd.cId);
      if (!lineId) {
        setStatus({ kind: "error", text: "Cannot construct angle bisector" });
        return;
      }
      setStatus({ kind: "ok", text: `Created line ${lineId}` });
      return;
    }

    if (cmd.type === "CreateAngle") {
      const angleId = createAngle(cmd.aId, cmd.bId, cmd.cId);
      if (!angleId) {
        setStatus({ kind: "error", text: "Cannot construct angle" });
        return;
      }
      setStatus({ kind: "ok", text: `Created angle ${angleId}` });
      return;
    }

    if (cmd.type === "CreateAngleFixed") {
      const created = createAngleFixed(cmd.vertexId, cmd.basePointId, cmd.angleExpr, cmd.direction);
      if (!created) {
        setStatus({ kind: "error", text: "Cannot construct fixed angle" });
        return;
      }
      setStatus({ kind: "ok", text: `Created angle ${created.angleId}` });
      return;
    }

    if (cmd.type === "CreateSector") {
      const angleId = createSector(cmd.centerId, cmd.startId, cmd.endId);
      if (!angleId) {
        setStatus({ kind: "error", text: "Cannot construct sector" });
        return;
      }
      setStatus({ kind: "ok", text: `Created sector ${angleId}` });
      return;
    }

    if (cmd.type === "CreateCircleThreePoint") {
      const circleId = createCircleThreePoint(cmd.aId, cmd.bId, cmd.cId);
      if (!circleId) {
        setStatus({ kind: "error", text: "Cannot construct circle" });
        return;
      }
      setStatus({ kind: "ok", text: `Created circle ${circleId}` });
      return;
    }

    if (cmd.type === "CreateCircleCenterThrough") {
      const circleId = createCircle(cmd.centerId, cmd.throughId);
      if (!circleId) {
        setStatus({ kind: "error", text: "Cannot construct circle" });
        return;
      }
      setStatus({ kind: "ok", text: `Created circle ${circleId}` });
      return;
    }

    if (cmd.type === "CreateCircleCenterRadius") {
      const radiusExpr = cmd.rExpr && cmd.rExpr.trim() ? cmd.rExpr : String(cmd.r);
      const circleId = createCircleFixedRadius(cmd.centerId, radiusExpr);
      if (!circleId) {
        setStatus({ kind: "error", text: "Cannot construct circle" });
        return;
      }
      setStatus({ kind: "ok", text: `Created circle ${circleId}` });
      return;
    }

    if (cmd.type === "CreateCircleXYR") {
      const centerId = createFreePoint({ x: cmd.x, y: cmd.y });
      const circleId = createCircleFixedRadius(centerId, String(cmd.r));
      if (!circleId) {
        setStatus({ kind: "error", text: "Cannot construct circle" });
        return;
      }
      setStatus({ kind: "ok", text: `Created circle ${circleId}` });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setInput("");
      setHistoryIndex(-1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (history.length === 0) return;
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInput("");
        return;
      }
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
    }
  };

  return (
    <div className="commandBarWrap">
      {collapsed ? (
        <div className="commandBarCollapsed">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="commandBarCollapseButton"
            title="Show command bar"
          >
            ▴ Command
          </button>
        </div>
      ) : (
        <div className="commandBarExpanded">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="commandBarInput"
            placeholder="Command: 5*5, X=A+B, Point(x,y), Midpoint(A,B), Translate(P,A,B), Rotate(P,O,30), Dilate(P,O,2), Reflect(P,l)"
          />
          <button
            type="button"
            onClick={runCommand}
            className="commandBarRunButton"
          >
            Run
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="commandBarHideButton"
            title="Hide command bar"
          >
            ▾
          </button>
          <div className="commandBarStatus" style={{ color: statusColor }}>{status.text}</div>
        </div>
      )}
    </div>
  );
}
