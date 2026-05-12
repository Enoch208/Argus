// Must be the first import — patches `child_process.spawn` to rewrite
// `app.asar/` paths to `app.asar.unpacked/`. Without this the Bare runtime
// binary spawn fails with `ENOTDIR` in the packaged build because
// `bare-runtime-<platform>-<arch>` resolves the binary path off of
// `__filename`, which sits inside the asar.
import "./asar-spawn-shim";

import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { logger } from "./log";
import { registerModelsHandlers } from "./ipc/handlers/models";
import { registerReviewHandlers } from "./ipc/handlers/review";
import { registerStackHandlers } from "./ipc/handlers/stack";
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
    void loadDevRenderer(win, process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
}

async function loadDevRenderer(win: BrowserWindow, url: string): Promise<void> {
  const attempts = 30;
  for (let i = 1; i <= attempts; i += 1) {
    if (win.isDestroyed()) return;
    try {
      await win.loadURL(url);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("ERR_CONNECTION_REFUSED") || i === attempts) {
        logger.error("renderer load failed", { url, msg: message });
        throw err;
      }
      await delay(250);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  // Initialise the registry before opening the window so the renderer's first
  // `models.status` call returns a real snapshot, not an empty default.
  try {
    await registry.init();
  } catch (err) {
    logger.error("registry.init failed", {
      msg: err instanceof Error ? err.message : "?",
    });
  }

  registerWalletHandlers();
  registerModelsHandlers();
  registerStackHandlers();
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
