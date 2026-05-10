/**
 * SOL transfer constructor.
 *
 * Builds a `SystemProgram.transfer` legacy `Transaction`, fetches a recent
 * blockhash, and serialises it to base58 — the exact wire format that
 * `review.start` already accepts. The transaction is **not signed here**:
 * the user must run it through the verdict pipeline first, see the verdict,
 * and then approve, at which point `signAndBroadcast` signs and broadcasts.
 *
 * Routing the user's own transfers through the same review pipeline as
 * pasted base58 is the point: every signature this wallet makes goes
 * through Argus's AI co-pilot, in front of the signing path. That promise
 * cannot be made by a wallet that bypasses its own review for "trusted"
 * paths.
 */

import { Buffer } from "node:buffer";
import bs58 from "bs58";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { ArgusError } from "@/shared/errors";
import { logger } from "@/main/log";
import { getConnection } from "@/main/solana/rpc";

export interface BuildTransferInput {
  /** Sender — the unlocked wallet's address. */
  from: string;
  /** Destination Solana address. */
  to: string;
  /** Amount in SOL (not lamports). The constructor does the conversion. */
  amountSol: number;
}

export async function buildSolTransfer(input: BuildTransferInput): Promise<string> {
  const fromKey = parseAddress(input.from, "from");
  const toKey = parseAddress(input.to, "to");
  if (fromKey.equals(toKey)) {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      "destination is the same as the source wallet",
    );
  }

  if (!Number.isFinite(input.amountSol) || input.amountSol <= 0) {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      "transfer amount must be a positive number of SOL",
    );
  }

  const lamports = Math.round(input.amountSol * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      "transfer amount rounds to zero lamports",
    );
  }

  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: fromKey,
    blockhash,
    lastValidBlockHeight,
  });
  tx.add(
    SystemProgram.transfer({
      fromPubkey: fromKey,
      toPubkey: toKey,
      lamports,
    }),
  );

  const wire = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const base58 = bs58.encode(Buffer.from(wire));
  logger.info("transfer constructed", {
    lamports,
    from: redact(input.from),
    to: redact(input.to),
  });
  return base58;
}

function parseAddress(raw: string, label: "from" | "to"): PublicKey {
  try {
    return new PublicKey(raw.trim());
  } catch {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      `${label} address is not a valid Solana public key`,
    );
  }
}

function redact(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
