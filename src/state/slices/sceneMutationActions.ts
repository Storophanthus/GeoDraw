import type { Vec2 } from "../../geo/vec2";
import { projectPointToCircle, projectPointToLine, projectPointToSegment } from "../../geo/geometry";
import { getCircleWorldGeometry, getLineWorldAnchors, getPointWorldPos, type AngleStyle, type CircleStyle, type LineStyle, type PathArrowMark, type PointStyle, type PolygonStyle, type SceneModel, type SegmentArrowMark } from "../../scene/points";
import {
  defaultCircleLabelPosWorld,
  defaultCircleLabelText,
  defaultLineLabelPosWorld,
  defaultLineLabelText,
  defaultPolygonLabelPosWorld,
  defaultPolygonLabelText,
  defaultSegmentLabelPosWorld,
  defaultSegmentLabelText,
  isFiniteLabelPosWorld,
  resolveObjectLabelText,
} from "../../scene/objectLabels";
import { applyDeletion, collectCascadeDelete, isSelectedObjectAlive } from "../../domain/geometryGraph";
import { isValidNumberDefinition } from "../../domain/numberDefinitions";
import { rebuildRightAngleProvenance } from "../../domain/rightAngleProvenance";
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
  | "updateSelectedSegmentStyle"
  | "updateSelectedLineStyle"
  | "updateSelectedCircleStyle"
  | "updateSelectedPolygonStyle"
  | "updateSelectedAngleStyle"
  | "updateSelectedSegmentFields"
  | "updateSelectedLineFields"
  | "updateSelectedCircleFields"
  | "updateSelectedPolygonFields"
  | "setSelectedPolygonOwnedSegmentsVisible"
  | "updateSelectedAngleFields"
  | "updateSelectedNumberDefinition"
  | "updateSelectedTextLabelFields"
  | "updateSelectedTextLabelStyle"
  | "setObjectVisibility"
  | "deleteSelectedObject"
  | "setCopyStyleSource"
  | "applyCopyStyleTo"
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
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: (prev.scene.textLabels ?? []).map((label) =>
              label.id === prev.selectedObject!.id
                ? {
                    ...label,
                    ...next,
                    positionWorld: next.positionWorld
                      ? { x: next.positionWorld.x, y: next.positionWorld.y }
                      : label.positionWorld,
                  }
                : label
            ),
          },
        };
      });
    },

    updateSelectedTextLabelStyle(next) {
      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "textLabel") return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: (prev.scene.textLabels ?? []).map((label) =>
              label.id === prev.selectedObject!.id
                ? {
                    ...label,
                    style: {
                      ...label.style,
                      ...next,
                    },
                  }
                : label
            ),
          },
        };
      });
    },

    setObjectVisibility(obj, visible) {
      setState((prev) => {
        if (obj.type === "point") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              points: prev.scene.points.map((point) =>
                point.id === obj.id ? { ...point, visible } : point
              ),
            },
          };
        }
        if (obj.type === "segment") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              segments: prev.scene.segments.map((seg) =>
                seg.id === obj.id ? { ...seg, visible } : seg
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
                line.id === obj.id ? { ...line, visible } : line
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
                circle.id === obj.id ? { ...circle, visible } : circle
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
                polygon.id === obj.id ? { ...polygon, visible } : polygon
              ),
            },
          };
        }
        if (obj.type === "angle") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              angles: prev.scene.angles.map((angle) =>
                angle.id === obj.id ? { ...angle, visible } : angle
              ),
            },
          };
        }
        if (obj.type === "textLabel") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              textLabels: (prev.scene.textLabels ?? []).map((label) =>
                label.id === obj.id ? { ...label, visible } : label
              ),
            },
          };
        }
        if (obj.type === "number") {
          return {
            ...prev,
            scene: {
              ...prev.scene,
              numbers: prev.scene.numbers.map((num) =>
                num.id === obj.id ? { ...num, visible } : num
              ),
            },
          };
        }
        return prev;
      });
    },

    deleteSelectedObject() {
      setState((prev) => {
        if (!prev.selectedObject) return prev;
        const deleted = collectCascadeDelete(prev.scene, prev.selectedObject);
        const nextScene = applyDeletion(prev.scene, deleted);
        rebuildRightAngleProvenance(nextScene);
        return {
          ...prev,
          scene: nextScene,
          selectedObject: null,
          recentCreatedObject: null,
          copyStyle: isSelectedObjectAlive(nextScene, prev.copyStyle.source)
            ? prev.copyStyle
            : {
                source: null,
                pointStyle: null,
                lineStyle: null,
                circleStyle: null,
                polygonStyle: null,
                angleStyle: null,
                textLabelStyle: null,
                showLabel: null,
              },
        };
      });
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
              showLabel: point.showLabel,
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
              showLabel: null,
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
              showLabel: null,
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
              showLabel: null,
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
              showLabel: null,
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
              showLabel: null,
            },
          };
        }

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
            showLabel: null,
          },
        };
      });
    },

    applyCopyStyleTo(obj) {
      setState((prev) => {
        if (obj.type === "textLabel") {
          if (!prev.copyStyle.textLabelStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              textLabels: (prev.scene.textLabels ?? []).map((label) =>
                label.id === obj.id
                  ? {
                      ...label,
                      style: {
                        ...label.style,
                        ...prev.copyStyle.textLabelStyle,
                      },
                    }
                  : label
              ),
            },
          };
        }

        if (obj.type === "point") {
          const sourcePointStyle =
            prev.copyStyle.pointStyle ??
            (prev.copyStyle.lineStyle ? pointStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
            (prev.copyStyle.circleStyle ? pointStyleFromCircleStyle(prev.copyStyle.circleStyle) : null);
          if (!sourcePointStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              points: prev.scene.points.map((point) =>
                point.id !== obj.id
                  ? point
                  : {
                      ...point,
                      showLabel: prev.copyStyle.showLabel ?? point.showLabel,
                      style: {
                        ...point.style,
                        ...sourcePointStyle,
                        labelOffsetPx: { ...point.style.labelOffsetPx },
                      },
                    }
              ),
            },
          };
        }

        if (obj.type === "segment") {
          const sourceLineStyle =
            prev.copyStyle.lineStyle ??
            (prev.copyStyle.polygonStyle ? lineStyleFromPolygonStyle(prev.copyStyle.polygonStyle) : null) ??
            (prev.copyStyle.circleStyle ? lineStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
            (prev.copyStyle.pointStyle ? lineStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
          if (!sourceLineStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              segments: prev.scene.segments.map((segment) =>
                segment.id === obj.id ? { ...segment, style: { ...segment.style, ...sourceLineStyle } } : segment
              ),
            },
          };
        }

        if (obj.type === "circle") {
          const sourceCircleStyle =
            prev.copyStyle.circleStyle ??
            (prev.copyStyle.polygonStyle ? circleStyleFromPolygonStyle(prev.copyStyle.polygonStyle) : null) ??
            (prev.copyStyle.lineStyle ? circleStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
            (prev.copyStyle.pointStyle ? circleStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
          if (!sourceCircleStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              circles: prev.scene.circles.map((circle) =>
                circle.id === obj.id ? { ...circle, style: { ...circle.style, ...sourceCircleStyle } } : circle
              ),
            },
          };
        }

        if (obj.type === "polygon") {
          const sourcePolygonStyle =
            prev.copyStyle.polygonStyle ??
            (prev.copyStyle.circleStyle ? polygonStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
            (prev.copyStyle.lineStyle ? polygonStyleFromLineStyle(prev.copyStyle.lineStyle) : null);
          if (!sourcePolygonStyle) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              polygons: prev.scene.polygons.map((polygon) =>
                polygon.id === obj.id ? { ...polygon, style: { ...polygon.style, ...sourcePolygonStyle } } : polygon
              ),
            },
          };
        }

        if (obj.type === "angle") {
          const sourceAngleStyle =
            prev.copyStyle.angleStyle ??
            (prev.copyStyle.polygonStyle ? angleStyleFromCircleStyle(circleStyleFromPolygonStyle(prev.copyStyle.polygonStyle)) : null) ??
            (prev.copyStyle.lineStyle ? angleStyleFromLineStyle(prev.copyStyle.lineStyle) : null) ??
            (prev.copyStyle.circleStyle ? angleStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
            (prev.copyStyle.pointStyle ? angleStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
          if (!sourceAngleStyle) return prev;
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
                        ...sourceAngleStyle,
                        labelPosWorld: { ...angle.style.labelPosWorld },
                      },
                    }
                  : angle
              ),
            },
          };
        }

        const sourceLineStyle =
          prev.copyStyle.lineStyle ??
          (prev.copyStyle.polygonStyle ? lineStyleFromPolygonStyle(prev.copyStyle.polygonStyle) : null) ??
          (prev.copyStyle.circleStyle ? lineStyleFromCircleStyle(prev.copyStyle.circleStyle) : null) ??
          (prev.copyStyle.pointStyle ? lineStyleFromPointStyle(prev.copyStyle.pointStyle) : null);
        if (!sourceLineStyle) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: prev.scene.lines.map((line) =>
              line.id === obj.id ? { ...line, style: { ...line.style, ...sourceLineStyle } } : line
            ),
          },
        };
      });
    },

    clearCopyStyle() {
      setState((prev) => ({
        ...prev,
        copyStyle: {
          source: null,
          pointStyle: null,
          lineStyle: null,
          circleStyle: null,
          polygonStyle: null,
          angleStyle: null,
          textLabelStyle: null,
          showLabel: null,
        },
      }));
    },
  };
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
