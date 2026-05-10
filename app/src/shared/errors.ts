/**
 * Single closed set of error codes. Renderer renders by `code`, never by
 * `message` — messages are for logs.
 *
 * STRICT (CODE-RULES.md §Errors): throw `ArgusError` subclasses, never
 * strings. Add a new code here, don't widen the type.
 */

export const ARGUS_ERROR_CODES = [
  // wallet / keystore
  "WALLET_LOCKED",
  "WALLET_BAD_PASSPHRASE",
  "WALLET_NOT_INITIALISED",
  "WALLET_ALREADY_INITIALISED",
  "WALLET_BAD_MNEMONIC",
  "WALLET_AWAITING_CONFIRMATION",

  // models
  "MODEL_MANIFEST_INVALID",
  "MODEL_INTEGRITY_FAILED",
  "MODEL_DOWNLOAD_FAILED",

  // chain / RPC
  "RPC_UNREACHABLE",
  "RPC_REJECTED",
  "TX_DECODE_FAILED",
  "TX_SIMULATION_FAILED",

  // verdict
  "VERDICT_PIPELINE_FAILED",
  "VERDICT_SCHEMA_VIOLATION",

  // IPC / contract
  "IPC_INVALID_PAYLOAD",
  "IPC_UNKNOWN_CHANNEL",

  // generic
  "INTERNAL",
] as const;

export type ArgusErrorCode = (typeof ARGUS_ERROR_CODES)[number];

export class ArgusError extends Error {
  readonly code: ArgusErrorCode;

  constructor(code: ArgusErrorCode, message: string) {
    super(message);
    this.name = "ArgusError";
    this.code = code;
  }
}

/** Wire-safe representation. Stripped of stack and cause for IPC return. */
export interface ArgusErrorWire {
  code: ArgusErrorCode;
  message: string;
}

export function toWire(err: unknown): ArgusErrorWire {
  if (err instanceof ArgusError) return { code: err.code, message: err.message };
  return { code: "INTERNAL", message: "Internal error" };
}
