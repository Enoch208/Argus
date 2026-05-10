import { z } from "zod";

/**
 * Public wallet state — what the renderer can know.
 *
 * STRICT (SECURITY.md §The seed phrase): the seed itself is NEVER part of
 * any IPC schema. Mnemonic words generated during `wallet.create` are an
 * exception — they are returned ONCE to the renderer for display, then
 * forgotten by main once the user confirms. They are NOT stored in plaintext
 * anywhere, and they are NOT included in any subsequent `wallet.state`.
 */

export const WalletState = z.enum(["uninitialised", "locked", "unlocked"]);
export type WalletState = z.infer<typeof WalletState>;

export const WalletInfo = z.object({
  state: WalletState,
  /** Public Solana address. null when uninitialised; present when locked or unlocked. */
  address: z.string().nullable(),
});
export type WalletInfo = z.infer<typeof WalletInfo>;
