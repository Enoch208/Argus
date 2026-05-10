# Argus — desktop app

A self-custodial Solana wallet that runs a **local AI co-pilot** in front of every signature. Every model the co-pilot uses runs on your machine — no transaction, screenshot, mnemonic, or activity ever leaves the device.

> **AI contributors:** read [AGENTS.md](AGENTS.md) before writing code. The rules are not optional.

## What it does

You paste a base58-encoded Solana transaction (or drop a screenshot of the dApp asking you to sign one), and Argus produces a verdict — RED, YELLOW, or GREEN — backed by **citations only it can verify locally**:

- Decodes every instruction (System / Token / Token-2022 / ATA, plus an "unknown program" path that forces YELLOW).
- Runs an RPC `simulateTransaction`; a rejected simulation forces RED.
- Looks the program / wallet / mint / OCR'd domain up in a local scam-intel store seeded from Mandiant CLINKSINK and SolanaFM.
- Fuzzy-matches OCR'd domains against an allow-list of canonical Solana dApps (one-edit Levenshtein over `magiceden.io`, `jup.ag`, etc.) so typo-squats don't slip through.
- Detects **brand impersonation**: a screenshot that mentions "Phantom" but doesn't surface `phantom.app` (only some look-alike domain) earns its own citation, independent of whether the look-alike is already on the blocklist.
- Embeds the verdict signal with `bge-small-en-v1.5` and ranks it against your **own prior signed/blocked history** — outliers are flagged.
- Asks `Qwen3-1.7B` (running locally via `node-llama-cpp`) to rewrite the deterministic facts into plain English. The model never adds facts; on any schema miss, the deterministic explanation is shown instead.

Everything above is the verdict pipeline ([src/main/verdict/pipeline.ts](src/main/verdict/pipeline.ts)). It is a pure function over `{ raw?, image? }` and returns a verdict whose `citations.length >= 1` is enforced by zod at the IPC boundary.

## Architecture

Three processes, one typed contract.

```
┌────────────────────────────────────────────────────────────────────┐
│                        RENDERER (React 19 + Vite)                   │
│  • Pure UI. No filesystem, no network, no node integration.         │
│  • Reads via TanStack Query, writes via window.argus.*              │
│  • Zustand for transient UI state only (toast, drawer, drag-state). │
└──────────────────────────────────△────────△────────────────────────┘
                                   │        │  contextBridge
                                   ▼        ▼  (zod-validated)
┌────────────────────────────────────────────────────────────────────┐
│                              PRELOAD                                │
│  Exposes one typed window.argus API. No business logic.             │
└──────────────────────────────────△────────△────────────────────────┘
                                   │        │
                                   ▼        ▼  ipcMain.handle
┌────────────────────────────────────────────────────────────────────┐
│                            MAIN PROCESS                             │
│  Owns:                                                              │
│   • WDK keystore (Argon2id + AES-256-GCM)                           │
│   • Solana RPC (read + broadcast)                                   │
│   • SQLite review ledger (signed/blocked history)                   │
│   • In-memory scam-intel + URL allow-list                           │
│   • QVAC SDK runtime (@qvac/sdk → @qvac/llm-llamacpp, in-process)   │
│   • Tesseract.js OCR worker (lazy WASM load)                        │
│                                                                     │
│  Verdict pipeline:                                                  │
│   raw / screenshot ─► decode / OCR ─► simulate ─► intel             │
│         │                                                           │
│         └─► personal-history RAG ─► explainer LLM ─► Verdict        │
└────────────────────────────────────────────────────────────────────┘
```

Detailed reading order: [docs/AGENTS.md](AGENTS.md) → [docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → [docs/SECURITY.md](docs/SECURITY.md). Material decisions are recorded as ADRs in [docs/decisions/](docs/decisions/).

## Built with QVAC

Argus runs on the **official [QVAC SDK](https://www.npmjs.com/package/@qvac/sdk)** — Tether's vertically-integrated, on-device AI stack — because a wallet co-pilot that phones home defeats the point. Every LLM and embedding call goes through `@qvac/sdk` ([src/main/llm/qvac.ts](src/main/llm/qvac.ts)), which loads the same GGUF files our manifest already SHA-verifies. There is no remote inference path, anywhere.

| QVAC role | Model | Where in code |
|---|---|---|
| Verdict explainer | `Qwen3-1.7B-Q4_K_M.gguf` (via `@qvac/llm-llamacpp`) | [src/main/verdict/explainer.ts](src/main/verdict/explainer.ts) |
| Personal-history RAG embeddings | `bge-small-en-v1.5-q4_k_m.gguf` (via `@qvac/embed-llamacpp`) | [src/main/llm/embedder.ts](src/main/llm/embedder.ts) |
| Screenshot text extraction | Tesseract.js v5 (WASM, in-process) | [src/main/ocr/extractor.ts](src/main/ocr/extractor.ts) |
| Voice transcription | `whisper-base.en` (via `@qvac/transcription-whispercpp`) | reserved |
| Voice readback | Piper (via `@qvac/tts-onnx`) | reserved |

> Multimodal vision (`MiniCPM-V-2.6`) is intentionally deferred until we wire the QVAC SDK's projection-model loading path. Today the screenshot signals are OCR'd URLs and the brand-impersonation citation in the verdict pipeline ([ADR-0015](docs/decisions/0015-vision-deferred-brand-impersonation.md)).

The SDK lifecycle is owned in [src/main/llm/qvac.ts](src/main/llm/qvac.ts): `startQVACProvider()` boots the worker on first need, `loadModel()` registers GGUFs by absolute path, `stopQVACProvider()` runs on `app.before-quit`. All failures surface as `null` so the verdict pipeline degrades to its deterministic explanation instead of hard-failing — see ADR-0010 (revised).

**The seed phrase never crosses IPC.** It is generated, encrypted, and signed-with entirely inside the main process — the renderer cannot reach it, and no log line includes it. See [docs/SECURITY.md](docs/SECURITY.md).

## Quick start

```bash
# from /app
npm install                  # installs deps + rebuilds better-sqlite3 for Electron
npm run dev                  # starts Electron with HMR on the renderer
```

First launch downloads the model bundle (~6 GB, SHA-verified, resumable; pause/resume from the Models route). Once the explainer model is `ready`, the verdict pipeline switches from deterministic-only to QVAC-backed explanations automatically.

### Demo scripts

Three pre-built scenarios drop a base58 transaction into the Review route and produce a verdict end-to-end:

```bash
npm run demo:safe       # token transfer → GREEN-ish (always YELLOW per §3 honest uncertainty)
npm run demo:phishing   # spl-approve to a known-bad delegate → RED with citations
npm run demo:approve    # approves a queued review and broadcasts to devnet
```

### Useful scripts

```bash
npm run typecheck       # tsc --noEmit (must be clean before review)
npm run lint            # eslint flat config (must be clean before review)
npm run build           # electron-vite build && electron-builder
npm run test            # vitest (decoder + url-intel + history-rag)
```

## What's implemented (P0)

- ☑ Wallet primitives — WDK keystore, mnemonic gen + import, Solana derivation, Argon2id-encrypted vault
- ☑ Transaction decode + simulate — System / SPL / Token-2022 / ATA, unknown-program YELLOW path
- ☑ Sign + broadcast — confirmed status surfaced as a Solscan link
- ☑ Local scam-intel — 65 real entries from Mandiant CLINKSINK + SolanaFM (program / wallet / mint tables)
- ☑ OCR + URL allow-list — Tesseract.js v5 + 34-entry in-memory store + Levenshtein-1 fuzzy match
- ☑ Brand-impersonation detection — OCR-derived "brand mentioned, canonical domain absent" signal with its own citation and severity policy
- ☑ Personal-history RAG — `bge-small` embeddings with bag-of-words fallback for cold-start
- ☑ Local explainer LLM — `Qwen3-1.7B` via `@qvac/sdk`, deterministic fallback on schema miss
- ☑ Demo scenarios — phishing / safe / approve, all wired through the real pipeline (no mocks)

## What's *not* yet implemented

- ☐ Multimodal LLM over screenshots — deferred until `node-llama-cpp` ships a multimodal API ([ADR-0015](docs/decisions/0015-vision-deferred-brand-impersonation.md)). Brand-impersonation + URL allow-list are the screenshot signals today.
- ☐ Voice mode (Whisper transcribe → Piper readback)
- ☐ Phantom-blocklist full ~2,300-entry scrape ([scripts/refresh-url-intel.ts](scripts/) is the boundary)

## Related

- [`/landing_page/`](../landing_page/) — Next.js 16 marketing site. Source of truth for design tokens, fonts, and brand.
- [`/prd.md`](../prd.md) — canonical hackathon-scoped V1 PRD.

## License

MIT.
