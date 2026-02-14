export type DrawableObjectSelection =
  | { type: "point" | "segment" | "line" | "circle" | "polygon" | "angle"; id: string }
  | null;
