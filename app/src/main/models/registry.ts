/**
 * Single source of model state for the main process. Owns:
 *   - the parsed manifest
 *   - the in-memory progress map
 *   - the download queue + cancel signal
 *   - the on-launch integrity check
 *
 * The IPC handlers in `main/ipc/handlers/models.ts` are the only consumers.
 */

import type {
  ModelProgress as ModelProgressOut,
  ModelsStatus,
  ModelState,
} from "@/shared/ipc";
import type { Manifest, ManifestModel } from "@/shared/types/manifest";
import { ArgusError } from "@/shared/errors";
import { logger } from "@/main/log";
import { allow } from "@/main/net/allowlist";
import { download } from "./downloader";
import { isAlreadyComplete, loadManifest } from "./store";

interface Slot {
  model: ManifestModel;
  state: ModelState;
  bytes: number;
  error: string | null;
}

class Registry {
  private manifest: Manifest | null = null;
  private slots: Slot[] = [];
  private active = false;
  private aborter: AbortController | null = null;

  async init(): Promise<void> {
    if (this.manifest) return;
    const m = await loadManifest();
    this.manifest = m;

    // Trust the manifest to declare every host it might fetch from.
    for (const host of m.allowedHosts) allow(host);

    this.slots = m.models.map((model) => {
      const complete = isAlreadyComplete(model.filename, model.sizeBytes);
      return {
        model,
        state: complete ? "ready" : "queued",
        bytes: complete ? model.sizeBytes : 0,
        error: null,
      };
    });

    logger.info("model registry initialised", {
      total: this.slots.length,
      ready: this.slots.filter((s) => s.state === "ready").length,
    });
  }

  status(): ModelsStatus {
    const models = this.slots.map<ModelProgressOut>((s) => ({
      id: s.model.id,
      name: s.model.name,
      role: s.model.role,
      vram: s.model.vram,
      sizeBytes: s.model.sizeBytes,
      downloadedBytes: s.bytes,
      state: s.state,
      error: s.error,
    }));
    const total = models.reduce((a, m) => a + m.sizeBytes, 0);
    const done = models.reduce((a, m) => a + m.downloadedBytes, 0);
    return {
      ready: models.every((m) => m.state === "ready"),
      active: this.active,
      fraction: total === 0 ? 0 : done / total,
      models,
    };
  }

  async start(): Promise<void> {
    if (this.active) return;
    if (!this.manifest) throw new ArgusError("MODEL_MANIFEST_INVALID", "registry not initialised");

    this.active = true;
    this.aborter = new AbortController();
    const signal = this.aborter.signal;

    try {
      for (const slot of this.slots) {
        if (signal.aborted) break;
        if (slot.state === "ready") continue;

        slot.state = "downloading";
        slot.error = null;

        try {
          await download(slot.model, {
            signal,
            onProgress: ({ bytes }) => {
              slot.bytes = bytes;
            },
          });
          slot.state = "ready";
          slot.bytes = slot.model.sizeBytes;
          logger.info("model ready", { id: slot.model.id });
        } catch (err) {
          if (signal.aborted) {
            slot.state = "paused";
            break;
          }
          const msg = err instanceof Error ? err.message : "unknown";
          slot.state = "error";
          slot.error = msg;
          logger.error("model download failed", { id: slot.model.id, msg });
          // continue to the next model — one failure shouldn't block others
        }
      }
    } finally {
      this.active = false;
      this.aborter = null;
    }
  }

  pause(): void {
    if (!this.active || !this.aborter) return;
    this.aborter.abort();
  }
}

export const registry = new Registry();
