import { distance } from "../../geo/geometry";
import type { SceneNumberDefinition } from "../points";
import { evalNumberDefinitionWithOps } from "./numberDefinitions";
import { computeOrientedAngleRad } from "./angleMath";

export function evalNumberDefinitionInScene(
  def: SceneNumberDefinition,
  runtime: {
    getPointWorldById: (id: string) => { x: number; y: number } | null;
    getSegmentById: (id: string) => { aId: string; bId: string } | null;
    getCircleRadiusById: (id: string) => number | null;
    getAngleById: (id: string) => { aId: string; bId: string; cId: string } | null;
    evaluateNumberExpression: (expr: string, excludeNumberId?: string) => number | null;
    evalNumberById: (id: string) => number | null;
  },
  selfNumberId?: string
): number | null {
  return evalNumberDefinitionWithOps(
    def,
    {
      getPointWorldById: runtime.getPointWorldById,
      getSegmentById: runtime.getSegmentById,
      getCircleRadiusById: runtime.getCircleRadiusById,
      getAngleById: runtime.getAngleById,
      evaluateNumberExpression: runtime.evaluateNumberExpression,
      evalNumberById: runtime.evalNumberById,
      computeOrientedAngleRad,
      distance,
    },
    selfNumberId
  );
}

