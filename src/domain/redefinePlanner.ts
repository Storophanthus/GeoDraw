import type { Command } from "../CommandParser";
import type { SceneModel } from "../scene/points";

export type CommandAliasTarget = {
  type: "point" | "segment" | "line" | "circle" | "polygon" | "angle";
  id: string;
};

type RedefinePlanOk = {
  ok: true;
  objectType: CommandAliasTarget["type"];
};

type RedefinePlanErr = {
  ok: false;
  error: string;
};

export type RedefinePlan = RedefinePlanOk | RedefinePlanErr;

function hasPoint(scene: SceneModel, id: string): boolean {
  return scene.points.some((p) => p.id === id);
}

function hasLineLike(scene: SceneModel, ref: { type: "line" | "segment"; id: string }): boolean {
  return ref.type === "line"
    ? scene.lines.some((l) => l.id === ref.id)
    : scene.segments.some((s) => s.id === ref.id);
}

export function planAliasRedefine(
  scene: SceneModel,
  label: string,
  target: CommandAliasTarget,
  cmd: Command
): RedefinePlan {
  if (target.type === "point") {
    if (cmd.type !== "CreatePointXY") return { ok: false, error: `Cannot redefine point ${label} with this command` };
    const point = scene.points.find((p) => p.id === target.id);
    if (!point || point.kind !== "free" || point.locked) return { ok: false, error: `Cannot redefine point ${label}` };
    return { ok: true, objectType: "point" };
  }

  if (target.type === "line") {
    const line = scene.lines.find((l) => l.id === target.id);
    if (!line) return { ok: false, error: `Cannot redefine line ${label}` };
    if (cmd.type === "CreateLineByPoints") {
      if (!hasPoint(scene, cmd.aId) || !hasPoint(scene, cmd.bId)) return { ok: false, error: `Cannot redefine line ${label} with this command` };
      return { ok: true, objectType: "line" };
    }
    if (cmd.type === "CreatePerpendicularLine" || cmd.type === "CreateParallelLine") {
      if (!hasPoint(scene, cmd.throughId) || !hasLineLike(scene, cmd.base)) return { ok: false, error: `Cannot redefine line ${label} with this command` };
      return { ok: true, objectType: "line" };
    }
    if (cmd.type === "CreateAngleBisector") {
      if (!hasPoint(scene, cmd.aId) || !hasPoint(scene, cmd.bId) || !hasPoint(scene, cmd.cId)) {
        return { ok: false, error: `Cannot redefine line ${label} with this command` };
      }
      return { ok: true, objectType: "line" };
    }
    return { ok: false, error: `Cannot redefine line ${label} with this command` };
  }

  if (target.type === "segment") {
    if (cmd.type !== "CreateSegmentByPoints") return { ok: false, error: `Cannot redefine segment ${label} with this command` };
    const seg = scene.segments.find((s) => s.id === target.id);
    if (!seg) return { ok: false, error: `Cannot redefine segment ${label}` };
    if (
      (Array.isArray(seg.ownedByPolygonIds) && seg.ownedByPolygonIds.length > 0) ||
      (Array.isArray(seg.ownedBySectorIds) && seg.ownedBySectorIds.length > 0)
    ) {
      return { ok: false, error: `Cannot redefine segment ${label}` };
    }
    if (!hasPoint(scene, cmd.aId) || !hasPoint(scene, cmd.bId)) return { ok: false, error: `Cannot redefine segment ${label}` };
    return { ok: true, objectType: "segment" };
  }

  if (target.type === "circle") {
    const circle = scene.circles.find((c) => c.id === target.id);
    if (!circle) return { ok: false, error: `Cannot redefine circle ${label}` };
    if (cmd.type === "CreateCircleCenterThrough") {
      if (!hasPoint(scene, cmd.centerId) || !hasPoint(scene, cmd.throughId)) {
        return { ok: false, error: `Cannot redefine circle ${label} with this command` };
      }
      return { ok: true, objectType: "circle" };
    }
    if (cmd.type === "CreateCircleCenterRadius") {
      if (!hasPoint(scene, cmd.centerId) || !(cmd.r > 0)) return { ok: false, error: `Cannot redefine circle ${label} with this command` };
      return { ok: true, objectType: "circle" };
    }
    if (cmd.type === "CreateCircleThreePoint") {
      if (!hasPoint(scene, cmd.aId) || !hasPoint(scene, cmd.bId) || !hasPoint(scene, cmd.cId)) {
        return { ok: false, error: `Cannot redefine circle ${label} with this command` };
      }
      return { ok: true, objectType: "circle" };
    }
    return { ok: false, error: `Cannot redefine circle ${label} with this command` };
  }

  if (target.type === "polygon") {
    if (cmd.type !== "CreatePolygonByPoints") return { ok: false, error: `Cannot redefine polygon ${label} with this command` };
    if (!scene.polygons.some((p) => p.id === target.id)) return { ok: false, error: `Cannot redefine polygon ${label}` };
    const unique = Array.from(new Set(cmd.pointIds));
    if (unique.length < 3) return { ok: false, error: `Cannot redefine polygon ${label}` };
    if (unique.some((id) => !hasPoint(scene, id))) return { ok: false, error: `Cannot redefine polygon ${label}` };
    return { ok: true, objectType: "polygon" };
  }

  if (target.type === "angle") {
    if (!scene.angles.some((a) => a.id === target.id)) return { ok: false, error: `Cannot redefine angle ${label}` };
    if (cmd.type === "CreateAngle") {
      if (!hasPoint(scene, cmd.aId) || !hasPoint(scene, cmd.bId) || !hasPoint(scene, cmd.cId)) {
        return { ok: false, error: `Cannot redefine angle ${label} with this command` };
      }
      return { ok: true, objectType: "angle" };
    }
    if (cmd.type === "CreateSector") {
      if (!hasPoint(scene, cmd.centerId) || !hasPoint(scene, cmd.startId) || !hasPoint(scene, cmd.endId)) {
        return { ok: false, error: `Cannot redefine angle ${label} with this command` };
      }
      return { ok: true, objectType: "angle" };
    }
    return { ok: false, error: `Cannot redefine angle ${label} with this command` };
  }

  return { ok: false, error: `Cannot redefine alias ${label}` };
}
