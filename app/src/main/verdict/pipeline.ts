/**
 * Verdict pipeline. Today: decode → simulate → intel-lookup (program + wallet
 * + mint) → QVAC LLM explanation → assemble verdict. Tomorrow: + history RAG.
 * The output shape is stable across all those upgrades — the renderer
 * doesn't notice.
 *
 * STRICT (DESIGN-PRINCIPLES.md):
 *   §1 The verdict comes first → `level` + `summary` are populated before
 *      anything else. The renderer can show the badge while citations stream.
 *   §2 Citations are mandatory → `citations.length >= 1`, schema-enforced.
 *   §3 Honest uncertainty → unknown-program instructions force YELLOW
 *      with the explicit "novel program" reason. Never silently green.
 */

import { randomUUID } from "node:crypto";
import { ArgusError } from "@/shared/errors";
import { explainVerdict } from "@/main/verdict/explainer";
import type {
  DecodedInstruction,
  Verdict,
  VerdictLevel,
} from "@/shared/types/verdict";
import { logger } from "@/main/log";
import {
  lookupMintIntel,
  lookupProgramIntel,
  lookupWalletIntel,
  type MintIntel,
  type ProgramIntel,
  type WalletIntel,
} from "@/main/scam-intel/store";
import { parseTransaction } from "@/main/solana/decoder";
import { simulate } from "@/main/solana/simulator";

interface IntelHits {
  program: ProgramIntel[];
  wallet: WalletIntel[];
  mint: MintIntel[];
}

export async function reviewTransaction(raw: string): Promise<Verdict> {
  const parsed = parseTransaction(raw);
  let deltas: Verdict["deltas"] = [];
  let simFailed: string | null = null;

  try {
    const sim = await simulate(parsed.transaction);
    deltas = sim.deltas;
    if (sim.raw.err) simFailed = JSON.stringify(sim.raw.err);
  } catch (err) {
    if (err instanceof ArgusError) simFailed = err.message;
    else throw err;
    logger.warn("simulation failed; verdict still emits", { msg: simFailed });
  }

  const intel = lookupAllIntel(parsed.instructions);
  const level = pickLevel(parsed.instructions, simFailed, intel);
  const summary = buildSummary(parsed.instructions, level, simFailed, intel);
  const citations = buildCitations(parsed.instructions, deltas, simFailed, intel);
  const meta = buildMeta(parsed.instructions, simFailed, intel);
  const explanation = await explainVerdict({
    level,
    summary,
    citations,
    instructions: parsed.instructions,
    deltas,
    simFailed,
  });

  return {
    id: randomUUID(),
    level,
    summary,
    explanation,
    citations,
    instructions: parsed.instructions,
    deltas,
    meta,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Intel collection — pulls every address worth looking up out of the decoded
// instructions and runs all three table lookups in one pass.
// ---------------------------------------------------------------------------

function lookupAllIntel(ix: DecodedInstruction[]): IntelHits {
  const programIds = ix.map((i) => i.programId);

  const wallets = new Set<string>();
  const mints = new Set<string>();
  for (const i of ix) {
    // Recipient-shaped fields per InstructionKind. We're conservative — only
    // address-typed values, never amounts. Anything we add to the decoder
    // becomes lookupable here automatically by extending this switch.
    switch (i.kind) {
      case "sol-transfer":
        if (typeof i.details.to === "string") wallets.add(i.details.to);
        break;
      case "spl-transfer":
        if (typeof i.details.destination === "string") wallets.add(i.details.destination);
        break;
      case "spl-approve":
        if (typeof i.details.delegate === "string") wallets.add(i.details.delegate);
        break;
      case "spl-close-account":
        if (typeof i.details.destination === "string") wallets.add(i.details.destination);
        break;
      // Mints are surfaced when the decoder learns to extract them
      // (Token-2022 transfer-checked carries one). For now this set may stay
      // empty — the table is queried but returns nothing.
      default:
        break;
    }
  }

  return {
    program: lookupProgramIntel(programIds),
    wallet: lookupWalletIntel([...wallets]),
    mint: lookupMintIntel([...mints]),
  };
}

// ---------------------------------------------------------------------------
// Verdict-level policy. Conservative until the history-RAG pass lands.
// ---------------------------------------------------------------------------

function pickLevel(
  ix: DecodedInstruction[],
  simFailed: string | null,
  intel: IntelHits,
): VerdictLevel {
  if (simFailed) return "RED";
  if (anyDanger(intel)) return "RED";
  if (ix.some((i) => i.kind === "spl-set-authority")) return "YELLOW";
  if (ix.some((i) => i.kind === "spl-approve")) return "YELLOW";
  if (anyCaution(intel)) return "YELLOW";
  if (ix.some((i) => i.kind === "unknown")) return "YELLOW";
  if (ix.length === 0) return "YELLOW";
  return "YELLOW"; // see DESIGN-PRINCIPLES §3 — never overclaim certainty
}

function anyDanger(intel: IntelHits): boolean {
  return (
    intel.program.some((i) => i.severity === "danger") ||
    intel.wallet.some((i) => i.severity === "danger") ||
    intel.mint.some((i) => i.severity === "danger")
  );
}
function anyCaution(intel: IntelHits): boolean {
  return (
    intel.program.some((i) => i.severity === "caution") ||
    intel.wallet.some((i) => i.severity === "caution") ||
    intel.mint.some((i) => i.severity === "caution")
  );
}

function buildSummary(
  ix: DecodedInstruction[],
  level: VerdictLevel,
  simFailed: string | null,
  intel: IntelHits,
): string {
  if (level === "RED" && simFailed) return "Refuse to sign — simulation rejected.";
  if (level === "RED" && intel.wallet.some((w) => w.severity === "danger")) {
    return "Refuse to sign — recipient is on the local scam-intel blocklist.";
  }
  if (level === "RED" && intel.program.some((p) => p.severity === "danger")) {
    return "Refuse to sign — local scam-intel flagged this program.";
  }
  if (level === "RED" && intel.mint.some((m) => m.severity === "danger")) {
    return "Refuse to sign — token mint is on the local scam-intel blocklist.";
  }
  if (ix.length === 0) return "Empty transaction.";
  if (ix.length === 1) return ix[0]!.summary;
  const head = ix[0]!.summary;
  return `${head}, plus ${ix.length - 1} more instruction${ix.length - 1 === 1 ? "" : "s"}.`;
}

function buildCitations(
  ix: DecodedInstruction[],
  deltas: Verdict["deltas"],
  simFailed: string | null,
  intel: IntelHits,
): string[] {
  const out: string[] = [];

  if (simFailed) {
    out.push(`Simulation rejected: ${simFailed}.`);
  } else {
    out.push(`Simulation passed (${ix.length} instruction${ix.length === 1 ? "" : "s"}).`);
  }

  for (const i of ix.slice(0, 3)) {
    out.push(i.summary);
  }

  out.push(buildIntelCitation(ix, intel));

  const unknownCount = ix.filter((i) => i.kind === "unknown").length;
  if (unknownCount > 0) {
    out.push(
      `${unknownCount} instruction${unknownCount === 1 ? "" : "s"} on programs Argus does not recognise.`,
    );
  }

  if (deltas.length > 0) {
    const owner = deltas[0]!;
    if (owner.delta !== 0) {
      out.push(
        `Estimated cost · ${formatDelta(owner.delta)} ${owner.asset} from ${short(owner.account)}.`,
      );
    }
  }

  return out;
}

function buildMeta(
  ix: DecodedInstruction[],
  simFailed: string | null,
  intel: IntelHits,
): string {
  const parts: string[] = [];
  parts.push(simFailed ? "Simulation · rejected" : "Simulation");
  parts.push(anyDanger(intel) ? "Intel · flagged" : "Intel");
  if (ix.length > 0) parts.push(`${ix.length} ix`);
  return parts.join(" · ");
}

function buildIntelCitation(
  ix: DecodedInstruction[],
  intel: IntelHits,
): string {
  // Surface the highest-severity hit, regardless of which table fired it.
  const danger = [
    ...intel.wallet.filter((w) => w.severity === "danger").map((w) => `recipient ${w.label}`),
    ...intel.program.filter((p) => p.severity === "danger").map((p) => `program ${p.label}`),
    ...intel.mint.filter((m) => m.severity === "danger").map((m) => `mint ${m.label}`),
  ];
  if (danger.length > 0) {
    return `Local scam-intel flagged ${danger.slice(0, 3).join(", ")}.`;
  }

  const caution = [
    ...intel.wallet.filter((w) => w.severity === "caution").map((w) => `recipient ${w.label}`),
    ...intel.program.filter((p) => p.severity === "caution").map((p) => `program ${p.label}`),
    ...intel.mint.filter((m) => m.severity === "caution").map((m) => `mint ${m.label}`),
  ];
  if (caution.length > 0) {
    return `Local scam-intel recognises ${caution.slice(0, 3).join(", ")}; verify the on-screen terms before signing.`;
  }

  const programsChecked = new Set(ix.map((i) => i.programId)).size;
  return `Local scam-intel checked ${programsChecked} program${programsChecked === 1 ? "" : "s"}; no blocklist matches.`;
}

// ---------------------------------------------------------------------------

function short(s: string): string {
  if (s.length <= 9) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function formatDelta(n: number): string {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "+";
  if (abs < 0.0001) return `${sign}${abs.toExponential(2)}`;
  return `${sign}${abs.toFixed(6).replace(/\.?0+$/, "")}`;
}
