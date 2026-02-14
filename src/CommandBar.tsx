import { useMemo, useState, type KeyboardEvent } from "react";
import { parseCommandInput, type ParseContext, type Symbol } from "./CommandParser";
import { getPointWorldPos } from "./scene/points";
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
  objectAliases: Record<string, { type: "point" | "segment" | "line" | "circle" | "polygon"; id: string }>
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

  return {
    symbolsByLabel,
    pointWorldById,
    scalarsByName: new Map(Object.entries(scalarVars)),
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
  const createCircle = useGeoStore((store) => store.createCircle);
  const createCircleFixedRadius = useGeoStore((store) => store.createCircleFixedRadius);

  const [input, setInput] = useState("");
  const [ans, setAns] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "Ready" });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [collapsed, setCollapsed] = useState(false);

  const statusColor = useMemo(() => {
    if (status.kind === "ok") return "#166534";
    if (status.kind === "error") return "#b91c1c";
    return "#475569";
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
      const out = commandBarApi.setScalarVar(parsed.name, parsed.value);
      if (!out.ok) {
        setStatus({ kind: "error", text: out.error });
        return;
      }
      setStatus({ kind: "ok", text: `${parsed.name} = ${parsed.value}` });
      return;
    }

    if (parsed.kind === "assignObject") {
      const { name, cmd } = parsed;
      if (cmd.type === "CreatePointXY") {
        const id = commandBarApi.createPointXYWithLabel(cmd.x, cmd.y, name);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct point" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Point created` });
        return;
      }
      if (cmd.type === "CreateLineXY") {
        const id = commandBarApi.createLineXYWithLabel(cmd.x1, cmd.y1, cmd.x2, cmd.y2, name);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct line" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Line created` });
        return;
      }
      if (cmd.type === "CreateLineByPoints") {
        const id = commandBarApi.createLineThroughPointsWithLabel(cmd.aId, cmd.bId, name);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct line" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Line created` });
        return;
      }
      if (cmd.type === "CreateSegmentByPoints") {
        const id = commandBarApi.createSegmentThroughPointsWithLabel(cmd.aId, cmd.bId, name);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct segment" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Segment created` });
        return;
      }
      if (cmd.type === "CreatePolygonByPoints") {
        const id = commandBarApi.createPolygonWithLabel(cmd.pointIds, name);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct polygon" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Polygon created` });
        return;
      }
      if (cmd.type === "CreateCircleCenterThrough") {
        const id = commandBarApi.createCircleCenterThroughWithLabel(cmd.centerId, cmd.throughId, name);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct circle" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Circle created` });
        return;
      }
      if (cmd.type === "CreateCircleCenterRadius") {
        const id = commandBarApi.createCircleCenterRadiusWithLabel(cmd.centerId, cmd.r, name, cmd.rExpr);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct circle" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Circle created` });
        return;
      }
      if (cmd.type === "CreateCircleXYR") {
        const centerId = createFreePoint({ x: cmd.x, y: cmd.y });
        const id = commandBarApi.createCircleCenterRadiusWithLabel(centerId, cmd.r, name);
        if (!id) {
          setStatus({ kind: "error", text: "Cannot construct circle" });
          return;
        }
        setStatus({ kind: "ok", text: `${name}: Circle created` });
        return;
      }
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
    <div
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        bottom: 10,
        zIndex: 60,
        pointerEvents: "auto",
      }}
    >
      {collapsed ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 999,
              background: "rgba(255,255,255,0.96)",
              color: "#0f172a",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
            }}
            title="Show command bar"
          >
            ▴ Command
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            boxShadow: "0 2px 10px rgba(15,23,42,0.08)",
            padding: "8px 10px",
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Command: 5*5, X=A+B, Point(x,y), Line(A,B), Segment(A,B), Circle(O,A), Circle(O,3), Distance(A,B)"
            style={{
              width: "100%",
              minWidth: 0,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 13,
              background: "#fff",
            }}
          />
          <button
            type="button"
            onClick={runCommand}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#f8fafc",
              color: "#0f172a",
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Run
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#fff",
              color: "#334155",
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 700,
            }}
            title="Hide command bar"
          >
            ▾
          </button>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: statusColor, minHeight: 16 }}>{status.text}</div>
        </div>
      )}
    </div>
  );
}
