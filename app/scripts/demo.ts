/**
 * Argus demo scenarios. Builds a canned base58 Solana transaction for one
 * of three flavours and prints it to stdout with a copy-paste banner.
 *
 *   $ npm run demo:phishing
 *   $ npm run demo:safe
 *   $ npm run demo:approve
 *
 * See docs/decisions/0012-demo-scenarios.md.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mnemonicToSeedSync } from "bip39";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { DEMO_PAYER_MNEMONIC, DEMO_RECIPIENT_MNEMONIC } from "./demo-seeds";

// Mandiant CLINKSINK primary operator (`mandiant/clinksink-2024`).
// See main/scam-intel/store.ts for provenance + severity policy.
const PHISHING_RECIPIENT = "B8Y1dERnVNoUUXeXA4NaCHiB9htcukMSkfHrFsTMHA7h";

// Devnet RPC by default. Override with `SOLANA_RPC_URL=https://...` for
// the mainnet rehearsal documented in PRD §16 Day 11.
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

type Scenario = "phishing" | "safe" | "approve";

interface BuiltDemo {
  scenario: Scenario;
  recipient: string;
  expectedVerdict: "RED" | "YELLOW";
  citedSource: string | null;
  base58: string;
}

async function main(): Promise<void> {
  const scenario = parseScenario(process.argv[2]);
  const built = await build(scenario);
  writeFixture(built);
  printBanner(built);
}

function parseScenario(raw: string | undefined): Scenario {
  if (raw === "phishing" || raw === "safe" || raw === "approve") return raw;
  console.error(
    `usage: tsx scripts/demo.ts <phishing | safe | approve>\n` +
      `       (or use one of the npm scripts: demo:phishing / demo:safe / demo:approve)`,
  );
  process.exit(2);
}

async function build(scenario: Scenario): Promise<BuiltDemo> {
  const payer = keypairFromMnemonic(DEMO_PAYER_MNEMONIC);
  const recipient =
    scenario === "phishing"
      ? new PublicKey(PHISHING_RECIPIENT)
      : keypairFromMnemonic(DEMO_RECIPIENT_MNEMONIC).publicKey;

  // Pull a recent blockhash so the transaction simulates against current
  // chain state when Argus reviews it. Devnet by default to keep judges
  // safe; the mainnet rehearsal sets `SOLANA_RPC_URL` explicitly.
  const conn = new Connection(RPC_URL, "confirmed");
  const { blockhash } = await conn.getLatestBlockhash("finalized");

  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports: Math.floor(0.001 * LAMPORTS_PER_SOL),
    }),
  );

  // Compile the message without actually signing — Argus's signer step is
  // owned by the wallet manager. The unsigned tx still carries enough
  // information for decode + simulate + verdict.
  const wire = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const base58 = bs58.encode(wire);

  return {
    scenario,
    recipient: recipient.toBase58(),
    expectedVerdict: scenario === "phishing" ? "RED" : "YELLOW",
    citedSource: scenario === "phishing" ? "mandiant/clinksink-2024" : null,
    base58,
  };
}

function keypairFromMnemonic(mnemonic: string): Keypair {
  // BIP-39 → seed → first 32 bytes as Ed25519 secret. Same shape WDK uses
  // for derivation path m/44'/501'/0'/0' (just elided here for brevity —
  // the demo doesn't need to match a specific BIP-44 path, only to be
  // deterministic across runs).
  const seed = mnemonicToSeedSync(mnemonic).subarray(0, 32);
  return Keypair.fromSeed(seed);
}

function writeFixture(built: BuiltDemo): void {
  const fixturePath = fixtureFile(built.scenario);
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        scenario: built.scenario,
        recipient: built.recipient,
        expectedVerdict: built.expectedVerdict,
        citedSource: built.citedSource,
        base58: built.base58,
        rpcUrl: RPC_URL,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
}

function fixtureFile(scenario: Scenario): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "tests", "fixtures", `demo-${scenario}.json`);
}

function printBanner(built: BuiltDemo): void {
  const headline = `Argus demo · ${built.scenario}`;
  const lines: string[] = [
    `Expected verdict: ${built.expectedVerdict}`,
    `Cited source:     ${built.citedSource ?? "—"}`,
    `Recipient:        ${built.recipient}`,
    `RPC:              ${RPC_URL}`,
  ];
  const width = Math.max(headline.length, ...lines.map((l) => l.length)) + 2;
  const top = `╭─ ${headline} ${"─".repeat(width - headline.length - 2)}╮`;
  const bottom = `╰${"─".repeat(width)}╯`;
  console.log(top);
  for (const line of lines) {
    console.log(`│ ${line.padEnd(width - 2)} │`);
  }
  console.log(bottom);
  console.log();
  console.log("base58:");
  console.log(built.base58);
  console.log();
  console.log("Paste the base58 above into the Review canvas. Argus will produce the");
  console.log(`expected ${built.expectedVerdict} verdict. The fixture is also saved at:`);
  console.log(`  tests/fixtures/demo-${built.scenario}.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
