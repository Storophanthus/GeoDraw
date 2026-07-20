import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

const MENU_EVENT_CHECK_UPDATES = "gd-menu-check-updates";

// Delay the automatic check so it never competes with first paint.
const STARTUP_CHECK_DELAY_MS = 4000;

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as object);

/**
 * Wires up the updater. A quiet check runs shortly after launch and only
 * speaks up when an update exists; the Help menu item runs the same check but
 * reports "up to date" and failures too, so a manual check always says something.
 */
export function UpdateChecker() {
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;

    const runCheck = async (silent: boolean) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const update = await check();

        if (!update) {
          if (!silent) {
            await message("GeoDraw is up to date.", { title: "Check for Updates", kind: "info" });
          }
          return;
        }

        const install = await ask(
          `GeoDraw ${update.version} is available. You are running ${update.currentVersion}.\n\nDownload and install it now?`,
          { title: "Update Available", kind: "info", okLabel: "Install", cancelLabel: "Later" },
        );
        if (!install || disposed) return;

        await update.downloadAndInstall();

        const restart = await ask("The update has been installed. Restart GeoDraw now?", {
          title: "Update Installed",
          kind: "info",
          okLabel: "Restart",
          cancelLabel: "Later",
        });
        if (restart) await relaunch();
      } catch (err) {
        // A failed background check is not worth interrupting anyone over.
        if (silent) {
          console.warn("Background update check failed:", err);
          return;
        }
        await message(`Could not check for updates.\n\n${String(err)}`, {
          title: "Check for Updates",
          kind: "error",
        });
      } finally {
        checkingRef.current = false;
      }
    };

    const startupTimer = window.setTimeout(() => void runCheck(true), STARTUP_CHECK_DELAY_MS);

    let unlisten: UnlistenFn | undefined;
    void listen(MENU_EVENT_CHECK_UPDATES, () => void runCheck(false)).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    return () => {
      disposed = true;
      window.clearTimeout(startupTimer);
      unlisten?.();
    };
  }, []);

  return null;
}
