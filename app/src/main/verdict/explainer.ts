/**
 * QVAC explainer boundary.
 *
 * Deterministic decode/sim/intel facts stay authoritative. The local model may
 * only rewrite those facts into clearer prose; its JSON is schema-validated
 * and falls back to a deterministic explanation on any miss.
 *
 * Runtime: `@qvac/sdk` (ADR-0010, revised). The SDK wraps `@qvac/llm-llamacpp`,
 * so the GGUF we already download (`qwen3-1.7b-instruct-q4_k_m.gguf`) is the
 * exact file the explainer runs against — no second download, no second
 * runtime.
 */

import { z } from "zod";
import { logger } from "@/main/log";
import { complete } from "@/main/llm/qvac";
import { isAlreadyComplete, loadManifest } from "@/main/models/store";
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
// Public entry point
// ---------------------------------------------------------------------------

export async function explainVerdict(
  input: ExplainVerdictInput,
): Promise<VerdictExplanation> {
  const ready = await explainerReady();
  const fallback = deterministicExplanation(input, EXPLAINER_MODEL_ID);

  if (!ready) return { ...fallback, status: "model-missing" };

  try {
    const draft = await runQvac(input);
    if (!draft) return { ...fallback, status: "invalid-output" };
    return {
      source: "qvac",
      status: "ready",
      title: draft.title,
      plainEnglish: draft.plainEnglish,
      risks: draft.risks,
      recommendation: draft.recommendation,
      model: EXPLAINER_MODEL_ID,
    };
  } catch (err) {
    logger.warn("qvac explainer failed; deterministic fallback used", {
      msg: err instanceof Error ? err.message : "?",
    });
    return { ...fallback, status: "runtime-error" };
  }
}

async function explainerReady(): Promise<boolean> {
  const manifest = await loadManifest();
  const m = manifest.models.find((x) => x.id === EXPLAINER_MODEL_ID);
  if (!m) return false;
  return isAlreadyComplete(m.filename, m.sizeBytes);
}

async function runQvac(
  input: ExplainVerdictInput,
): Promise<z.infer<typeof ModelDraft> | null> {
  const out = await complete(EXPLAINER_MODEL_ID, systemPrompt(), userPrompt(input));
  if (out === null) return null; // SDK runtime issue → caller maps to fallback
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
// Prompt construction (unchanged shape)
// ---------------------------------------------------------------------------

function systemPrompt(): string {
  return [
    "You are Argus, a local Solana transaction reviewer.",
    "Use only the facts in JSON. Do not add facts, program names, amounts, addresses, citations, or safety claims not present.",
    "Return strict JSON only with keys: title, plainEnglish, risks, recommendation.",
    "Tone: concise, premium, calm. Avoid hype. If uncertain, say what remains uncertain.",
  ].join("\n");
}

function userPrompt(input: ExplainVerdictInput): string {
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
  return JSON.stringify(facts);
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
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
