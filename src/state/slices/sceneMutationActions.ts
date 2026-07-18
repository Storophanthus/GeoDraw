import type { Vec2 } from "../../geo/vec2";
import { projectPointToCircle, projectPointToLine, projectPointToSegment } from "../../geo/geometry";
import { getCircleWorldGeometry, getLineWorldAnchors, getPointWorldPos, type AngleStyle, type CircleStyle, type LineStyle, type PathArrowMark, type PointStyle, type PolygonStyle, type SceneModel, type SegmentArrowMark } from "../../scene/points";
import {
  defaultCircleLabelPosWorld,
  defaultCircleLabelText,
  defaultEllipseLabelPosWorld,
  defaultEllipseLabelText,
  defaultLineLabelPosWorld,
  defaultLineLabelText,
  defaultPolygonLabelPosWorld,
  defaultPolygonLabelText,
  defaultSegmentLabelPosWorld,
  defaultSegmentLabelText,
  isFiniteLabelPosWorld,
  resolveObjectLabelText,
} from "../../scene/objectLabels";
import { geometryLayerKey, moveGeometryLayerWithinTab } from "../../scene/geometryLayerOrder";
import { applyDeletion, collectCascadeDeleteMany, isSelectedObjectAlive } from "../../domain/geometryGraph";
import { isValidNumberDefinition } from "../../domain/numberDefinitions";
import { rebuildRightAngleProvenance, registerSegmentPair } from "../../domain/rightAngleProvenance";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";

type SetState = (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;

export function createSceneMutationActions({
  setState,
}: {
  setState: SetState;
}): Pick<
  GeoActions,
  | "movePointTo"
  | "movePolygonByWorldDelta"
  | "movePointLabelBy"
  | "moveAngleLabelTo"
  | "moveObjectLabelTo"
  | "moveTextLabelTo"
  | "moveTextLabelByWorldDelta"
  | "enableObjectLabel"
  | "updateSelectedPointStyle"
  | "updateSelectedPointFields"
  | "updatePointStyleByIds"
  | "updatePointFieldsByIds"
  | "updateSelectedSegmentStyle"
  | "updateSegmentStyleByIds"
  | "updateSelectedLineStyle"
  | "updateLineStyleByIds"
  | "updateSelectedCircleStyle"
  | "updateCircleStyleByIds"
  | "updateSelectedEllipseStyle"
  | "updateEllipseStyleByIds"
  | "updateSelectedPolygonStyle"
  | "updatePolygonStyleByIds"
  | "updateSelectedAngleStyle"
  | "updateAngleStyleByIds"
  | "updateSelectedSegmentFields"
  | "updateSegmentFieldsByIds"
  | "updateSelectedLineFields"
  | "convertSelectedLineToSegment"
  | "convertLinesToSegmentsByIds"
  | "updateLineFieldsByIds"
  | "updateSelectedCircleFields"
  | "updateCircleFieldsByIds"
  | "updateSelectedEllipseFields"
  | "updateEllipseFieldsByIds"
  | "updateSelectedPolygonFields"
  | "updatePolygonFieldsByIds"
  | "setSelectedPolygonOwnedSegmentsVisible"
  | "updateSelectedAngleFields"
  | "updateAngleFieldsByIds"
  | "updateSelectedNumberDefinition"
  | "updateSelectedTextLabelFields"
  | "updateTextLabelFieldsByIds"
  | "updateSelectedTextLabelStyle"
  | "updateTextLabelStyleByIds"
  | "moveRichTextNodeTo"
  | "moveRichTextNodeByWorldDelta"
  | "updateSelectedRichTextFields"
  | "updateRichTextFieldsByIds"
  | "updateSelectedRichTextStyle"
  | "updateRichTextStyleByIds"
  | "updateSelectedRichTextDocument"
  | "updateRichTextDocumentByIds"
  | "setObjectVisibility"
  | "setObjectsVisibility"
  | "reorderGeometryLayerInTab"
  | "deleteSelectedObject"
  | "deleteObjects"
  | "setCopyStyleSource"
  | "applyCopyStyleTo"
  | "applyCopyStyleToMany"
  | "clearCopyStyle"
> {
  return {
    movePointTo(id, world) {
      setState((prev) => {
        const nextPoints = prev.scene.points.map((point) =>
          point.id === id ? movePointToWorldInScene(point, world, prev.scene) : point
        );
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: nextPoints,
          },
        };
      }, { history: "coalesce", actionKey: `movePointTo:${id}` });
    },

    movePolygonByWorldDelta(id, deltaWorld) {
      if (!Number.isFinite(deltaWorld.x) || !Number.isFinite(deltaWorld.y)) return;
      if (Math.abs(deltaWorld.x) <= 1e-12 && Math.abs(deltaWorld.y) <= 1e-12) return;
      setState((prev) => {
        const polygon = prev.scene.polygons.find((item) => item.id === id);
        if (!polygon) return prev;

        const targetByPointId = new Map<string, Vec2>();
        for (const pointId of new Set(polygon.pointIds)) {
          const world = getPointWorldById(prev.scene, pointId);
          if (!world) continue;
          targetByPointId.set(pointId, {
            x: world.x + deltaWorld.x,
            y: world.y + deltaWorld.y,
          });
        }
        if (targetByPointId.size === 0) return prev;

        let movedAnyPoint = false;
        const nextPoints = prev.scene.points.map((point) => {
          const target = targetByPointId.get(point.id);
          if (!target) return point;
          const nextPoint = movePointToWorldInScene(point, target, prev.scene);
          if (nextPoint !== point) movedAnyPoint = true;
          return nextPoint;
        });

        const nextPolygons = prev.scene.polygons.map((polygonItem) => {
          if (polygonItem.id !== id || !polygonItem.labelPosWorld) return polygonItem;
          return {
            ...polygonItem,
            labelPosWorld: {
              x: polygonItem.labelPosWorld.x + deltaWorld.x,
              y: polygonItem.labelPosWorld.y + deltaWorld.y,
            },
          };
        });

        if (!movedAnyPoint && nextPolygons === prev.scene.polygons) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: nextPoints,
            polygons: nextPolygons,
          },
        };
      }, { history: "coalesce", actionKey: `movePolygonByWorldDelta:${id}` });
    },

    movePointLabelBy(id, deltaPx) {
      setState((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          points: prev.scene.points.map((point) =>
            point.id === id
              ? {
                  ...point,
                  style: {
                    ...point.style,
                    labelOffsetPx: {
                      x: point.style.labelOffsetPx.x + deltaPx.x,
                      y: point.style.labelOffsetPx.y + deltaPx.y,
                    },
                  },
                }
              : point
          ),
        },
      }), { history: "coalesce", actionKey: `movePointLabelBy:${id}` });
    },

    moveAngleLabelTo(id, world) {
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            angles: prev.scene.angles.map((angle) =>
              angle.id === id
                ? {
                    ...angle,
                    style: {
                      ...angle.style,
                      labelPosWorld: { x: world.x, y: world.y },
                    },
                  }
                : angle
            ),
          },
        }),
        { history: "coalesce", actionKey: `moveAngleLabelTo:${id}` }
      );
    },

    moveObjectLabelTo(obj, world) {
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
      if (obj.type === "angle") {
        setState(
          (prev) => ({
            ...prev,
            scene: {
              ...prev.scene,
              angles: prev.scene.angles.map((angle) =>
                angle.id === obj.id
                  ? {
                      ...angle,
                      style: {
                        ...angle.style,
                        labelPosWorld: { x: world.x, y: world.y },
                      },
                    }
                  : angle
              ),
            },
          }),
          { history: "coalesce", actionKey: `moveObjectLabelTo:angle:${obj.id}` }
        );
        return;
      }

      setState(
        (prev) => {
          if (obj.type === "segment") {
            return {
              ...prev,
              scene: {
                ...prev.scene,
                segments: prev.scene.segments.map((segment) =>
                  segment.id === obj.id ? { ...segment, labelPosWorld: { x: world.x, y: world.y } } : segment
                ),
              },
            };
          }
          if (obj.type === "line") {
            return {
              ...prev,
              scene: {
                ...prev.scene,
                lines: prev.scene.lines.map((line) =>
                  line.id === obj.id ? { ...line, labelPosWorld: { x: world.x, y: world.y } } : line
                ),
              },
            };
          }
          if (obj.type === "circle") {
            return {
              ...prev,
              scene: {
                ...prev.scene,
                circles: prev.scene.circles.map((circle) =>
                  circle.id === obj.id ? { ...circle, labelPosWorld: { x: world.x, y: world.y } } : circle
                ),
              },
            };
          }
          if (obj.type === "ellipse") {
            return {
              ...prev,
              scene: {
                ...prev.scene,
                ellipses: (prev.scene.ellipses ?? []).map((ellipse) =>
                  ellipse.id === obj.id ? { ...ellipse, labelPosWorld: { x: world.x, y: world.y } } : ellipse
                ),
              },
            };
          }
          if (obj.type === "polygon") {
            return {
              ...prev,
              scene: {
                ...prev.scene,
                polygons: prev.scene.polygons.map((polygon) =>
                  polygon.id === obj.id ? { ...polygon, labelPosWorld: { x: world.x, y: world.y } } : polygon
                ),
              },
            };
          }
          return prev;
        },
        { history: "coalesce", actionKey: `moveObjectLabelTo:${obj.type}:${obj.id}` }
      );
    },

    moveTextLabelTo(id, world) {
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: (prev.scene.textLabels ?? []).map((label) =>
              label.id === id ? { ...label, positionWorld: { x: world.x, y: world.y } } : label
            ),
          },
        }),
        { history: "coalesce", actionKey: `moveTextLabelTo:${id}` }
      );
    },



    moveRichTextNodeTo(id, world) {
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
              node.id === id ? { ...node, positionWorld: { x: world.x, y: world.y } } : node
            ),
          },
        }),
        { history: "coalesce", actionKey: `moveRichTextNodeTo:${id}` }
      );
    },

    moveRichTextNodeByWorldDelta(id, deltaWorld) {
      if (!Number.isFinite(deltaWorld.x) || !Number.isFinite(deltaWorld.y)) return;
      if (Math.abs(deltaWorld.x) <= 1e-12 && Math.abs(deltaWorld.y) <= 1e-12) return;
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
              node.id === id
                ? {
                    ...node,
                    positionWorld: {
                      x: node.positionWorld.x + deltaWorld.x,
                      y: node.positionWorld.y + deltaWorld.y,
                    },
                  }
                : node
            ),
          },
        }),
        { history: "coalesce", actionKey: `moveRichTextNodeTo:${id}` }
      );
    },

    updateSelectedRichTextFields(next) {
      setState(
        (prev) => {
          if (!prev.selectedObject || prev.selectedObject.type !== "richText") return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
                node.id === prev.selectedObject!.id ? { ...node, ...next } : node
              ),
            },
          };
        },
        { history: "coalesce", actionKey: "updateSelectedRichTextFields" }
      );
    },

    updateRichTextFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
              idSet.has(node.id) ? { ...node, ...next } : node
            ),
          },
        }),
        { history: "coalesce", actionKey: "updateRichTextFieldsByIds" }
      );
    },

    updateSelectedRichTextStyle(next) {
      setState(
        (prev) => {
          if (!prev.selectedObject || prev.selectedObject.type !== "richText") return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
                node.id === prev.selectedObject!.id ? { ...node, style: { ...node.style, ...next } } : node
              ),
            },
          };
        },
        { history: "coalesce", actionKey: "updateSelectedRichTextStyle" }
      );
    },

    updateRichTextStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
              idSet.has(node.id) ? { ...node, style: { ...node.style, ...next } } : node
            ),
          },
        }),
        { history: "coalesce", actionKey: "updateRichTextStyleByIds" }
      );
    },

    updateSelectedRichTextDocument(document) {
      setState(
        (prev) => {
          if (!prev.selectedObject || prev.selectedObject.type !== "richText") return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
                node.id === prev.selectedObject!.id ? { ...node, document } : node
              ),
            },
          };
        },
        { history: "coalesce", actionKey: "updateSelectedRichTextDocument" }
      );
    },

    updateRichTextDocumentByIds(ids, document) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: (prev.scene.richTextNodes ?? []).map((node) =>
              idSet.has(node.id) ? { ...node, document } : node
            ),
          },
        }),
        { history: "coalesce", actionKey: "updateRichTextDocumentByIds" }
      );
    },

    moveTextLabelByWorldDelta(id, deltaWorld) {
      if (!Number.isFinite(deltaWorld.x) || !Number.isFinite(deltaWorld.y)) return;
      if (Math.abs(deltaWorld.x) <= 1e-12 && Math.abs(deltaWorld.y) <= 1e-12) return;
      setState(
        (prev) => ({
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: (prev.scene.textLabels ?? []).map((label) =>
              label.id === id
                ? {
                    ...label,
                    positionWorld: {
                      x: label.positionWorld.x + deltaWorld.x,
                      y: label.positionWorld.y + deltaWorld.y,
                    },
                  }
                : label
            ),
          },
        }),
        { history: "coalesce", actionKey: `moveTextLabelTo:${id}` }
      );
    },

    enableObjectLabel(obj) {
      setState((prev) => {
        if (obj.type === "point") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              points: prev.scene.points.map((point) => {
                if (point.id !== obj.id) return point;
                if (point.showLabel !== "none") return point;
                return { ...point, showLabel: "name" };
              }),
            },
          };
        }
        if (obj.type === "angle") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              angles: prev.scene.angles.map((angle) =>
                angle.id === obj.id
                  ? {
                      ...angle,
                      style: {
                        ...angle.style,
                        showLabel: true,
                      },
                    }
                  : angle
              ),
            },
          };
        }
        if (obj.type === "segment") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              segments: prev.scene.segments.map((segment) => {
                if (segment.id !== obj.id) return segment;
                const withDefaults = ensureSegmentLabelFields({ ...segment, showLabel: true }, prev.scene);
                return withDefaults;
              }),
            },
          };
        }
        if (obj.type === "line") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              lines: prev.scene.lines.map((line) => {
                if (line.id !== obj.id) return line;
                const withDefaults = ensureLineLabelFields({ ...line, showLabel: true }, prev.scene);
                return withDefaults;
              }),
            },
          };
        }
        if (obj.type === "circle") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              circles: prev.scene.circles.map((circle) => {
                if (circle.id !== obj.id) return circle;
                const withDefaults = ensureCircleLabelFields({ ...circle, showLabel: true }, prev.scene);
                return withDefaults;
              }),
            },
          };
        }
        if (obj.type === "ellipse") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              ellipses: (prev.scene.ellipses ?? []).map((ellipse) => {
                if (ellipse.id !== obj.id) return ellipse;
                return ensureEllipseLabelFields({ ...ellipse, showLabel: true }, prev.scene);
              }),
            },
          };
        }
        if (obj.type === "polygon") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              polygons: prev.scene.polygons.map((polygon) => {
                if (polygon.id !== obj.id) return polygon;
                const withDefaults = ensurePolygonLabelFields({ ...polygon, showLabel: true }, prev.scene);
                return withDefaults;
              }),
            },
          };
        }
        return prev;
      });
    },

    updateSelectedPointStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "point") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: prev.scene.points.map((point) =>
              point.id === prev.selectedObject!.id
                ? {
                    ...point,
                    style: {
                      ...point.style,
                      ...next,
                    },
                  }
                : point
            ),
          },
        };
      });
    },

    updatePointStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const points = prev.scene.points.map((point) => {
          if (!idSet.has(point.id)) return point;
          changed = true;
          return {
            ...point,
            style: {
              ...point.style,
              ...next,
              labelOffsetPx: { ...point.style.labelOffsetPx },
            },
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points,
          },
        };
      });
    },

    updateSelectedPointFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "point") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: prev.scene.points.map((point) =>
              point.id === prev.selectedObject!.id
                ? {
                    ...point,
                    ...next,
                  }
                : point
            ),
          },
        };
      });
    },

    updatePointFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const points = prev.scene.points.map((point) => {
          if (!idSet.has(point.id)) return point;
          changed = true;
          return {
            ...point,
            ...next,
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points,
          },
        };
      });
    },

    updateSelectedSegmentStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "segment") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: prev.scene.segments.map((seg) =>
              seg.id === prev.selectedObject!.id ? { ...seg, style: { ...seg.style, ...next } } : seg
            ),
          },
        };
      });
    },

    updateSegmentStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const segments = prev.scene.segments.map((segment) => {
          if (!idSet.has(segment.id)) return segment;
          changed = true;
          return {
            ...segment,
            style: {
              ...segment.style,
              ...next,
            },
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments,
          },
        };
      });
    },

    updateSelectedLineStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "line") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: prev.scene.lines.map((line) =>
              line.id === prev.selectedObject!.id ? { ...line, style: { ...line.style, ...next } } : line
            ),
          },
        };
      });
    },

    updateLineStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const lines = prev.scene.lines.map((line) => {
          if (!idSet.has(line.id)) return line;
          changed = true;
          return {
            ...line,
            style: {
              ...line.style,
              ...next,
            },
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines,
          },
        };
      });
    },

    updateSelectedCircleStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "circle") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: prev.scene.circles.map((circle) =>
              circle.id === prev.selectedObject!.id ? { ...circle, style: { ...circle.style, ...next } } : circle
            ),
          },
        };
      });
    },

    updateCircleStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const circles = prev.scene.circles.map((circle) => {
          if (!idSet.has(circle.id)) return circle;
          changed = true;
          return {
            ...circle,
            style: {
              ...circle.style,
              ...next,
            },
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles,
          },
        };
      });
    },

    updateSelectedEllipseStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "ellipse") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            ellipses: (prev.scene.ellipses ?? []).map((ellipse) =>
              ellipse.id === prev.selectedObject!.id ? { ...ellipse, style: { ...ellipse.style, ...next } } : ellipse
            ),
          },
        };
      });
    },

    updateEllipseStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const ellipses = (prev.scene.ellipses ?? []).map((ellipse) => {
          if (!idSet.has(ellipse.id)) return ellipse;
          changed = true;
          return {
            ...ellipse,
            style: {
              ...ellipse.style,
              ...next,
            },
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            ellipses,
          },
        };
      });
    },

    updateSelectedPolygonStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "polygon") return prev;
        const polygonId = prev.selectedObject.id;
        const segmentStylePatch = lineStylePatchFromPolygonStrokePatch(next);
        return {
          ...prev,
          scene: {
            ...prev.scene,
            polygons: prev.scene.polygons.map((polygon) =>
              polygon.id === polygonId ? { ...polygon, style: { ...polygon.style, ...next } } : polygon
            ),
            segments:
              segmentStylePatch == null
                ? prev.scene.segments
                : prev.scene.segments.map((segment) => {
                    if (!Array.isArray(segment.ownedByPolygonIds) || !segment.ownedByPolygonIds.includes(polygonId)) {
                      return segment;
                    }
                    return {
                      ...segment,
                      style: {
                        ...segment.style,
                        ...segmentStylePatch,
                      },
                    };
                  }),
          },
        };
      });
    },

    updatePolygonStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        const segmentStylePatch = lineStylePatchFromPolygonStrokePatch(next);
        let polygonChanged = false;
        const polygons = prev.scene.polygons.map((polygon) => {
          if (!idSet.has(polygon.id)) return polygon;
          polygonChanged = true;
          return {
            ...polygon,
            style: {
              ...polygon.style,
              ...next,
            },
          };
        });
        let segmentChanged = false;
        const segments =
          segmentStylePatch == null
            ? prev.scene.segments
            : prev.scene.segments.map((segment) => {
                if (
                  !Array.isArray(segment.ownedByPolygonIds) ||
                  !segment.ownedByPolygonIds.some((ownerId) => idSet.has(ownerId))
                ) {
                  return segment;
                }
                segmentChanged = true;
                return {
                  ...segment,
                  style: {
                    ...segment.style,
                    ...segmentStylePatch,
                  },
                };
              });
        if (!polygonChanged && !segmentChanged) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            polygons,
            segments,
          },
        };
      });
    },

    updateSelectedAngleStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "angle") return prev;
        const selectedAngleId = prev.selectedObject.id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles: prev.scene.angles.map((angle) =>
              angle.id === selectedAngleId ? { ...angle, style: { ...angle.style, ...next } } : angle
            ),
          },
        };
      }, { history: "coalesce", actionKey: "updateSelectedAngleStyle" });
    },

    updateAngleStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const angles = prev.scene.angles.map((angle) => {
          if (!idSet.has(angle.id)) return angle;
          changed = true;
          return {
            ...angle,
            style: {
              ...angle.style,
              ...next,
            },
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles,
          },
        };
      }, { history: "coalesce", actionKey: "updateAngleStyleByIds" });
    },

    updateSelectedSegmentFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "segment") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: prev.scene.segments.map((seg) =>
              seg.id === prev.selectedObject!.id
                ? ensureSegmentLabelFields({ ...seg, ...next }, prev.scene)
                : seg
            ),
          },
        };
      });
    },

    updateSegmentFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const segments = prev.scene.segments.map((segment) => {
          if (!idSet.has(segment.id)) return segment;
          changed = true;
          return ensureSegmentLabelFields({ ...segment, ...next }, prev.scene);
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments,
          },
        };
      });
    },

    updateSelectedLineFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "line") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: prev.scene.lines.map((line) =>
              line.id === prev.selectedObject!.id
                ? ensureLineLabelFields({ ...line, ...next }, prev.scene)
                : line
            ),
          },
        };
      });
    },

    convertSelectedLineToSegment() {
      let createdSegmentId: string | null = null;
      let createdSegmentAId = "";
      let createdSegmentBId = "";
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "line") return prev;
        const selectedLine = prev.scene.lines.find((line) => line.id === prev.selectedObject!.id);
        if (!selectedLine) return prev;
        if (!("aId" in selectedLine) || !("bId" in selectedLine)) return prev;
        if (selectedLine.aId === selectedLine.bId) return prev;
        if (!prev.scene.points.some((point) => point.id === selectedLine.aId)) return prev;
        if (!prev.scene.points.some((point) => point.id === selectedLine.bId)) return prev;

        const nextSegmentId = `s_${prev.nextSegmentId}`;
        createdSegmentId = nextSegmentId;
        createdSegmentAId = selectedLine.aId;
        createdSegmentBId = selectedLine.bId;

        const segment = ensureSegmentLabelFields({
          id: nextSegmentId,
          aId: selectedLine.aId,
          bId: selectedLine.bId,
          visible: true,
          showLabel: Boolean(selectedLine.showLabel),
          labelText: selectedLine.labelText,
          labelPosWorld: selectedLine.labelPosWorld ? { ...selectedLine.labelPosWorld } : undefined,
          labelGlow: selectedLine.labelGlow,
          style: { ...selectedLine.style },
        }, prev.scene);

        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: prev.scene.lines.map((line) =>
              line.id === selectedLine.id
                ? { ...line, visible: false }
                : line
            ),
            segments: [...prev.scene.segments, segment],
          },
          selectedObject: { type: "segment", id: nextSegmentId },
          recentCreatedObject: { type: "segment", id: nextSegmentId },
          nextSegmentId: prev.nextSegmentId + 1,
        };
      });
      if (createdSegmentId) {
        registerSegmentPair(createdSegmentId, createdSegmentAId, createdSegmentBId);
      }
      return createdSegmentId;
    },

    convertLinesToSegmentsByIds(ids) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return [];
      const createdSegmentIds: string[] = [];
      const createdSegmentPairs: Array<{ id: string; aId: string; bId: string }> = [];
      setState((prev) => {
        const pointIdSet = new Set(prev.scene.points.map((point) => point.id));
        let nextSegmentId = prev.nextSegmentId;
        const newSegments: SceneModel["segments"] = [];
        const nextLines = prev.scene.lines.map((line) => {
          if (!idSet.has(line.id)) return line;
          if (!("aId" in line) || !("bId" in line)) return line;
          if (line.aId === line.bId) return line;
          if (!pointIdSet.has(line.aId) || !pointIdSet.has(line.bId)) return line;

          const segmentId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          createdSegmentIds.push(segmentId);
          createdSegmentPairs.push({ id: segmentId, aId: line.aId, bId: line.bId });

          newSegments.push(
            ensureSegmentLabelFields(
              {
                id: segmentId,
                aId: line.aId,
                bId: line.bId,
                visible: true,
                showLabel: Boolean(line.showLabel),
                labelText: line.labelText,
                labelPosWorld: line.labelPosWorld ? { ...line.labelPosWorld } : undefined,
                labelGlow: line.labelGlow,
                style: { ...line.style },
              },
              prev.scene
            )
          );

          return line.visible ? { ...line, visible: false } : line;
        });

        if (newSegments.length === 0) return prev;
        const firstCreatedId = createdSegmentIds[0];
        const lastCreatedId = createdSegmentIds[createdSegmentIds.length - 1];
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: nextLines,
            segments: [...prev.scene.segments, ...newSegments],
          },
          selectedObject: { type: "segment", id: firstCreatedId },
          recentCreatedObject: { type: "segment", id: lastCreatedId },
          nextSegmentId,
        };
      });
      for (let i = 0; i < createdSegmentPairs.length; i += 1) {
        const pair = createdSegmentPairs[i];
        registerSegmentPair(pair.id, pair.aId, pair.bId);
      }
      return createdSegmentIds;
    },

    updateLineFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const lines = prev.scene.lines.map((line) => {
          if (!idSet.has(line.id)) return line;
          changed = true;
          return ensureLineLabelFields({ ...line, ...next }, prev.scene);
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines,
          },
        };
      });
    },

    updateSelectedCircleFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "circle") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles: prev.scene.circles.map((circle) =>
              circle.id === prev.selectedObject!.id
                ? ensureCircleLabelFields({ ...circle, ...next }, prev.scene)
                : circle
            ),
          },
        };
      });
    },

    updateCircleFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const circles = prev.scene.circles.map((circle) => {
          if (!idSet.has(circle.id)) return circle;
          changed = true;
          return ensureCircleLabelFields({ ...circle, ...next }, prev.scene);
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            circles,
          },
        };
      });
    },

    updateSelectedEllipseFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "ellipse") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            ellipses: (prev.scene.ellipses ?? []).map((ellipse) =>
              ellipse.id === prev.selectedObject!.id
                ? ensureEllipseLabelFields({ ...ellipse, ...next }, prev.scene)
                : ellipse
            ),
          },
        };
      });
    },

    updateEllipseFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const ellipses = (prev.scene.ellipses ?? []).map((ellipse) => {
          if (!idSet.has(ellipse.id)) return ellipse;
          changed = true;
          return ensureEllipseLabelFields({ ...ellipse, ...next }, prev.scene);
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            ellipses,
          },
        };
      });
    },

    updateSelectedPolygonFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "polygon") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            polygons: prev.scene.polygons.map((polygon) =>
              polygon.id === prev.selectedObject!.id
                ? ensurePolygonLabelFields({ ...polygon, ...next }, prev.scene)
                : polygon
            ),
          },
        };
      });
    },

    updatePolygonFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const polygons = prev.scene.polygons.map((polygon) => {
          if (!idSet.has(polygon.id)) return polygon;
          changed = true;
          return ensurePolygonLabelFields({ ...polygon, ...next }, prev.scene);
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            polygons,
          },
        };
      });
    },

    setSelectedPolygonOwnedSegmentsVisible(visible) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "polygon") return prev;
        const polygonId = prev.selectedObject.id;
        let changed = false;
        const segments = prev.scene.segments.map((segment) => {
          if (!Array.isArray(segment.ownedByPolygonIds) || !segment.ownedByPolygonIds.includes(polygonId)) {
            return segment;
          }
          if (segment.visible === visible) return segment;
          changed = true;
          return {
            ...segment,
            visible,
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments,
          },
        };
      });
    },

    updateSelectedAngleFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "angle") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles: prev.scene.angles.map((angle) =>
              angle.id === prev.selectedObject!.id ? { ...angle, ...next } : angle
            ),
          },
        };
      });
    },

    updateAngleFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const angles = prev.scene.angles.map((angle) => {
          if (!idSet.has(angle.id)) return angle;
          changed = true;
          return {
            ...angle,
            ...next,
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            angles,
          },
        };
      });
    },

    updateSelectedNumberDefinition(nextDefinition) {
      setState((prev) => {
        if (prev.selectedObject?.type !== "number") return prev;
        if (!isValidNumberDefinition(nextDefinition, prev.scene)) return prev;
        let changed = false;
        const nextNumbers = prev.scene.numbers.map((num) => {
          if (num.id !== prev.selectedObject?.id) return num;
          changed = true;
          return {
            ...num,
            definition: nextDefinition,
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            numbers: nextNumbers,
          },
        };
      });
    },

    updateSelectedTextLabelFields(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "textLabel") return prev;
        let changed = false;
        const textLabels = (prev.scene.textLabels ?? []).map((label) => {
          if (label.id !== prev.selectedObject!.id) return label;
          const positionWorld = next.positionWorld
            ? { x: next.positionWorld.x, y: next.positionWorld.y }
            : label.positionWorld;
          const nextLabel = {
            ...label,
            ...next,
            positionWorld,
          };
          if (JSON.stringify(nextLabel) === JSON.stringify(label)) return label;
          changed = true;
          return nextLabel;
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels,
          },
        };
      });
    },

    updateTextLabelFieldsByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const textLabels = (prev.scene.textLabels ?? []).map((label) => {
          if (!idSet.has(label.id)) return label;
          const positionWorld = next.positionWorld
            ? { x: next.positionWorld.x, y: next.positionWorld.y }
            : label.positionWorld;
          const nextLabel = {
            ...label,
            ...next,
            positionWorld,
          };
          if (JSON.stringify(nextLabel) === JSON.stringify(label)) return label;
          changed = true;
          return nextLabel;
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels,
          },
        };
      });
    },

    updateSelectedTextLabelStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "textLabel") return prev;
        let changed = false;
        const textLabels = (prev.scene.textLabels ?? []).map((label) => {
          if (label.id !== prev.selectedObject!.id) return label;
          const nextStyle = {
            ...label.style,
            ...next,
          };
          if (JSON.stringify(nextStyle) === JSON.stringify(label.style)) return label;
          changed = true;
          return {
            ...label,
            style: nextStyle,
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels,
          },
        };
      });
    },

    updateTextLabelStyleByIds(ids, next) {
      const idSet = toIdSet(ids);
      if (idSet.size === 0) return;
      setState((prev) => {
        let changed = false;
        const textLabels = (prev.scene.textLabels ?? []).map((label) => {
          if (!idSet.has(label.id)) return label;
          const nextStyle = {
            ...label.style,
            ...next,
          };
          if (JSON.stringify(nextStyle) === JSON.stringify(label.style)) return label;
          changed = true;
          return {
            ...label,
            style: nextStyle,
          };
        });
        if (!changed) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels,
          },
        };
      });
    },

    setObjectVisibility(obj, visible) {
      setState((prev) => {
        const nextScene = applyVisibilityToScene(prev.scene, [obj], visible);
        if (nextScene === prev.scene) return prev;
        return {
          ...prev,
          scene: nextScene,
        };
      });
    },

    setObjectsVisibility(objects, visible) {
      const targets = dedupeSelectedObjects(objects);
      if (targets.length === 0) return;
      setState((prev) => {
        const nextScene = applyVisibilityToScene(prev.scene, targets, visible);
        if (nextScene === prev.scene) return prev;
        return {
          ...prev,
          scene: nextScene,
        };
      });
    },

    reorderGeometryLayerInTab(dragged, target, tab, placement) {
      setState((prev) => {
        const nextOrder = moveGeometryLayerWithinTab(prev.scene, dragged, target, tab, placement);
        const prevOrder = Array.isArray(prev.scene.geometryLayerOrder) ? prev.scene.geometryLayerOrder : [];
        const sameOrder =
          prevOrder.length === nextOrder.length &&
          prevOrder.every((ref, idx) => geometryLayerKey(ref) === geometryLayerKey(nextOrder[idx]));
        if (sameOrder) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            geometryLayerOrder: nextOrder,
          },
        };
      });
    },

    deleteSelectedObject() {
      setState((prev) => {
        if (!prev.selectedObject) return prev;
        return deleteObjectsFromState(prev, [prev.selectedObject]);
      });
    },

    deleteObjects(objects) {
      const targets = dedupeSelectedObjects(objects);
      if (targets.length === 0) return;
      setState((prev) => deleteObjectsFromState(prev, targets));
    },

    setCopyStyleSource(obj) {
      setState((prev) => {
        if (obj.type === "point") {
          const point = prev.scene.points.find((item) => item.id === obj.id);
          if (!point) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: {
                ...point.style,
                labelOffsetPx: { ...point.style.labelOffsetPx },
              },
              lineStyle: null,
              circleStyle: null,
              polygonStyle: null,
              angleStyle: null,
              textLabelStyle: null,
              richTextStyle: null,
              pointShowLabel: point.showLabel,
              objectShowLabel: null,
              objectLabelGlow: null,
            },
          };
        }

        if (obj.type === "segment") {
          const segment = prev.scene.segments.find((item) => item.id === obj.id);
          if (!segment) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: { ...segment.style },
              circleStyle: circleStyleFromLineStyle(segment.style),
              polygonStyle: polygonStyleFromLineStyle(segment.style),
              angleStyle: angleStyleFromLineStyle(segment.style),
              textLabelStyle: null,
              richTextStyle: null,
              pointShowLabel: null,
              objectShowLabel: Boolean(segment.showLabel),
              objectLabelGlow: segment.labelGlow !== false,
            },
          };
        }

        if (obj.type === "circle") {
          const circle = prev.scene.circles.find((item) => item.id === obj.id);
          if (!circle) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: lineStyleFromCircleStyle(circle.style),
              circleStyle: { ...circle.style },
              polygonStyle: polygonStyleFromCircleStyle(circle.style),
              angleStyle: angleStyleFromCircleStyle(circle.style),
              textLabelStyle: null,
              richTextStyle: null,
              pointShowLabel: null,
              objectShowLabel: Boolean(circle.showLabel),
              objectLabelGlow: circle.labelGlow !== false,
            },
          };
        }

        if (obj.type === "ellipse") {
          const ellipse = (prev.scene.ellipses ?? []).find((item) => item.id === obj.id);
          if (!ellipse) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: lineStyleFromCircleStyle(ellipse.style),
              circleStyle: { ...ellipse.style },
              polygonStyle: polygonStyleFromCircleStyle(ellipse.style),
              angleStyle: angleStyleFromCircleStyle(ellipse.style),
              textLabelStyle: null,
              richTextStyle: null,
              pointShowLabel: null,
              objectShowLabel: Boolean(ellipse.showLabel),
              objectLabelGlow: ellipse.labelGlow !== false,
            },
          };
        }

        if (obj.type === "polygon") {
          const polygon = prev.scene.polygons.find((item) => item.id === obj.id);
          if (!polygon) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: lineStyleFromPolygonStyle(polygon.style),
              circleStyle: circleStyleFromPolygonStyle(polygon.style),
              polygonStyle: { ...polygon.style },
              angleStyle: angleStyleFromCircleStyle(circleStyleFromPolygonStyle(polygon.style)),
              textLabelStyle: null,
              richTextStyle: null,
              pointShowLabel: null,
              objectShowLabel: Boolean(polygon.showLabel),
              objectLabelGlow: polygon.labelGlow !== false,
            },
          };
        }

        if (obj.type === "angle") {
          const angle = prev.scene.angles.find((item) => item.id === obj.id);
          if (!angle) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: {
                strokeColor: angle.style.strokeColor,
                strokeWidth: angle.style.strokeWidth,
                dash: "solid",
                opacity: angle.style.strokeOpacity,
              },
              circleStyle: {
                strokeColor: angle.style.strokeColor,
                strokeWidth: angle.style.strokeWidth,
                strokeDash: "solid",
                strokeOpacity: angle.style.strokeOpacity,
                fillColor: angle.style.fillColor,
                fillOpacity: angle.style.fillOpacity,
                pattern: angle.style.pattern ?? "",
                patternColor: angle.style.patternColor,
              },
              polygonStyle: {
                strokeColor: angle.style.strokeColor,
                strokeWidth: angle.style.strokeWidth,
                strokeDash: "solid",
                strokeOpacity: angle.style.strokeOpacity,
                fillColor: angle.style.fillColor,
                fillOpacity: angle.style.fillOpacity,
                pattern: angle.style.pattern ?? "",
                patternColor: angle.style.patternColor,
              },
              angleStyle: {
                ...angle.style,
                labelPosWorld: { ...angle.style.labelPosWorld },
              },
              textLabelStyle: null,
              richTextStyle: null,
              pointShowLabel: null,
              objectShowLabel: null,
              objectLabelGlow: null,
            },
          };
        }

        if (obj.type === "textLabel") {
          const textLabel = (prev.scene.textLabels ?? []).find((item) => item.id === obj.id);
          if (!textLabel) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: null,
              circleStyle: null,
              polygonStyle: null,
              angleStyle: null,
              textLabelStyle: { ...textLabel.style },
              richTextStyle: null,
              pointShowLabel: null,
              objectShowLabel: null,
              objectLabelGlow: null,
            },
          };
        }

        if (obj.type === "richText") {
          const richText = (prev.scene.richTextNodes ?? []).find((item) => item.id === obj.id);
          if (!richText) return prev;
          return {
            ...prev,
            copyStyle: {
              source: obj,
              pointStyle: null,
              lineStyle: null,
              circleStyle: null,
              polygonStyle: null,
              angleStyle: null,
              textLabelStyle: null,
              richTextStyle: { ...richText.style },
              pointShowLabel: null,
              objectShowLabel: null,
              objectLabelGlow: null,
            },
          };
        }

        if (obj.type === "number") return prev;

        const line = prev.scene.lines.find((item) => item.id === obj.id);
        if (!line) return prev;
        return {
          ...prev,
          copyStyle: {
            source: obj,
            pointStyle: null,
            lineStyle: { ...line.style },
            circleStyle: circleStyleFromLineStyle(line.style),
            polygonStyle: polygonStyleFromLineStyle(line.style),
            angleStyle: angleStyleFromLineStyle(line.style),
            textLabelStyle: null,
            richTextStyle: null,
            pointShowLabel: null,
            objectShowLabel: Boolean(line.showLabel),
            objectLabelGlow: line.labelGlow !== false,
          },
        };
      }, { history: "skip" });
    },

    applyCopyStyleTo(obj) {
      setState((prev) => {
        const nextScene = applyCopyStyleToScene(prev.scene, prev.copyStyle, obj);
        if (nextScene === prev.scene) return prev;
        return {
          ...prev,
          scene: nextScene,
        };
      });
    },

    applyCopyStyleToMany(objects) {
      const targets = dedupeSelectedObjects(objects);
      if (targets.length === 0) return;
      setState((prev) => {
        let nextScene = prev.scene;
        for (let i = 0; i < targets.length; i += 1) {
          nextScene = applyCopyStyleToScene(nextScene, prev.copyStyle, targets[i]);
        }
        if (nextScene === prev.scene) return prev;
        return {
          ...prev,
          scene: nextScene,
        };
      });
    },

    clearCopyStyle() {
      setState((prev) => ({
        ...prev,
        copyStyle: emptyCopyStyle(),
      }), { history: "skip" });
    },
  };
}

type SelectedObjectRef = Exclude<GeoState["selectedObject"], null>;

function toIdSet(ids: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    if (!id) continue;
    out.add(id);
  }
  return out;
}

function selectedObjectKey(obj: SelectedObjectRef): string {
  return `${obj.type}:${obj.id}`;
}

function dedupeSelectedObjects(objects: SelectedObjectRef[]): SelectedObjectRef[] {
  const out: SelectedObjectRef[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < objects.length; i += 1) {
    const obj = objects[i];
    const key = selectedObjectKey(obj);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(obj);
  }
  return out;
}

function emptyCopyStyle(): GeoState["copyStyle"] {
  return {
    source: null,
    pointStyle: null,
    lineStyle: null,
    circleStyle: null,
    polygonStyle: null,
    angleStyle: null,
    textLabelStyle: null,
    richTextStyle: null,
    pointShowLabel: null,
    objectShowLabel: null,
    objectLabelGlow: null,
  };
}

function applyVisibilityToScene(scene: SceneModel, objects: SelectedObjectRef[], visible: boolean): SceneModel {
  const pointIds = new Set<string>();
  const segmentIds = new Set<string>();
  const lineIds = new Set<string>();
  const circleIds = new Set<string>();
  const ellipseIds = new Set<string>();
  const polygonIds = new Set<string>();
  const angleIds = new Set<string>();
  const textLabelIds = new Set<string>();
  const richTextIds = new Set<string>();
  const numberIds = new Set<string>();
  for (let i = 0; i < objects.length; i += 1) {
    const obj = objects[i];
    if (obj.type === "point") pointIds.add(obj.id);
    else if (obj.type === "segment") segmentIds.add(obj.id);
    else if (obj.type === "line") lineIds.add(obj.id);
    else if (obj.type === "circle") circleIds.add(obj.id);
    else if (obj.type === "ellipse") ellipseIds.add(obj.id);
    else if (obj.type === "polygon") polygonIds.add(obj.id);
    else if (obj.type === "angle") angleIds.add(obj.id);
    else if (obj.type === "textLabel") textLabelIds.add(obj.id);
    else if (obj.type === "richText") richTextIds.add(obj.id);
    else numberIds.add(obj.id);
  }

  let nextScene = scene;
  if (pointIds.size > 0) {
    let changed = false;
    const points = scene.points.map((point) => {
      if (!pointIds.has(point.id) || point.visible === visible) return point;
      changed = true;
      return { ...point, visible };
    });
    if (changed) nextScene = { ...nextScene, points };
  }
  if (segmentIds.size > 0) {
    let changed = false;
    const segments = nextScene.segments.map((segment) => {
      if (!segmentIds.has(segment.id) || segment.visible === visible) return segment;
      changed = true;
      return { ...segment, visible };
    });
    if (changed) nextScene = { ...nextScene, segments };
  }
  if (lineIds.size > 0) {
    let changed = false;
    const lines = nextScene.lines.map((line) => {
      if (!lineIds.has(line.id) || line.visible === visible) return line;
      changed = true;
      return { ...line, visible };
    });
    if (changed) nextScene = { ...nextScene, lines };
  }
  if (circleIds.size > 0) {
    let changed = false;
    const circles = nextScene.circles.map((circle) => {
      if (!circleIds.has(circle.id) || circle.visible === visible) return circle;
      changed = true;
      return { ...circle, visible };
    });
    if (changed) nextScene = { ...nextScene, circles };
  }
  if (ellipseIds.size > 0) {
    let changed = false;
    const ellipses = (nextScene.ellipses ?? []).map((ellipse) => {
      if (!ellipseIds.has(ellipse.id) || ellipse.visible === visible) return ellipse;
      changed = true;
      return { ...ellipse, visible };
    });
    if (changed) nextScene = { ...nextScene, ellipses };
  }
  if (polygonIds.size > 0) {
    let changed = false;
    const polygons = nextScene.polygons.map((polygon) => {
      if (!polygonIds.has(polygon.id) || polygon.visible === visible) return polygon;
      changed = true;
      return { ...polygon, visible };
    });
    if (changed) nextScene = { ...nextScene, polygons };
  }
  if (angleIds.size > 0) {
    let changed = false;
    const angles = nextScene.angles.map((angle) => {
      if (!angleIds.has(angle.id) || angle.visible === visible) return angle;
      changed = true;
      return { ...angle, visible };
    });
    if (changed) nextScene = { ...nextScene, angles };
  }
  if (textLabelIds.size > 0) {
    let changed = false;
    const textLabels = (nextScene.textLabels ?? []).map((label) => {
      if (!textLabelIds.has(label.id) || label.visible === visible) return label;
      changed = true;
      return { ...label, visible };
    });
    if (changed) nextScene = { ...nextScene, textLabels };
  }
  if (richTextIds.size > 0) {
    let changed = false;
    const richTextNodes = (nextScene.richTextNodes ?? []).map((node) => {
      if (!richTextIds.has(node.id) || node.visible === visible) return node;
      changed = true;
      return { ...node, visible };
    });
    if (changed) nextScene = { ...nextScene, richTextNodes };
  }
  if (numberIds.size > 0) {
    let changed = false;
    const numbers = nextScene.numbers.map((num) => {
      if (!numberIds.has(num.id) || num.visible === visible) return num;
      changed = true;
      return { ...num, visible };
    });
    if (changed) nextScene = { ...nextScene, numbers };
  }

  return nextScene;
}

function deleteObjectsFromState(prev: GeoState, targets: SelectedObjectRef[]): GeoState {
  const aliveTargets: SelectedObjectRef[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    if (isSelectedObjectAlive(prev.scene, targets[i])) aliveTargets.push(targets[i]);
  }
  if (aliveTargets.length === 0) return prev;

  const deleted = collectCascadeDeleteMany(prev.scene, aliveTargets);
  if (deleted.size === 0) return prev;

  const nextScene = applyDeletion(prev.scene, deleted);
  rebuildRightAngleProvenance(nextScene);
  return {
    ...prev,
    scene: nextScene,
    selectedObject: isSelectedObjectAlive(nextScene, prev.selectedObject) ? prev.selectedObject : null,
    recentCreatedObject: isSelectedObjectAlive(nextScene, prev.recentCreatedObject) ? prev.recentCreatedObject : null,
    copyStyle: isSelectedObjectAlive(nextScene, prev.copyStyle.source) ? prev.copyStyle : emptyCopyStyle(),
  };
}

function applyCopyStyleToScene(
  scene: SceneModel,
  copyStyle: GeoState["copyStyle"],
  obj: SelectedObjectRef
): SceneModel {
  if (obj.type === "textLabel") {
    if (!copyStyle.textLabelStyle) return scene;
    let changed = false;
    const textLabels = (scene.textLabels ?? []).map((label) => {
      if (label.id !== obj.id) return label;
      changed = true;
      return {
        ...label,
        style: {
          ...label.style,
          ...copyStyle.textLabelStyle,
        },
      };
    });
    return changed ? { ...scene, textLabels } : scene;
  }

  if (obj.type === "richText") {
    if (!copyStyle.richTextStyle) return scene;
    let changed = false;
    const richTextNodes = (scene.richTextNodes ?? []).map((node) => {
      if (node.id !== obj.id) return node;
      changed = true;
      return {
        ...node,
        style: {
          ...node.style,
          ...copyStyle.richTextStyle,
        },
      };
    });
    return changed ? { ...scene, richTextNodes } : scene;
  }

  if (obj.type === "point") {
    const sourcePointStyle =
      copyStyle.pointStyle ??
      (copyStyle.lineStyle ? pointStyleFromLineStyle(copyStyle.lineStyle) : null) ??
      (copyStyle.circleStyle ? pointStyleFromCircleStyle(copyStyle.circleStyle) : null);
    if (!sourcePointStyle) return scene;
    let changed = false;
    const points = scene.points.map((point) => {
      if (point.id !== obj.id) return point;
      changed = true;
      return {
        ...point,
        showLabel: copyStyle.pointShowLabel ?? point.showLabel,
        style: {
          ...point.style,
          ...sourcePointStyle,
          labelOffsetPx: { ...point.style.labelOffsetPx },
        },
      };
    });
    return changed ? { ...scene, points } : scene;
  }

  if (obj.type === "segment") {
    const sourceLineStyle =
      copyStyle.lineStyle ??
      (copyStyle.polygonStyle ? lineStyleFromPolygonStyle(copyStyle.polygonStyle) : null) ??
      (copyStyle.circleStyle ? lineStyleFromCircleStyle(copyStyle.circleStyle) : null) ??
      (copyStyle.pointStyle ? lineStyleFromPointStyle(copyStyle.pointStyle) : null);
    if (!sourceLineStyle) return scene;
    let changed = false;
    const segments = scene.segments.map((segment) => {
      if (segment.id !== obj.id) return segment;
      changed = true;
      return {
        ...segment,
        showLabel: copyStyle.objectShowLabel ?? segment.showLabel,
        labelGlow: copyStyle.objectLabelGlow ?? segment.labelGlow,
        style: { ...segment.style, ...sourceLineStyle },
      };
    });
    return changed ? { ...scene, segments } : scene;
  }

  if (obj.type === "circle") {
    const sourceCircleStyle =
      copyStyle.circleStyle ??
      (copyStyle.polygonStyle ? circleStyleFromPolygonStyle(copyStyle.polygonStyle) : null) ??
      (copyStyle.lineStyle ? circleStyleFromLineStyle(copyStyle.lineStyle) : null) ??
      (copyStyle.pointStyle ? circleStyleFromPointStyle(copyStyle.pointStyle) : null);
    if (!sourceCircleStyle) return scene;
    let changed = false;
    const circles = scene.circles.map((circle) => {
      if (circle.id !== obj.id) return circle;
      changed = true;
      return {
        ...circle,
        showLabel: copyStyle.objectShowLabel ?? circle.showLabel,
        labelGlow: copyStyle.objectLabelGlow ?? circle.labelGlow,
        style: { ...circle.style, ...sourceCircleStyle },
      };
    });
    return changed ? { ...scene, circles } : scene;
  }

  if (obj.type === "ellipse") {
    const sourceCircleStyle =
      copyStyle.circleStyle ??
      (copyStyle.polygonStyle ? circleStyleFromPolygonStyle(copyStyle.polygonStyle) : null) ??
      (copyStyle.lineStyle ? circleStyleFromLineStyle(copyStyle.lineStyle) : null) ??
      (copyStyle.pointStyle ? circleStyleFromPointStyle(copyStyle.pointStyle) : null);
    if (!sourceCircleStyle) return scene;
    let changed = false;
    const ellipses = (scene.ellipses ?? []).map((ellipse) => {
      if (ellipse.id !== obj.id) return ellipse;
      changed = true;
      return {
        ...ellipse,
        showLabel: copyStyle.objectShowLabel ?? ellipse.showLabel,
        labelGlow: copyStyle.objectLabelGlow ?? ellipse.labelGlow,
        style: { ...ellipse.style, ...sourceCircleStyle },
      };
    });
    return changed ? { ...scene, ellipses } : scene;
  }

  if (obj.type === "polygon") {
    const sourcePolygonStyle =
      copyStyle.polygonStyle ??
      (copyStyle.circleStyle ? polygonStyleFromCircleStyle(copyStyle.circleStyle) : null) ??
      (copyStyle.lineStyle ? polygonStyleFromLineStyle(copyStyle.lineStyle) : null);
    if (!sourcePolygonStyle) return scene;
    let changed = false;
    const polygons = scene.polygons.map((polygon) => {
      if (polygon.id !== obj.id) return polygon;
      changed = true;
      return {
        ...polygon,
        showLabel: copyStyle.objectShowLabel ?? polygon.showLabel,
        labelGlow: copyStyle.objectLabelGlow ?? polygon.labelGlow,
        style: { ...polygon.style, ...sourcePolygonStyle },
      };
    });
    return changed ? { ...scene, polygons } : scene;
  }

  if (obj.type === "angle") {
    const sourceAngleStyle =
      copyStyle.angleStyle ??
      (copyStyle.polygonStyle ? angleStyleFromCircleStyle(circleStyleFromPolygonStyle(copyStyle.polygonStyle)) : null) ??
      (copyStyle.lineStyle ? angleStyleFromLineStyle(copyStyle.lineStyle) : null) ??
      (copyStyle.circleStyle ? angleStyleFromCircleStyle(copyStyle.circleStyle) : null) ??
      (copyStyle.pointStyle ? angleStyleFromPointStyle(copyStyle.pointStyle) : null);
    if (!sourceAngleStyle) return scene;
    let changed = false;
    const angles = scene.angles.map((angle) => {
      if (angle.id !== obj.id) return angle;
      changed = true;
      return {
        ...angle,
        style: {
          ...angle.style,
          ...sourceAngleStyle,
          labelPosWorld: { ...angle.style.labelPosWorld },
        },
      };
    });
    return changed ? { ...scene, angles } : scene;
  }

  if (obj.type === "number") return scene;
  const sourceLineStyle =
    copyStyle.lineStyle ??
    (copyStyle.polygonStyle ? lineStyleFromPolygonStyle(copyStyle.polygonStyle) : null) ??
    (copyStyle.circleStyle ? lineStyleFromCircleStyle(copyStyle.circleStyle) : null) ??
    (copyStyle.pointStyle ? lineStyleFromPointStyle(copyStyle.pointStyle) : null);
  if (!sourceLineStyle) return scene;
  let changed = false;
  const lines = scene.lines.map((line) => {
    if (line.id !== obj.id) return line;
    changed = true;
    return {
      ...line,
      showLabel: copyStyle.objectShowLabel ?? line.showLabel,
      labelGlow: copyStyle.objectLabelGlow ?? line.labelGlow,
      style: { ...line.style, ...sourceLineStyle },
    };
  });
  return changed ? { ...scene, lines } : scene;
}

function ensureSegmentLabelFields(
  segment: SceneModel["segments"][number],
  scene: SceneModel
): SceneModel["segments"][number] {
  const fallbackText = defaultSegmentLabelText(segment, scene);
  const labelText = resolveObjectLabelText(segment.labelText, fallbackText);
  const fallbackPos = defaultSegmentLabelPosWorld(segment, scene) ?? undefined;
  const labelPosWorld = isFiniteLabelPosWorld(segment.labelPosWorld) ? segment.labelPosWorld : fallbackPos;
  const showLabel = Boolean(segment.showLabel);
  return {
    ...segment,
    showLabel,
    labelText,
    labelPosWorld,
  };
}

function ensureLineLabelFields(
  line: SceneModel["lines"][number],
  scene: SceneModel
): SceneModel["lines"][number] {
  const fallbackText = defaultLineLabelText(line, scene);
  const labelText = resolveObjectLabelText(line.labelText, fallbackText);
  const fallbackPos = defaultLineLabelPosWorld(line, scene) ?? undefined;
  const labelPosWorld = isFiniteLabelPosWorld(line.labelPosWorld) ? line.labelPosWorld : fallbackPos;
  return {
    ...line,
    showLabel: Boolean(line.showLabel),
    labelText,
    labelPosWorld,
  };
}

function ensureCircleLabelFields(
  circle: SceneModel["circles"][number],
  scene: SceneModel
): SceneModel["circles"][number] {
  const fallbackText = defaultCircleLabelText(circle, scene);
  const labelText = resolveObjectLabelText(circle.labelText, fallbackText);
  const fallbackPos = defaultCircleLabelPosWorld(circle, scene) ?? undefined;
  const labelPosWorld = isFiniteLabelPosWorld(circle.labelPosWorld) ? circle.labelPosWorld : fallbackPos;
  return {
    ...circle,
    showLabel: Boolean(circle.showLabel),
    labelText,
    labelPosWorld,
  };
}

function ensureEllipseLabelFields(
  ellipse: NonNullable<SceneModel["ellipses"]>[number],
  scene: SceneModel
): NonNullable<SceneModel["ellipses"]>[number] {
  const fallbackText = defaultEllipseLabelText(ellipse, scene);
  const labelText = resolveObjectLabelText(ellipse.labelText, fallbackText);
  const fallbackPos = defaultEllipseLabelPosWorld(ellipse, scene) ?? undefined;
  const labelPosWorld = isFiniteLabelPosWorld(ellipse.labelPosWorld) ? ellipse.labelPosWorld : fallbackPos;
  return {
    ...ellipse,
    showLabel: Boolean(ellipse.showLabel),
    labelText,
    labelPosWorld,
  };
}

function ensurePolygonLabelFields(
  polygon: SceneModel["polygons"][number],
  scene: SceneModel
): SceneModel["polygons"][number] {
  const fallbackText = defaultPolygonLabelText(polygon, scene);
  const labelText = resolveObjectLabelText(polygon.labelText, fallbackText);
  const fallbackPos = defaultPolygonLabelPosWorld(polygon, scene) ?? undefined;
  const labelPosWorld = isFiniteLabelPosWorld(polygon.labelPosWorld) ? polygon.labelPosWorld : fallbackPos;
  return {
    ...polygon,
    showLabel: Boolean(polygon.showLabel),
    labelText,
    labelPosWorld,
  };
}

function getPointWorldById(scene: SceneModel, pointId: string): Vec2 | null {
  const point = scene.points.find((p) => p.id === pointId);
  if (!point) return null;
  return getPointWorldPos(point, scene);
}

function movePointToWorldInScene(
  point: SceneModel["points"][number],
  world: Vec2,
  scene: SceneModel
): SceneModel["points"][number] {
  if (point.locked) return point;
  if (point.kind === "free") return { ...point, position: world };

  if (point.kind === "pointOnLine") {
    const line = scene.lines.find((item) => item.id === point.lineId);
    if (!line) return point;
    const anchors = getLineWorldAnchors(line, scene);
    if (!anchors) return point;
    const pr = projectPointToLine(world, anchors.a, anchors.b);
    return { ...point, s: pr.s };
  }

  if (point.kind === "pointOnSegment") {
    const seg = scene.segments.find((item) => item.id === point.segId);
    if (!seg) return point;
    const a = getPointWorldById(scene, seg.aId);
    const b = getPointWorldById(scene, seg.bId);
    if (!a || !b) return point;
    const pr = projectPointToSegment(world, a, b);
    return { ...point, u: pr.u };
  }

  if (point.kind === "pointOnCircle") {
    const circle = scene.circles.find((item) => item.id === point.circleId);
    if (!circle) return point;
    const geom = getCircleWorldGeometry(circle, scene);
    if (!geom) return point;
    const pr = projectPointToCircle(world, geom.center, geom.radius);
    const nextT = clampPointOnCircleToSectorArc(pr.t, point, scene, geom.center);
    return { ...point, t: nextT };
  }

  return point;
}

function clampPointOnCircleToSectorArc(
  t: number,
  point: SceneModel["points"][number],
  scene: SceneModel,
  circleCenter: Vec2
): number {
  if (point.kind !== "pointOnCircle" || !point.sectorArcId) return t;
  const sector = scene.angles.find((angle) => angle.id === point.sectorArcId && angle.kind === "sector");
  if (!sector) return t;
  const centerWorld = getPointWorldById(scene, sector.bId);
  const startWorld = getPointWorldById(scene, sector.aId);
  const endWorld = getPointWorldById(scene, sector.cId);
  if (!centerWorld || !startWorld || !endWorld) return t;
  // Ensure the sector still shares the same supporting circle center.
  if (Math.hypot(centerWorld.x - circleCenter.x, centerWorld.y - circleCenter.y) > 1e-6) return t;
  const start = Math.atan2(startWorld.y - centerWorld.y, startWorld.x - centerWorld.x);
  const end = Math.atan2(endWorld.y - centerWorld.y, endWorld.x - centerWorld.x);
  const sweep = normalizeAngleRad(end - start);
  if (!Number.isFinite(sweep)) return t;
  const rel = normalizeAngleRad(t - start);
  const clampedRel = Math.max(0, Math.min(rel, sweep));
  return start + clampedRel;
}

function normalizeAngleRad(value: number): number {
  const full = Math.PI * 2;
  let out = value;
  while (out < 0) out += full;
  while (out >= full) out -= full;
  return out;
}

function circleStyleFromLineStyle(style: LineStyle): CircleStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: style.dash,
    strokeOpacity: style.opacity,
    arrowMark: pathArrowMarkFromSegmentArrow(style.segmentArrowMark),
  };
}

function polygonStyleFromLineStyle(style: LineStyle): PolygonStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: style.dash,
    strokeOpacity: style.opacity,
    arrowMark: pathArrowMarkFromSegmentArrow(style.segmentArrowMark),
  };
}

function lineStylePatchFromPolygonStrokePatch(next: Partial<PolygonStyle>): Partial<LineStyle> | null {
  let changed = false;
  const patch: Partial<LineStyle> = {};
  if (next.strokeColor !== undefined) {
    patch.strokeColor = next.strokeColor;
    changed = true;
  }
  if (next.strokeWidth !== undefined) {
    patch.strokeWidth = next.strokeWidth;
    changed = true;
  }
  if (next.strokeDash !== undefined) {
    patch.dash = next.strokeDash;
    changed = true;
  }
  if (next.strokeOpacity !== undefined) {
    patch.opacity = next.strokeOpacity;
    changed = true;
  }
  if (next.arrowMark !== undefined) {
    patch.segmentArrowMark = segmentArrowMarkFromPathArrow(next.arrowMark, "mid");
    changed = true;
  }
  return changed ? patch : null;
}

function lineStyleFromCircleStyle(style: CircleStyle): LineStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: style.strokeDash,
    opacity: style.strokeOpacity,
    segmentArrowMark: segmentArrowMarkFromPathArrow(style.arrowMark, "mid"),
  };
}

function lineStyleFromPolygonStyle(style: PolygonStyle): LineStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: style.strokeDash,
    opacity: style.strokeOpacity,
    segmentArrowMark: segmentArrowMarkFromPathArrow(style.arrowMark, "mid"),
  };
}

function circleStyleFromPolygonStyle(style: PolygonStyle): CircleStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: style.strokeDash,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    pattern: style.pattern,
    patternColor: style.patternColor,
    arrowMark: style.arrowMark ? { ...style.arrowMark } : undefined,
  };
}

function polygonStyleFromCircleStyle(style: CircleStyle): PolygonStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: style.strokeDash,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    pattern: style.pattern,
    patternColor: style.patternColor,
    arrowMark: style.arrowMark ? { ...style.arrowMark } : undefined,
  };
}

function lineStyleFromPointStyle(style: PointStyle): LineStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: "solid",
    opacity: style.strokeOpacity,
  };
}

function circleStyleFromPointStyle(style: PointStyle): CircleStyle {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeDash: "solid",
    strokeOpacity: style.strokeOpacity,
    arrowMark: undefined,
  };
}

function pointStyleFromLineStyle(style: LineStyle): Partial<PointStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.opacity,
    fillColor: style.strokeColor,
    fillOpacity: style.opacity,
  };
}

function pointStyleFromCircleStyle(style: CircleStyle): Partial<PointStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor ?? style.strokeColor,
    fillOpacity: style.fillOpacity ?? style.strokeOpacity,
  };
}

function angleStyleFromLineStyle(style: LineStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.opacity,
    arcArrowMark: pathArrowMarkFromSegmentArrow(style.segmentArrowMark),
  };
}

function angleStyleFromCircleStyle(style: CircleStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    fillColor: style.fillColor ?? style.strokeColor,
    fillOpacity: style.fillOpacity ?? style.strokeOpacity,
    pattern: style.pattern ?? "",
    patternColor: style.patternColor,
    arcArrowMark: style.arrowMark ? { ...style.arrowMark } : undefined,
  };
}

function angleStyleFromPointStyle(style: PointStyle): Partial<AngleStyle> {
  return {
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
    textColor: style.labelColor,
    textSize: style.labelFontPx,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
  };
}

function pathArrowMarkFromSegmentArrow(arrow: LineStyle["segmentArrowMark"] | undefined): PathArrowMark | undefined {
  if (!arrow) return undefined;
  const { enabled, direction, tip, pos, distribution, startPos, endPos, step, sizeScale, color, lineWidthPt, pairGapPx } = arrow;
  return { enabled, direction, tip, pos, distribution, startPos, endPos, step, sizeScale, color, lineWidthPt, pairGapPx };
}

function segmentArrowMarkFromPathArrow(
  arrow: CircleStyle["arrowMark"] | PolygonStyle["arrowMark"] | undefined,
  mode: SegmentArrowMark["mode"]
): SegmentArrowMark | undefined {
  if (!arrow) return undefined;
  const { enabled, direction, tip, pos, distribution, startPos, endPos, step, sizeScale, color, lineWidthPt, pairGapPx } = arrow;
  return {
    enabled,
    mode,
    direction,
    tip,
    pos,
    distribution,
    startPos,
    endPos,
    step,
    sizeScale,
    color,
    lineWidthPt,
    pairGapPx,
  };
}
