import { BrowserWindow, shell } from "electron";
import { join } from "node:path";

/**
 * BrowserWindow factory enforcing the chrome rules from docs/UI-RULES.md and
 * the security posture from docs/SECURITY.md. Don't create windows elsewhere.
 */
export function createMainWindow(): BrowserWindow {
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    show: false, // shown on `ready-to-show` to avoid white flash

    backgroundColor: "#08080a",

    // Mac: hidden-inset traffic lights inset into the sidebar (per UI-RULES).
    ...(isMac && {
      titleBarStyle: "hiddenInset" as const,
      trafficLightPosition: { x: 14, y: 16 },
      vibrancy: "under-window" as const,
      visualEffectState: "active" as const,
    }),

    // Win 11: Mica blur + custom title-bar overlay.
    ...(isWin && {
      backgroundMaterial: "mica" as const,
      titleBarOverlay: {
        color: "#08080a",
        symbolColor: "#ffffff",
        height: 36,
      },
    }),

    webPreferences: {
      // SECURITY.md §process isolation — non-negotiable.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, "../preload/index.js"),
    },
  });

  win.once("ready-to-show", () => {
    win.show();
    if (process.env.ELECTRON_RENDERER_URL) {
      // Dev only — open DevTools so renderer errors are visible.
      win.webContents.openDevTools({ mode: "detach" });
    }
  });

  // SECURITY.md §window features — no in-app popups; deflect to OS browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("http://localhost") && !url.startsWith("file://")) {
      event.preventDefault();
    }
  });

  return win;
}
