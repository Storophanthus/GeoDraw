export type DrawableObjectSelection =
  | { type: "point" | "segment" | "line" | "circle" | "ellipse" | "polygon" | "angle"; id: string }
  | null;
