/**
 * QVAC explainer boundary.
 *
 * Deterministic decode/sim/intel facts stay authoritative. The local model may
 * only rewrite those facts into clearer prose; its JSON is schema-validated
 * and falls back to a deterministic explanation on any miss.
 *
 * Runtime: `node-llama-cpp` v3 — ADR-0010. ESM-only, dynamic-imported once
 * per main-process lifetime, then memoised. Same pattern as
 * [WDK manager](../wallet/manager.ts).
 *
 * Lifecycle: the model is loaded lazily on first verdict (eager-load on app
 * boot would block first-paint by a few seconds while llama.cpp mmap's the
 * weights). One model + one context survives for the process lifetime; we
 * create a fresh `LlamaChatSession` per verdict so prompts don't leak.
 */

import { z } from "zod";
import { logger } from "@/main/log";
import { isAlreadyComplete, loadManifest, modelPath } from "@/main/models/store";
import type {
  BalanceDelta,
  DecodedInstruction,
  VerdictExplanation,
  VerdictLevel,
} from "@/shared/types/verdict";

const EXPLAINER_MODEL_ID = "qwen3-1-7b-q4";

const ModelDraft = z.object({
  title: z.string().min(1).max(90),
  plainEnglish: z.string().min(1).max(520),
  risks: z.array(z.string().min(1).max(180)).max(4),
  recommendation: z.string().min(1).max(240),
});

export interface ExplainVerdictInput {
  level: VerdictLevel;
  summary: string;
  citations: string[];
  instructions: DecodedInstruction[];
  deltas: BalanceDelta[];
  simFailed: string | null;
}

// ---------------------------------------------------------------------------
// node-llama-cpp loader (ESM, dynamic-imported, memoised)
// ---------------------------------------------------------------------------

interface LlamaSessionFactory {
  prompt(text: string): Promise<string>;
  dispose(): Promise<void> | void;
}

let sessionFactoryPromise: Promise<LlamaSessionFactory | null> | null = null;
function loadSessionFactory(modelFile: string): Promise<LlamaSessionFactory | null> {
  if (sessionFactoryPromise) return sessionFactoryPromise;
  sessionFactoryPromise = (async () => {
    try {
      const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: modelFile });
      const context = await model.createContext();
      logger.info("llama.cpp model loaded", { path: modelFile });
      return {
        async prompt(text: string) {
          // Fresh session per call — avoids unbounded chat-history accrual.
          const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
          });
          const out = await session.prompt(text, {
            // Deterministic enough for JSON output, leaves a little room.
            temperature: 0.2,
            maxTokens: 480,
          });
          session.dispose();
          return out;
        },
        async dispose() {
          await model.dispose();
        },
      };
    } catch (err) {
      logger.error("llama.cpp init failed", {
        msg: err instanceof Error ? err.message : "?",
      });
      return null;
    }
  })();
  return sessionFactoryPromise;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function explainVerdict(
  input: ExplainVerdictInput,
): Promise<VerdictExplanation> {
  const model = await explainerModel();
  const fallback = deterministicExplanation(input, model.id);

  if (!model.ready || !model.path) {
    return { ...fallback, status: "model-missing" };
  }

  const factory = await loadSessionFactory(model.path);
  if (!factory) {
    return { ...fallback, status: "runtime-error" };
  }

  try {
    const draft = await runLocalModel(factory, input);
    if (!draft) return { ...fallback, status: "invalid-output" };
    return {
      source: "qvac",
      status: "ready",
      title: draft.title,
      plainEnglish: draft.plainEnglish,
      risks: draft.risks,
      recommendation: draft.recommendation,
      model: model.id,
    };
  } catch (err) {
    logger.warn("qvac explainer failed; deterministic fallback used", {
      msg: err instanceof Error ? err.message : "?",
    });
    return { ...fallback, status: "runtime-error" };
  }
}

async function explainerModel(): Promise<{
  id: string;
  path: string | null;
  ready: boolean;
}> {
  const manifest = await loadManifest();
  const m = manifest.models.find((x) => x.id === EXPLAINER_MODEL_ID);
  if (!m) return { id: EXPLAINER_MODEL_ID, path: null, ready: false };
  return {
    id: m.id,
    path: modelPath(m.filename),
    ready: isAlreadyComplete(m.filename, m.sizeBytes),
  };
}

async function runLocalModel(
  factory: LlamaSessionFactory,
  input: ExplainVerdictInput,
): Promise<z.infer<typeof ModelDraft> | null> {
  const out = await factory.prompt(buildPrompt(input));
  const json = extractJson(out);
  if (!json) return null;
  try {
    const parsed = ModelDraft.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deterministic fallback (unchanged shape — UI gates on `status`)
// ---------------------------------------------------------------------------

function deterministicExplanation(
  input: ExplainVerdictInput,
  modelId: string,
): VerdictExplanation {
  const primaryRisk = primaryRiskFrom(input);
  return {
    source: "deterministic",
    status: "fallback",
    title: titleFor(input.level),
    plainEnglish: plainEnglishFor(input),
    risks: primaryRisk
      ? [primaryRisk]
      : ["No high-confidence drain pattern was found in the deterministic checks."],
    recommendation: recommendationFor(input.level),
    model: modelId,
  };
}

function buildPrompt(input: ExplainVerdictInput): string {
  const facts = {
    level: input.level,
    summary: input.summary,
    citations: input.citations,
    instructions: input.instructions.map((ix) => ({
      kind: ix.kind,
      summary: ix.summary,
      programId: ix.programId,
      details: ix.details,
    })),
    deltas: input.deltas,
    simulation: input.simFailed ? { ok: false, error: input.simFailed } : { ok: true },
  };
  return [
    "You are Argus, a local Solana transaction reviewer.",
    "Use only the facts in JSON. Do not add facts, program names, amounts, addresses, citations, or safety claims not present.",
    "Return strict JSON only with keys: title, plainEnglish, risks, recommendation.",
    "Tone: concise, premium, calm. Avoid hype. If uncertain, say what remains uncertain.",
    JSON.stringify(facts),
  ].join("\n\n");
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function titleFor(level: VerdictLevel): string {
  if (level === "RED") return "Do not sign yet.";
  if (level === "GREEN") return "Looks consistent.";
  return "Review before signing.";
}

function plainEnglishFor(input: ExplainVerdictInput): string {
  if (input.simFailed) {
    return "Argus decoded the transaction, but the chain simulation rejected it. That means the transaction is not in a state we should sign.";
  }
  if (input.instructions.length === 0) {
    return "Argus did not find executable instructions in this transaction.";
  }
  const first = input.instructions[0]!.summary;
  const rest = input.instructions.length - 1;
  if (rest === 0) return `This transaction asks your wallet to approve: ${first}.`;
  return `This transaction asks your wallet to approve: ${first}, plus ${rest} additional instruction${rest === 1 ? "" : "s"}.`;
}

function primaryRiskFrom(input: ExplainVerdictInput): string | null {
  if (input.simFailed) return `Simulation rejected the transaction: ${input.simFailed}.`;
  if (input.instructions.some((ix) => ix.kind === "spl-set-authority")) {
    return "A token authority change can alter who controls an account or mint.";
  }
  if (input.instructions.some((ix) => ix.kind === "spl-approve")) {
    return "A token approval can let another address move tokens up to the approved limit.";
  }
  if (input.instructions.some((ix) => ix.kind === "unknown")) {
    return "At least one instruction targets a program Argus does not recognise yet.";
  }
  const debit = input.deltas.find((d) => d.delta < 0);
  if (debit) {
    return `Simulation estimates ${formatDelta(debit.delta)} ${debit.asset} from ${short(debit.account)}.`;
  }
  return null;
}

function recommendationFor(level: VerdictLevel): string {
  if (level === "RED") return "Block this transaction unless you can independently explain the failure.";
  if (level === "GREEN") return "You can approve if the decoded action matches what you intended.";
  return "Approve only if every decoded instruction matches the action you expected.";
}

function short(s: string): string {
  if (s.length <= 9) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function formatDelta(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  if (abs < 0.0001) return `${sign}${abs.toExponential(2)}`;
  return `${sign}${abs.toFixed(6).replace(/\.?0+$/, "")}`;
}
