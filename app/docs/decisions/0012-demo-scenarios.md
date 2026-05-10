# ADR-0012: Demo scenarios via printable base58 transactions

**Status:** Accepted · 2026-05-10

## Context

[PRD F-12](../../../prd.md) requires three demo scripts:

> Three npm scripts (`demo:phishing`, `demo:safe`, `demo:approve`) load
> canned transaction scenarios with deterministic outcomes for judge
> replay.

These are the centrepiece of the demo video ([PRD §16 Day 11, Appendix C](../../../prd.md))
and the reproducibility lever — a judge running them sees the verdict path
end-to-end in 30 seconds, no need for them to find a real-world transaction
and paste it in.

## Decision

### One TypeScript script, three flavours

`scripts/demo.ts` builds a base58-encoded Solana transaction for each
flavour and prints it to stdout, prefixed with a copy-paste banner:

```
$ npm run demo:phishing

╭─ Argus demo · phishing ─────────────────────────────────────────╮
│ Expected verdict: RED                                            │
│ Cited source:    mandiant/clinksink-2024                         │
│ Recipient:       B8Y1dERnVNoUUXeXA4NaCHiB9htcukMSkfHrFsTMHA7h   │
╰──────────────────────────────────────────────────────────────────╯

base58: <long base58 string>

Paste the line above into the Review canvas. Argus will land RED.
```

The judge copies the base58 line, pastes into Argus's Review canvas,
clicks Review. The verdict pipeline routes through real decoders and the
real scam-intel store; the only thing canned is the input.

Three scenarios:

| Flavour | What it builds | Expected verdict | Why |
|---|---|---|---|
| `phishing` | SOL transfer from a deterministic dummy keypair to the Mandiant primary CLINKSINK operator wallet | **RED** | Wallet-intel match, severity `danger` |
| `safe` | SOL transfer between two deterministic dummy keypairs (no scam-intel hit) | **YELLOW** | Pipeline never claims GREEN until history-RAG (DESIGN-PRINCIPLES §3) |
| `approve` | Same shape as `safe`, intended for the user to manually click Approve in Argus | **YELLOW**, signs + broadcasts when approved | Demonstrates the full round-trip; broadcasts on devnet for safety |

### Why scripts that print, not buttons in the UI

The PRD specifies *"npm scripts."* The script-based path keeps demo state
out of production code: there's no "demo mode" toggle in the renderer, no
hidden route. The fixtures live in `tests/fixtures/*.json` so they're
reviewable + diffable — the script writes the same JSON the test harness
uses, so the test suite asserts the canned verdicts are still RED / YELLOW
on every commit.

### Deterministic dummy keypairs

The scripts derive their keypairs from a hard-coded seed phrase committed
to the repo (`scripts/demo-seeds.ts`). The seed has no SOL and no
authority over any real assets — its sole role is to deterministically
generate the same base58 transaction every run. Documented as such inline
so anyone reviewing the file knows the seed is **not a wallet**.

For `demo:approve`, the script targets **devnet** (configurable via
`SOLANA_RPC_URL` env), and the user's real wallet acts as the fee-payer
when they click Approve in Argus. The script just builds the message; the
user's real key signs.

## Consequences

### What we get

- A 30-second judge-replayable demo that lands the marquee verdict.
- Test fixtures + scripts share a single source of truth (the JSON in
  `tests/fixtures/`).
- No new UI surface, no new IPC channels.

### What we accept

- The scripts assume the user has Argus running. Friendlier UX (one-click
  "open Argus and paste") would require an OS-level URL handler
  registration; out of scope for v1.
- `demo:approve` lands on devnet, not mainnet, by default. The PRD's "$1
  mainnet rehearsal" (Day 11) is a manual override via `SOLANA_RPC_URL=
  ...mainnet...`.

### Out of scope

- A canned screenshot fixture for the future drag-screenshot demo (vision
  slice ships its own `demo:screenshot`).
- Auto-pasting into Argus (would need a global pasteboard write +
  app-focus + key-injection — operating-system-specific, judges don't
  need it).

## Revisit when

- The vision slice lands. Add `demo:screenshot` that drops a canned PNG
  into Argus's drag-handler.
- The scenario list grows beyond three. Generalise into a `scripts/demo.ts
  --scenario phishing` form rather than three sibling scripts.
