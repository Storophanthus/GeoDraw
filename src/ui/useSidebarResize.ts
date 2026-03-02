import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type ResizeSide = "left" | "right";

type ResizeState = {
  side: ResizeSide | null;
  startX: number;
  leftWidth: number;
  rightWidth: number;
  pointerId: number | null;
  handleEl: HTMLDivElement | null;
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
    pointerId: null,
    handleEl: null,
  });

  useEffect(() => {
    const clearResizeState = () => {
      const st = resizeRef.current;
      if (st.handleEl !== null && st.pointerId !== null) {
        try {
          if (st.handleEl.hasPointerCapture(st.pointerId)) {
            st.handleEl.releasePointerCapture(st.pointerId);
          }
        } catch {
          // Ignore release errors if capture is already gone.
        }
      }
      resizeRef.current.side = null;
      resizeRef.current.pointerId = null;
      resizeRef.current.handleEl = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.removeProperty("-webkit-user-select");
      document.documentElement.style.userSelect = "";
      document.documentElement.style.removeProperty("-webkit-user-select");
      document.body.classList.remove("sidebar-resizing");
    };

    const onMove = (e: PointerEvent) => {
      const st = resizeRef.current;
      if (!st.side) return;
      if (st.pointerId !== null && e.pointerId !== st.pointerId) return;
      e.preventDefault();

      const dx = e.clientX - st.startX;
      if (st.side === "left") {
        setLeftWidth(clamp(st.leftWidth + dx, leftMin, leftMax));
      } else {
        setRightWidth(clamp(st.rightWidth - dx, rightMin, rightMax));
      }
    };

    const onUp = (e: PointerEvent) => {
      const st = resizeRef.current;
      if (!st.side) return;
      if (st.pointerId !== null && e.pointerId !== st.pointerId) return;
      e.preventDefault();
      clearResizeState();
    };

    const onCancel = (e: PointerEvent) => {
      const st = resizeRef.current;
      if (!st.side) return;
      if (st.pointerId !== null && e.pointerId !== st.pointerId) return;
      clearResizeState();
    };

    const onWindowBlur = () => {
      if (!resizeRef.current.side) return;
      clearResizeState();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onWindowBlur);
      clearResizeState();
    };
  }, [leftMax, leftMin, rightMax, rightMin, setLeftWidth, setRightWidth]);

  const startResize = (side: ResizeSide) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((side === "left" && leftCollapsed) || (side === "right" && rightCollapsed)) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handleEl = e.currentTarget;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is best-effort on this handle.
    }
    resizeRef.current = {
      side,
      startX: e.clientX,
      leftWidth,
      rightWidth,
      pointerId: e.pointerId,
      handleEl,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.style.setProperty("-webkit-user-select", "none");
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.setProperty("-webkit-user-select", "none");
    document.body.classList.add("sidebar-resizing");
  };

  return { startResize };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
