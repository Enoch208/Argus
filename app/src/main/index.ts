import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { logger } from "./log";
import { registerModelsHandlers } from "./ipc/handlers/models";
import { registerReviewHandlers } from "./ipc/handlers/review";
import { registerVoiceHandlers } from "./ipc/handlers/voice";
import { registerWalletHandlers } from "./ipc/handlers/wallet";
import { shutdownQvac } from "./llm/qvac";
import { registry } from "./models/registry";
import { createMainWindow } from "./window";

// Single-instance lock — only one Argus window ever, even on relaunch.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function isLive(win: BrowserWindow | null): win is BrowserWindow {
  return win !== null && !win.isDestroyed();
}

function spawnMainWindow(): void {
  const win = createMainWindow();
  mainWindow = win;

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialise the registry before opening the window so the renderer's first
  // `models.status` call returns a real snapshot, not an empty default.
  try {
    await registry.init();
  } catch (err) {
    logger.error("registry.init failed", { msg: err instanceof Error ? err.message : "?" });
  }

  registerWalletHandlers();
  registerModelsHandlers();
  registerReviewHandlers();
  registerVoiceHandlers();

  spawnMainWindow();

  app.on("activate", () => {
    if (!isLive(mainWindow) && BrowserWindow.getAllWindows().length === 0) {
      spawnMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Stop the QVAC worker before Electron tears down the main process. Tracked
// awaits inside `before-quit` block app.quit(); we event.preventDefault() once
// to drain, then quit again. Idempotent — `shutdownQvac` is safe to call
// multiple times.
let qvacShutdown: Promise<void> | null = null;
app.on("before-quit", (event) => {
  if (qvacShutdown) return;
  event.preventDefault();
  qvacShutdown = shutdownQvac()
    .catch((err) => logger.warn("qvac shutdown error", { msg: String(err) }))
    .finally(() => app.quit());
});

app.on("second-instance", () => {
  if (!isLive(mainWindow)) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});
