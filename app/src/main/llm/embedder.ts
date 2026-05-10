/**
 * Local embedding boundary.
 *
 * Wraps `node-llama-cpp`'s embedding context around the bundled
 * bge-small-en-v1.5 GGUF (manifest id `bge-small-en-v1-5`). Same dynamic-import
 * pattern as [verdict/explainer.ts](../verdict/explainer.ts):
 *   - load on first call, memoise for the process lifetime
 *   - any failure returns `null` so callers can fall back deterministically
 *
 * Vector shape is whatever bge-small emits (384-d), normalised inside
 * `cosineFloat32` so callers don't need to care.
 */
import { logger } from "@/main/log";
import { isAlreadyComplete, loadManifest, modelPath } from "@/main/models/store";

const EMBEDDER_MODEL_ID = "bge-small-en-v1-5";

export interface Embedder {
  embed(text: string): Promise<Float32Array>;
}

let embedderPromise: Promise<Embedder | null> | null = null;

export function getEmbedder(): Promise<Embedder | null> {
  if (!embedderPromise) embedderPromise = loadEmbedder();
  return embedderPromise;
}

async function loadEmbedder(): Promise<Embedder | null> {
  const manifest = await loadManifest();
  const m = manifest.models.find((x) => x.id === EMBEDDER_MODEL_ID);
  if (!m || !isAlreadyComplete(m.filename, m.sizeBytes)) {
    logger.info("embedder model not ready; rag will fall back to lexical", {
      id: EMBEDDER_MODEL_ID,
    });
    return null;
  }
  try {
    const { getLlama } = await import("node-llama-cpp");
    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath: modelPath(m.filename) });
    const context = await model.createEmbeddingContext();
    logger.info("embedder loaded", { path: m.filename });
    return {
      async embed(text: string): Promise<Float32Array> {
        const { vector } = await context.getEmbeddingFor(text.slice(0, 4_000));
        return Float32Array.from(vector);
      },
    };
  } catch (err) {
    logger.error("embedder init failed", {
      msg: err instanceof Error ? err.message : "?",
    });
    return null;
  }
}

export function cosineFloat32(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}
