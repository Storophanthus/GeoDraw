import { isNameUnique, isValidPointName } from "../../scene/points";
import type { SetStateOptions } from "./historySlice";
import type { GeoActions, GeoState, RenameResult } from "./storeTypes";

type SetState = (updater: (prev: GeoState) => GeoState, options?: SetStateOptions) => void;

export function createSceneRenameActions({ setState }: { setState: SetState }): Pick<GeoActions, "renameSelectedPoint"> {
  return {
    renameSelectedPoint(nextNameRaw: string): RenameResult {
      const nextName = nextNameRaw.trim();
      if (!nextName) return { ok: false, error: "Name cannot be empty." };
      if (!isValidPointName(nextName)) {
        return { ok: false, error: "Name must match /^[A-Za-z][A-Za-z0-9_]*$/." };
      }

      let result: RenameResult = { ok: true, name: nextName };

      setState((prev) => {
        if (!prev.selectedObject || prev.selectedObject.type !== "point") {
          result = { ok: false, error: "No point selected." };
          return prev;
        }

        const selected = prev.scene.points.find((point) => point.id === prev.selectedObject!.id);
        if (!selected) {
          result = { ok: false, error: "Selected point was not found." };
          return { ...prev, selectedObject: null };
        }

        const unique = isNameUnique(
          nextName,
          prev.scene.points.map((point) => point.name),
          selected.name
        );
        if (!unique) {
          result = { ok: false, error: `Point \"${nextName}\" already exists.` };
          return prev;
        }

        result = { ok: true, name: nextName };
        return {
          ...prev,
          scene: {
            ...prev.scene,
            points: prev.scene.points.map((point) =>
              point.id === selected.id ? { ...point, name: nextName } : point
            ),
          },
        };
      });

      return result;
    },
  };
}
