/**
 * THE channel registry. Every IPC channel lives here with a zod input and
 * output schema. The main process registers handlers off this. The renderer
 * generates a typed client off this. There is no other path.
 *
 * STRICT (ARCHITECTURE.md §The contract, CODE-RULES.md §Errors):
 *   - If a channel isn't here, it doesn't exist.
 *   - Schemas are the source of truth; types are inferred.
 *   - Renderer cannot invoke an undeclared channel; main cannot register one.
 */

import { z } from "zod";
import type { ArgusErrorWire } from "./errors";
import { WalletInfo } from "./types/wallet";
import { ReviewRecord, Verdict, VerdictLevel } from "./types/verdict";

export { ReviewRecord, Verdict, VerdictLevel };
export type { VerdictLevel as VerdictLevelType } from "./types/verdict";

// ---------------------------------------------------------------------------
// Model status
// ---------------------------------------------------------------------------

export const ModelState = z.enum([
  "queued",
  "downloading",
  "verifying",
  "ready",
  "error",
  "paused",
]);
export type ModelState = z.infer<typeof ModelState>;

export const ModelProgress = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  vram: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  downloadedBytes: z.number().int().nonnegative(),
  state: ModelState,
  /** Last error message; null while healthy. */
  error: z.string().nullable(),
});
export type ModelProgress = z.infer<typeof ModelProgress>;

export const ModelsStatus = z.object({
  /** True iff every model is in `ready`. */
  ready: z.boolean(),
  /** True iff the downloader is currently working through the queue. */
  active: z.boolean(),
  /** Aggregate bytes-downloaded / bytes-total across all models, 0..1. */
  fraction: z.number().min(0).max(1),
  models: z.array(ModelProgress),
});
export type ModelsStatus = z.infer<typeof ModelsStatus>;

// ---------------------------------------------------------------------------
// Channel registry
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Wallet (the seed itself NEVER appears in any IPC payload — see
// SECURITY.md §The seed phrase). The exception below is `wallet.create`,
// which returns the mnemonic once for display, after which main forgets it.
// ---------------------------------------------------------------------------

export const channels = {
  /** Lifecycle state + public address. Polled by the WalletPill. */
  "wallet.state": {
    input: z.void(),
    output: WalletInfo,
  },

  /** Generate a fresh seed + keystore. Returns the mnemonic once for the
   * confirmation step. The user MUST confirm via `wallet.confirmCreate`
   * before main commits the keystore to disk. */
  "wallet.create": {
    input: z.object({
      passphrase: z.string().min(8, "passphrase must be at least 8 characters"),
    }),
    output: z.object({
      mnemonic: z.array(z.string()).length(12),
      address: z.string(),
    }),
  },

  /** Confirms the user has stored the mnemonic offline; main commits the
   * keystore + clears the in-memory mnemonic. */
  "wallet.confirmCreate": {
    input: z.void(),
    output: z.object({ ok: z.literal(true) }),
  },

  /** Restore from a 12 / 24 word phrase. Stores encrypted; leaves wallet locked. */
  "wallet.import": {
    input: z.object({
      mnemonic: z.array(z.string().min(1)).min(12).max(24),
      passphrase: z.string().min(8),
    }),
    output: z.object({ address: z.string() }),
  },

  /** Decrypt the keystore; brings wallet to `unlocked`. */
  "wallet.unlock": {
    input: z.object({ passphrase: z.string().min(1) }),
    output: WalletInfo,
  },

  /** Zero the in-memory seed; wallet returns to `locked`. */
  "wallet.lock": {
    input: z.void(),
    output: z.object({ ok: z.literal(true) }),
  },

  /** Begins the review pipeline for a pasted base58 transaction and / or
   *  a dragged screenshot. Either input fires alone; both can fire together
   *  (paste a screenshot of the dApp UI alongside the base58 it's about to
   *  sign). The pipeline runs whichever surfaces are present.
   *
   *  Image bytes travel as base64 over IPC — Electron's IPC supports binary,
   *  but base64 keeps the payload JSON-serialisable and the wire-format
   *  obvious in logs (which never log it; SECURITY.md §logging redacts long
   *  base64 strings). */
  "review.start": {
    input: z
      .object({
        raw: z
          .string()
          .min(1)
          .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "expected base58")
          .optional(),
        image: z
          .object({
            base64: z.string().min(1),
            mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
          })
          .optional(),
      })
      .refine((d) => d.raw !== undefined || d.image !== undefined, {
        message: "review.start requires `raw`, `image`, or both",
      }),
    output: Verdict,
  },

  /** User approves a pending verdict — main signs and broadcasts. */
  "review.approve": {
    input: z.object({ id: z.string().uuid() }),
    output: z.object({ signature: z.string() }),
  },

  /** User blocks a pending verdict. */
  "review.block": {
    input: z.object({ id: z.string().uuid() }),
    output: z.object({ ok: z.literal(true) }),
  },

  /** Pending reviewed transactions that have not been approved or blocked. */
  "review.queue": {
    input: z.void(),
    output: z.array(ReviewRecord),
  },

  /** Signed / blocked review history, newest first. */
  "review.history": {
    input: z.void(),
    output: z.array(ReviewRecord),
  },

  /** Local search across reviewed transaction summaries, citations, and status. */
  "review.search": {
    input: z.object({ query: z.string().max(160) }),
    output: z.array(ReviewRecord),
  },

  /** Snapshot of every model's progress. Polled by the Setup screen. */
  "models.status": {
    input: z.void(),
    output: ModelsStatus,
  },

  /** Begin the download queue. Idempotent — calling while active is a no-op. */
  "models.start": {
    input: z.void(),
    output: z.object({ ok: z.literal(true) }),
  },

  /** Pause the queue. Resumes from the same byte offset on next start. */
  "models.pause": {
    input: z.void(),
    output: z.object({ ok: z.literal(true) }),
  },
} as const;

export type ChannelName = keyof typeof channels;

export type ChannelInput<C extends ChannelName> = z.infer<
  (typeof channels)[C]["input"]
>;
export type ChannelOutput<C extends ChannelName> = z.infer<
  (typeof channels)[C]["output"]
>;

/** What the main process actually returns over the wire. */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ArgusErrorWire };
