import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type ResizeSide = "left" | "right";

type ResizeState = {
  side: ResizeSide | null;
  startX: number;
  leftWidth: number;
  rightWidth: number;
};

type SidebarResizeOptions = {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftWidth: number;
  rightWidth: number;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  leftMin: number;
  leftMax: number;
  rightMin: number;
  rightMax: number;
};

export function useSidebarResize({
  leftCollapsed,
  rightCollapsed,
  leftWidth,
  rightWidth,
  setLeftWidth,
  setRightWidth,
  leftMin,
  leftMax,
  rightMin,
  rightMax,
}: SidebarResizeOptions) {
  const resizeRef = useRef<ResizeState>({
    side: null,
    startX: 0,
    leftWidth,
    rightWidth,
  });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = resizeRef.current;
      if (!st.side) return;

      const dx = e.clientX - st.startX;
      if (st.side === "left") {
        setLeftWidth(clamp(st.leftWidth + dx, leftMin, leftMax));
      } else {
        setRightWidth(clamp(st.rightWidth - dx, rightMin, rightMax));
      }
    };

    const onUp = () => {
      if (!resizeRef.current.side) return;
      resizeRef.current.side = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [leftMax, leftMin, rightMax, rightMin, setLeftWidth, setRightWidth]);

  const startResize = (side: ResizeSide) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((side === "left" && leftCollapsed) || (side === "right" && rightCollapsed)) return;
    resizeRef.current = {
      side,
      startX: e.clientX,
      leftWidth,
      rightWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return { startResize };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
