/**
 * QVAC SDK boundary.
 *
 * Argus is "Built with QVAC" — every model invocation goes through the
 * official `@qvac/sdk` (Tether's on-device AI stack), not directly through
 * llama.cpp. The SDK is ESM + uses bare-globals polyfills, so we
 * dynamic-import once and reuse for the process lifetime — same pattern as
 * WDK ([wallet/manager.ts](../wallet/manager.ts)).
 *
 * Lifecycle (per [ADR-0010](../../docs/decisions/0010-qvac-llm-runtime.md),
 * revised):
 *   1. `startQVACProvider()` boots the worker on first need.
 *   2. `loadModel()` registers a GGUF by absolute path; the SDK returns a
 *      stable string id we keep around.
 *   3. `complete()` / `embed()` are the only surfaces this module exports.
 *   4. `stopQVACProvider()` runs on app quit (registered in main/index.ts).
 *
 * Failure mode: if the SDK can't init (e.g. bare-globals polyfill is
 * incompatible with the host runtime), the helpers return `null` so the
 * verdict pipeline degrades to its deterministic fallback rather than
 * hard-failing. This module never throws to its callers.
 */

import type * as QvacSdk from "@qvac/sdk";
import { logger } from "@/main/log";
import { isAlreadyComplete, loadManifest, modelPath } from "@/main/models/store";

type Sdk = typeof QvacSdk;

interface QvacRuntime {
  sdk: Sdk;
  /** Map manifest model id → SDK model id (the SDK assigns ids on load). */
  loaded: Map<string, string>;
}

let runtimePromise: Promise<QvacRuntime | null> | null = null;
let stopped = false;

function loadRuntime(): Promise<QvacRuntime | null> {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    try {
      const sdk = await import("@qvac/sdk");
      await sdk.startQVACProvider();
      logger.info("qvac provider started");
      return { sdk, loaded: new Map() };
    } catch (err) {
      logger.error("qvac provider failed to start", {
        msg: err instanceof Error ? err.message : "?",
      });
      return null;
    }
  })();
  return runtimePromise;
}

/**
 * Ensure a manifest model is loaded into QVAC. Returns the SDK model id, or
 * `null` if the manifest entry is missing, the file isn't downloaded, or the
 * SDK rejects the load.
 */
async function ensureLoaded(
  manifestId: string,
  modelType: "llm" | "embeddings",
): Promise<{ runtime: QvacRuntime; modelId: string } | null> {
  if (stopped) return null;
  const runtime = await loadRuntime();
  if (!runtime) return null;

  const cached = runtime.loaded.get(manifestId);
  if (cached) return { runtime, modelId: cached };

  const manifest = await loadManifest();
  const entry = manifest.models.find((m) => m.id === manifestId);
  if (!entry || !isAlreadyComplete(entry.filename, entry.sizeBytes)) {
    logger.info("qvac model not ready on disk", { id: manifestId });
    return null;
  }

  try {
    const modelId = await runtime.sdk.loadModel({
      modelSrc: modelPath(entry.filename),
      modelType,
    });
    runtime.loaded.set(manifestId, modelId);
    logger.info("qvac model loaded", { id: manifestId, modelType });
    return { runtime, modelId };
  } catch (err) {
    logger.error("qvac loadModel failed", {
      id: manifestId,
      msg: err instanceof Error ? err.message : "?",
    });
    return null;
  }
}

/**
 * One-shot completion through QVAC. Returns the model's text output, or
 * `null` if the runtime / model isn't available — callers must have a
 * deterministic fallback.
 */
export async function complete(
  manifestId: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string | null> {
  const handle = await ensureLoaded(manifestId, "llm");
  if (!handle) return null;
  try {
    const run = await handle.runtime.sdk.completion({
      modelId: handle.modelId,
      history: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      generationParams: {
        temp: opts.temperature ?? 0.2,
        predict: opts.maxTokens ?? 480,
      },
    });
    const final = await run.final;
    return final.contentText ?? "";
  } catch (err) {
    logger.warn("qvac completion failed", {
      id: manifestId,
      msg: err instanceof Error ? err.message : "?",
    });
    return null;
  }
}

/**
 * Single-text embedding through QVAC. Returns a Float32Array (cosine-friendly
 * shape) or `null` if the embedder model / runtime isn't available — callers
 * must have a lexical fallback.
 */
export async function embed(
  manifestId: string,
  text: string,
): Promise<Float32Array | null> {
  const handle = await ensureLoaded(manifestId, "embeddings");
  if (!handle) return null;
  try {
    const { embedding } = await handle.runtime.sdk.embed({
      modelId: handle.modelId,
      text: text.slice(0, 4_000),
    });
    return Float32Array.from(embedding);
  } catch (err) {
    logger.warn("qvac embed failed", {
      id: manifestId,
      msg: err instanceof Error ? err.message : "?",
    });
    return null;
  }
}

/** Registered in main/index.ts under `app.on("before-quit")`. */
export async function shutdownQvac(): Promise<void> {
  stopped = true;
  if (!runtimePromise) return;
  const runtime = await runtimePromise;
  if (!runtime) return;
  try {
    await runtime.sdk.stopQVACProvider();
    logger.info("qvac provider stopped");
  } catch (err) {
    logger.warn("qvac provider stop failed", {
      msg: err instanceof Error ? err.message : "?",
    });
  }
}
