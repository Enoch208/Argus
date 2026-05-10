/**
 * Local URL allow-list / blocklist.
 *
 * ADR-0013. Owned by this domain (not folded into `main/scam-intel/`)
 * because the surfaces are different: scam-intel checks on-chain entities
 * (programs / wallets / mints), URL intel checks OCR-extracted domains
 * from screenshots. They share the severity vocabulary; nothing else.
 *
 * Storage: in-memory Map for v1 — the corpus is small enough (≤ 40 entries)
 * that SQLite is overkill. When the full Phantom-blocklist scrape lands
 * (~2,300 entries), we'll move to a SQLite table; the boundary is one
 * function (`lookupDomains`).
 */

import type { IntelSeverity } from "@/main/scam-intel/store";

export interface UrlIntel {
  /** Normalised: lowercase, no scheme, no `www.`, no path / port. */
  domain: string;
  label: string;
  severity: IntelSeverity;
  source: string;
  note: string;
  updatedAt: number;
}

const SEED_UPDATED_AT = 1_762_646_400_000; // 2025-11-09T00:00:00Z
const ARGUS_URL_ALLOWLIST = "argus-allowlist";
const PHANTOM_BLOCKLIST = "phantom/blocklist";

function allowed(domain: string, label: string): UrlIntel {
  return {
    domain: normaliseDomain(domain),
    label,
    severity: "allow",
    source: ARGUS_URL_ALLOWLIST,
    note: `Canonical Solana dApp · ${label}.`,
    updatedAt: SEED_UPDATED_AT,
  };
}
function phantomTyposquat(domain: string, mimics: string): UrlIntel {
  return {
    domain: normaliseDomain(domain),
    label: `Phantom-flagged typo-squat of ${mimics}`,
    severity: "danger",
    source: PHANTOM_BLOCKLIST,
    note: `Listed in github.com/phantom/blocklist as a known phishing domain mimicking ${mimics}.`,
    updatedAt: SEED_UPDATED_AT,
  };
}

const SEEDS: UrlIntel[] = [
  // Canonical Solana dApps. One-edit fuzzy matching over this allow-list
  // catches typo-squats not yet in the blocklist.
  allowed("magiceden.io", "Magic Eden"),
  allowed("tensor.trade", "Tensor"),
  allowed("jup.ag", "Jupiter"),
  allowed("raydium.io", "Raydium"),
  allowed("orca.so", "Orca"),
  allowed("drift.trade", "Drift"),
  allowed("marinade.finance", "Marinade"),
  allowed("kamino.finance", "Kamino"),
  allowed("solana.com", "Solana Foundation"),
  allowed("solscan.io", "Solscan"),
  allowed("solana.fm", "SolanaFM"),
  allowed("phantom.app", "Phantom"),
  allowed("solflare.com", "Solflare"),
  allowed("backpack.app", "Backpack"),
  allowed("pump.fun", "pump.fun"),
  allowed("birdeye.so", "Birdeye"),
  allowed("dexscreener.com", "DEX Screener"),

  // Sample from Phantom's blocklist. Full ~2,300-entry scrape is a follow-up
  // (`scripts/refresh-url-intel.ts`); the lookup boundary is unchanged.
  phantomTyposquat("phantomweb.app", "phantom.app"),
  phantomTyposquat("phantom-web.app", "phantom.app"),
  phantomTyposquat("phantom-extension.com", "phantom.app"),
  phantomTyposquat("phantomwallet.live", "phantom.app"),
  phantomTyposquat("solflare.asia", "solflare.com"),
  phantomTyposquat("solflare-web.org", "solflare.com"),
  phantomTyposquat("solflare.biz", "solflare.com"),
  phantomTyposquat("solflare.live", "solflare.com"),
  phantomTyposquat("soflarewallet.com", "solflare.com"),
  phantomTyposquat("magiceden.site", "magiceden.io"),
  phantomTyposquat("magicedenpresale.com", "magiceden.io"),
  phantomTyposquat("magiceden-mint.com", "magiceden.io"),
  phantomTyposquat("magic-edenn.io", "magiceden.io"),
  phantomTyposquat("solscan.tech", "solscan.io"),
  phantomTyposquat("backpack-claim.com", "backpack.app"),
  phantomTyposquat("jup-claim.org", "jup.ag"),
  phantomTyposquat("tensor-airdrop.com", "tensor.trade"),
];

const INDEX: ReadonlyMap<string, UrlIntel> = new Map(
  SEEDS.map((s) => [s.domain, s]),
);
const ALLOWLIST = SEEDS.filter((s) => s.severity === "allow");

/**
 * Look up a list of domains (or full URLs — they're normalised first).
 * Returns one match per unique normalised key that hits.
 */
export function lookupDomains(input: string[]): UrlIntel[] {
  const seen = new Set<string>();
  const out: UrlIntel[] = [];
  for (const raw of input) {
    const key = normaliseDomain(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    const hit = INDEX.get(key);
    if (hit) out.push(hit);
    else {
      const fuzzy = fuzzyTyposquat(key);
      if (fuzzy) out.push(fuzzy);
    }
  }
  return out;
}

/**
 * Normalised form of a domain. Same on insert and on lookup so equality
 * is exact:
 *   lowercase, no `https?://`, no `www.`, no trailing slash, no path,
 *   no query, no port.
 */
export function normaliseDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  const slash = s.indexOf("/");
  if (slash !== -1) s = s.slice(0, slash);
  const q = s.indexOf("?");
  if (q !== -1) s = s.slice(0, q);
  const colon = s.indexOf(":");
  if (colon !== -1) s = s.slice(0, colon);
  return s;
}

/** Snapshot for diagnostics / Stack route. */
export function urlIntelHealth(): { totalEntries: number } {
  return { totalEntries: SEEDS.length };
}

function fuzzyTyposquat(domain: string): UrlIntel | null {
  for (const canonical of ALLOWLIST) {
    if (
      sameRegistrableShape(domain, canonical.domain) &&
      levenshteinWithinOne(domain, canonical.domain)
    ) {
      return {
        domain,
        label: `One-edit lookalike of ${canonical.domain}`,
        severity: "danger",
        source: "argus-fuzzy-url",
        note: `Domain is one edit away from canonical Solana dApp ${canonical.label}.`,
        updatedAt: Date.now(),
      };
    }
  }
  return null;
}

function sameRegistrableShape(a: string, b: string): boolean {
  const aParts = a.split(".");
  const bParts = b.split(".");
  if (aParts.length !== bParts.length) return false;
  return aParts.at(-1) === bParts.at(-1);
}

function levenshteinWithinOne(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;

  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < a.length || j < b.length) edits += 1;
  return edits === 1;
}
