# ADR-0005: No network at runtime except Solana RPC

**Status:** Accepted · 2026-05-10

## Context

Argus's privacy posture is the product. The PRD's premise (§1) is that *"nothing about your wallet activity ever leaves your machine."* If we add even a single piece of telemetry, "anonymous metrics," or crash reporting, that claim becomes a lie — and a wallet that lies about its privacy is not a wallet anyone should use.

## Decision

At runtime, after the first-launch model download completes, the only outbound network connections allowed from any Argus process are:

- **Solana RPC** to the user-configured endpoint.

That is the entire allowlist. No telemetry. No crash reporting. No "anonymous usage metrics." No third-party fonts (bundled). No third-party scripts (CSP forbids). No analytics SDK.

Auto-update connections are allowed but only *on user action* (the user clicks "Check for updates") — never on a timer.

## Enforcement

Two layers:

1. **CSP** in the renderer process — `connect-src 'self' <rpc-url>` and nothing else.
2. **Main-process HTTP allowlist** — every `net.request` goes through a wrapper that rejects URLs not on the allowlist. Bypass attempts throw at compile time (the wrapper is the only export from `main/net/`).

A pre-commit hook greps for `fetch(`, `axios`, `node-fetch`, `got`, `request(` in `src/main/` and `src/renderer/` and fails the commit if found outside the wrapper.

## Consequences

### What we get

- The privacy claim is structural, not aspirational.
- The threat model in [SECURITY.md](../SECURITY.md) is enforceable.
- Marketing isn't tempted to add an "opt-in usage stat" that quietly ships to all users.

### What we give up

- We learn nothing about how the app is used. Acceptable: we have a hackathon to ship and a clear product hypothesis. Post-launch insights come from talking to users, not telemetry.
- Crash reporting requires the user to manually copy a log file. Acceptable: the redactor in `main/log.ts` makes the log safe to share, and a "Copy crash report" button in Settings is a small UX cost.

## Revisit when

- Never. This is the load-bearing claim of the product. If we change it, we're a different product.
