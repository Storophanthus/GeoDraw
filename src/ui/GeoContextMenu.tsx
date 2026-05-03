import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Circle,
  Copy,
  Eye,
  EyeOff,
  Hash,
  PenLine,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGeoStore, type GeoStore } from "../state/geoStore";
import type { ContextMenuAction, ContextMenuActionId, ContextMenuTarget } from "./contextMenuActions";
import { getContextActionsForTarget, getContextMenuTitle } from "./contextMenuActions";

export type GeoContextMenuState = {
  x: number;
  y: number;
  target: ContextMenuTarget;
};

type GeoContextMenuProps = {
  menu: GeoContextMenuState | null;
  onClose: () => void;
};

const MENU_WIDTH_PX = 244;
const MENU_ITEM_HEIGHT_PX = 34;
const MENU_HEADER_HEIGHT_PX = 38;
const MENU_MARGIN_PX = 8;

export function GeoContextMenu({ menu, onClose }: GeoContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const scene = useGeoStore((store) => store.scene);
  const camera = useGeoStore((store) => store.camera);
  const textClipboard = useGeoStore((store) => store.textClipboard);
  const setSelectedObject = useGeoStore((store) => store.setSelectedObject);
  const clearPendingSelection = useGeoStore((store) => store.clearPendingSelection);
  const createFreePoint = useGeoStore((store) => store.createFreePoint);
  const createTextLabel = useGeoStore((store) => store.createTextLabel);
  const createRichTextNode = useGeoStore((store) => store.createRichTextNode);
  const duplicateTextLabel = useGeoStore((store) => store.duplicateTextLabel);
  const duplicateRichTextNode = useGeoStore((store) => store.duplicateRichTextNode);
  const copyTextObjectToClipboard = useGeoStore((store) => store.copyTextObjectToClipboard);
  const pasteTextClipboard = useGeoStore((store) => store.pasteTextClipboard);
  const createNumber = useGeoStore((store) => store.createNumber);
  const requestTextEdit = useGeoStore((store) => store.requestTextEdit);
  const fitViewToScene = useGeoStore((store) => store.fitViewToScene);
  const renameSelectedPoint = useGeoStore((store) => store.renameSelectedPoint);
  const updatePointFieldsByIds = useGeoStore((store) => store.updatePointFieldsByIds);
  const updateSegmentFieldsByIds = useGeoStore((store) => store.updateSegmentFieldsByIds);
  const updateLineFieldsByIds = useGeoStore((store) => store.updateLineFieldsByIds);
  const updateCircleFieldsByIds = useGeoStore((store) => store.updateCircleFieldsByIds);
  const updatePolygonFieldsByIds = useGeoStore((store) => store.updatePolygonFieldsByIds);
  const updateTextLabelFieldsByIds = useGeoStore((store) => store.updateTextLabelFieldsByIds);
  const updateRichTextFieldsByIds = useGeoStore((store) => store.updateRichTextFieldsByIds);
  const updateSegmentStyleByIds = useGeoStore((store) => store.updateSegmentStyleByIds);
  const updateLineStyleByIds = useGeoStore((store) => store.updateLineStyleByIds);
  const updateCircleStyleByIds = useGeoStore((store) => store.updateCircleStyleByIds);
  const updatePolygonStyleByIds = useGeoStore((store) => store.updatePolygonStyleByIds);
  const updateAngleStyleByIds = useGeoStore((store) => store.updateAngleStyleByIds);
  const deleteObjects = useGeoStore((store) => store.deleteObjects);

  const actions = useMemo(
    () => (menu ? getContextActionsForTarget(scene, menu.target, { canPaste: Boolean(textClipboard) }) : []),
    [menu, scene, textClipboard]
  );
  const title = useMemo(
    () => (menu ? getContextMenuTitle(scene, menu.target) : ""),
    [menu, scene]
  );

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = menuRef.current;
      if (node && event.target instanceof Node && node.contains(event.target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [menu, onClose]);

  if (!menu || actions.length === 0) return null;

  const position = clampContextMenuPosition(menu.x, menu.y, actions.length);

  const runAction = (action: ContextMenuAction) => {
    if (action.disabled) return;
    executeContextAction(action.id, menu.target, {
      scene,
      duplicateOffsetWorld: getDuplicateOffsetWorld(camera.zoom),
      setSelectedObject,
      clearPendingSelection,
      createFreePoint,
      createTextLabel,
      createRichTextNode,
      duplicateTextLabel,
      duplicateRichTextNode,
      copyTextObjectToClipboard,
      pasteTextClipboard,
      createNumber,
      requestTextEdit,
      fitViewToScene,
      renameSelectedPoint,
      updatePointFieldsByIds,
      updateSegmentFieldsByIds,
      updateLineFieldsByIds,
      updateCircleFieldsByIds,
      updatePolygonFieldsByIds,
      updateTextLabelFieldsByIds,
      updateRichTextFieldsByIds,
      updateSegmentStyleByIds,
      updateLineStyleByIds,
      updateCircleStyleByIds,
      updatePolygonStyleByIds,
      updateAngleStyleByIds,
      deleteObjects,
    });
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="geoContextMenu"
      style={position}
      role="menu"
      aria-label={`${title} actions`}
    >
      <div className="geoContextMenuTitle">{title}</div>
      <div className="geoContextMenuItems">
        {actions.map((action) => {
          const Icon = iconForAction(action.id);
          return (
            <button
              key={action.id}
              type="button"
              className={[
                "geoContextMenuItem",
                action.tone === "danger" ? "danger" : "",
                action.separatorBefore ? "withSeparator" : "",
              ].filter(Boolean).join(" ")}
              role="menuitem"
              disabled={action.disabled}
              onClick={() => runAction(action)}
            >
              <span className="geoContextMenuIcon">{Icon ? <Icon size={15} strokeWidth={2.1} /> : null}</span>
              <span className="geoContextMenuLabel">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

type ContextActionRuntime = {
  scene: GeoStore["scene"];
  duplicateOffsetWorld: { x: number; y: number };
  setSelectedObject: GeoStore["setSelectedObject"];
  clearPendingSelection: GeoStore["clearPendingSelection"];
  createFreePoint: GeoStore["createFreePoint"];
  createTextLabel: GeoStore["createTextLabel"];
  createRichTextNode: GeoStore["createRichTextNode"];
  duplicateTextLabel: GeoStore["duplicateTextLabel"];
  duplicateRichTextNode: GeoStore["duplicateRichTextNode"];
  copyTextObjectToClipboard: GeoStore["copyTextObjectToClipboard"];
  pasteTextClipboard: GeoStore["pasteTextClipboard"];
  createNumber: GeoStore["createNumber"];
  requestTextEdit: GeoStore["requestTextEdit"];
  fitViewToScene: GeoStore["fitViewToScene"];
  renameSelectedPoint: GeoStore["renameSelectedPoint"];
  updatePointFieldsByIds: GeoStore["updatePointFieldsByIds"];
  updateSegmentFieldsByIds: GeoStore["updateSegmentFieldsByIds"];
  updateLineFieldsByIds: GeoStore["updateLineFieldsByIds"];
  updateCircleFieldsByIds: GeoStore["updateCircleFieldsByIds"];
  updatePolygonFieldsByIds: GeoStore["updatePolygonFieldsByIds"];
  updateTextLabelFieldsByIds: GeoStore["updateTextLabelFieldsByIds"];
  updateRichTextFieldsByIds: GeoStore["updateRichTextFieldsByIds"];
  updateSegmentStyleByIds: GeoStore["updateSegmentStyleByIds"];
  updateLineStyleByIds: GeoStore["updateLineStyleByIds"];
  updateCircleStyleByIds: GeoStore["updateCircleStyleByIds"];
  updatePolygonStyleByIds: GeoStore["updatePolygonStyleByIds"];
  updateAngleStyleByIds: GeoStore["updateAngleStyleByIds"];
  deleteObjects: GeoStore["deleteObjects"];
};

function executeContextAction(actionId: ContextMenuActionId, target: ContextMenuTarget, runtime: ContextActionRuntime): void {
  if (target.type !== "empty") {
    runtime.setSelectedObject(target);
  }

  if (target.type === "empty") {
    if (actionId === "create-point" && target.world) runtime.createFreePoint(target.world);
    if (actionId === "create-text" && target.world) runtime.createTextLabel(target.world, "label");
    if (actionId === "create-textbox" && target.world) runtime.createRichTextNode(target.world);
    if (actionId === "paste-clipboard" && target.world) runtime.pasteTextClipboard(target.world);
    if (actionId === "fit-view") {
      const canvas = document.querySelector<HTMLCanvasElement>(".drawingCanvas");
      const rect = canvas?.getBoundingClientRect();
      runtime.fitViewToScene({
        widthPx: rect?.width && rect.width > 1 ? rect.width : window.innerWidth,
        heightPx: rect?.height && rect.height > 1 ? rect.height : window.innerHeight,
      });
    }
    if (actionId === "clear-selection") {
      runtime.clearPendingSelection();
      runtime.setSelectedObject(null);
    }
    return;
  }

  if (actionId === "delete-object") {
    runtime.deleteObjects([target]);
    return;
  }

  if (target.type === "point") {
    const point = runtime.scene.points.find((item) => item.id === target.id);
    if (!point) return;
    if (actionId === "rename-point") {
      const next = window.prompt("Point name", point.name);
      if (next == null) return;
      const result = runtime.renameSelectedPoint(next);
      if (!result.ok) window.alert(result.error);
      return;
    }
    if (actionId === "toggle-point-label") {
      runtime.updatePointFieldsByIds([target.id], { showLabel: point.showLabel === "none" ? "name" : "none" });
    }
    return;
  }

  if (target.type === "segment") {
    const segment = runtime.scene.segments.find((item) => item.id === target.id);
    if (!segment) return;
    if (actionId === "set-line-solid") runtime.updateSegmentStyleByIds([target.id], { dash: "solid" });
    if (actionId === "set-line-dashed") runtime.updateSegmentStyleByIds([target.id], { dash: "dashed" });
    if (actionId === "set-line-dotted") runtime.updateSegmentStyleByIds([target.id], { dash: "dotted" });
    if (actionId === "toggle-object-label") runtime.updateSegmentFieldsByIds([target.id], { showLabel: !segment.showLabel });
    if (actionId === "create-variable-length") runtime.createNumber({ kind: "segmentLength", segId: target.id });
    return;
  }

  if (target.type === "line") {
    const line = runtime.scene.lines.find((item) => item.id === target.id);
    if (!line) return;
    if (actionId === "set-line-solid") runtime.updateLineStyleByIds([target.id], { dash: "solid" });
    if (actionId === "set-line-dashed") runtime.updateLineStyleByIds([target.id], { dash: "dashed" });
    if (actionId === "set-line-dotted") runtime.updateLineStyleByIds([target.id], { dash: "dotted" });
    if (actionId === "toggle-object-label") runtime.updateLineFieldsByIds([target.id], { showLabel: !line.showLabel });
    return;
  }

  if (target.type === "circle") {
    const circle = runtime.scene.circles.find((item) => item.id === target.id);
    if (!circle) return;
    if (actionId === "set-circle-solid") runtime.updateCircleStyleByIds([target.id], { strokeDash: "solid" });
    if (actionId === "set-circle-dashed") runtime.updateCircleStyleByIds([target.id], { strokeDash: "dashed" });
    if (actionId === "set-circle-dotted") runtime.updateCircleStyleByIds([target.id], { strokeDash: "dotted" });
    if (actionId === "toggle-object-label") runtime.updateCircleFieldsByIds([target.id], { showLabel: !circle.showLabel });
    if (actionId === "create-variable-radius") runtime.createNumber({ kind: "circleRadius", circleId: target.id });
    if (actionId === "create-variable-area") runtime.createNumber({ kind: "circleArea", circleId: target.id });
    return;
  }

  if (target.type === "polygon") {
    const polygon = runtime.scene.polygons.find((item) => item.id === target.id);
    if (!polygon) return;
    if (actionId === "set-polygon-solid") runtime.updatePolygonStyleByIds([target.id], { strokeDash: "solid" });
    if (actionId === "set-polygon-dashed") runtime.updatePolygonStyleByIds([target.id], { strokeDash: "dashed" });
    if (actionId === "set-polygon-dotted") runtime.updatePolygonStyleByIds([target.id], { strokeDash: "dotted" });
    if (actionId === "toggle-object-label") runtime.updatePolygonFieldsByIds([target.id], { showLabel: !polygon.showLabel });
    if (actionId === "create-variable-perimeter") runtime.createNumber({ kind: "polygonPerimeter", polygonId: target.id });
    if (actionId === "create-variable-area") runtime.createNumber({ kind: "polygonArea", polygonId: target.id });
    return;
  }

  if (target.type === "angle") {
    const angle = runtime.scene.angles.find((item) => item.id === target.id);
    if (!angle) return;
    if (actionId === "toggle-angle-promote-solid") {
      runtime.updateAngleStyleByIds([target.id], { promoteToSolid: !angle.style.promoteToSolid });
    }
    if (actionId === "toggle-angle-label") runtime.updateAngleStyleByIds([target.id], { showLabel: !angle.style.showLabel });
    if (actionId === "toggle-angle-value") runtime.updateAngleStyleByIds([target.id], { showValue: !angle.style.showValue });
    if (actionId === "create-variable-angle") runtime.createNumber({ kind: "angleDegrees", angleId: target.id });
    return;
  }

  if (target.type === "textLabel") {
    const label = runtime.scene.textLabels?.find((item) => item.id === target.id);
    if (!label) return;
    if (actionId === "edit-text") {
      const next = window.prompt("Text", label.text);
      if (next == null) return;
      runtime.updateTextLabelFieldsByIds([target.id], { text: next, contentMode: "static" });
      return;
    }
    if (actionId === "toggle-text-visibility") runtime.updateTextLabelFieldsByIds([target.id], { visible: !label.visible });
    if (actionId === "copy-object") runtime.copyTextObjectToClipboard({ type: "textLabel", id: target.id });
    if (actionId === "duplicate-object") runtime.duplicateTextLabel(target.id, runtime.duplicateOffsetWorld);
    return;
  }

  if (target.type === "richText") {
    const node = runtime.scene.richTextNodes?.find((item) => item.id === target.id);
    if (!node) return;
    if (actionId === "edit-text") {
      runtime.requestTextEdit({ type: "richText", id: target.id });
      return;
    }
    if (actionId === "toggle-text-visibility") runtime.updateRichTextFieldsByIds([target.id], { visible: !node.visible });
    if (actionId === "copy-object") runtime.copyTextObjectToClipboard({ type: "richText", id: target.id });
    if (actionId === "duplicate-object") runtime.duplicateRichTextNode(target.id, runtime.duplicateOffsetWorld);
  }
}

function getDuplicateOffsetWorld(zoom: number): { x: number; y: number } {
  const screenOffsetPx = 24;
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 80;
  const worldOffset = screenOffsetPx / safeZoom;
  return { x: worldOffset, y: -worldOffset };
}

function clampContextMenuPosition(x: number, y: number, actionCount: number): CSSProperties {
  const estimatedHeight = MENU_HEADER_HEIGHT_PX + actionCount * MENU_ITEM_HEIGHT_PX + MENU_MARGIN_PX;
  const left = Math.min(Math.max(MENU_MARGIN_PX, x), Math.max(MENU_MARGIN_PX, window.innerWidth - MENU_WIDTH_PX - MENU_MARGIN_PX));
  const top = Math.min(Math.max(MENU_MARGIN_PX, y), Math.max(MENU_MARGIN_PX, window.innerHeight - estimatedHeight - MENU_MARGIN_PX));
  return { left, top };
}

function iconForAction(actionId: ContextMenuActionId): LucideIcon | null {
  if (actionId === "create-text" || actionId === "create-textbox" || actionId === "paste-clipboard") return Type;
  if (actionId.startsWith("create-variable")) return Hash;
  if (actionId.startsWith("create-")) return Plus;
  if (actionId === "duplicate-object" || actionId === "copy-object") return Copy;
  if (actionId === "delete-object") return Trash2;
  if (actionId === "rename-point" || actionId === "edit-text") return PenLine;
  if (actionId.includes("label") || actionId.includes("visibility")) return actionId.includes("toggle") ? Eye : EyeOff;
  if (actionId.includes("angle-promote")) return Circle;
  return null;
}
