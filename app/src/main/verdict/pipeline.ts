/**
 * Verdict pipeline. Inputs in priority order:
 *   1. base58 transaction → decode → simulate → on-chain intel lookup
 *   2. screenshot bytes → OCR → URL allow-list / blocklist lookup
 * Either is optional; both can fire together (paste a screenshot of the
 * dApp UI alongside the base58 it's about to ask the user to sign). The
 * pipeline runs whichever surfaces are present.
 *
 * STRICT (DESIGN-PRINCIPLES.md):
 *   §1 The verdict comes first → `level` + `summary` are populated before
 *      anything else. The renderer can show the badge while citations stream.
 *   §2 Citations are mandatory → `citations.length >= 1`, schema-enforced.
 *   §3 Honest uncertainty → unknown-program instructions force YELLOW
 *      with the explicit "novel program" reason. Never silently green.
 */

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { ArgusError } from "@/shared/errors";
import { explainVerdict } from "@/main/verdict/explainer";
import {
  historySignalCitation,
  type HistoryRagSignal,
} from "@/main/review/history-rag";
import { personalHistorySignal } from "@/main/review/store";
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
import { lookupDomains, type UrlIntel } from "@/main/url-intel/store";
import { canonicalDomainForBrand, extractUrlsFromImage } from "@/main/ocr/extractor";
import { parseTransaction } from "@/main/solana/decoder";
import { simulate } from "@/main/solana/simulator";

export interface ReviewInput {
  raw?: string;
  image?: { base64: string; mime: string };
}

interface IntelHits {
  program: ProgramIntel[];
  wallet: WalletIntel[];
  mint: MintIntel[];
  url: UrlIntel[];
}

interface OcrSurface {
  text: string;
  domains: string[];
  brands: string[];
}

interface BrandImpersonation {
  brand: string;
  canonical: string;
  /** OCR-extracted domains that are *not* the canonical domain. The presence
   *  of any non-canonical domain alongside the brand mention is the signal. */
  competing: string[];
}

export async function reviewTransaction(input: ReviewInput): Promise<Verdict> {
  if (!input.raw && !input.image) {
    throw new ArgusError(
      "IPC_INVALID_PAYLOAD",
      "review requires `raw`, `image`, or both",
    );
  }

  // ── Phase 1: optional decode + simulate ────────────────────────────────
  let instructions: DecodedInstruction[] = [];
  let deltas: Verdict["deltas"] = [];
  let simFailed: string | null = null;

  if (input.raw) {
    const parsed = parseTransaction(input.raw);
    instructions = parsed.instructions;
    try {
      const sim = await simulate(parsed.transaction);
      deltas = sim.deltas;
      if (sim.raw.err) simFailed = JSON.stringify(sim.raw.err);
    } catch (err) {
      if (err instanceof ArgusError) simFailed = err.message;
      else throw err;
      logger.warn("simulation failed; verdict still emits", { msg: simFailed });
    }
  }

  // ── Phase 2: optional OCR ─────────────────────────────────────────────
  let ocr: OcrSurface | null = null;
  if (input.image) {
    try {
      const bytes = Buffer.from(input.image.base64, "base64");
      ocr = await extractUrlsFromImage(bytes);
    } catch (err) {
      logger.warn("ocr failed; verdict continues without URL signals", {
        msg: err instanceof Error ? err.message : "?",
      });
    }
  }

  // ── Phase 3: collated intel lookup ────────────────────────────────────
  const intel = lookupAllIntel(instructions, ocr?.domains ?? []);
  const impersonations = ocr ? detectBrandImpersonation(ocr) : [];
  const level = pickLevel(
    instructions,
    simFailed,
    intel,
    impersonations,
    !!input.image,
  );
  const summary = buildSummary(
    instructions,
    level,
    simFailed,
    intel,
    impersonations,
    !!input.image,
  );
  const citations = buildCitations(
    instructions,
    deltas,
    simFailed,
    intel,
    ocr,
    impersonations,
  );
  const history = await personalHistorySignal({ summary, citations, instructions });
  citations.push(historySignalCitation(history));
  const meta = buildMeta(
    instructions,
    simFailed,
    intel,
    impersonations,
    !!input.image,
    history,
  );
  const explanation = await explainVerdict({
    level,
    summary,
    citations,
    instructions,
    deltas,
    simFailed,
  });

  return {
    id: randomUUID(),
    level,
    summary,
    explanation,
    citations,
    instructions,
    deltas,
    meta,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Intel collection
// ---------------------------------------------------------------------------

function lookupAllIntel(
  ix: DecodedInstruction[],
  ocrDomains: string[],
): IntelHits {
  const programIds = ix.map((i) => i.programId);

  const wallets = new Set<string>();
  const mints = new Set<string>();
  for (const i of ix) {
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
      default:
        break;
    }
  }

  return {
    program: lookupProgramIntel(programIds),
    wallet: lookupWalletIntel([...wallets]),
    mint: lookupMintIntel([...mints]),
    url: lookupDomains(ocrDomains),
  };
}

// ---------------------------------------------------------------------------
// Verdict-level policy
// ---------------------------------------------------------------------------

function pickLevel(
  ix: DecodedInstruction[],
  simFailed: string | null,
  intel: IntelHits,
  impersonations: BrandImpersonation[],
  hasImage: boolean,
): VerdictLevel {
  if (simFailed) return "RED";
  if (anyDanger(intel)) return "RED";
  // Brand mention + a danger-flagged competing domain → impersonation, RED.
  if (
    impersonations.some((imp) =>
      imp.competing.some((c) => intel.url.some((u) => u.domain === c && u.severity === "danger")),
    )
  ) {
    return "RED";
  }
  if (ix.some((i) => i.kind === "spl-set-authority")) return "YELLOW";
  if (ix.some((i) => i.kind === "spl-approve")) return "YELLOW";
  if (anyCaution(intel)) return "YELLOW";
  if (impersonations.length > 0) return "YELLOW";
  if (ix.some((i) => i.kind === "unknown")) return "YELLOW";
  if (ix.length === 0 && !hasImage) return "YELLOW";
  return "YELLOW"; // see DESIGN-PRINCIPLES §3 — never overclaim certainty
}

function anyDanger(intel: IntelHits): boolean {
  return (
    intel.program.some((i) => i.severity === "danger") ||
    intel.wallet.some((i) => i.severity === "danger") ||
    intel.mint.some((i) => i.severity === "danger") ||
    intel.url.some((u) => u.severity === "danger")
  );
}
function anyCaution(intel: IntelHits): boolean {
  return (
    intel.program.some((i) => i.severity === "caution") ||
    intel.wallet.some((i) => i.severity === "caution") ||
    intel.mint.some((i) => i.severity === "caution") ||
    intel.url.some((u) => u.severity === "caution")
  );
}

function buildSummary(
  ix: DecodedInstruction[],
  level: VerdictLevel,
  simFailed: string | null,
  intel: IntelHits,
  impersonations: BrandImpersonation[],
  hasImage: boolean,
): string {
  if (level === "RED" && simFailed) return "Refuse to sign — simulation rejected.";
  if (level === "RED" && intel.url.some((u) => u.severity === "danger")) {
    return "Refuse to engage — screenshot shows a domain on the local URL blocklist.";
  }
  if (level === "RED" && impersonations.length > 0) {
    const imp = impersonations[0]!;
    return `Refuse to engage — screenshot impersonates ${imp.brand} (real domain ${imp.canonical}).`;
  }
  if (level === "RED" && intel.wallet.some((w) => w.severity === "danger")) {
    return "Refuse to sign — recipient is on the local scam-intel blocklist.";
  }
  if (level === "RED" && intel.program.some((p) => p.severity === "danger")) {
    return "Refuse to sign — local scam-intel flagged this program.";
  }
  if (level === "RED" && intel.mint.some((m) => m.severity === "danger")) {
    return "Refuse to sign — token mint is on the local scam-intel blocklist.";
  }
  if (ix.length === 0 && hasImage) return "Screenshot reviewed; no transaction submitted.";
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
  ocr: OcrSurface | null,
  impersonations: BrandImpersonation[],
): string[] {
  const out: string[] = [];

  if (ix.length > 0) {
    if (simFailed) {
      out.push(`Simulation rejected: ${simFailed}.`);
    } else {
      out.push(`Simulation passed (${ix.length} instruction${ix.length === 1 ? "" : "s"}).`);
    }
    for (const i of ix.slice(0, 3)) out.push(i.summary);
  }

  if (ix.length > 0) out.push(buildOnchainIntelCitation(ix, intel));

  if (ocr) out.push(buildUrlCitation(intel, ocr));

  if (impersonations.length > 0) out.push(buildImpersonationCitation(impersonations));

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

  // DESIGN-PRINCIPLES.md §2 — at least one citation, always.
  if (out.length === 0) out.push("No verifiable signals were extracted from the inputs.");

  return out;
}

function buildOnchainIntelCitation(
  ix: DecodedInstruction[],
  intel: IntelHits,
): string {
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

function buildUrlCitation(intel: IntelHits, ocr: OcrSurface): string {
  const danger = intel.url.filter((u) => u.severity === "danger");
  if (danger.length > 0) {
    const sample = danger.slice(0, 3).map((u) => `${u.domain} (${u.label})`).join(", ");
    return `OCR found ${danger.length} blocked domain${danger.length === 1 ? "" : "s"}: ${sample}.`;
  }
  const allow = intel.url.filter((u) => u.severity === "allow");
  if (allow.length > 0) {
    const sample = allow.slice(0, 3).map((u) => u.domain).join(", ");
    return `OCR recognised canonical Solana dApp${allow.length === 1 ? "" : "s"}: ${sample}.`;
  }
  if (ocr.domains.length > 0) {
    return `OCR extracted ${ocr.domains.length} domain${ocr.domains.length === 1 ? "" : "s"}; none on the local URL allow-list or blocklist.`;
  }
  return `OCR extracted no domains from the screenshot.`;
}

function buildMeta(
  ix: DecodedInstruction[],
  simFailed: string | null,
  intel: IntelHits,
  impersonations: BrandImpersonation[],
  hasImage: boolean,
  history: HistoryRagSignal,
): string {
  const parts: string[] = [];
  if (ix.length > 0) parts.push(simFailed ? "Simulation · rejected" : "Simulation");
  parts.push(anyDanger(intel) ? "Intel · flagged" : "Intel");
  if (hasImage) parts.push("OCR");
  if (impersonations.length > 0) parts.push("Brand · impersonation");
  parts.push(history.hits.length > 0 ? "History · match" : "History");
  if (ix.length > 0) parts.push(`${ix.length} ix`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Brand-impersonation detection
//
// Vision-pipeline-derived signal: a screenshot that names a canonical Solana
// brand (e.g. "Phantom") but does NOT surface the brand's canonical domain
// (phantom.app) is suspicious — especially when the screenshot also surfaces
// a competing domain. This pairs cleanly with the URL allow-list: if the
// competing domain is already on the blocklist, the impersonation citation
// reinforces the verdict; if it isn't, the impersonation alone earns YELLOW
// per DESIGN-PRINCIPLES.md §3 (honest uncertainty over silent green).
// ---------------------------------------------------------------------------

function detectBrandImpersonation(ocr: OcrSurface): BrandImpersonation[] {
  if (ocr.brands.length === 0) return [];
  const out: BrandImpersonation[] = [];
  for (const brand of ocr.brands) {
    const canonical = canonicalDomainForBrand(brand);
    if (!canonical) continue;
    if (ocr.domains.includes(canonical)) continue; // legitimate
    const competing = ocr.domains.filter((d) => d !== canonical);
    if (competing.length === 0) continue;
    out.push({ brand, canonical, competing });
  }
  return out;
}

function buildImpersonationCitation(impersonations: BrandImpersonation[]): string {
  const first = impersonations[0]!;
  const competing = first.competing.slice(0, 2).join(", ");
  const more = impersonations.length > 1 ? ` (+${impersonations.length - 1} more)` : "";
  return `Brand-impersonation: screenshot mentions ${first.brand} but the URL is ${competing}, not ${first.canonical}${more}.`;
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
