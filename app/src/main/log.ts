/**
 * electron-log with the secret redactor required by SECURITY.md §Logging.
 *
 * STRICT:
 *   - 12 / 24 BIP-39-shaped word sequences are stripped.
 *   - base58 strings ≥ 32 chars (Solana addresses, signatures) are stripped.
 *   - base64 strings ≥ 64 chars are stripped.
 *
 * Only the redactor is exported. Direct `console.log` is forbidden in
 * production builds (build config strips them).
 */

import log from "electron-log";

// 12-or-24-word lowercase BIP-39-shaped phrases.
const SEED_RE = /\b(?:[a-z]{3,10}\s+){11}[a-z]{3,10}(?:\s+[a-z]{3,10}){0,12}\b/gi;
// Solana-shaped base58 (32-char and up).
const BASE58_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,}\b/g;
// Long base64 chunks.
const BASE64_RE = /\b[A-Za-z0-9+/]{64,}={0,2}\b/g;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(SEED_RE, "[SEED]")
      .replace(BASE58_RE, "[ADDRESS]")
      .replace(BASE64_RE, "[BLOB]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v);
    return out;
  }
  return value;
}

log.hooks.push((message) => {
  message.data = (message.data as unknown[]).map(redact);
  return message;
});

log.transports.file.maxSize = 1024 * 1024; // 1 MB
log.transports.console.level = process.env.NODE_ENV === "development" ? "debug" : "info";

export const logger = log;
