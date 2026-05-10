/**
 * Preload — the only bridge across the IPC boundary.
 *
 * STRICT (ARCHITECTURE.md, SECURITY.md):
 *   - No business logic. Only typed pass-through.
 *   - The renderer sees a single `window.argus` object with one method per
 *     channel registered in `@/shared/ipc`.
 *   - Keep this file dependency-light. With `sandbox: true`, importing the
 *     zod-backed shared channel registry can prevent the bridge from loading.
 */

import { contextBridge, ipcRenderer } from "electron";
import type { ChannelName } from "../shared/ipc";

const channelNames = [
  "wallet.state",
  "wallet.create",
  "wallet.confirmCreate",
  "wallet.import",
  "wallet.unlock",
  "wallet.lock",
  "review.start",
  "review.approve",
  "review.block",
  "review.queue",
  "review.history",
  "review.search",
  "models.status",
  "models.start",
  "models.pause",
] satisfies ChannelName[];

const invoke = <C extends ChannelName>(
  channel: C,
  payload: unknown,
): Promise<unknown> => ipcRenderer.invoke(channel, payload);

const argus = {
  invoke,
  channels: channelNames,
} as const;

contextBridge.exposeInMainWorld("argus", argus);

declare global {
  interface Window {
    argus?: typeof argus;
  }
}

export type ArgusBridge = typeof argus;
