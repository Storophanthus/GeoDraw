declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
  );
}

export function installDesktopShellGuards(): void {
  if (!isTauriRuntime()) return;

  window.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    },
    { capture: true }
  );

  window.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();
      const isReloadShortcut = key === "f5" || ((event.metaKey || event.ctrlKey) && key === "r");
      if (!isReloadShortcut) return;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true }
  );
}

export {};
