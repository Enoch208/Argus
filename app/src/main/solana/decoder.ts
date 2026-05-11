/**
 * Decode a base58 transaction into renderer-ready instructions.
 *
 * Coverage (PRD Appendix A — first three patterns are fully structured;
 * Jupiter / Magic Eden surface by program-id only for v1):
 *
 *   System program        → SOL transfer / createAccount
 *   SPL Token / Token-2022 → Transfer, Approve, SetAuthority, CloseAccount
 *   Jupiter v6            → "Jupiter swap" (program-id surfaced)
 *   Magic Eden v2         → "Magic Eden listing" (program-id surfaced)
 *   Anything else         → "unknown" (feeds the YELLOW path in the verdict)
 *
 * Throws `ArgusError("TX_DECODE_FAILED")` if the base58 isn't a parseable
 * transaction. Never throws for "we don't recognise this program" — that's
 * a normal `unknown` instruction.
 */

import {
  PublicKey,
  SystemInstruction,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  type ParsedInstruction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { ArgusError } from "@/shared/errors";
import { bs58 } from "@/main/solana/base58";
import type {
  DecodedInstruction,
  InstructionKind,
} from "@/shared/types/verdict";

// ---------------------------------------------------------------------------
// Known program ids — single source of truth, used by the verdict pipeline
// to attach citations like "Jupiter v6 route".
// ---------------------------------------------------------------------------

export const PROGRAMS = {
  system: SystemProgram.programId.toBase58(), // "1111…1111"
  splToken: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  splToken2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  associatedToken: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  jupiterV6: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  magicEdenV2: "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",
} as const;

// SPL Token instruction discriminators — the first byte of `data`.
// (https://spl.solana.com/token#instructions)
const SPL_INSTRUCTION = {
  Transfer: 3,
  Approve: 4,
  Revoke: 5,
  SetAuthority: 6,
  MintTo: 7,
  Burn: 8,
  CloseAccount: 9,
  TransferChecked: 12,
  ApproveChecked: 13,
} as const;

// Serialized Solana transactions contain a compact signature count, 64-byte
// signature slots, and a message. Addresses/signatures are valid base58 too,
// but they decode to far fewer bytes and cannot be transaction wire data.
const MIN_SERIALIZED_TRANSACTION_BYTES = 96;

export interface ParsedTx {
  /** Original base58 input. */
  raw: string;
  /** Decoded instruction list — what the verdict pipeline reasons over. */
  instructions: DecodedInstruction[];
  /** Underlying transaction; the simulator consumes this. */
  transaction: Transaction | VersionedTransaction;
  /** True if this is a v0 versioned transaction (may carry ALT references). */
  isVersioned: boolean;
}

export function parseTransaction(raw: string): ParsedTx {
  const normalised = raw.trim();
  const bytes = decodeBase58(normalised);
  if (bytes.length < MIN_SERIALIZED_TRANSACTION_BYTES) {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      `expected a serialized Solana transaction, but decoded only ${bytes.length} bytes`,
    );
  }

  // Try v0 first — most modern transactions are versioned.
  let tx: Transaction | VersionedTransaction;
  let isVersioned = false;
  try {
    tx = VersionedTransaction.deserialize(bytes);
    isVersioned = true;
  } catch {
    try {
      tx = Transaction.from(bytes);
    } catch (err) {
      throw new ArgusError(
        "TX_DECODE_FAILED",
        `not a parseable transaction: ${err instanceof Error ? err.message : "?"}`,
      );
    }
  }

  const instructions = collectInstructions(tx).map(decodeOne);
  return { raw: normalised, instructions, transaction: tx, isVersioned };
}

// ---------------------------------------------------------------------------

function decodeBase58(raw: string): Buffer {
  try {
    return Buffer.from(bs58.decode(raw));
  } catch (err) {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      `bad base58: ${err instanceof Error ? err.message : "?"}`,
    );
  }
}

function collectInstructions(
  tx: Transaction | VersionedTransaction,
): TransactionInstruction[] {
  if (tx instanceof Transaction) return tx.instructions;
  // For versioned transactions we need to materialise the instruction list
  // from the compiled message. We don't resolve ALT keys here — for now we
  // surface the lookup-table-resolved program ids that web3 exposes via
  // `getAccountKeys`.
  const message = tx.message;
  const keys = message.staticAccountKeys;
  return message.compiledInstructions.map((ix) => ({
    programId: keys[ix.programIdIndex] ?? PublicKey.default,
    keys: ix.accountKeyIndexes.map((i) => ({
      pubkey: keys[i] ?? PublicKey.default,
      isSigner: false, // not knowable without ALT resolution
      isWritable: false,
    })),
    data: Buffer.from(ix.data),
  }));
}

function decodeOne(ix: TransactionInstruction): DecodedInstruction {
  const programId = ix.programId.toBase58();

  if (programId === PROGRAMS.system) return decodeSystem(ix);
  if (programId === PROGRAMS.splToken || programId === PROGRAMS.splToken2022) {
    return decodeSplToken(ix);
  }
  if (programId === PROGRAMS.jupiterV6) {
    return unknownButNamed("jupiter-swap", "Jupiter v6 swap", programId);
  }
  if (programId === PROGRAMS.magicEdenV2) {
    return unknownButNamed(
      "magic-eden",
      "Magic Eden marketplace call",
      programId,
    );
  }
  return {
    kind: "unknown",
    summary: `Unknown program · ${short(programId)}`,
    programId,
    details: { discriminator: short(ix.data.toString("hex")) },
  };
}

function decodeSystem(ix: TransactionInstruction): DecodedInstruction {
  const programId = ix.programId.toBase58();
  try {
    const t = SystemInstruction.decodeInstructionType(ix);
    if (t === "Transfer") {
      const d = SystemInstruction.decodeTransfer(ix);
      const lamports = Number(d.lamports);
      const sol = lamports / 1_000_000_000;
      return {
        kind: "sol-transfer",
        summary: `Transfer ${formatSol(sol)} SOL to ${short(d.toPubkey.toBase58())}`,
        programId,
        details: {
          from: d.fromPubkey.toBase58(),
          to: d.toPubkey.toBase58(),
          lamports,
        },
      };
    }
    if (t === "Create") {
      const d = SystemInstruction.decodeCreateAccount(ix);
      return {
        kind: "system-create-account",
        summary: `Create account · ${short(d.newAccountPubkey.toBase58())}`,
        programId,
        details: {
          newAccount: d.newAccountPubkey.toBase58(),
          lamports: Number(d.lamports),
          space: Number(d.space),
        },
      };
    }
  } catch {
    // fall through to unknown
  }
  return {
    kind: "unknown",
    summary: `System program call`,
    programId,
    details: {},
  };
}

function decodeSplToken(ix: TransactionInstruction): DecodedInstruction {
  const programId = ix.programId.toBase58();
  const tag = ix.data[0];
  const accounts = ix.keys.map((k) => k.pubkey.toBase58());

  if (
    tag === SPL_INSTRUCTION.Transfer ||
    tag === SPL_INSTRUCTION.TransferChecked
  ) {
    // Layout: [tag:1][amount:8] (Transfer) / [tag:1][amount:8][decimals:1] (Checked)
    const amount = readU64LE(ix.data, 1);
    return {
      kind: "spl-transfer",
      summary: `SPL transfer of ${amount.toString()} units to ${short(accounts[1] ?? "?")}`,
      programId,
      details: {
        amount: amount.toString(),
        source: accounts[0] ?? "",
        destination: accounts[1] ?? "",
      },
    };
  }
  if (
    tag === SPL_INSTRUCTION.Approve ||
    tag === SPL_INSTRUCTION.ApproveChecked
  ) {
    const amount = readU64LE(ix.data, 1);
    return {
      kind: "spl-approve",
      summary: `SPL approve · delegate ${amount.toString()} units to ${short(accounts[1] ?? "?")}`,
      programId,
      details: {
        amount: amount.toString(),
        source: accounts[0] ?? "",
        delegate: accounts[1] ?? "",
      },
    };
  }
  if (tag === SPL_INSTRUCTION.SetAuthority) {
    return {
      kind: "spl-set-authority",
      summary: `SPL setAuthority on ${short(accounts[0] ?? "?")}`,
      programId,
      details: { account: accounts[0] ?? "" },
    };
  }
  if (tag === SPL_INSTRUCTION.CloseAccount) {
    return {
      kind: "spl-close-account",
      summary: `SPL closeAccount · sweep ${short(accounts[0] ?? "?")} → ${short(accounts[1] ?? "?")}`,
      programId,
      details: { account: accounts[0] ?? "", destination: accounts[1] ?? "" },
    };
  }
  return {
    kind: "unknown",
    summary: `SPL Token call · tag ${tag}`,
    programId,
    details: { tag: tag ?? -1 },
  };
}

function unknownButNamed(
  kind: InstructionKind,
  summary: string,
  programId: string,
): DecodedInstruction {
  return { kind, summary, programId, details: {} };
}

// ---------------------------------------------------------------------------

function readU64LE(buf: Buffer, offset: number): bigint {
  if (buf.length < offset + 8) return 0n;
  return buf.readBigUInt64LE(offset);
}

function short(s: string): string {
  if (s.length <= 9) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function formatSol(n: number): string {
  if (n === 0) return "0";
  if (n < 0.001) return n.toExponential(2);
  return n.toFixed(4).replace(/\.?0+$/, "");
}

// Re-export so the verdict pipeline can fingerprint without re-importing.
export { ParsedInstruction };
