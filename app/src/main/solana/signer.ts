/**
 * Sign + broadcast for approved review verdicts.
 *
 * The raw key material never crosses IPC. We derive the web3.js keypair from
 * the unlocked WDK account inside main, sign the already-reviewed transaction,
 * then hand only the chain signature back to the renderer.
 */

import {
  Keypair,
  Transaction,
  type PublicKey,
  type VersionedTransaction,
} from "@solana/web3.js";
import { ArgusError } from "@/shared/errors";
import { logger } from "@/main/log";
import { parseTransaction } from "@/main/solana/decoder";
import { getConnection } from "@/main/solana/rpc";
import { wallet } from "@/main/wallet/manager";

interface WdkAccountWithKeyPair {
  getAddress(): Promise<string>;
  keyPair: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  };
}

export async function signAndBroadcast(raw: string): Promise<string> {
  const account = await wallet.unlockedManager().getAccount(0);
  const signer = signerFromWdkAccount(account as WdkAccountWithKeyPair);
  const walletAddress = await account.getAddress();

  if (signer.publicKey.toBase58() !== walletAddress) {
    throw new ArgusError("INTERNAL", "wallet key material did not match address");
  }

  const parsed = parseTransaction(raw);
  const wire = signTransaction(parsed.transaction, signer);

  try {
    const signature = await getConnection().sendRawTransaction(wire, {
      maxRetries: 3,
      preflightCommitment: "confirmed",
      skipPreflight: false,
    });
    logger.info("transaction broadcast", {
      signature,
      wallet: redact(walletAddress),
    });
    return signature;
  } catch (err) {
    if (err instanceof ArgusError) throw err;
    throw new ArgusError(
      "RPC_REJECTED",
      err instanceof Error ? err.message : "RPC rejected transaction",
    );
  }
}

function signerFromWdkAccount(account: WdkAccountWithKeyPair): Keypair {
  const { privateKey, publicKey } = account.keyPair;

  if (privateKey.length === 64) {
    return Keypair.fromSecretKey(privateKey);
  }

  if (privateKey.length === 32) {
    const fromSeed = Keypair.fromSeed(privateKey);
    if (sameBytes(fromSeed.publicKey.toBytes(), publicKey)) return fromSeed;

    if (publicKey.length === 32) {
      return Keypair.fromSecretKey(new Uint8Array([...privateKey, ...publicKey]));
    }
  }

  throw new ArgusError("INTERNAL", "unsupported WDK Solana key format");
}

function signTransaction(
  tx: Transaction | VersionedTransaction,
  signer: Keypair,
): Buffer | Uint8Array {
  if (tx instanceof Transaction) {
    ensureLegacyRequiresSigner(tx, signer.publicKey);
    tx.partialSign(signer);
    return tx.serialize();
  }

  ensureVersionedRequiresSigner(tx, signer.publicKey);
  tx.sign([signer]);
  return tx.serialize();
}

function ensureLegacyRequiresSigner(tx: Transaction, signer: PublicKey): void {
  const needsSigner = tx.signatures.some(({ publicKey }) => publicKey.equals(signer));
  if (!needsSigner) {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      "transaction does not request the unlocked wallet signature",
    );
  }
}

function ensureVersionedRequiresSigner(
  tx: VersionedTransaction,
  signer: PublicKey,
): void {
  const signerKeys = tx.message.staticAccountKeys.slice(
    0,
    tx.message.header.numRequiredSignatures,
  );
  if (!signerKeys.some((key) => key.equals(signer))) {
    throw new ArgusError(
      "TX_DECODE_FAILED",
      "transaction does not request the unlocked wallet signature",
    );
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function redact(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
