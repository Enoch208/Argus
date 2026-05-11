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
// Stack status
// ---------------------------------------------------------------------------

export const StackLayerState = z.enum(["ready", "loading", "attention"]);
export type StackLayerState = z.infer<typeof StackLayerState>;

export const StackLayer = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  state: StackLayerState,
  value: z.string().min(1),
  detail: z.string().min(1),
});
export type StackLayer = z.infer<typeof StackLayer>;

export const StackStatus = z.object({
  ready: z.boolean(),
  layers: z.array(StackLayer),
  modelsReady: z.number().int().nonnegative(),
  modelsTotal: z.number().int().nonnegative(),
  scamDomains: z.number().int().nonnegative(),
  blacklistedWallets: z.number().int().nonnegative(),
});
export type StackStatus = z.infer<typeof StackStatus>;

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

  /** Live SOL balance + active cluster, fetched from the configured RPC. The
   *  WalletPill polls this; the Send form reads it for max-amount validation. */
  "wallet.balance": {
    input: z.void(),
    output: z.object({
      lamports: z.number().int().nonnegative(),
      sol: z.number().nonnegative(),
      cluster: z.enum(["devnet", "mainnet", "testnet", "custom"]),
    }),
  },

  /** Devnet-only — request a free SOL airdrop so demo flows work without
   *  funding a real wallet. Refuses on mainnet. */
  "wallet.airdrop": {
    input: z.object({ sol: z.number().positive().max(2) }),
    output: z.object({ signature: z.string() }),
  },

  /** Construct an unsigned SOL transfer base58. The renderer pipes the
   *  result through `review.start` so the user reviews their own outgoing
   *  transfer with the AI co-pilot before approving. */
  "wallet.buildTransfer": {
    input: z.object({
      to: z.string().min(32).max(64),
      amountSol: z.number().positive(),
    }),
    output: z.object({ raw: z.string() }),
  },

  /** Begins the review pipeline for anything suspicious: raw transaction
   *  wire data, URLs, domains, addresses, signatures, free text, and / or a
   *  dragged screenshot. Raw transactions can be approved after review;
   *  everything else is informational and never enters the signing path.
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
        text: z.string().min(1).max(8000).optional(),
        image: z
          .object({
            base64: z.string().min(1),
            mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
          })
          .optional(),
      })
      .refine(
        (d) =>
          d.raw !== undefined || d.text !== undefined || d.image !== undefined,
        {
          message:
            "review.start requires `raw`, `text`, `image`, or a combination",
        },
      ),
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

  /** Voice-command transcription. Renderer captures audio (any browser
   *  format Whisper.cpp can decode) as base64 and calls this; main runs
   *  `@qvac/sdk` `transcribe` and returns the recognised text plus a
   *  parsed action for the caller to act on. The action is `null` when the
   *  utterance doesn't match an "approve" / "block" command. */
  "voice.transcribe": {
    input: z.object({
      audio: z.string().min(1),
      mime: z
        .enum([
          "audio/webm",
          "audio/ogg",
          "audio/wav",
          "audio/mp4",
          "audio/mpeg",
        ])
        .optional(),
    }),
    output: z.object({
      text: z.string(),
      action: z.enum(["approve", "block"]).nullable(),
    }),
  },

  /** Verdict readback via `@qvac/sdk` `textToSpeech`. First call triggers
   *  the Chatterbox model download (~1 GB, SDK-managed); subsequent calls
   *  reuse the cache. Returns 24 kHz mono PCM samples; the renderer
   *  re-builds them as an AudioBuffer and plays via AudioContext.
   *  Returns `samples: []` when the model isn't ready or synthesis fails
   *  — the caller surfaces a disabled / error state. */
  "voice.speak": {
    input: z.object({ text: z.string().min(1).max(1200) }),
    output: z.object({
      samples: z.array(z.number()),
      sampleRate: z.number().int().positive(),
    }),
  },

  /** Snapshot of every model's progress. Polled by the Setup screen. */
  "models.status": {
    input: z.void(),
    output: ModelsStatus,
  },

  /** User-facing protection summary for the Stack page. */
  "stack.status": {
    input: z.void(),
    output: StackStatus,
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
