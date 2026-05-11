/**
 * Local URL allow-list / blocklist.
 *
 * ADR-0013. Owned by this domain (not folded into `main/scam-intel/`)
 * because the surfaces are different: scam-intel checks on-chain entities
 * (programs / wallets / mints), URL intel checks OCR-extracted domains
 * from screenshots. They share the severity vocabulary; nothing else.
 *
 * Storage: in-memory Map. The corpus is bundled at build time as a JSON
 * snapshot ([resources/data/phantom-blocklist.json](../../../resources/data/phantom-blocklist.json))
 * scraped from `github.com/phantom/blocklist` (Apache-2.0), plus
 * [resources/data/scamsniffer-domains.json](../../../resources/data/scamsniffer-domains.json)
 * from `github.com/scamsniffer/scam-database` (GPL-3.0). Refresh with the
 * scripts in `app/scripts/`. Exact-match lookup stays O(1) through a Map.
 */

import type { IntelSeverity } from "@/main/scam-intel/store";
import phantomBundle from "../../../resources/data/phantom-blocklist.json";
import scamSnifferBundle from "../../../resources/data/scamsniffer-domains.json";

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
const PHANTOM_WHITELIST = "phantom/whitelist";
const SCAMSNIFFER_BLOCKLIST = "scamsniffer/scam-database";

interface PhantomBundle {
  version: number;
  fetchedAt: string;
  source: string;
  license: string;
  commit: string;
  commitDate: string;
  blocklist: { domain: string }[];
  whitelist: string[];
}
const PHANTOM = phantomBundle as PhantomBundle;
// Phantom commit SHA at build time, surfaced through `urlIntelHealth()` so
// reviewers can verify the bundled corpus against the upstream repo.
const PHANTOM_COMMIT_AT_MS = Date.parse(PHANTOM.commitDate);

interface ScamSnifferBundle {
  version: number;
  fetchedAt: string;
  source: string;
  license: string;
  commit: string;
  commitDate: string;
  domains: string[];
}
const SCAMSNIFFER = scamSnifferBundle as ScamSnifferBundle;
const SCAMSNIFFER_COMMIT_AT_MS = Date.parse(SCAMSNIFFER.commitDate);

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

/** Generic Phantom blocklist entry — used for the bundled corpus. The
 *  hand-curated seeds keep their richer "mimics" labels and stay
 *  authoritative; this builder fills in everything else. */
function phantomBlock(domain: string): UrlIntel {
  return {
    domain: normaliseDomain(domain),
    label: "Phantom-flagged phishing domain",
    severity: "danger",
    source: PHANTOM_BLOCKLIST,
    note: `Listed in github.com/phantom/blocklist@${PHANTOM.commit.slice(0, 7)} as a known phishing or scam domain.`,
    updatedAt: PHANTOM_COMMIT_AT_MS,
  };
}

function phantomAllow(domain: string): UrlIntel {
  return {
    domain: normaliseDomain(domain),
    label: "Phantom-flagged safe domain",
    severity: "allow",
    source: PHANTOM_WHITELIST,
    note: `Listed in github.com/phantom/blocklist whitelist@${PHANTOM.commit.slice(0, 7)}.`,
    updatedAt: PHANTOM_COMMIT_AT_MS,
  };
}

function scamSnifferBlock(domain: string): UrlIntel {
  return {
    domain: normaliseDomain(domain),
    label: "ScamSniffer phishing domain",
    severity: "danger",
    source: SCAMSNIFFER_BLOCKLIST,
    note: `Listed in github.com/scamsniffer/scam-database@${SCAMSNIFFER.commit.slice(0, 7)} as a phishing domain.`,
    updatedAt: SCAMSNIFFER_COMMIT_AT_MS,
  };
}

/**
 * Hand-curated seeds win on conflicts (richer labels, explicit `mimics`
 * targets); Phantom corpus fills out the long tail. Order matters: the
 * Map preserves the first insert, and we put `SEEDS` first.
 */
function buildSeedTable(): UrlIntel[] {
  const out = new Map<string, UrlIntel>();
  for (const seed of SEEDS) out.set(seed.domain, seed);
  for (const entry of PHANTOM.blocklist) {
    const key = normaliseDomain(entry.domain);
    if (!key || out.has(key)) continue;
    out.set(key, phantomBlock(key));
  }
  for (const domain of PHANTOM.whitelist) {
    const key = normaliseDomain(domain);
    if (!key || out.has(key)) continue;
    out.set(key, phantomAllow(key));
  }
  for (const domain of SCAMSNIFFER.domains) {
    const key = normaliseDomain(domain);
    if (!key || out.has(key)) continue;
    out.set(key, scamSnifferBlock(key));
  }
  return [...out.values()];
}

const ALL_ENTRIES: UrlIntel[] = buildSeedTable();
const INDEX: ReadonlyMap<string, UrlIntel> = new Map(
  ALL_ENTRIES.map((s) => [s.domain, s]),
);
// Fuzzy matcher only checks against the canonical allow-list — the Phantom
// blocklist is exact-match only (running Levenshtein over 2k entries on
// every OCR'd domain would be wasteful and noisy).
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
export function urlIntelHealth(): {
  totalEntries: number;
  blockedEntries: number;
  allowedEntries: number;
  handCurated: number;
  phantomCommit: string;
  phantomCommitDate: string;
  scamSnifferCommit: string;
  scamSnifferCommitDate: string;
} {
  return {
    totalEntries: ALL_ENTRIES.length,
    blockedEntries: ALL_ENTRIES.filter((e) => e.severity === "danger").length,
    allowedEntries: ALL_ENTRIES.filter((e) => e.severity === "allow").length,
    handCurated: SEEDS.length,
    phantomCommit: PHANTOM.commit.slice(0, 7),
    phantomCommitDate: PHANTOM.commitDate,
    scamSnifferCommit: SCAMSNIFFER.commit.slice(0, 7),
    scamSnifferCommitDate: SCAMSNIFFER.commitDate,
  };
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
