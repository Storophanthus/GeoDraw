import { getPointWorldPos, nextLabelFromIndex } from "../../scene/points";
import type { TextLabelToolKind, TriangleCenterKind } from "../../scene/points";
import {
  defaultLineLabelPosWorld,
  defaultLineLabelText,
  defaultPolygonLabelPosWorld,
  defaultPolygonLabelText,
  defaultSegmentLabelPosWorld,
  defaultSegmentLabelText,
} from "../../scene/objectLabels";
import { registerLinePair, registerSegmentPair } from "../../domain/rightAngleProvenance";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState } from "./storeTypes";
import type { Vec2 } from "../../geo/vec2";

type SceneCoreContext = {
  setState: (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;
};

function nextUnusedPointName(state: GeoState): string {
  const used = new Set(state.scene.points.map((point) => point.name));
  let idx = 0;
  let name = nextLabelFromIndex(idx);
  while (used.has(name)) {
    idx += 1;
    name = nextLabelFromIndex(idx);
  }
  return name;
}

function nextUnusedTextLabelName(state: GeoState): string {
  const used = new Set((state.scene.textLabels ?? []).map((label) => label.name));
  let idx = 1;
  let name = `T${idx}`;
  while (used.has(name)) {
    idx += 1;
    name = `T${idx}`;
  }
  return name;
}

function nextUnusedCopyName(usedNames: Iterable<string>, sourceName: string): string {
  const used = new Set(usedNames);
  const base = `${sourceName.trim() || "Object"} copy`;
  let name = base;
  let idx = 2;
  while (used.has(name)) {
    name = `${base} ${idx}`;
    idx += 1;
  }
  return name;
}

function duplicateOffsetWorld(world: Vec2, offsetWorld: Vec2 = { x: 0.35, y: -0.35 }) {
  const dx = Number.isFinite(offsetWorld.x) ? offsetWorld.x : 0.35;
  const dy = Number.isFinite(offsetWorld.y) ? offsetWorld.y : -0.35;
  return { x: world.x + dx, y: world.y + dy };
}

export function createSceneCoreActions(
  ctx: SceneCoreContext
): Pick<
  GeoActions,
  | "createFreePoint"
  | "createTextLabel"
  | "createRichTextNode"
  | "duplicateTextLabel"
  | "duplicateRichTextNode"
  | "copyTextObjectToClipboard"
  | "pasteTextClipboard"
  | "migrateTextLabelToRichTextNode"
  | "createMidpointFromPoints"
  | "createMidpointFromSegment"
  | "createSegment"
  | "createLine"
  | "createPolygon"
  | "createRegularPolygon"
  | "createCircleCenterPoint"
  | "createTriangleCenterPoint"
> {
  const edgeKey = (aId: string, bId: string) => (aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`);

  return {
    createFreePoint(world) {
      let createdId = "";
      ctx.setState((prev) => {
        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "free",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: false,
                auxiliary: false,
                position: world,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createTextLabel(world, preset = "label") {
      let createdId = "";
      ctx.setState((prev) => {
        if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return prev;
        const name = nextUnusedTextLabelName(prev);
        const id = `txt_${prev.nextTextLabelId}`;
        const toolKind: TextLabelToolKind = preset === "textbox" ? "textbox" : "label";
        const defaultStyle = toolKind === "textbox" ? prev.textboxToolDefaults : prev.labelToolDefaults;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: [
              ...(prev.scene.textLabels ?? []),
              {
                id,
                name,
                text: toolKind === "textbox" ? "" : name,
                toolKind,
                contentMode: "static",
                visible: true,
                positionWorld: { x: world.x, y: world.y },
                style: {
                  ...defaultStyle,
                },
              },
            ],
          },
          selectedObject: { type: "textLabel", id },
          recentCreatedObject: { type: "textLabel", id },
          nextTextLabelId: prev.nextTextLabelId + 1,
        };
      });
      return createdId;
    },

    createRichTextNode(world) {
      let createdId = "";
      ctx.setState((prev) => {
        if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return prev;
        const id = `rt_${prev.nextRichTextId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: [
              ...(prev.scene.richTextNodes ?? []),
              {
                id,
                type: "richText",
                name: id,
                visible: true,
                positionWorld: { x: world.x, y: world.y },
                style: {
                  ...prev.richTextToolDefaults,
                },
                document: {
                  kind: "document",
                  blocks: [
                    {
                      kind: "paragraph",
                      textAlign: prev.richTextToolDefaults.textAlign ?? "left",
                      children: [{ kind: "text", text: "" }],
                    },
                  ],
                },
                boundsPx: { widthPx: 100, heightPx: 20 },
              },
            ],
          },
          selectedObject: { type: "richText", id },
          recentCreatedObject: { type: "richText", id },
          nextRichTextId: prev.nextRichTextId + 1,
        };
      });
      return createdId;
    },

    duplicateTextLabel(id, offsetWorld) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const source = (prev.scene.textLabels ?? []).find((label) => label.id === id);
        if (!source) return prev;
        const nextId = `txt_${prev.nextTextLabelId}`;
        createdId = nextId;
        const nextLabel = {
          ...structuredClone(source),
          id: nextId,
          name: nextUnusedCopyName((prev.scene.textLabels ?? []).map((label) => label.name), source.name),
          positionWorld: duplicateOffsetWorld(source.positionWorld, offsetWorld),
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: [...(prev.scene.textLabels ?? []), nextLabel],
          },
          selectedObject: { type: "textLabel", id: nextId },
          recentCreatedObject: { type: "textLabel", id: nextId },
          nextTextLabelId: prev.nextTextLabelId + 1,
        };
      });
      return createdId;
    },

    duplicateRichTextNode(id, offsetWorld) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const source = (prev.scene.richTextNodes ?? []).find((node) => node.id === id);
        if (!source) return prev;
        const nextId = `rt_${prev.nextRichTextId}`;
        createdId = nextId;
        const nextNode = {
          ...structuredClone(source),
          id: nextId,
          name: nextUnusedCopyName((prev.scene.richTextNodes ?? []).map((node) => node.name), source.name),
          positionWorld: duplicateOffsetWorld(source.positionWorld, offsetWorld),
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: [...(prev.scene.richTextNodes ?? []), nextNode],
          },
          selectedObject: { type: "richText", id: nextId },
          recentCreatedObject: { type: "richText", id: nextId },
          nextRichTextId: prev.nextRichTextId + 1,
        };
      });
      return createdId;
    },

    copyTextObjectToClipboard(target) {
      let copied = false;
      ctx.setState(
        (prev) => {
          if (target.type === "textLabel") {
            const source = (prev.scene.textLabels ?? []).find((label) => label.id === target.id);
            if (!source) return prev;
            copied = true;
            return {
              ...prev,
              textClipboard: {
                payload: {
                  type: "textLabel",
                  text: source.text,
                  toolKind: source.toolKind,
                  contentMode: source.contentMode ?? "static",
                  numberId: source.numberId,
                  expr: source.expr,
                  visible: source.visible,
                  style: structuredClone(source.style),
                },
                origin: { ...source.positionWorld },
                pasteCount: 0,
              },
            };
          }
          const source = (prev.scene.richTextNodes ?? []).find((node) => node.id === target.id);
          if (!source) return prev;
          copied = true;
          return {
            ...prev,
            textClipboard: {
              payload: {
                type: "richText",
                visible: source.visible,
                document: structuredClone(source.document),
                style: structuredClone(source.style),
                boundsPx: source.boundsPx ? { ...source.boundsPx } : undefined,
              },
              origin: { ...source.positionWorld },
              pasteCount: 0,
            },
          };
        },
        { history: "skip" }
      );
      return copied;
    },

    pasteTextClipboard(world, offsetWorld) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const clipboard = prev.textClipboard;
        if (!clipboard) return prev;
        const pasteCount = clipboard.pasteCount + 1;
        const positionWorld = world ?? duplicateOffsetWorld(clipboard.origin, {
          x: (offsetWorld?.x ?? 0.35) * pasteCount,
          y: (offsetWorld?.y ?? -0.35) * pasteCount,
        });

        if (clipboard.payload.type === "textLabel") {
          const nextId = `txt_${prev.nextTextLabelId}`;
          createdId = nextId;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              textLabels: [
                ...(prev.scene.textLabels ?? []),
                {
                  id: nextId,
                  name: nextUnusedTextLabelName(prev),
                  text: clipboard.payload.text,
                  toolKind: clipboard.payload.toolKind,
                  contentMode: clipboard.payload.contentMode ?? "static",
                  numberId: clipboard.payload.numberId,
                  expr: clipboard.payload.expr,
                  visible: clipboard.payload.visible,
                  positionWorld,
                  style: structuredClone(clipboard.payload.style),
                },
              ],
            },
            selectedObject: { type: "textLabel", id: nextId },
            recentCreatedObject: { type: "textLabel", id: nextId },
            nextTextLabelId: prev.nextTextLabelId + 1,
            textClipboard: { ...clipboard, pasteCount },
          };
        }

        const nextId = `rt_${prev.nextRichTextId}`;
        createdId = nextId;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            richTextNodes: [
              ...(prev.scene.richTextNodes ?? []),
              {
                id: nextId,
                type: "richText",
                name: nextId,
                visible: clipboard.payload.visible,
                positionWorld,
                style: structuredClone(clipboard.payload.style),
                document: structuredClone(clipboard.payload.document),
                boundsPx: clipboard.payload.boundsPx ? { ...clipboard.payload.boundsPx } : undefined,
              },
            ],
          },
          selectedObject: { type: "richText", id: nextId },
          recentCreatedObject: { type: "richText", id: nextId },
          nextRichTextId: prev.nextRichTextId + 1,
          textClipboard: { ...clipboard, pasteCount },
        };
      });
      return createdId;
    },

    migrateTextLabelToRichTextNode(id) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const textLabel = (prev.scene.textLabels ?? []).find(l => l.id === id);
        if (!textLabel) return prev;

        const newId = `rt_${prev.nextRichTextId}`;
        createdId = newId;

        const textLines = textLabel.text.split("\n");
        const blocks = textLines.length > 0 ? textLines.map(line => ({
          kind: "paragraph" as const,
          textAlign: prev.richTextToolDefaults.textAlign ?? "left",
          children: [{ kind: "text" as const, text: line }],
        })) : [
          {
            kind: "paragraph" as const,
            textAlign: prev.richTextToolDefaults.textAlign ?? "left",
            children: [{ kind: "text" as const, text: "" }],
          }
        ];

        return {
          ...prev,
          scene: {
            ...prev.scene,
            textLabels: prev.scene.textLabels!.filter(l => l.id !== id),
            richTextNodes: [
              ...(prev.scene.richTextNodes ?? []),
              {
                id: newId,
                type: "richText",
                name: newId,
                visible: textLabel.visible,
                positionWorld: { ...textLabel.positionWorld },
                style: {
                  ...prev.richTextToolDefaults,
                  textColor: textLabel.style.textColor,
                  textSize: textLabel.style.textSize,
                  rotationDeg:
                    typeof textLabel.style.rotationDeg === "number" && Number.isFinite(textLabel.style.rotationDeg)
                      ? textLabel.style.rotationDeg
                      : prev.richTextToolDefaults.rotationDeg,
                },
                document: {
                  kind: "document",
                  blocks,
                },
                boundsPx: { widthPx: 200, heightPx: 30 * Math.max(1, textLines.length) },
              },
            ],
          },
          selectedObject: { type: "richText", id: newId },
          recentCreatedObject: { type: "richText", id: newId },
          nextRichTextId: prev.nextRichTextId + 1,
        };
      });
      return createdId;
    },

    createMidpointFromPoints(aId, bId) {
      if (aId === bId) return null;
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;

        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;

        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "midpointPoints",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: true,
                auxiliary: true,
                aId,
                bId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createMidpointFromSegment(segId) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const seg = prev.scene.segments.find((s) => s.id === segId);
        if (!seg) return prev;

        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;

        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "midpointSegment",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: true,
                auxiliary: true,
                segId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createSegment(aId, bId) {
      if (aId === bId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;
        id = `s_${prev.nextSegmentId}`;
        const showLabel = prev.objectLabelDefaults.segment;
        const newSegment = {
          id,
          aId,
          bId,
          visible: true,
          showLabel,
          labelGlow: prev.objectLabelDefaults.segmentGlow ?? true,
          labelText: defaultSegmentLabelText({ id, aId, bId, visible: true, showLabel, style: prev.segmentDefaults }, prev.scene),
          labelPosWorld:
            defaultSegmentLabelPosWorld({ id, aId, bId, visible: true, showLabel, style: prev.segmentDefaults }, prev.scene) ?? undefined,
          style: { ...prev.segmentDefaults },
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: [
              ...prev.scene.segments,
              newSegment,
            ],
          },
          selectedObject: { type: "segment", id },
          recentCreatedObject: { type: "segment", id },
          nextSegmentId: prev.nextSegmentId + 1,
        };
      });
      if (id) registerSegmentPair(id, aId, bId);
      return id;
    },

    createLine(aId, bId) {
      if (aId === bId) return null;
      let id: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;
        id = `l_${prev.nextLineId}`;
        const showLabel = prev.objectLabelDefaults.line;
        const newLine = {
          id,
          kind: "twoPoint" as const,
          aId,
          bId,
          visible: true,
          showLabel,
          labelGlow: prev.objectLabelDefaults.lineGlow ?? true,
          labelText: defaultLineLabelText(
            { id, kind: "twoPoint", aId, bId, visible: true, showLabel, style: prev.lineDefaults },
            prev.scene
          ),
          labelPosWorld:
            defaultLineLabelPosWorld(
              { id, kind: "twoPoint", aId, bId, visible: true, showLabel, style: prev.lineDefaults },
              prev.scene
            ) ?? undefined,
          style: { ...prev.lineDefaults },
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            lines: [
              ...prev.scene.lines,
              newLine,
            ],
          },
          selectedObject: { type: "line", id },
          recentCreatedObject: { type: "line", id },
          nextLineId: prev.nextLineId + 1,
        };
      });
      if (id) registerLinePair(id, aId, bId);
      return id;
    },

    createPolygon(pointIds) {
      const uniqueIds = Array.from(new Set(pointIds));
      if (uniqueIds.length < 3) return null;
      let id: string | null = null;
      let createdEdges: Array<{ id: string; aId: string; bId: string }> = [];
      ctx.setState((prev) => {
        createdEdges = [];
        for (let i = 0; i < uniqueIds.length; i += 1) {
          if (!prev.scene.points.some((p) => p.id === uniqueIds[i])) return prev;
        }
        const polygonId = `pg_${prev.nextPolygonId}`;

        const edgeIndexByKey = new Map<string, number>();
        for (let i = 0; i < prev.scene.segments.length; i += 1) {
          const seg = prev.scene.segments[i];
          edgeIndexByKey.set(edgeKey(seg.aId, seg.bId), i);
        }

        const newSegments = [...prev.scene.segments];
        let nextSegmentId = prev.nextSegmentId;
        for (let i = 0; i < uniqueIds.length; i += 1) {
          const aId = uniqueIds[i];
          const bId = uniqueIds[(i + 1) % uniqueIds.length];
          if (aId === bId) continue;
          const key = edgeKey(aId, bId);
          const existingIdx = edgeIndexByKey.get(key);
          if (existingIdx !== undefined) {
            const existingSeg = newSegments[existingIdx];
            if (Array.isArray(existingSeg.ownedByPolygonIds) && !existingSeg.ownedByPolygonIds.includes(polygonId)) {
              newSegments[existingIdx] = {
                ...existingSeg,
                ownedByPolygonIds: [...existingSeg.ownedByPolygonIds, polygonId],
              };
            }
            continue;
          }
          const segId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          const segForLabel = {
            id: segId,
            aId,
            bId,
            visible: true,
            showLabel: prev.objectLabelDefaults.segment,
            ownedByPolygonIds: [polygonId],
            style: prev.segmentDefaults,
          };
          newSegments.push({
            id: segId,
            aId,
            bId,
            ownedByPolygonIds: [polygonId],
            visible: true,
            showLabel: prev.objectLabelDefaults.segment,
            labelGlow: prev.objectLabelDefaults.segmentGlow ?? true,
            labelText: defaultSegmentLabelText(segForLabel, prev.scene),
            labelPosWorld: defaultSegmentLabelPosWorld(segForLabel, prev.scene) ?? undefined,
            style: { ...prev.segmentDefaults },
          });
          edgeIndexByKey.set(key, newSegments.length - 1);
          createdEdges.push({ id: segId, aId, bId });
        }

        id = polygonId;
        const showLabel = prev.objectLabelDefaults.polygon;
        const newPolygon = {
          id,
          pointIds: uniqueIds,
          visible: true,
          showLabel,
          labelGlow: prev.objectLabelDefaults.polygonGlow ?? true,
          labelText: defaultPolygonLabelText({ id, pointIds: uniqueIds, visible: true, showLabel, style: prev.polygonDefaults }, prev.scene),
          labelPosWorld:
            defaultPolygonLabelPosWorld(
              { id, pointIds: uniqueIds, visible: true, showLabel, style: prev.polygonDefaults },
              prev.scene
            ) ?? undefined,
          style: { ...prev.polygonDefaults },
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            segments: newSegments,
            polygons: [
              ...prev.scene.polygons,
              newPolygon,
            ],
          },
          selectedObject: { type: "polygon", id },
          recentCreatedObject: { type: "polygon", id },
          nextSegmentId,
          nextPolygonId: prev.nextPolygonId + 1,
        };
      });
      for (let i = 0; i < createdEdges.length; i += 1) {
        const edge = createdEdges[i];
        registerSegmentPair(edge.id, edge.aId, edge.bId);
      }
      return id;
    },

    createRegularPolygon(aId, bId, sides, direction) {
      if (aId === bId) return null;
      if (!Number.isInteger(sides) || sides < 3 || sides > 64) return null;
      if (direction !== "CCW" && direction !== "CW") return null;
      let id: string | null = null;
      let createdEdges: Array<{ id: string; aId: string; bId: string }> = [];
      ctx.setState((prev) => {
        createdEdges = [];
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        if (!a || !b) return prev;
        const aw = getPointWorldPos(a, prev.scene);
        const bw = getPointWorldPos(b, prev.scene);
        if (!aw || !bw) return prev;
        if (Math.hypot(aw.x - bw.x, aw.y - bw.y) <= 1e-12) return prev;

        const polygonId = `pg_${prev.nextPolygonId}`;
        const newPoints = [...prev.scene.points];
        const usedNames = new Set(newPoints.map((point) => point.name));
        let nextPointId = prev.nextPointId;
        // pointByRotation rotates the previous vertex around the current one.
        // To advance edge direction by orientation-selected exterior angle, we
        // rotate by interior angle and flip direction due to reversed base vector.
        const angleDeg = 180 - 360 / sides;
        const rotationDirection = direction === "CCW" ? "CW" : "CCW";
        const pointIds: string[] = [aId, bId];

        for (let i = 2; i < sides; i += 1) {
          let idx = 0;
          let name = nextLabelFromIndex(idx);
          while (usedNames.has(name)) {
            idx += 1;
            name = nextLabelFromIndex(idx);
          }
          usedNames.add(name);
          const pointId = `p_${nextPointId}`;
          nextPointId += 1;
          const centerId = pointIds[i - 1];
          const basePointId = pointIds[i - 2];
          newPoints.push({
            id: pointId,
            kind: "pointByRotation",
            name,
            captionTex: name,
            visible: true,
            showLabel: prev.objectLabelDefaults.point,
            locked: true,
            auxiliary: true,
            centerId,
            pointId: basePointId,
                angleDeg,
                direction: rotationDirection,
                radiusMode: "keep",
            style: {
              ...prev.pointDefaults,
              labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
            },
          });
          pointIds.push(pointId);
        }

        const edgeIndexByKey = new Map<string, number>();
        for (let i = 0; i < prev.scene.segments.length; i += 1) {
          const seg = prev.scene.segments[i];
          edgeIndexByKey.set(edgeKey(seg.aId, seg.bId), i);
        }

        const newSegments = [...prev.scene.segments];
        const sceneWithNewPoints = {
          ...prev.scene,
          points: newPoints,
        };
        let nextSegmentId = prev.nextSegmentId;
        for (let i = 0; i < pointIds.length; i += 1) {
          const pa = pointIds[i];
          const pb = pointIds[(i + 1) % pointIds.length];
          if (pa === pb) continue;
          const key = edgeKey(pa, pb);
          const existingIdx = edgeIndexByKey.get(key);
          if (existingIdx !== undefined) {
            const existingSeg = newSegments[existingIdx];
            if (Array.isArray(existingSeg.ownedByPolygonIds) && !existingSeg.ownedByPolygonIds.includes(polygonId)) {
              newSegments[existingIdx] = {
                ...existingSeg,
                ownedByPolygonIds: [...existingSeg.ownedByPolygonIds, polygonId],
              };
            }
            continue;
          }
          const segId = `s_${nextSegmentId}`;
          nextSegmentId += 1;
          const segForLabel = {
            id: segId,
            aId: pa,
            bId: pb,
            visible: true,
            showLabel: prev.objectLabelDefaults.segment,
            ownedByPolygonIds: [polygonId],
            style: prev.segmentDefaults,
          };
          newSegments.push({
            id: segId,
            aId: pa,
            bId: pb,
            ownedByPolygonIds: [polygonId],
            visible: true,
            showLabel: prev.objectLabelDefaults.segment,
            labelGlow: prev.objectLabelDefaults.segmentGlow ?? true,
            labelText: defaultSegmentLabelText(segForLabel, sceneWithNewPoints),
            labelPosWorld: defaultSegmentLabelPosWorld(segForLabel, sceneWithNewPoints) ?? undefined,
            style: { ...prev.segmentDefaults },
          });
          edgeIndexByKey.set(key, newSegments.length - 1);
          createdEdges.push({ id: segId, aId: pa, bId: pb });
        }

        id = polygonId;
        const polygonForLabel = {
          id: polygonId,
          pointIds,
          visible: true,
          showLabel: prev.objectLabelDefaults.polygon,
          style: prev.polygonDefaults,
        };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: newPoints,
            segments: newSegments,
            polygons: [
              ...prev.scene.polygons,
              {
                id: polygonId,
                pointIds,
                visible: true,
                showLabel: prev.objectLabelDefaults.polygon,
                labelGlow: prev.objectLabelDefaults.polygonGlow ?? true,
                labelText: defaultPolygonLabelText(polygonForLabel, sceneWithNewPoints),
                labelPosWorld: defaultPolygonLabelPosWorld(polygonForLabel, sceneWithNewPoints) ?? undefined,
                style: { ...prev.polygonDefaults },
              },
            ],
          },
          selectedObject: { type: "polygon", id: polygonId },
          recentCreatedObject: { type: "polygon", id: polygonId },
          nextPointId,
          nextSegmentId,
          nextPolygonId: prev.nextPolygonId + 1,
        };
      });
      for (let i = 0; i < createdEdges.length; i += 1) {
        const edge = createdEdges[i];
        registerSegmentPair(edge.id, edge.aId, edge.bId);
      }
      return id;
    },

    createCircleCenterPoint(circleId) {
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const circle = prev.scene.circles.find((c) => c.id === circleId);
        if (!circle) return prev;

        if (circle.kind !== "threePoint") {
          const center = prev.scene.points.find((p) => p.id === circle.centerId);
          if (!center) return prev;
          createdId = center.id;
          return {
            ...prev,
            selectedObject: { type: "point", id: center.id },
          };
        }

        const existing = prev.scene.points.find(
          (p) => p.kind === "circleCenter" && p.circleId === circleId
        );
        if (existing) {
          createdId = existing.id;
          return {
            ...prev,
            selectedObject: { type: "point", id: existing.id },
          };
        }

        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "circleCenter",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: true,
                auxiliary: true,
                circleId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },

    createTriangleCenterPoint(centerKind, aId, bId, cId) {
      if (aId === bId || bId === cId || aId === cId) return null;
      let createdId: string | null = null;
      ctx.setState((prev) => {
        const a = prev.scene.points.find((p) => p.id === aId);
        const b = prev.scene.points.find((p) => p.id === bId);
        const c = prev.scene.points.find((p) => p.id === cId);
        if (!a || !b || !c) return prev;
        const name = nextUnusedPointName(prev);
        const id = `p_${prev.nextPointId}`;
        createdId = id;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: [
              ...prev.scene.points,
              {
                id,
                kind: "triangleCenter",
                name,
                captionTex: name,
                visible: true,
                showLabel: prev.objectLabelDefaults.point,
                locked: true,
                auxiliary: true,
                centerKind: centerKind as TriangleCenterKind,
                aId,
                bId,
                cId,
                style: {
                  ...prev.pointDefaults,
                  labelOffsetPx: { ...prev.pointDefaults.labelOffsetPx },
                },
              },
            ],
          },
          selectedObject: { type: "point", id },
          recentCreatedObject: { type: "point", id },
          nextPointId: prev.nextPointId + 1,
        };
      });
      return createdId;
    },
  };
}
