/**
 * Memoised `Connection` per RPC URL. Goes through the net allowlist so an
 * unconfigured / typo'd URL gets refused before a single byte is sent.
 *
 * SECURITY.md §Network: only Solana RPC URLs are reachable at runtime;
 * everything else is blocked at the wrapper layer.
 */

import { Connection } from "@solana/web3.js";
import { ArgusError } from "@/shared/errors";
import { allow, isAllowed } from "@/main/net/allowlist";
import { logger } from "@/main/log";

// Default to mainnet. The Settings page will let users swap; until then this
// is the single source of truth in the main process.
const DEFAULT_URL = "https://api.mainnet-beta.solana.com";

const cache = new Map<string, Connection>();
let activeUrl = DEFAULT_URL;

allow(new URL(DEFAULT_URL).hostname);

export function getConnection(url: string = activeUrl): Connection {
  if (!isAllowed(url)) {
    throw new ArgusError(
      "RPC_UNREACHABLE",
      `RPC URL not on allowlist: ${url}`,
    );
  }
  let conn = cache.get(url);
  if (!conn) {
    conn = new Connection(url, "confirmed");
    cache.set(url, conn);
    logger.info("rpc connection opened", { url });
  }
  return conn;
}

export function setActiveRpcUrl(url: string): void {
  // The hostname must already be on the allowlist before we cache the conn.
  // The settings handler is responsible for `allow(host)` first.
  if (!isAllowed(url)) {
    throw new ArgusError("RPC_UNREACHABLE", `RPC URL not on allowlist: ${url}`);
  }
  activeUrl = url;
}

export function activeRpcUrl(): string {
  return activeUrl;
}
