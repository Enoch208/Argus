/**
 * The single allowed path for outbound HTTP from the main process. Per
 * ADR-0005 and SECURITY.md §Network, the main process never opens a
 * connection to a host not on the runtime allowlist.
 *
 * Two layers of allowlist:
 *   - The static set initialised here (Solana RPC defaults).
 *   - Hosts dynamically added by the model registry from the manifest's
 *     `allowedHosts` after the manifest is parsed.
 *
 * Ad-hoc imports of `fetch` / `axios` / `node-fetch` are forbidden by the
 * pre-commit grep documented in ADR-0005. Reach for `request()` here.
 */

import { net, type ClientRequest } from "electron";
import { ArgusError } from "@/shared/errors";
import { logger } from "@/main/log";

const allowlist = new Set<string>([
  "api.mainnet-beta.solana.com",
  "api.devnet.solana.com",
]);

export function allow(host: string): void {
  allowlist.add(host);
}

export function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return allowlist.has(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Wrapped `net.request`. Throws if the URL host is not allowed.
 * Caller owns the lifecycle (`req.end()`, response listening).
 */
export function request(options: { method?: string; url: string; headers?: Record<string, string> }): ClientRequest {
  if (!isAllowed(options.url)) {
    logger.warn("net.request rejected (not on allowlist)", { url: options.url });
    throw new ArgusError(
      "RPC_UNREACHABLE",
      `Refusing to call host not on allowlist: ${new URL(options.url).hostname}`,
    );
  }
  return net.request({
    method: options.method ?? "GET",
    url: options.url,
    headers: options.headers,
    redirect: "follow",
  });
}

/** Snapshot for diagnostics / Settings page. */
export function listAllowed(): string[] {
  return [...allowlist].sort();
}
