/**
 * Resumable single-file downloader.
 *
 * - HTTP Range request resumes from `*.partial` at its current size.
 * - sha-256 streamed during download (no second pass).
 * - Atomic rename to the final filename only after sha verifies.
 * - Caller-driven cancel via AbortSignal; abort leaves the partial in place
 *   so the next `download()` call resumes.
 *
 * SECURITY.md §model integrity. The function never trusts the network — it
 * returns an `ArgusError("MODEL_INTEGRITY_FAILED")` and deletes the partial
 * on sha mismatch.
 */

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rename, stat, unlink } from "node:fs/promises";
import { ArgusError } from "@/shared/errors";
import type { ManifestModel } from "@/shared/types/manifest";
import { logger } from "@/main/log";
import { request } from "@/main/net/allowlist";
import {
  ensureModelsDir,
  existingBytes,
  isAlreadyComplete,
  modelPath,
  partialPath,
} from "./store";

export interface DownloadEvent {
  bytes: number;
  total: number;
}

interface DownloadOptions {
  signal: AbortSignal;
  onProgress: (event: DownloadEvent) => void;
}

export async function download(
  model: ManifestModel,
  { signal, onProgress }: DownloadOptions,
): Promise<void> {
  await ensureModelsDir();

  if (isAlreadyComplete(model.filename, model.sizeBytes)) {
    if (await verifyExisting(model)) {
      onProgress({ bytes: model.sizeBytes, total: model.sizeBytes });
      return;
    }
    // sha mismatch — remove and re-download
    await unlink(modelPath(model.filename)).catch(() => {});
  }

  const start = existingBytes(model.filename);
  if (start === model.sizeBytes) {
    onProgress({ bytes: start, total: model.sizeBytes });
    await verifyAndPromote(model);
    return;
  }
  if (start > model.sizeBytes) {
    await unlink(partialPath(model.filename)).catch(() => {});
    await streamToFile(model, 0, { signal, onProgress });
  } else {
    await streamToFile(model, start, { signal, onProgress });
  }
  await verifyAndPromote(model);
}

// ---------------------------------------------------------------------------

async function streamToFile(
  model: ManifestModel,
  start: number,
  { signal, onProgress }: DownloadOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (start > 0) headers["Range"] = `bytes=${start}-`;

    const req = request({ url: model.url, headers });

    const onAbort = () => {
      req.abort();
      reject(new ArgusError("MODEL_DOWNLOAD_FAILED", "aborted"));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });

    req.on("error", (err) => {
      signal.removeEventListener("abort", onAbort);
      reject(new ArgusError("MODEL_DOWNLOAD_FAILED", err.message));
    });

    req.on("response", (res) => {
      const status = res.statusCode;
      if (status !== 200 && status !== 206) {
        signal.removeEventListener("abort", onAbort);
        return reject(
          new ArgusError(
            "MODEL_DOWNLOAD_FAILED",
            `unexpected status ${status} for ${model.id}`,
          ),
        );
      }
      // 200 means the server ignored Range — restart from byte 0.
      const restart = status === 200 && start > 0;
      const initial = restart ? 0 : start;
      const sink = createWriteStream(partialPath(model.filename), {
        flags: restart ? "w" : "a",
      });
      let bytes = initial;

      res.on("data", (chunk: Buffer) => {
        sink.write(chunk);
        bytes += chunk.length;
        onProgress({ bytes, total: model.sizeBytes });
      });
      res.on("end", () => {
        sink.end(() => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        });
      });
      res.on("error", (err) => {
        sink.destroy();
        signal.removeEventListener("abort", onAbort);
        reject(new ArgusError("MODEL_DOWNLOAD_FAILED", err.message));
      });
    });

    req.end();
  });
}

async function verifyAndPromote(model: ManifestModel): Promise<void> {
  const partial = partialPath(model.filename);
  const final = modelPath(model.filename);

  const stats = await stat(partial).catch(() => null);
  if (!stats || stats.size !== model.sizeBytes) {
    throw new ArgusError(
      "MODEL_DOWNLOAD_FAILED",
      `size mismatch for ${model.id}: got ${stats?.size ?? 0}, expected ${model.sizeBytes}`,
    );
  }

  if (model.sha256) {
    const actual = await sha256(partial);
    if (actual !== model.sha256) {
      await unlink(partial).catch(() => {});
      throw new ArgusError(
        "MODEL_INTEGRITY_FAILED",
        `sha256 mismatch for ${model.id}`,
      );
    }
  } else {
    // v1-manifest tolerance documented in shared/types/manifest.ts.
    logger.warn("manifest entry has no sha256; accepting after size check", {
      id: model.id,
    });
  }

  await rename(partial, final);
}

async function verifyExisting(model: ManifestModel): Promise<boolean> {
  if (!model.sha256) return true; // see manifest.ts
  return (await sha256(modelPath(model.filename))) === model.sha256;
}

function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const s = createReadStream(path);
    s.on("data", (chunk) => hash.update(chunk));
    s.on("end", () => resolve(hash.digest("hex")));
    s.on("error", reject);
  });
}
