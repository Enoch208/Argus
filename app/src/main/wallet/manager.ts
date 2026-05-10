/**
 * Single source of wallet state in the main process.
 *
 * Lifecycle: `uninitialised → (create | import) → locked → unlocked → locked`
 *
 * STRICT (SECURITY.md §The seed phrase):
 *   - The mnemonic exists in plaintext only briefly: while we instantiate
 *     `WalletManagerSolana` from it, or while showing it once during create.
 *   - The mnemonic is NEVER serialised to a log line or a stack trace.
 *   - The unlocked WDK instance lives in this module's closure; no getter
 *     exposes the underlying keys.
 */

import { generateMnemonic, validateMnemonic } from "bip39";
import type WalletManagerSolanaT from "@tetherto/wdk-wallet-solana";
import type { WalletInfo, WalletState } from "@/shared/types/wallet";
import { ArgusError } from "@/shared/errors";
import { logger } from "@/main/log";
import { decrypt, exists as keystoreExists, write as writeKeystore } from "./keystore";

// WDK is ESM-only and depends on Bare's `sodium-universal` addon. Bundling it
// breaks the addon loader; static `import` from a CJS main is forbidden. The
// dynamic-import bridge below is the canonical Node-CJS-loads-ESM pattern.
type WdkCtor = typeof WalletManagerSolanaT;
let wdkCtorPromise: Promise<WdkCtor> | null = null;
async function loadWdk(): Promise<WdkCtor> {
  if (!wdkCtorPromise) {
    wdkCtorPromise = import("@tetherto/wdk-wallet-solana").then((m) => m.default);
  }
  return wdkCtorPromise;
}

interface UnlockedHandle {
  manager: InstanceType<WdkCtor>;
  address: string;
}

interface PendingCreate {
  mnemonic: string;
  passphrase: string;
  address: string;
}

class WalletState_ {
  private unlocked: UnlockedHandle | null = null;
  private pending: PendingCreate | null = null;
  /** Cached after first successful unlock so the WalletPill can show an
   *  address even when the wallet is locked. */
  private knownAddress: string | null = null;

  state(): WalletState {
    if (this.unlocked) return "unlocked";
    if (keystoreExists()) return "locked";
    return "uninitialised";
  }

  info(): WalletInfo {
    return {
      state: this.state(),
      address: this.unlocked?.address ?? this.knownAddress ?? null,
    };
  }

  /** Generate a fresh mnemonic, derive the address, hold both in memory
   *  pending `confirmCreate`. The keystore is NOT written yet — the user
   *  must confirm they've stored the words first. */
  async create(passphrase: string): Promise<{ mnemonic: string[]; address: string }> {
    if (keystoreExists()) {
      throw new ArgusError("WALLET_ALREADY_INITIALISED", "a wallet already exists");
    }
    const phrase = generateMnemonic(128); // 12 words
    const address = await deriveFirstAddress(phrase);
    this.pending = { mnemonic: phrase, passphrase, address };
    return { mnemonic: phrase.split(" "), address };
  }

  /** Persists the keystore, instantiates the WDK manager from the in-memory
   *  mnemonic (so the user is left `unlocked`), then zeroes the plaintext.
   *  The user shouldn't have to re-enter the passphrase right after typing it. */
  async confirmCreate(): Promise<void> {
    const p = this.pending;
    if (!p) throw new ArgusError("WALLET_AWAITING_CONFIRMATION", "no pending create");
    const buf = Buffer.from(p.mnemonic, "utf8");
    try {
      await writeKeystore(buf, p.passphrase);
      const manager = new (await loadWdk())(p.mnemonic);
      this.unlocked = { manager, address: p.address };
      this.knownAddress = p.address;
      logger.info("wallet created + unlocked", { address: redact(p.address) });
    } finally {
      // Zero everything that touched the seed plaintext.
      buf.fill(0);
      this.pending = null;
    }
  }

  async import(words: string[], passphrase: string): Promise<{ address: string }> {
    if (keystoreExists()) {
      throw new ArgusError("WALLET_ALREADY_INITIALISED", "a wallet already exists");
    }
    const phrase = words.join(" ").trim().toLowerCase();
    if (!validateMnemonic(phrase)) {
      throw new ArgusError("WALLET_BAD_MNEMONIC", "phrase failed BIP-39 checksum");
    }
    const address = await deriveFirstAddress(phrase);
    const buf = Buffer.from(phrase, "utf8");
    try {
      await writeKeystore(buf, passphrase);
    } finally {
      buf.fill(0);
    }
    this.knownAddress = address;
    logger.info("wallet imported", { address: redact(address) });
    return { address };
  }

  async unlock(passphrase: string): Promise<WalletInfo> {
    if (this.unlocked) return this.info();
    const buf = await decrypt(passphrase);
    try {
      const phrase = Buffer.from(buf).toString("utf8");
      const manager = new (await loadWdk())(phrase);
      const account = await manager.getAccount(0);
      const address = await account.getAddress();
      this.unlocked = { manager, address };
      this.knownAddress = address;
      logger.info("wallet unlocked", { address: redact(address) });
      return this.info();
    } finally {
      buf.fill(0);
    }
  }

  lock(): void {
    if (!this.unlocked) return;
    this.unlocked = null;
    logger.info("wallet locked");
  }

  /** Internal getter for the unlocked manager — used only by future
   *  `signer.ts` and the `review.approve` handler. Never exposed via IPC. */
  unlockedManager(): InstanceType<WdkCtor> {
    if (!this.unlocked) throw new ArgusError("WALLET_LOCKED", "unlock the wallet first");
    return this.unlocked.manager;
  }
}

async function deriveFirstAddress(mnemonic: string): Promise<string> {
  const Wdk = await loadWdk();
  const m = new Wdk(mnemonic);
  const account = await m.getAccount(0);
  return await account.getAddress();
}

/** Public addresses are not secrets, but log redaction trims them anyway so
 *  the log file is harder to correlate against on-chain activity. */
function redact(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export const wallet = new WalletState_();
