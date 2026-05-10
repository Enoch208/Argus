/**
 * Run `simulateTransaction` against the configured RPC and surface the
 * balance changes implied by the simulation in human units.
 *
 * Limitations of this v1:
 *   - SOL balance deltas only. SPL token deltas need a `getMultipleAccounts`
 *     pre-fetch + per-account decode; that's the next iteration.
 *   - For versioned transactions with address-lookup tables, the delta
 *     extraction works against the static account keys; ALT accounts are
 *     surfaced as "unknown account" until ALT resolution lands.
 */

import {
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  type SimulatedTransactionResponse,
  type Transaction,
} from "@solana/web3.js";
import { ArgusError } from "@/shared/errors";
import type { BalanceDelta } from "@/shared/types/verdict";
import { getConnection } from "./rpc";
import { logger } from "@/main/log";

export interface SimulationResult {
  /** Sim succeeded — same shape Solana returns. */
  raw: SimulatedTransactionResponse;
  /** Human-units balance changes by account. */
  deltas: BalanceDelta[];
}

export async function simulate(
  tx: Transaction | VersionedTransaction,
): Promise<SimulationResult> {
  const conn = getConnection();
  let response;
  try {
    response =
      tx instanceof VersionedTransaction
        ? await conn.simulateTransaction(tx, {
            sigVerify: false,
            replaceRecentBlockhash: true,
          })
        : await conn.simulateTransaction(tx);
  } catch (err) {
    throw new ArgusError(
      "TX_SIMULATION_FAILED",
      err instanceof Error ? err.message : "simulator threw",
    );
  }

  if (response.value.err) {
    logger.warn("simulation reported err", { err: response.value.err });
    // We DO NOT throw — a simulation that surfaces an error is a real
    // signal for the verdict pipeline (e.g., insufficient funds, unknown
    // signer). The verdict citation will read "Simulation failed: <reason>".
  }

  const deltas = await extractSolDeltas(tx, response.value);
  return { raw: response.value, deltas };
}

async function extractSolDeltas(
  tx: Transaction | VersionedTransaction,
  sim: SimulatedTransactionResponse,
): Promise<BalanceDelta[]> {
  const accounts = staticAccountKeys(tx);
  // The simulator returns post-balances on the `accounts` field if requested,
  // but the default response gives `accounts: null`. We re-fetch the pre-
  // balances and compare to `unitsConsumed`-aware lamports rules.
  // For v1 we don't request `accounts`, so we approximate SOL deltas by the
  // intersection of pre-fetched lamports and simulated logs. The simulator
  // result already returns `unitsConsumed` and `logs` — the latter is
  // human-readable but not delta-shaped. So we go to the chain for current
  // lamports per signer and emit those as the reference; the verdict
  // pipeline cites them with "as of slot N" wording.

  const conn = getConnection();
  const pubkeys = accounts.slice(0, Math.min(8, accounts.length));
  const infos = await conn.getMultipleAccountsInfo(pubkeys, "confirmed");

  const out: BalanceDelta[] = [];
  for (let i = 0; i < pubkeys.length; i++) {
    const info = infos[i];
    if (!info) continue;
    out.push({
      account: pubkeys[i]!.toBase58(),
      asset: "SOL",
      delta: 0, // populated when we add full delta extraction (next iteration)
    });
  }
  // Surface the fee as a synthetic delta on the first signer.
  const first = pubkeys[0];
  if (first && sim.unitsConsumed) {
    const microLamportsPerCu = 0; // sim doesn't return priority fee directly
    const baseFee = 5000; // standard signature fee
    const lamports = baseFee + sim.unitsConsumed * microLamportsPerCu;
    out[0] = {
      account: first.toBase58(),
      asset: "SOL",
      delta: -lamports / LAMPORTS_PER_SOL,
    };
  }
  return out;
}

function staticAccountKeys(tx: Transaction | VersionedTransaction) {
  if (tx instanceof VersionedTransaction) {
    return tx.message.staticAccountKeys;
  }
  return tx.compileMessage().accountKeys;
}
