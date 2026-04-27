import type { Vec2 } from "../geo/vec2";
import type { SceneModel } from "../scene/points";
import type { SelectedObject } from "../state/slices/storeTypes";

export type ContextMenuObjectTarget = Exclude<SelectedObject, null>;

export type ContextMenuTarget =
  | ContextMenuObjectTarget
  | {
      type: "empty";
      world: Vec2 | null;
    };

export type ContextMenuActionTone = "normal" | "danger";

export type ContextMenuActionId =
  | "create-point"
  | "create-text"
  | "create-textbox"
  | "fit-view"
  | "clear-selection"
  | "rename-point"
  | "toggle-point-label"
  | "toggle-object-label"
  | "toggle-text-visibility"
  | "set-line-solid"
  | "set-line-dashed"
  | "set-line-dotted"
  | "set-circle-solid"
  | "set-circle-dashed"
  | "set-circle-dotted"
  | "set-polygon-solid"
  | "set-polygon-dashed"
  | "set-polygon-dotted"
  | "toggle-angle-promote-solid"
  | "toggle-angle-label"
  | "toggle-angle-value"
  | "create-variable-length"
  | "create-variable-radius"
  | "create-variable-area"
  | "create-variable-angle"
  | "delete-object";

export type ContextMenuAction = {
  id: ContextMenuActionId;
  label: string;
  tone?: ContextMenuActionTone;
  disabled?: boolean;
  separatorBefore?: boolean;
};

export function getContextMenuTitle(scene: SceneModel, target: ContextMenuTarget): string {
  if (target.type === "empty") return "Canvas";
  if (target.type === "point") {
    return scene.points.find((point) => point.id === target.id)?.name ?? "Point";
  }
  if (target.type === "segment") return "Segment";
  if (target.type === "line") return "Line";
  if (target.type === "circle") return "Circle";
  if (target.type === "polygon") return "Polygon";
  if (target.type === "angle") {
    const angle = scene.angles.find((item) => item.id === target.id);
    return angle?.kind === "sector" ? "Sector" : "Angle";
  }
  if (target.type === "textLabel") {
    return scene.textLabels?.find((label) => label.id === target.id)?.name ?? "Text";
  }
  if (target.type === "richText") {
    return scene.richTextNodes?.find((node) => node.id === target.id)?.name ?? "Textbox";
  }
  if (target.type === "number") {
    return scene.numbers.find((number) => number.id === target.id)?.name ?? "Number";
  }
  return "Object";
}

export function getContextActionsForTarget(scene: SceneModel, target: ContextMenuTarget): ContextMenuAction[] {
  if (target.type === "empty") {
    return [
      { id: "create-point", label: "Create Point", disabled: !target.world },
      { id: "create-text", label: "Create Text", disabled: !target.world },
      { id: "create-textbox", label: "Create Textbox", disabled: !target.world },
      { id: "fit-view", label: "Fit View", separatorBefore: true },
      { id: "clear-selection", label: "Clear Selection" },
    ];
  }

  if (target.type === "point") {
    const point = scene.points.find((item) => item.id === target.id);
    if (!point) return [];
    return [
      { id: "rename-point", label: "Rename" },
      { id: "toggle-point-label", label: point.showLabel === "none" ? "Show Label" : "Hide Label" },
      deleteAction(),
    ];
  }

  if (target.type === "segment") {
    const segment = scene.segments.find((item) => item.id === target.id);
    if (!segment) return [];
    return [
      ...lineDashActions(segment.style.dash),
      { id: "toggle-object-label", label: segment.showLabel ? "Hide Label" : "Show Label", separatorBefore: true },
      { id: "create-variable-length", label: "Create Variable from Length", separatorBefore: true },
      deleteAction(),
    ];
  }

  if (target.type === "line") {
    const line = scene.lines.find((item) => item.id === target.id);
    if (!line) return [];
    return [
      ...lineDashActions(line.style.dash),
      { id: "toggle-object-label", label: line.showLabel ? "Hide Label" : "Show Label", separatorBefore: true },
      deleteAction(),
    ];
  }

  if (target.type === "circle") {
    const circle = scene.circles.find((item) => item.id === target.id);
    if (!circle) return [];
    return [
      ...strokeDashActions(circle.style.strokeDash, "circle"),
      { id: "toggle-object-label", label: circle.showLabel ? "Hide Label" : "Show Label", separatorBefore: true },
      { id: "create-variable-radius", label: "Create Variable from Radius", separatorBefore: true },
      { id: "create-variable-area", label: "Create Variable from Area" },
      deleteAction(),
    ];
  }

  if (target.type === "polygon") {
    const polygon = scene.polygons.find((item) => item.id === target.id);
    if (!polygon) return [];
    return [
      ...strokeDashActions(polygon.style.strokeDash, "polygon"),
      { id: "toggle-object-label", label: polygon.showLabel ? "Hide Label" : "Show Label", separatorBefore: true },
      deleteAction(),
    ];
  }

  if (target.type === "angle") {
    const angle = scene.angles.find((item) => item.id === target.id);
    if (!angle) return [];
    const isSector = angle.kind === "sector";
    return [
      {
        id: "toggle-angle-promote-solid",
        label: angle.style.promoteToSolid ? "Use Approximation Dash" : "Promote to Solid",
        disabled: isSector,
      },
      { id: "toggle-angle-label", label: angle.style.showLabel ? "Hide Label" : "Show Label", separatorBefore: true },
      { id: "toggle-angle-value", label: angle.style.showValue ? "Hide Value" : "Show Value" },
      {
        id: "create-variable-angle",
        label: isSector ? "Create Variable from Sweep" : "Create Variable from Angle",
        separatorBefore: true,
      },
      deleteAction(),
    ];
  }

  if (target.type === "textLabel") {
    const label = scene.textLabels?.find((item) => item.id === target.id);
    if (!label) return [];
    return [
      { id: "toggle-text-visibility", label: label.visible ? "Hide Text" : "Show Text" },
      deleteAction(),
    ];
  }

  if (target.type === "richText") {
    const node = scene.richTextNodes?.find((item) => item.id === target.id);
    if (!node) return [];
    return [
      { id: "toggle-text-visibility", label: node.visible ? "Hide Textbox" : "Show Textbox" },
      deleteAction(),
    ];
  }

  if (target.type === "number") {
    const number = scene.numbers.find((item) => item.id === target.id);
    if (!number) return [];
    return [deleteAction()];
  }

  return [];
}

function lineDashActions(current: "solid" | "dashed" | "dotted"): ContextMenuAction[] {
  return [
    { id: "set-line-solid", label: "Solid", disabled: current === "solid" },
    { id: "set-line-dashed", label: "Dashed", disabled: current === "dashed" },
    { id: "set-line-dotted", label: "Dotted", disabled: current === "dotted" },
  ];
}

function strokeDashActions(
  current: "solid" | "dashed" | "dotted",
  family: "circle" | "polygon"
): ContextMenuAction[] {
  if (family === "circle") {
    return [
      { id: "set-circle-solid", label: "Solid", disabled: current === "solid" },
      { id: "set-circle-dashed", label: "Dashed", disabled: current === "dashed" },
      { id: "set-circle-dotted", label: "Dotted", disabled: current === "dotted" },
    ];
  }
  return [
    { id: "set-polygon-solid", label: "Solid", disabled: current === "solid" },
    { id: "set-polygon-dashed", label: "Dashed", disabled: current === "dashed" },
    { id: "set-polygon-dotted", label: "Dotted", disabled: current === "dotted" },
  ];
}

function deleteAction(): ContextMenuAction {
  return { id: "delete-object", label: "Delete", tone: "danger", separatorBefore: true };
}
