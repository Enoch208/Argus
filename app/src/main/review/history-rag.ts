/**
 * Personal-history retrieval.
 *
 * Two ranking strategies share one boundary:
 *   1. Semantic — bge-small-en-v1.5 embeddings via node-llama-cpp. Used when
 *      the embedder model is downloaded and loads cleanly.
 *   2. Lexical — local bag-of-words cosine. Always available; used as the
 *      fallback when the embedder is missing or errors mid-flight.
 *
 * The verdict pipeline calls `personalHistorySignal()` (in `review/store.ts`)
 * which feeds `retrieveHistorySignals` here. Either ranking returns the same
 * `HistoryRagSignal` shape, so the citation builder doesn't branch on source.
 */

import { cosineFloat32, getEmbedder } from "@/main/llm/embedder";
import { logger } from "@/main/log";
import type { DecodedInstruction, ReviewRecord } from "@/shared/types/verdict";

export interface HistoryRagInput {
  summary: string;
  citations: string[];
  instructions: DecodedInstruction[];
}

export interface HistoryRagHit {
  id: string;
  status: ReviewRecord["status"];
  summary: string;
  similarity: number;
  updatedAt: number;
}

export interface HistoryRagSignal {
  hits: HistoryRagHit[];
  signedSimilar: number;
  blockedSimilar: number;
  totalCompared: number;
  outlier: boolean;
  source: "semantic" | "lexical";
}

const SIMILARITY_THRESHOLD_LEXICAL = 0.42;
// bge embeddings cluster tighter; raise the bar so casual overlap doesn't fire.
const SIMILARITY_THRESHOLD_SEMANTIC = 0.78;

// Embeddings are deterministic per (model, text); cache by record id so we
// only embed each record once per process lifetime.
const recordEmbeddingCache = new Map<string, Float32Array>();

export async function retrieveHistorySignals(
  input: HistoryRagInput,
  records: ReviewRecord[],
): Promise<HistoryRagSignal> {
  const embedder = await getEmbedder();
  if (embedder) {
    try {
      return await rankSemantic(embedder, input, records);
    } catch (err) {
      logger.warn("semantic rag failed; falling back to lexical", {
        msg: err instanceof Error ? err.message : "?",
      });
    }
  }
  return rankLexical(input, records);
}

export function historySignalCitation(signal: HistoryRagSignal): string {
  const tag = signal.source === "semantic" ? "" : " (lexical)";
  if (signal.blockedSimilar > 0) {
    return `Personal history matched ${signal.blockedSimilar} similar blocked review${signal.blockedSimilar === 1 ? "" : "s"}${tag}.`;
  }
  if (signal.signedSimilar > 0) {
    return `Personal history matched ${signal.signedSimilar} similar approved review${signal.signedSimilar === 1 ? "" : "s"}${tag}.`;
  }
  if (signal.outlier) {
    return `Personal history found no close match across ${signal.totalCompared} prior review${signal.totalCompared === 1 ? "" : "s"}${tag}; treat this as unusual for your wallet.`;
  }
  if (signal.totalCompared > 0) {
    return `Personal history compared ${signal.totalCompared} prior review${signal.totalCompared === 1 ? "" : "s"}${tag}; no close match.`;
  }
  return "Personal history has no prior reviews yet.";
}

// ---------------------------------------------------------------------------
// Semantic ranking
// ---------------------------------------------------------------------------

async function rankSemantic(
  embedder: { embed(text: string): Promise<Float32Array> },
  input: HistoryRagInput,
  records: ReviewRecord[],
): Promise<HistoryRagSignal> {
  const queryVec = await embedder.embed(textForInput(input));

  const scored: HistoryRagHit[] = [];
  for (const record of records) {
    const vec = await ensureRecordEmbedding(embedder, record);
    const similarity = cosineFloat32(queryVec, vec);
    if (similarity < SIMILARITY_THRESHOLD_SEMANTIC) continue;
    scored.push({
      id: record.id,
      status: record.status,
      summary: record.verdict.summary,
      similarity,
      updatedAt: record.updatedAt,
    });
  }
  return finalise(scored, records.length, "semantic");
}

async function ensureRecordEmbedding(
  embedder: { embed(text: string): Promise<Float32Array> },
  record: ReviewRecord,
): Promise<Float32Array> {
  const cached = recordEmbeddingCache.get(record.id);
  if (cached) return cached;
  const vec = await embedder.embed(textForRecord(record));
  recordEmbeddingCache.set(record.id, vec);
  return vec;
}

// ---------------------------------------------------------------------------
// Lexical ranking (always available; embedder fallback)
// ---------------------------------------------------------------------------

function rankLexical(
  input: HistoryRagInput,
  records: ReviewRecord[],
): HistoryRagSignal {
  const query = vectoriseLexical(textForInput(input));
  const scored = records
    .map<HistoryRagHit>((record) => ({
      id: record.id,
      status: record.status,
      summary: record.verdict.summary,
      similarity: cosineLexical(query, vectoriseLexical(textForRecord(record))),
      updatedAt: record.updatedAt,
    }))
    .filter((hit) => hit.similarity >= SIMILARITY_THRESHOLD_LEXICAL);
  return finalise(scored, records.length, "lexical");
}

function finalise(
  scored: HistoryRagHit[],
  totalCompared: number,
  source: "semantic" | "lexical",
): HistoryRagSignal {
  const candidates = scored
    .sort((a, b) => b.similarity - a.similarity || b.updatedAt - a.updatedAt)
    .slice(0, 5);
  return {
    hits: candidates,
    signedSimilar: candidates.filter((hit) => hit.status === "signed").length,
    blockedSimilar: candidates.filter((hit) => hit.status === "blocked").length,
    totalCompared,
    outlier: totalCompared >= 5 && candidates.length === 0,
    source,
  };
}

// ---------------------------------------------------------------------------
// Shared text construction
// ---------------------------------------------------------------------------

function textForInput(input: HistoryRagInput): string {
  return [
    input.summary,
    ...input.citations,
    ...input.instructions.flatMap((ix) => [
      ix.kind,
      ix.summary,
      ix.programId,
      ...Object.values(ix.details).map(String),
    ]),
  ].join(" ");
}

function textForRecord(record: ReviewRecord): string {
  return [
    record.status,
    record.verdict.level,
    record.verdict.summary,
    record.verdict.explanation.plainEnglish,
    record.verdict.explanation.recommendation,
    ...record.verdict.citations,
    ...record.verdict.instructions.flatMap((ix) => [
      ix.kind,
      ix.summary,
      ix.programId,
      ...Object.values(ix.details).map(String),
    ]),
  ].join(" ");
}

function vectoriseLexical(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
    if (STOPWORDS.has(token)) continue;
    out.set(token, (out.get(token) ?? 0) + 1);
  }
  return out;
}

function cosineLexical(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (const n of a.values()) aNorm += n * n;
  for (const n of b.values()) bNorm += n * n;
  for (const [token, n] of a.entries()) dot += n * (b.get(token) ?? 0);
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "your",
  "you",
  "argus",
  "review",
  "transaction",
  "instruction",
  "instructions",
]);
