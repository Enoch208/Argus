# ADR-0010: `node-llama-cpp` for the QVAC LLM runtime

**Status:** Accepted · 2026-05-10

## Context

[explainer.ts](../../src/main/verdict/explainer.ts) was scaffolded around an
`ARGUS_LLAMA_CLI` env var pointing at a user-installed `llama-cli` binary
(brew, manual install, etc.). That works but breaks the
[PRD §9](../../../prd.md) reproducibility promise — *"compile and run from a
fresh `git clone && npm install && npm run dev` … with no manual
configuration"*. A dev who's never heard of llama.cpp would find Argus
silently falling back to deterministic explanations, no clear path to fix
it.

We need: a runtime that ships with `npm install`, loads our existing
downloaded GGUF, and runs in Electron's main process.

## Decision

We adopt **`node-llama-cpp` v3** (the official `withcatai/node-llama-cpp`
project).

- Programmatic API: `getLlama()` → `loadModel({ modelPath })` → context →
  `LlamaChatSession`. No spawn, no CLI binary, no env var to set.
- Ships prebuilt binaries for macOS (arm64 + x64), Windows (x64), Linux
  (x64). `npm install` is enough on supported platforms.
- Loads our existing `qwen3-1.7b-instruct-q4_k_m.gguf` from the model
  registry's path — no separate download.
- Apache 2.0 + MIT for the GGUF Qwen3 weights.

It's ESM-only, so we load it the same way we load WDK
([ADR-0007](0007-wallet-primitives.md)) — one cached dynamic `import()`
inside the module that uses it.

The env-var escape hatch (`ARGUS_LLAMA_CLI`) is **removed**. Less surface,
single supported path. If a future user wants a custom build, they can swap
node-llama-cpp at the package level — that ADR can come later.

## Consequences

### What we get

- One `npm install` and the LLM is live.
- Same code path on Mac / Windows / Linux.
- The `Verdict.explanation.status` enum already in
  [shared/types/verdict.ts](../../src/shared/types/verdict.ts) provides
  graceful fallback semantics (`ready / fallback / model-missing /
  invalid-output / runtime-error`) — the renderer doesn't need to change.

### What we accept

- Adds ~50 MB to `node_modules` (prebuilt llama.cpp). Acceptable; the GGUF
  itself is 1.1 GB.
- A native binding plus ESM-only package = two small interop quirks the
  team has now solved twice (better-sqlite3 + WDK). This is the third
  application of the pattern; consider it muscle memory.
- Locked into node-llama-cpp's release cadence. Acceptable — it's actively
  maintained.

### Out of scope

- Streaming token output to the renderer. The full draft arrives in one
  IPC response for v1; streaming via `webContents.send` is a UX upgrade,
  not a correctness one.
- Concurrent inference. One model in memory; one verdict at a time. Queue
  serialisation is implicit.

## Revisit when

- A platform we care about isn't on the prebuilt list (unlikely — they
  cover the three Argus targets).
- We need streaming. node-llama-cpp supports it; we'd add a new IPC
  channel that streams tokens.
- A faster local runtime emerges that ships at the same friction.
