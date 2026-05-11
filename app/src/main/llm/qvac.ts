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
import { Buffer, type Buffer as NodeBuffer } from "node:buffer";
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { nativeImage, type Rectangle } from "electron";
import { logger } from "@/main/log";
import { isAlreadyComplete, loadManifest, modelPath } from "@/main/models/store";

type Sdk = typeof QvacSdk;

interface QvacRuntime {
  sdk: Sdk;
  /** Map manifest model id → SDK model id (the SDK assigns ids on load). */
  loaded: Map<string, string>;
  /** SDK model id for the OCR pipeline once it's been registered. The OCR
   *  pipeline is loaded once for the process lifetime — it bundles the CRAFT
   *  detector + the Latin recognizer under a single SDK model id. */
  ocrModelId: string | null;
  /** Single-flight latch: only one `loadModel` call for OCR can run at once. */
  ocrLoading: Promise<string | null> | null;
}

let runtimePromise: Promise<QvacRuntime | null> | null = null;
let stopped = false;

function loadRuntime(): Promise<QvacRuntime | null> {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    // A crashed previous dev / app run will leave the SDK's RocksDB LOCK
    // and `~/.qvac/.worker.lock` behind; the next `startQVACProvider()` then
    // hangs on `fd-lock` retries (we saw this in the wild during pre-demo
    // smoke tests). Clean stale locks before booting so the demo doesn't
    // require a manual `pkill` between runs.
    await cleanupStaleQvacLocks();
    try {
      const sdk = await import("@qvac/sdk");
      await sdk.startQVACProvider();
      logger.info("qvac provider started");
      return {
        sdk,
        loaded: new Map(),
        ocrModelId: null,
        ocrLoading: null,
      };
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
 * Best-effort cleanup of orphaned QVAC locks. If a Bare worker is *still*
 * running from a prior session, we leave the locks alone — the new
 * `startQVACProvider()` will surface the conflict honestly. If no worker is
 * alive, the locks are stale and we remove them so the SDK can boot.
 */
async function cleanupStaleQvacLocks(): Promise<void> {
  const qvacDir = join(homedir(), ".qvac");
  try {
    await stat(qvacDir);
  } catch {
    return; // No ~/.qvac yet — first boot, nothing to clean.
  }

  if (hasLiveQvacWorker()) {
    logger.info("qvac worker already alive; not touching locks");
    return;
  }

  let cleaned = 0;
  const workerLock = join(qvacDir, ".worker.lock");
  try {
    await unlink(workerLock);
    cleaned += 1;
  } catch {
    /* missing is fine */
  }
  cleaned += removeRocksDbLocks(join(qvacDir, "registry-corestore"));
  if (cleaned > 0) {
    logger.info("qvac stale locks cleared at boot", { cleaned });
  }
}

function hasLiveQvacWorker(): boolean {
  try {
    // `pgrep -f` returns 0 if any process matches the pattern. We grep for
    // the worker.js path so this only catches QVAC workers (not other Bare
    // apps on the system).
    execSync("pgrep -f '@qvac/sdk/dist/server/worker.js'", {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function removeRocksDbLocks(rootDir: string): number {
  let removed = 0;
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: { name: string; isDirectory: () => boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as unknown as {
        name: string;
        isDirectory: () => boolean;
      }[];
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.name === "LOCK") {
        try {
          // Synchronous because we're inside an async boot path that's
          // already gated behind a single-flight latch — the extra await
          // adds nothing.
          execSync(`rm -f ${JSON.stringify(path)}`);
          removed += 1;
        } catch {
          /* ignore — best-effort */
        }
      }
    }
  }
  return removed;
}

/**
 * Ensure a manifest model is loaded into QVAC. Returns the SDK model id, or
 * `null` if the manifest entry is missing, the file isn't downloaded, or the
 * SDK rejects the load.
 */
async function ensureLoaded(
  manifestId: string,
  modelType: "llamacpp-completion" | "llamacpp-embedding" | "whispercpp-transcription",
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
  const handle = await ensureLoaded(manifestId, "llamacpp-completion");
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
  const handle = await ensureLoaded(manifestId, "llamacpp-embedding");
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

// ---------------------------------------------------------------------------
// OCR — `@qvac/ocr-onnx` via the SDK's EasyOCR pipeline (CRAFT detector +
// Latin recognizer). Models are pulled by the SDK's registry on first call;
// our own manifest doesn't track them because the SDK ships the descriptors.
// ---------------------------------------------------------------------------

export interface OcrBlock {
  text: string;
  confidence?: number;
}

async function ensureOcrLoaded(runtime: QvacRuntime): Promise<string | null> {
  if (runtime.ocrModelId) return runtime.ocrModelId;
  if (runtime.ocrLoading) return runtime.ocrLoading;
  runtime.ocrLoading = (async () => {
    try {
      const id = await runtime.sdk.loadModel({
        modelSrc: runtime.sdk.OCR_LATIN_RECOGNIZER_1,
        modelType: "ocr",
        modelConfig: {
          langList: ["en"],
          useGPU: true,
          timeout: 30_000,
          magRatio: 1.5,
          defaultRotationAngles: [90, 180, 270],
          contrastRetry: false,
          lowConfidenceThreshold: 0.5,
          recognizerBatchSize: 1,
        },
      });
      runtime.ocrModelId = id;
      logger.info("qvac ocr pipeline loaded", { id });
      return id;
    } catch (err) {
      logger.error("qvac ocr loadModel failed", {
        msg: err instanceof Error ? err.message : "?",
      });
      return null;
    } finally {
      runtime.ocrLoading = null;
    }
  })();
  return runtime.ocrLoading;
}

/**
 * Run OCR over an image buffer. Returns extracted text blocks (in reading
 * order) or `null` if the SDK / OCR pipeline isn't available — callers must
 * have a no-OCR path (the verdict pipeline already skips OCR signals when
 * this returns null).
 */
export async function ocrImage(
  image: NodeBuffer | Uint8Array,
): Promise<OcrBlock[] | null> {
  if (stopped) return null;
  const runtime = await loadRuntime();
  if (!runtime) return null;
  const modelId = await ensureOcrLoaded(runtime);
  if (!modelId) return null;

  const variants = buildOcrImageVariants(Buffer.from(image));
  const allBlocks: OcrBlock[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    try {
      const { blocks } = runtime.sdk.ocr({
        modelId,
        image: variant.bytes,
      });
      const resolved = await blocks;
      logger.info("qvac ocr variant complete", {
        variant: variant.label,
        blocks: resolved.length,
      });
      for (const block of resolved) {
        const text = block.text.trim();
        if (!text || seen.has(text.toLowerCase())) continue;
        seen.add(text.toLowerCase());
        allBlocks.push({ text, confidence: block.confidence });
      }
    } catch (err) {
      logger.warn("qvac ocr variant failed", {
        variant: variant.label,
        msg: err instanceof Error ? err.message : "?",
      });
    }
  }
  if (allBlocks.length === 0) {
    logger.warn("qvac ocr found no text across image variants");
    return null;
  }
  return allBlocks;
}

interface OcrImageVariant {
  label: string;
  bytes: Buffer;
}

function buildOcrImageVariants(input: Buffer): OcrImageVariant[] {
  const img = nativeImage.createFromBuffer(input);
  const size = img.getSize();
  if (size.width <= 0 || size.height <= 0) return [{ label: "original", bytes: input }];

  const variants: OcrImageVariant[] = [];
  const add = (label: string, source: Electron.NativeImage): void => {
    if (source.isEmpty()) return;
    const resized = source.resize({ width: 512, height: 512, quality: "best" });
    variants.push({ label, bytes: resized.toPNG() });
  };
  const crop = (label: string, rect: Rectangle): void => {
    const x = clampInt(rect.x, 0, size.width - 1);
    const y = clampInt(rect.y, 0, size.height - 1);
    const width = clampInt(rect.width, 1, size.width - x);
    const height = clampInt(rect.height, 1, size.height - y);
    add(label, img.crop({ x, y, width, height }));
  };

  add("full", img);
  crop("browser-url-bar", {
    x: Math.round(size.width * 0.04),
    y: 0,
    width: Math.round(size.width * 0.92),
    height: Math.round(size.height * 0.09),
  });
  crop("center-modal", {
    x: Math.round(size.width * 0.28),
    y: Math.round(size.height * 0.18),
    width: Math.round(size.width * 0.44),
    height: Math.round(size.height * 0.58),
  });
  crop("upper-page", {
    x: 0,
    y: 0,
    width: size.width,
    height: Math.round(size.height * 0.45),
  });

  return variants;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Voice — Whisper STT (`@qvac/sdk` `transcribe`).
//
// Our manifest already ships `ggml-base.en.bin` (whisper-base-en) which is
// byte-identical to QVAC's `WHISPER_EN_BASE_Q0F16` descriptor. The local
// path is what the SDK loads — same lazy lifecycle pattern as the other
// model surfaces.
// ---------------------------------------------------------------------------

const WHISPER_MODEL_ID = "whisper-base-en";

/**
 * Transcribe a recorded audio buffer (any format Whisper.cpp can read —
 * 16 kHz mono PCM is ideal but WAV / OGG / FLAC also work). Returns
 * `null` if the SDK / model isn't ready; the caller has a no-voice path.
 */
export async function transcribeAudio(
  audio: NodeBuffer | Uint8Array,
): Promise<string | null> {
  const handle = await ensureLoaded(WHISPER_MODEL_ID, "whispercpp-transcription");
  if (!handle) return null;
  try {
    const text = await handle.runtime.sdk.transcribe({
      modelId: handle.modelId,
      audioChunk: Buffer.from(audio),
    });
    return text.trim();
  } catch (err) {
    logger.warn("qvac transcribe failed", {
      msg: err instanceof Error ? err.message : "?",
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Voice — Chatterbox TTS via the SDK's registered descriptor.
//
// The SDK's `loadModel({ modelSrc: TTS_EN_ES_CHATTERBOX_Q4F16, modelType: "tts" })`
// path auto-resolves the companion model files (tokenizer, speech encoder,
// embed tokens, conditional decoder, reference audio) via the model
// registry. First call downloads ~1 GB; subsequent calls reuse the cache.
//
// Returned PCM samples are 24 kHz mono float — the renderer plays them via
// AudioContext.createBuffer with sampleRate 24000.
// ---------------------------------------------------------------------------

const TTS_SAMPLE_RATE = 24_000;

async function ensureTtsLoaded(runtime: QvacRuntime): Promise<string | null> {
  const cacheKey = "__tts_chatterbox";
  const cached = runtime.loaded.get(cacheKey);
  if (cached) return cached;
  try {
    const id = await runtime.sdk.loadModel({
      modelSrc: runtime.sdk.TTS_TOKENIZER_EN_CHATTERBOX.src,
      modelType: "onnx-tts",
      modelConfig: {
        ttsEngine: "chatterbox",
        language: "en",
        ttsTokenizerSrc: runtime.sdk.TTS_TOKENIZER_EN_CHATTERBOX.src,
        ttsSpeechEncoderSrc: runtime.sdk.TTS_SPEECH_ENCODER_EN_CHATTERBOX_FP32.src,
        ttsEmbedTokensSrc: runtime.sdk.TTS_EMBED_TOKENS_EN_CHATTERBOX_FP32.src,
        ttsConditionalDecoderSrc:
          runtime.sdk.TTS_CONDITIONAL_DECODER_EN_CHATTERBOX_FP32.src,
        ttsLanguageModelSrc: runtime.sdk.TTS_LANGUAGE_MODEL_EN_CHATTERBOX_FP32.src,
        referenceAudioSrc: "node_modules/@qvac/tts-onnx/test/reference-audio/jfk.wav",
      },
    });
    runtime.loaded.set(cacheKey, id);
    logger.info("qvac tts pipeline loaded", { id });
    return id;
  } catch (err) {
    logger.warn("qvac tts loadModel failed", {
      msg: err instanceof Error ? err.message : "?",
    });
    return null;
  }
}

export interface TtsAudio {
  /** PCM samples as a regular `number[]` (the SDK's wire format). The
   *  renderer copies them into a Float32Array before piping into
   *  AudioContext. */
  samples: number[];
  sampleRate: number;
}

/**
 * Synthesize speech for the verdict explanation. Returns `null` if the
 * Chatterbox model isn't loaded (first call is ~1 GB download), the SDK
 * runtime isn't up, or the synthesis errors. Callers must surface a
 * disabled / error state — there is no fallback voice.
 */
export async function synthesizeSpeech(text: string): Promise<TtsAudio | null> {
  if (stopped) return null;
  const runtime = await loadRuntime();
  if (!runtime) return null;
  const modelId = await ensureTtsLoaded(runtime);
  if (!modelId) return null;
  try {
    const result = runtime.sdk.textToSpeech({
      modelId,
      text: text.trim(),
      stream: false,
    });
    const samples = await result.buffer;
    return { samples, sampleRate: TTS_SAMPLE_RATE };
  } catch (err) {
    logger.warn("qvac tts synthesis failed", {
      msg: err instanceof Error ? err.message : "?",
    });
    return null;
  }
}

/** Registered in main/index.ts under `app.on("before-quit")`. Bounded by a
 *  3-second timeout: if the QVAC worker is wedged (we observed this in
 *  pre-demo smoke when the Bare worker was hot-spinning at 98 % CPU and
 *  ignored its IPC stop request), we still return so `app.quit()` can
 *  proceed. Stale locks left behind will be cleaned by
 *  `cleanupStaleQvacLocks()` on the next boot. */
export async function shutdownQvac(): Promise<void> {
  stopped = true;
  if (!runtimePromise) return;
  const runtime = await runtimePromise;
  if (!runtime) return;
  try {
    await Promise.race([
      runtime.sdk.stopQVACProvider(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("qvac stopQVACProvider timed out after 3s")),
          3_000,
        ),
      ),
    ]);
    logger.info("qvac provider stopped");
  } catch (err) {
    logger.warn("qvac provider stop failed (cleanup will run on next boot)", {
      msg: err instanceof Error ? err.message : "?",
    });
  }
}
