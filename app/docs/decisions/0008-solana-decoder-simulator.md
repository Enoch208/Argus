# ADR-0008: Solana decoder + simulator on `@solana/web3.js` v1

**Status:** Accepted · 2026-05-10

## Context

Per [PRD §6 / §8 / Appendix A](../../../prd.md), Argus must:

- Accept a base58-encoded transaction pasted by the user.
- Decode it into structured instructions humans can read (system transfers,
  SPL transfers, SPL approvals, `setAuthority`, Jupiter swaps, Magic Eden
  listings, "unknown program").
- Simulate it against current chain state and surface balance deltas.
- All before the LLM sees it, because the decoded form is what feeds the
  prompt.

Two questions: which Solana JS lib do we decode with, and where does the
RPC connection live.

## Decision

### Decoding — `@solana/web3.js` v1

We use the existing `@solana/web3.js@^1` install for both transaction parsing
and the `Connection` client. WDK uses the newer modular `@solana/*@^3`
packages internally; we don't re-do the modular migration just for the
decoder — they coexist, and v1's `Transaction.from(buffer)` plus the
ecosystem of helpers (`SystemProgram`, `@solana/spl-token`) is the simpler
surface for v1 of Argus.

Decoder strategy is per-program, dispatching on the program-id of each
instruction:

| Program | What we decode |
|---|---|
| `11111111111111111111111111111111` (System) | SOL transfer (`from`, `to`, `lamports`), `createAccount`, `assign` |
| `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (SPL Token) | `Transfer`, `TransferChecked`, `Approve`, `ApproveChecked`, `SetAuthority`, `CloseAccount` |
| `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` (Token-2022) | Same instruction set as SPL Token, plus transfer-hook surfacing |
| `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4` (Jupiter v6 — note: pinned in code) | Surface as "Jupiter swap" with input/output mints + slippage if present |
| `M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K` (Magic Eden v2) | Surface as "Magic Eden listing" |
| anything else | "Unknown program: <id>" — feeds the YELLOW path |

For v1, only the System and SPL-Token cases get full structured decoding.
Jupiter and Magic Eden are surfaced by program-id only; their internal
encoding decoders land in a follow-up.

### Simulator — `Connection.simulateTransaction`

The simulator uses `Connection.simulateTransaction(transaction, { sigVerify:
false, replaceRecentBlockhash: true })`. We compare `accounts` returned in
the simulation result against the pre-balances we fetch with
`getMultipleAccountsInfo` to compute balance deltas in lamports / token
units.

### RPC — single allow-listed `Connection` per RPC URL

A wrapper in `main/solana/rpc.ts` returns a memoised `Connection` per URL.
The URL is pulled from settings (default: `https://api.mainnet-beta.solana.com`).
The wrapper hands the URL through `main/net/allowlist.ts` first; non-allowed
URLs are refused. WDK uses its own modular RPC client; for simulation +
decode (which v3 doesn't yet expose ergonomically) we use v1.

## Consequences

### What we get

- Battle-tested decoders for the System and SPL Token programs.
- Simulation comes for free via `Connection.simulateTransaction`.
- One memoised `Connection` per URL = no socket churn.
- `@solana/web3.js` v1 is already a dependency — no new install.

### What we accept

- Two Solana stacks coexist (v1 for decode/simulate, v3 inside WDK). Both
  ~1 MB; bundle is fine. Mental load only matters at the API boundary, and
  we keep that boundary at the wrapper functions.
- Jupiter and Magic Eden decoders are surface-level for v1. The verdict
  pipeline can still cite them ("Jupiter v6 route"), and a phased build-out
  fits the way the PRD's threat catalog escalates them anyway.

### What's out of scope here

- Sign + broadcast — those go through the WDK `WalletAccountSolana.sign()`
  + `Connection.sendRawTransaction`. Wired in the next session.
- Versioned transactions with address-lookup tables — the parser supports
  both legacy and v0; ALT-resolution is a follow-up if we hit a real-world
  case that needs it.

## Revisit when

- The decoder is too narrow for a real demo transaction. Symptom: most
  Jupiter swaps in production use route accounts that we'd want to surface.
- We move off v1 for some other reason (e.g., bundle size). v3 covers all
  the same primitives.
