/**
 * Local scam-intel store.
 *
 * Local-first by design (PRD F-05, ADR-0011). Bundled seeds and future sync
 * snapshots hydrate a SQLite database under app userData; the verdict
 * pipeline queries it synchronously while assembling citations. No intel
 * lookup leaves the device.
 *
 * Four independent tables, same shape:
 *
 *   - `program_intel` — known programs (System, SPL, Jupiter, Magic Eden, …).
 *   - `wallet_intel`  — known recipient wallets (drainer hot-wallets, demo
 *     fixture used by `npm run demo:phishing`).
 *   - `mint_intel`    — known SPL mints (canonical USDC; copycats).
 *   - `url_intel`     — canonical dApp domains + Phantom-blocked typo-squats,
 *     consumed by the OCR pipeline (ADR-0013).
 *
 *   Severity in every table: `allow` (canonical infra), `caution` (known
 *   router / marketplace, requires verification), `danger` (confirmed
 *   drainer / scam).
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";
import { logger } from "@/main/log";
import { PROGRAMS } from "@/main/solana/decoder";

export type IntelSeverity = "allow" | "caution" | "danger";

interface IntelBase {
  label: string;
  severity: IntelSeverity;
  source: string;
  note: string;
  updatedAt: number;
}

export interface ProgramIntel extends IntelBase {
  programId: string;
}
export interface WalletIntel extends IntelBase {
  address: string;
}
export interface MintIntel extends IntelBase {
  mint: string;
}
export interface UrlIntel extends IntelBase {
  domain: string;
}

interface ProgramRow {
  program_id: string;
  label: string;
  severity: IntelSeverity;
  source: string;
  note: string;
  updated_at: number;
}
interface AddressRow {
  address: string;
  label: string;
  severity: IntelSeverity;
  source: string;
  note: string;
  updated_at: number;
}
interface UrlRow {
  domain: string;
  label: string;
  severity: IntelSeverity;
  source: string;
  note: string;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Seed data — inline so the corpus version is git-tracked alongside the schema.
//
// Provenance for the real entries below:
//
//   `mandiant/clinksink-2024`
//     https://cloud.google.com/blog/topics/threat-intelligence/solana-cryptocurrency-stolen-clinksink-drainer-campaigns
//     Mandiant / Google Cloud Threat Intelligence (2024-01-09). Documents 35+
//     affiliate IDs and 42 unique drainer wallets behind the CLINKSINK DaaS,
//     with confirmed theft >= 1,491 SOL into the primary operator address.
//
//   `solanafm/scam-token-wallets-2024`
//     https://solanafm.substack.com/p/flagged-scam-token-wallets-on-solana
//     SolanaFM-flagged deployer / treasury / manipulator wallets and the SPL
//     mints they deployed; ongoing list maintained by SolanaFM analysts.
//
// Update this file when refreshing the corpus. ADR-0011 documents the
// migration to a bundled JSON file once we cross ~100 entries.
// ---------------------------------------------------------------------------

const SEED_UPDATED_AT = 1_762_646_400_000; // 2025-11-09T00:00:00Z
const ARGUS_REGISTRY_SOURCE = "Argus bundled registry";
const MANDIANT_CLINKSINK = "mandiant/clinksink-2024";
const SOLANAFM_FLAGGED = "solanafm/scam-token-wallets-2024";
const ARGUS_URL_ALLOWLIST = "argus-allowlist";
const PHANTOM_BLOCKLIST = "phantom/blocklist";

const PROGRAM_SEEDS: ProgramIntel[] = [
  {
    programId: PROGRAMS.system,
    label: "Solana System Program",
    severity: "allow",
    source: ARGUS_REGISTRY_SOURCE,
    note: "Core Solana program.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    programId: PROGRAMS.splToken,
    label: "SPL Token Program",
    severity: "allow",
    source: ARGUS_REGISTRY_SOURCE,
    note: "Canonical SPL token program.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    programId: PROGRAMS.splToken2022,
    label: "SPL Token 2022",
    severity: "allow",
    source: ARGUS_REGISTRY_SOURCE,
    note: "Canonical Token-2022 program.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    programId: PROGRAMS.associatedToken,
    label: "Associated Token Account Program",
    severity: "allow",
    source: ARGUS_REGISTRY_SOURCE,
    note: "Canonical associated token account program.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    programId: PROGRAMS.jupiterV6,
    label: "Jupiter v6",
    severity: "caution",
    source: ARGUS_REGISTRY_SOURCE,
    note: "Known swap router; verify route and token outputs before signing.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    programId: PROGRAMS.magicEdenV2,
    label: "Magic Eden v2",
    severity: "caution",
    source: ARGUS_REGISTRY_SOURCE,
    note: "Known marketplace program; verify listing terms before signing.",
    updatedAt: SEED_UPDATED_AT,
  },
];

/**
 * Compact builder for the bulk of the CLINKSINK affiliate list — keeps the
 * 35 rows below as a flat `[address, affiliateId]` table rather than a wall
 * of identical-shaped object literals. Same `WalletIntel` shape comes out.
 */
function clinksinkAffiliates(
  rows: ReadonlyArray<readonly [string, string]>,
): WalletIntel[] {
  return rows.map(([address, affiliateId]) => ({
    address,
    label: `CLINKSINK affiliate · ${affiliateId}`,
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "CLINKSINK drainer affiliate hot-wallet (Mandiant, Jan 2024).",
    updatedAt: SEED_UPDATED_AT,
  }));
}

const WALLET_SEEDS: WalletIntel[] = [
  // ── Demo fixture ────────────────────────────────────────────────────────
  {
    address: "Drainerz1111111111111111111111111111111111",
    label: "Argus demo drainer hot-wallet",
    severity: "danger",
    source: ARGUS_REGISTRY_SOURCE,
    note: "Demo fixture used by `npm run demo:phishing`. Always-RED match for the demo flow.",
    updatedAt: SEED_UPDATED_AT,
  },

  // ── CLINKSINK drainer-as-a-service (Mandiant, 2024-01-09) ─────────────
  // The DaaS operator's primary fund-receiver. Confirmed theft of 1,491+ SOL.
  {
    address: "B8Y1dERnVNoUUXeXA4NaCHiB9htcukMSkfHrFsTMHA7h",
    label: "CLINKSINK DaaS — primary operator",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "Mandiant-confirmed primary operator wallet for the CLINKSINK drainer service. Receives the 20% operator cut of stolen SOL across 35+ affiliates. >=1,491 SOL inflow as of 2024-01.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "MszS2N8CT1MV9byX8FKFnrUpkmASSeR5Fmji19ushw1",
    label: "CLINKSINK DaaS — alternate operator",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "Mandiant-cited alternate operator wallet observed in some CLINKSINK campaigns.",
    updatedAt: SEED_UPDATED_AT,
  },
  // Sample of CLINKSINK affiliate hot-wallets (the campaign cited 42 — these
  // are the named ones in the report; full set will land with the scraper).
  {
    address: "B4y9s5E8rb79RH4BoQRTqQBPKxpEFxdkL1y3E5A9XYCK",
    label: "CLINKSINK affiliate · null696969",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "CLINKSINK drainer affiliate hot-wallet (Mandiant, Jan 2024).",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "3RH44Pfx9GtN8ZWoSdWHoxH7HqXAC7V3YcqkX3kDf8J4",
    label: "CLINKSINK affiliate · aa1731a",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "CLINKSINK drainer affiliate hot-wallet (Mandiant, Jan 2024).",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "GmCYGAzMHhsNgoSK8JKHNRpdXC4xsbmFy9fknMioAmEK",
    label: "CLINKSINK affiliate · anxiety",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "CLINKSINK drainer affiliate hot-wallet (Mandiant, Jan 2024).",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "218JtpiEn5ZUvMoLwPmZtXf7ZM6PvMXvrmYuw6ZaoeB1",
    label: "CLINKSINK affiliate · cheetah",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "CLINKSINK drainer affiliate hot-wallet (Mandiant, Jan 2024).",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "5C9EHpAdSNBFWboWs9HHGy2kZ4CJCkxCHW8fFRhVcZLx",
    label: "CLINKSINK affiliate · exeFill",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "CLINKSINK drainer affiliate hot-wallet (Mandiant, Jan 2024).",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "CgvT6j6pmQJYk2EKuWMbGmpu2f5pjaysrDUR6fgWBuxj",
    label: "CLINKSINK affiliate · willetproject",
    severity: "danger",
    source: MANDIANT_CLINKSINK,
    note: "CLINKSINK drainer affiliate hot-wallet (Mandiant, Jan 2024).",
    updatedAt: SEED_UPDATED_AT,
  },
  // The remaining 35 CLINKSINK affiliate hot-wallets from Mandiant's Jan
  // 2024 report. Multiple addresses per affiliate where the report shows
  // a wallet rotation (e.g., `cheetah` + `cheetah2`, `lick` × 3). All flow
  // 80% to the affiliate and 20% to the primary operator wallet above.
  ...clinksinkAffiliates([
      ["AVvCiPrjR3es4NHnA4HrUXVsYFbyeasDBzWhywH7pCtC", "analosdev"],
      ["EHPGHGnFVYMZhc9xHF597yHC19odPHP6Kn2nmvkkWCWk", "asdasdgasdgf"],
      ["7tCSWUZYKRvx1obdFB6hwFJRN7gFEadE3dFX4fsJ1nPz", "biggynow"],
      ["8qezdtS9eP3GvSuFdYd11cLB84pD8siwjBvTqyBxfxKk", "cheetah2"],
      ["4qzye6MmnyFkLKGq2yM64QpUgv3TyefwwR9zHrS6LThb", "cheetah2 (alt)"],
      ["Fxm4yyVLSuWGhKNyJtr93VA6feJkjTjirTca78vpUVFe", "example29020208"],
      ["3Xoki5GPu2t4h7b2x2jAARARwcFLZ1CCxyPv43ePm3nS", "fatyyban"],
      ["GvKQzXo9RDcZowAXvAxxB9XHWo9EAXYUY6af5NoFms1r", "fatyyban (alt)"],
      ["D9HYCccL2TcmiWhyoXqTHgbFtWvfQG8a5ZfHYieAWyLa", "gangster"],
      ["HFgFGQS9NmvFzG7dSH8sMRTEeKi793uB8fzgmaoDxBei", "gangster (alt)"],
      ["FJLztLtZfjYAtwJYjg3ZNsqMHAJwtHc1xYS5AZwLu9PN", "GateDev"],
      ["HpTvuyVxwy7nK8AXCZqMHV1wiup3yvvsjpB5L2AHTGMc", "gostxast"],
      ["FF1iEduHrvJChE7anZbxDn7gSKefT46xBaBcuuiqMxo9", "hahahahahahahaha"],
      ["DYFKcauBDmbj29x9jucNsAYxmWv423GjCN4ZbjvDWX9e", "kndawd"],
      ["bkfS3Mo8surQ3RKSm55GHjouHyqGPgFZebQJASDdFWf", "lgbtq_monkey"],
      ["5NM4zTiCqHCtF88qxUw4CSTUEb1yA5P4Q1icStXyXdoX", "lick"],
      ["HVR8U9zaPES2Zb7hFGVsqt2HLpxFc2jpZxnk3d1km4kY", "lick (alt 1)"],
      ["T3KNsTzkiyW2gxfbqkbHxfGr7ciFzBpDTkV2UAJgd3x", "lick (alt 2)"],
      ["Aidf4FyS42q6TeMtSmJmB3goGLmNuVrhgr4LCyb8HceM", "milahRyuk"],
      ["Bw1ktx1MjzQjWEEinJGQ1kHK8CjCZ2ZLnS3hYmfN5yBE", "mistake"],
      ["8nnMe1cGJpr2wUaVH4LbAut6Zka7vewZs9oQkc5H4JN7", "mr_jord"],
      ["5G6VsUNdMcMJZit2y2p9kAaVXf43PUu96uNJkoWDWPXr", "mr_jord (alt)"],
      ["Fte4wZgKApNbsbzbKpyJyjnautjrr6diovgzVHwX2PFE", "nftkhufu2"],
      ["EjfTahgtoRxzeaPsWuMwouZbqAw3tZAXyQeyGwUVN9hw", "nftkhufu2 (alt)"],
      ["FDLuQRg6yYENo4Q75HJ4RdF6wZhNeSW9HjUGD1eoDGG1", "null_fed"],
      ["CuWXwbstHKkhFLbGDAWpF7rbiRvfQpPSo4uFMnYyhDSx", "orgifox"],
      ["8Vc4R5gHEZs6PxA3uRmYVyqFRZgSmRV866UTvfeyc4VA", "outsmart"],
      ["HVHAGvL8HCByevnep9jgSYdr5Eq1wFFBwbq2jFVqoxNh", "pitbull"],
      ["7XAgCsWMwfuzi1LLvXmpFMaXLQSoc4D6QJ5YyKhCUaSu", "pitbull_idk"],
      ["13XC9hfTu2f2e7wzrfVugbCqnWcG27XJwyhrBFff3GAr", "randomized9992342324"],
      ["5pKrMXARbv6iNbtp2uEsZhyyTpR85jRrEny5fSCydvbW", "shudsidj"],
      ["EhunAZL5v7r14Di9DGjW55dHLKzKJjHutpWKHZ9yDNbs", "sleepzzz35"],
      ["BYQsPKfFznw1kyTysBX9GAYCUpsStFiwQbCBS2AMeJd7", "stuntin1121"],
      ["5ubbRtLvoVmbN6LVthcmMGTB8nxShE5dRZtuZTgFVLNs", "stuntin1121 (alt)"],
      ["4gRHwBUz9VKGgRWL9UAjFEAdR63D5GHA3z6A9ny2ww8V", "suki6969"],
    ],
  ),

  // ── SolanaFM-flagged deployer / treasury wallets ──────────────────────
  // Deployers of confirmed scam tokens — sending to these wallets is the
  // smoking-gun for an active rug operation.
  {
    address: "GSjdhGyy7YdZNJmKcBPt5JePfT4Y5D8V8G255DJygewN",
    label: "SolanaFM-flagged scam-token deployer",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts flagged this address for deploying scam tokens.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "AoF7heFuMZHSwyiYg3yT6StBwnNN6tQYta76KFB4AT6T",
    label: "SolanaFM-flagged scam-token deployer",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts flagged this address for deploying scam tokens.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "BJJaBHA8XUbcKNVAYwD75tdQLxHnECa33vLSN7pb7mdM",
    label: "SolanaFM-flagged scam-token deployer",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts flagged this address for deploying scam tokens.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "BpKXaWfQFNbrmjpuSmrsCJ7rUYKEyZzdUvw6Q8Tyg4gT",
    label: "SolanaFM-flagged scam-token deployer",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts flagged this address for deploying scam tokens.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "8SawTvYZeJexmZzx1SFgYGVYFDCtzUvctcw8ctgJ3SU2",
    label: "SolanaFM-flagged scam-token treasury",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts identified this as a scam-token treasury wallet.",
    updatedAt: SEED_UPDATED_AT,
  },
  // Price-manipulation wallets — caution, not danger. Sending to them isn't
  // automatically a drain, but the wallet has a documented manipulation
  // history; the user should know.
  {
    address: "5N7PBBYjAH9t2nabyaFMZWA9TTdpepxtFM9zBu9MNPfh",
    label: "SolanaFM-flagged price manipulator",
    severity: "caution",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts observed this wallet manipulating token prices.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "CzCYTz3bzrPXeiB3xotvNsfawDN9HMZLSNSif9uUR2jp",
    label: "SolanaFM-flagged price manipulator",
    severity: "caution",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts observed this wallet manipulating token prices.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "BSHQetPSTPaqvvoN5M8xB1xieL9jPMgnwsTdJQTc2YC1",
    label: "SolanaFM-flagged price manipulator",
    severity: "caution",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts observed this wallet manipulating token prices.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "2w3WBLN92gXxaCXt6kbXJ7KiMYHXGsDGQFmvvsHkuWe9",
    label: "SolanaFM-flagged price manipulator",
    severity: "caution",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts observed this wallet manipulating token prices.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    address: "FJM2nAbTamVP3ceLQ7FMNwaCfyyF3j4MNDnr1ebLLvuz",
    label: "SolanaFM-flagged price manipulator",
    severity: "caution",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM analysts observed this wallet manipulating token prices.",
    updatedAt: SEED_UPDATED_AT,
  },
];

const MINT_SEEDS: MintIntel[] = [
  // ── Canonical infra ─────────────────────────────────────────────────────
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    label: "USDC (Circle, canonical)",
    severity: "allow",
    source: "circle-canon",
    note: "Canonical USDC mint on Solana mainnet.",
    updatedAt: SEED_UPDATED_AT,
  },

  // ── SolanaFM-flagged scam token mints ───────────────────────────────────
  // These are SPL mints whose deployers + market activity are documented
  // as fraudulent. A transaction touching them = strong RED signal.
  {
    mint: "13wXsFLNuaNfaCamRNt7wW217Lt8AgBYFLXhMZCztabD",
    label: "$2PAC — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $2PAC mint; deployer + manipulator wallets in the same corpus.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "2dwB7cHRdjcBJy9Qmtt1Sf9ibVBPuVsKuE5d9donMF41",
    label: "$NYK — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $NYK mint.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "3RPvusJQJ8r8A6NG7eifbkCpDsAsrT2jmfAQf59F6nof",
    label: "$PCIRCLE — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $PCIRCLE mint.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "3zaUVkU8K1zthd2QvioDD5yUTUzdgHPooExMGLmxMKiM",
    label: "$QREDO — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $QREDO mint.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "4NQa8qBuxNiSTAjeqYTdMEy4aA5g3Tc1WqAfyNZxidSJ",
    label: "$ASTRODOG — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $ASTRODOG mint.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "4QGYjwimB3nmuSyX1fXWj5MBiXBZ6Zjn2NCGGjEUkToF",
    label: "$BOUNCE — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $BOUNCE mint.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "5fa8GAgPVQwW98S9hXtQ6ihnzJNJVQU6M5ZRHxqYR1sh",
    label: "$ONE — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $ONE mint.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "6fJtFkZG1m6d7Fy4X1PEKhyYNYAsVVciYGGGbszUxRAS",
    label: "$SONIC — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $SONIC mint.",
    updatedAt: SEED_UPDATED_AT,
  },
  {
    mint: "6t9ZN3GHAaq1owPb8HB2v9XfQoLQLXysQLosU1SeaLGU",
    label: "$P-POLKADOT — flagged scam token",
    severity: "danger",
    source: SOLANAFM_FLAGGED,
    note: "SolanaFM-flagged $P-POLKADOT mint.",
    updatedAt: SEED_UPDATED_AT,
  },
];

/**
 * Compact builders for the URL cohorts — same pattern as
 * `clinksinkAffiliates`. Domains are stored normalised (lowercase, no
 * scheme, no `www.`, no trailing slash); the lookup function normalises
 * the same way before hitting the index.
 */
function allowedDomain(domain: string, label: string): UrlIntel {
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

const URL_SEEDS: UrlIntel[] = [
  // ── Canonical Solana dApps ──────────────────────────────────────────────
  // Argus's "we recognise this" allow-list. A future fuzzy-match upgrade
  // (Levenshtein over these) detects typo-squats not in the blocklist yet.
  allowedDomain("magiceden.io", "Magic Eden"),
  allowedDomain("tensor.trade", "Tensor"),
  allowedDomain("jup.ag", "Jupiter"),
  allowedDomain("raydium.io", "Raydium"),
  allowedDomain("orca.so", "Orca"),
  allowedDomain("drift.trade", "Drift"),
  allowedDomain("marinade.finance", "Marinade"),
  allowedDomain("kamino.finance", "Kamino"),
  allowedDomain("solana.com", "Solana Foundation"),
  allowedDomain("solscan.io", "Solscan"),
  allowedDomain("solana.fm", "SolanaFM"),
  allowedDomain("phantom.app", "Phantom"),
  allowedDomain("solflare.com", "Solflare"),
  allowedDomain("backpack.app", "Backpack"),
  allowedDomain("pump.fun", "pump.fun"),
  allowedDomain("birdeye.so", "Birdeye"),
  allowedDomain("dexscreener.com", "DEX Screener"),

  // ── Phantom-blocked typo-squats (sample of ~2,300; full scrape is a
  //    follow-up, see `scripts/refresh-url-intel.ts` placeholder in ADR-0013).
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

// ---------------------------------------------------------------------------

/**
 * Normalised form of a domain for the URL allow-list / blocklist:
 *   lowercase, no `https?://`, no `www.`, no trailing slash, no path,
 *   no port. Same on insert and on lookup so equality is exact.
 */
export function normaliseDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  // Strip path / query / fragment.
  const slash = s.indexOf("/");
  if (slash !== -1) s = s.slice(0, slash);
  const q = s.indexOf("?");
  if (q !== -1) s = s.slice(0, q);
  // Strip port.
  const colon = s.indexOf(":");
  if (colon !== -1) s = s.slice(0, colon);
  return s;
}

let cachedDb: Database.Database | null = null;

export function lookupProgramIntel(programIds: string[]): ProgramIntel[] {
  const unique = [...new Set(programIds)].filter(Boolean);
  if (unique.length === 0) return [];
  const stmt = openDb().prepare<[string], ProgramRow>(
    "SELECT program_id, label, severity, source, note, updated_at FROM program_intel WHERE program_id = ?",
  );
  return unique
    .map((id) => stmt.get(id))
    .filter((r): r is ProgramRow => Boolean(r))
    .map(
      (r): ProgramIntel => ({
        programId: r.program_id,
        label: r.label,
        severity: r.severity,
        source: r.source,
        note: r.note,
        updatedAt: r.updated_at,
      }),
    );
}

export function lookupWalletIntel(addresses: string[]): WalletIntel[] {
  return lookupAddressTable<WalletIntel>("wallet_intel", addresses, (r) => ({
    address: r.address,
    label: r.label,
    severity: r.severity,
    source: r.source,
    note: r.note,
    updatedAt: r.updated_at,
  }));
}

export function lookupMintIntel(mints: string[]): MintIntel[] {
  return lookupAddressTable<MintIntel>("mint_intel", mints, (r) => ({
    mint: r.address,
    label: r.label,
    severity: r.severity,
    source: r.source,
    note: r.note,
    updatedAt: r.updated_at,
  }));
}

export function lookupUrlIntel(domains: string[]): UrlIntel[] {
  // Caller may pass raw URLs; we normalise on the way in so lookup is one
  // exact-match query per domain regardless of input shape.
  const unique = [...new Set(domains.map((d) => normaliseDomain(d)))].filter(Boolean);
  if (unique.length === 0) return [];
  const stmt = openDb().prepare<[string], UrlRow>(
    "SELECT domain, label, severity, source, note, updated_at FROM url_intel WHERE domain = ?",
  );
  return unique
    .map((d) => stmt.get(d))
    .filter((r): r is UrlRow => Boolean(r))
    .map(
      (r): UrlIntel => ({
        domain: r.domain,
        label: r.label,
        severity: r.severity,
        source: r.source,
        note: r.note,
        updatedAt: r.updated_at,
      }),
    );
}

function lookupAddressTable<T>(
  table: "wallet_intel" | "mint_intel",
  values: string[],
  to: (r: AddressRow) => T,
): T[] {
  const unique = [...new Set(values)].filter(Boolean);
  if (unique.length === 0) return [];
  // Table name comes from a fixed string-literal type — safe to interpolate.
  const stmt = openDb().prepare<[string], AddressRow>(
    `SELECT address, label, severity, source, note, updated_at FROM ${table} WHERE address = ?`,
  );
  return unique
    .map((v) => stmt.get(v))
    .filter((r): r is AddressRow => Boolean(r))
    .map(to);
}

// ---------------------------------------------------------------------------
// Schema + seed
// ---------------------------------------------------------------------------

function openDb(): Database.Database {
  if (cachedDb) return cachedDb;

  const dbPath = join(app.getPath("userData"), "intel", "scam-intel.sqlite3");
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS program_intel (
      program_id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('allow', 'caution', 'danger')),
      source TEXT NOT NULL,
      note TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_program_intel_severity ON program_intel(severity);

    CREATE TABLE IF NOT EXISTS wallet_intel (
      address TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('allow', 'caution', 'danger')),
      source TEXT NOT NULL,
      note TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_intel_severity ON wallet_intel(severity);

    CREATE TABLE IF NOT EXISTS mint_intel (
      address TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('allow', 'caution', 'danger')),
      source TEXT NOT NULL,
      note TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mint_intel_severity ON mint_intel(severity);

    CREATE TABLE IF NOT EXISTS url_intel (
      domain TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('allow', 'caution', 'danger')),
      source TEXT NOT NULL,
      note TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_url_intel_severity ON url_intel(severity);
  `);
  seedAll(db);

  cachedDb = db;
  logger.info("scam intel db opened", {
    path: dbPath,
    programs: PROGRAM_SEEDS.length,
    wallets: WALLET_SEEDS.length,
    mints: MINT_SEEDS.length,
    urls: URL_SEEDS.length,
  });
  return cachedDb;
}

function seedAll(db: Database.Database): void {
  const insertProgram = db.prepare(`
    INSERT INTO program_intel (program_id, label, severity, source, note, updated_at)
    VALUES (@programId, @label, @severity, @source, @note, @updatedAt)
    ON CONFLICT(program_id) DO UPDATE SET
      label = excluded.label,
      severity = excluded.severity,
      source = excluded.source,
      note = excluded.note,
      updated_at = excluded.updated_at
    WHERE program_intel.source = '${ARGUS_REGISTRY_SOURCE}'
  `);
  const insertWallet = db.prepare(`
    INSERT INTO wallet_intel (address, label, severity, source, note, updated_at)
    VALUES (@address, @label, @severity, @source, @note, @updatedAt)
    ON CONFLICT(address) DO UPDATE SET
      label = excluded.label,
      severity = excluded.severity,
      source = excluded.source,
      note = excluded.note,
      updated_at = excluded.updated_at
    WHERE wallet_intel.source = '${ARGUS_REGISTRY_SOURCE}'
  `);
  const insertMint = db.prepare(`
    INSERT INTO mint_intel (address, label, severity, source, note, updated_at)
    VALUES (@mint, @label, @severity, @source, @note, @updatedAt)
    ON CONFLICT(address) DO UPDATE SET
      label = excluded.label,
      severity = excluded.severity,
      source = excluded.source,
      note = excluded.note,
      updated_at = excluded.updated_at
    WHERE mint_intel.source = excluded.source
  `);
  const insertUrl = db.prepare(`
    INSERT INTO url_intel (domain, label, severity, source, note, updated_at)
    VALUES (@domain, @label, @severity, @source, @note, @updatedAt)
    ON CONFLICT(domain) DO UPDATE SET
      label = excluded.label,
      severity = excluded.severity,
      source = excluded.source,
      note = excluded.note,
      updated_at = excluded.updated_at
    WHERE url_intel.source IN ('${ARGUS_URL_ALLOWLIST}', '${PHANTOM_BLOCKLIST}')
  `);

  const tx = db.transaction(() => {
    for (const p of PROGRAM_SEEDS) insertProgram.run(p);
    for (const w of WALLET_SEEDS) insertWallet.run(w);
    for (const m of MINT_SEEDS) insertMint.run(m);
    for (const u of URL_SEEDS) insertUrl.run(u);
  });
  tx();
}
