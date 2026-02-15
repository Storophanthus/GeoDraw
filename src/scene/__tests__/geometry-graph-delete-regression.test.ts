import { applyDeletion, collectCascadeDelete } from "../../domain/geometryGraph";
import type { AngleStyle, CircleStyle, LineStyle, PointStyle, PolygonStyle, SceneModel } from "../points";

const pointStyle: PointStyle = {
  shape: "circle",
  sizePx: 4,
  strokeColor: "#0f172a",
  strokeWidth: 1.2,
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 1,
  labelFontPx: 14,
  labelHaloWidthPx: 2.5,
  labelHaloColor: "#ffffff",
  labelColor: "#0f172a",
  labelOffsetPx: { x: 8, y: -8 },
};

const lineStyle: LineStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.5,
  dash: "solid",
  opacity: 1,
};

const circleStyle: CircleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.5,
  strokeDash: "solid",
  strokeOpacity: 1,
};

const polygonStyle: PolygonStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.5,
  strokeDash: "solid",
  strokeOpacity: 1,
  fillColor: "#60a5fa",
  fillOpacity: 0.2,
};

const angleStyle: AngleStyle = {
  strokeColor: "#334155",
  strokeWidth: 1.2,
  strokeOpacity: 1,
  textColor: "#0f172a",
  textSize: 18,
  fillEnabled: false,
  fillColor: "#60a5fa",
  fillOpacity: 0.2,
  markStyle: "arc",
  markSymbol: "none",
  arcMultiplicity: 1,
  markPos: 0.5,
  markSize: 4,
  markColor: "#334155",
  arcRadius: 0.8,
  labelText: "",
  labelPosWorld: { x: 0, y: 0 },
  showLabel: true,
  showValue: true,
};

function baseScene(): SceneModel {
  return {
    points: [
      {
        id: "pA",
        kind: "free",
        name: "A",
        captionTex: "A",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 0 },
        style: pointStyle,
      },
      {
        id: "pB",
        kind: "free",
        name: "B",
        captionTex: "B",
        visible: true,
        showLabel: "name",
        position: { x: 4, y: 0 },
        style: pointStyle,
      },
      {
        id: "pC",
        kind: "free",
        name: "C",
        captionTex: "C",
        visible: true,
        showLabel: "name",
        position: { x: 0, y: 3 },
        style: pointStyle,
      },
      {
        id: "pL",
        kind: "pointOnLine",
        name: "L",
        captionTex: "L",
        visible: true,
        showLabel: "name",
        lineId: "l2",
        s: 0.25,
        style: pointStyle,
      },
      {
        id: "pI",
        kind: "circleLineIntersectionPoint",
        name: "I",
        captionTex: "I",
        visible: true,
        showLabel: "name",
        circleId: "c1",
        lineId: "l2",
        branchIndex: 0,
        style: pointStyle,
      },
    ],
    numbers: [
      { id: "n1", name: "l_1", visible: true, definition: { kind: "segmentLength", segId: "s1" } },
      { id: "n2", name: "n_2", visible: true, definition: { kind: "expression", expr: "l_1+2" } },
    ],
    lines: [
      { id: "l1", kind: "twoPoint", aId: "pA", bId: "pC", visible: true, style: lineStyle },
      { id: "l2", kind: "perpendicular", throughId: "pB", base: { type: "line", id: "l1" }, visible: true, style: lineStyle },
    ],
    segments: [{ id: "s1", aId: "pA", bId: "pB", visible: true, showLabel: false, style: lineStyle }],
    circles: [{ id: "c1", kind: "twoPoint", centerId: "pA", throughId: "pB", visible: true, style: circleStyle }],
    polygons: [],
    angles: [{ id: "a1", aId: "pA", bId: "pB", cId: "pC", visible: true, style: angleStyle }],
  };
}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function testDeleteLineCascadesDependents(): void {
  const scene = baseScene();
  const deleted = collectCascadeDelete(scene, { type: "line", id: "l1" });
  const next = applyDeletion(scene, deleted);

  assert(!next.lines.some((l) => l.id === "l1"), "l1 should be deleted");
  assert(!next.lines.some((l) => l.id === "l2"), "dependent perpendicular line l2 should be deleted");
  assert(!next.points.some((p) => p.id === "pL"), "pointOnLine on l2 should be deleted");
  assert(!next.points.some((p) => p.id === "pI"), "circleLineIntersection using l2 should be deleted");
  assert(next.circles.some((c) => c.id === "c1"), "unrelated circle should remain");
}

function testDeletePointCascadesGraph(): void {
  const scene = baseScene();
  const deleted = collectCascadeDelete(scene, { type: "point", id: "pA" });
  const next = applyDeletion(scene, deleted);

  assert(!next.points.some((p) => p.id === "pA"), "point A should be deleted");
  assert(!next.segments.some((s) => s.id === "s1"), "segment s1 depending on A should be deleted");
  assert(!next.lines.some((l) => l.id === "l1"), "line l1 depending on A should be deleted");
  assert(!next.circles.some((c) => c.id === "c1"), "circle c1 depending on A should be deleted");
  assert(!next.numbers.some((n) => n.id === "n1"), "number from deleted segment should be deleted");
  assert(!next.numbers.some((n) => n.id === "n2"), "expression number depending on n1 by name should be deleted");
}

function testDeletePolygonCascadesOwnedEdges(): void {
  const scene: SceneModel = {
    ...baseScene(),
    segments: [
      { id: "sOwned", aId: "pA", bId: "pB", ownedByPolygonIds: ["pg1"], visible: true, showLabel: false, style: lineStyle },
      { id: "sKeep", aId: "pB", bId: "pC", visible: true, showLabel: false, style: lineStyle },
    ],
    polygons: [{ id: "pg1", pointIds: ["pA", "pB", "pC"], visible: true, style: polygonStyle }],
    numbers: [{ id: "nOwned", name: "l_owned", visible: true, definition: { kind: "segmentLength", segId: "sOwned" } }],
  };
  const deleted = collectCascadeDelete(scene, { type: "polygon", id: "pg1" });
  const next = applyDeletion(scene, deleted);
  assert(!next.polygons.some((p) => p.id === "pg1"), "polygon should be deleted");
  assert(!next.segments.some((s) => s.id === "sOwned"), "owned segment should be deleted with polygon");
  assert(next.segments.some((s) => s.id === "sKeep"), "unowned segment should remain");
  assert(!next.numbers.some((n) => n.id === "nOwned"), "dependents of owned segment should cascade-delete");
}

function testDeletePolygonKeepsSharedOwnedEdges(): void {
  const scene: SceneModel = {
    ...baseScene(),
    segments: [
      { id: "sShared", aId: "pA", bId: "pB", ownedByPolygonIds: ["pg1", "pg2"], visible: true, showLabel: false, style: lineStyle },
    ],
    polygons: [
      { id: "pg1", pointIds: ["pA", "pB", "pC"], visible: true, style: polygonStyle },
      { id: "pg2", pointIds: ["pA", "pB", "pC"], visible: true, style: polygonStyle },
    ],
    numbers: [],
  };
  const deleted = collectCascadeDelete(scene, { type: "polygon", id: "pg1" });
  const next = applyDeletion(scene, deleted);
  assert(!next.polygons.some((p) => p.id === "pg1"), "target polygon should be deleted");
  assert(next.polygons.some((p) => p.id === "pg2"), "other owner polygon should remain");
  assert(next.segments.some((s) => s.id === "sShared"), "shared owned segment should remain");
}

function testDeleteSectorCascadesOwnedEdges(): void {
  const scene: SceneModel = {
    ...baseScene(),
    segments: [
      { id: "sSector", aId: "pB", bId: "pC", ownedBySectorIds: ["aSector"], visible: true, showLabel: false, style: lineStyle },
      { id: "sKeep", aId: "pA", bId: "pB", visible: true, showLabel: false, style: lineStyle },
    ],
    angles: [
      ...baseScene().angles,
      { id: "aSector", kind: "sector", aId: "pB", bId: "pA", cId: "pC", visible: true, style: angleStyle },
    ],
    numbers: [{ id: "nSector", name: "l_sector", visible: true, definition: { kind: "segmentLength", segId: "sSector" } }],
  };
  const deleted = collectCascadeDelete(scene, { type: "angle", id: "aSector" });
  const next = applyDeletion(scene, deleted);
  assert(!next.angles.some((a) => a.id === "aSector"), "sector should be deleted");
  assert(!next.segments.some((s) => s.id === "sSector"), "sector-owned segment should be deleted with sector");
  assert(next.segments.some((s) => s.id === "sKeep"), "unowned segment should remain");
  assert(!next.numbers.some((n) => n.id === "nSector"), "dependents of sector-owned segment should cascade-delete");
}

function testDeleteSectorKeepsSharedOwnedEdges(): void {
  const scene: SceneModel = {
    ...baseScene(),
    segments: [
      {
        id: "sSharedSector",
        aId: "pB",
        bId: "pC",
        ownedBySectorIds: ["aSector1", "aSector2"],
        visible: true,
        showLabel: false,
        style: lineStyle,
      },
    ],
    angles: [
      ...baseScene().angles,
      { id: "aSector1", kind: "sector", aId: "pB", bId: "pA", cId: "pC", visible: true, style: angleStyle },
      { id: "aSector2", kind: "sector", aId: "pB", bId: "pA", cId: "pC", visible: true, style: angleStyle },
    ],
    numbers: [],
  };
  const deleted = collectCascadeDelete(scene, { type: "angle", id: "aSector1" });
  const next = applyDeletion(scene, deleted);
  assert(!next.angles.some((a) => a.id === "aSector1"), "target sector should be deleted");
  assert(next.angles.some((a) => a.id === "aSector2"), "other owner sector should remain");
  assert(next.segments.some((s) => s.id === "sSharedSector"), "shared sector-owned segment should remain");
}

testDeleteLineCascadesDependents();
testDeletePointCascadesGraph();
testDeletePolygonCascadesOwnedEdges();
testDeletePolygonKeepsSharedOwnedEdges();
testDeleteSectorCascadesOwnedEdges();
testDeleteSectorKeepsSharedOwnedEdges();
console.log("geometry-graph-delete-regression: ok");
