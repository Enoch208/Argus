/**
 * Local embedding boundary.
 *
 * Backed by `@qvac/sdk` ([qvac.ts](./qvac.ts)). Same shape as before — the
 * history-RAG module ([review/history-rag.ts](../review/history-rag.ts))
 * doesn't need to know whether QVAC or a local fallback served the call.
 *
 * If the SDK can't initialise or the embedder model isn't downloaded yet,
 * `getEmbedder` returns `null` and the caller falls back to the lexical
 * cosine path. See ADR-0010 (revised) and ADR-0014.
 */
import { embed as qvacEmbed } from "@/main/llm/qvac";
import { logger } from "@/main/log";
import { isAlreadyComplete, loadManifest } from "@/main/models/store";

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
  // Probe with a tiny string; if QVAC can't serve embeddings, surface that
  // now so `getEmbedder` can return null and the lexical fallback engages.
  const probe = await qvacEmbed(EMBEDDER_MODEL_ID, "argus");
  if (!probe) return null;
  logger.info("embedder ready (qvac)", { dims: probe.length });
  return {
    async embed(text: string): Promise<Float32Array> {
      const vec = await qvacEmbed(EMBEDDER_MODEL_ID, text);
      if (!vec) throw new Error("qvac embed returned null mid-flight");
      return vec;
    },
  };
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
