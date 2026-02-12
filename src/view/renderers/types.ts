export type DrawableObjectSelection =
  | { type: "point" | "segment" | "line" | "circle" | "angle"; id: string }
  | null;
