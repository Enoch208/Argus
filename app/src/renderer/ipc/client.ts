/**
 * Typed IPC client. Renderer code should only use this — never `window.argus`
 * directly, never `ipcRenderer`.
 *
 * Pattern (CODE-RULES.md): one wrapper validates the response at the boundary;
 * inside the renderer types are the contract.
 */

import { ArgusError } from "@/shared/errors";
import {
  channels,
  type ChannelInput,
  type ChannelName,
  type ChannelOutput,
  type IpcResult,
  type ModelProgress,
  type ModelsStatus,
} from "@/shared/ipc";

type ArgusBridge = {
  invoke<C extends ChannelName>(channel: C, payload: unknown): Promise<unknown>;
  channels: readonly ChannelName[];
};

async function invoke<C extends ChannelName>(
  channel: C,
  input: ChannelInput<C>,
): Promise<ChannelOutput<C>> {
  const raw = (await getBridge().invoke(channel, input)) as IpcResult<unknown>;
  if (!raw.ok) throw new ArgusError(raw.error.code, raw.error.message);
  return channels[channel].output.parse(raw.data) as ChannelOutput<C>;
}

function getBridge(): ArgusBridge {
  if (window.argus) return window.argus;
  if (isDevRenderer()) return browserPreviewBridge;
  throw new ArgusError(
    "INTERNAL",
    "Argus IPC bridge is unavailable. Launch the app through Electron.",
  );
}

function isDevRenderer(): boolean {
  return Boolean(
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV,
  );
}

export const argus = {
  wallet: {
    state: () => invoke("wallet.state", undefined),
    create: (input: ChannelInput<"wallet.create">) => invoke("wallet.create", input),
    confirmCreate: () => invoke("wallet.confirmCreate", undefined),
    import: (input: ChannelInput<"wallet.import">) => invoke("wallet.import", input),
    unlock: (input: ChannelInput<"wallet.unlock">) => invoke("wallet.unlock", input),
    lock: () => invoke("wallet.lock", undefined),
  },
  review: {
    start: (input: ChannelInput<"review.start">) => invoke("review.start", input),
    approve: (input: ChannelInput<"review.approve">) => invoke("review.approve", input),
    block: (input: ChannelInput<"review.block">) => invoke("review.block", input),
    queue: () => invoke("review.queue", undefined),
    history: () => invoke("review.history", undefined),
    search: (input: ChannelInput<"review.search">) => invoke("review.search", input),
  },
  voice: {
    transcribe: (input: ChannelInput<"voice.transcribe">) =>
      invoke("voice.transcribe", input),
    speak: (input: ChannelInput<"voice.speak">) => invoke("voice.speak", input),
  },
  models: {
    status: () => invoke("models.status", undefined),
    start: () => invoke("models.start", undefined),
    pause: () => invoke("models.pause", undefined),
  },
};

const previewModels: ModelProgress[] = [
  {
    id: "qwen3-1-7b-q4",
    name: "Qwen3-1.7B Q4",
    role: "Verdict explainer",
    vram: "1.2 GB",
    sizeBytes: 1_117_320_256,
    downloadedBytes: 0,
    state: "queued",
    error: null,
  },
  {
    id: "whisper-base-en",
    name: "Whisper-base.en",
    role: "Voice transcription",
    vram: "180 MB",
    sizeBytes: 147_951_616,
    downloadedBytes: 0,
    state: "queued",
    error: null,
  },
  {
    id: "piper-medium-en",
    name: "Piper-medium-en",
    role: "Verdict readback",
    vram: "90 MB",
    sizeBytes: 63_288_832,
    downloadedBytes: 0,
    state: "queued",
    error: null,
  },
  {
    id: "bge-small-en-v1-5",
    name: "bge-small-en-v1.5",
    role: "Embeddings",
    vram: "60 MB",
    sizeBytes: 24_117_248,
    downloadedBytes: 0,
    state: "queued",
    error: null,
  },
];

let previewActive = false;
let previewStartedAt = 0;
let previewBaseFraction = 0;

const browserPreviewBridge: ArgusBridge = {
  channels: Object.keys(channels) as ChannelName[],
  async invoke(channel) {
    switch (channel) {
      case "models.status":
        return ok(previewStatus());
      case "models.start":
        previewBaseFraction = previewStatus().fraction;
        previewStartedAt = Date.now();
        previewActive = true;
        return ok({ ok: true });
      case "models.pause":
        previewBaseFraction = previewStatus().fraction;
        previewActive = false;
        return ok({ ok: true });
      case "wallet.state":
        return ok({ state: "uninitialised", address: null } as const);
      case "wallet.lock":
        return ok({ ok: true } as const);
      case "review.queue":
      case "review.history":
        return ok([]);
      case "review.search":
        return ok([]);
      default:
        return {
          ok: false,
          error: {
            code: "IPC_UNKNOWN_CHANNEL",
            message: `${channel} is unavailable in browser preview`,
          },
        } satisfies IpcResult<never>;
    }
  },
};

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function previewStatus(): ModelsStatus {
  const fraction = previewFraction();
  const total = previewModels.reduce((sum, model) => sum + model.sizeBytes, 0);
  let remaining = Math.round(total * fraction);

  const models = previewModels.map((model) => {
    const downloadedBytes = Math.min(model.sizeBytes, Math.max(0, remaining));
    remaining -= downloadedBytes;
    const state: ModelProgress["state"] =
      downloadedBytes >= model.sizeBytes
        ? "ready"
        : downloadedBytes > 0 && previewActive
          ? "downloading"
          : downloadedBytes > 0
            ? "paused"
            : "queued";
    return { ...model, downloadedBytes, state };
  });

  const ready = models.every((model) => model.state === "ready");
  if (ready) previewActive = false;

  return {
    ready,
    active: previewActive && !ready,
    fraction,
    models,
  };
}

function previewFraction(): number {
  if (!previewActive) return previewBaseFraction;
  const elapsed = Date.now() - previewStartedAt;
  return Math.min(1, previewBaseFraction + elapsed / 18_000);
}
