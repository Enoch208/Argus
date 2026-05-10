# Argus Desktop

Argus Desktop is the product surface: a self-custodial Solana wallet with a local AI review layer in front of every signature.

The app is built for a simple user promise: before money moves, Argus explains what is about to happen, cites the evidence, and keeps the review local.

## Core Surfaces

- **Review:** paste a base58 transaction, drop a screenshot, or provide both.
- **Queue:** pending reviewed transactions waiting for an explicit approve / block decision.
- **History:** signed and blocked decisions stored locally.
- **Search:** local retrieval over prior verdicts, citations, signatures, and outcomes.
- **Stack:** model readiness, local intel status, and runtime health.
- **Settings:** wallet state, address copy, lock controls, and local runtime notes.

## Runtime Architecture

```text
Renderer        React UI, no Node, no direct signing
Preload         contextBridge with typed IPC only
Main            wallet, Solana RPC, model runtime, SQLite, verdict pipeline
```

The renderer calls `window.argus.invoke(channel, payload)`. Main validates every payload against the shared zod IPC registry before executing a handler.

## Verdict Pipeline

Input shape:

```ts
type ReviewInput = {
  raw?: string;
  image?: { base64: string; mime: "image/png" | "image/jpeg" | "image/webp" };
};
```

Pipeline:

1. Decode the transaction if `raw` is present.
2. Simulate through Solana RPC.
3. OCR the screenshot if `image` is present.
4. Extract domains and brand signals.
5. Look up programs, wallets, mints, and domains in local intel stores.
6. Compare against prior signed / blocked history.
7. Generate a concise explanation from grounded facts.
8. Return a schema-validated verdict with citations.

Image-only reviews produce a verdict but do not enter the signing queue. Transaction reviews enter the queue and can be approved or blocked.

## Local Data Stores

- `review-ledger.sqlite3`: pending, signed, and blocked reviews.
- `scam-intel.sqlite3`: program, wallet, and mint intelligence.
- URL intel: bundled allow-list / blocklist with fuzzy lookalike detection.
- Model files: downloaded under Electron `userData`, verified by size and SHA.

## AI Runtime

Argus uses `@qvac/sdk` for local AI capabilities:

- Qwen3-1.7B for verdict explanation.
- bge-small-en-v1.5 for personal-history retrieval when available.
- OCR for screenshot URL and brand extraction.
- Whisper / Piper-style voice paths for approve / block and readback.

Every AI call has a deterministic fallback. A model failure should never prevent a safety verdict from rendering.

## Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Demo commands:

```bash
npm run demo:phishing
npm run demo:safe
npm run demo:approve
```

Threat corpus refresh:

```bash
npm run refresh:intel
```

## Security Defaults

- Mnemonic and private key material stay in the main process.
- Renderer sandbox is enabled.
- No direct wallet key access from UI code.
- All IPC payloads are schema-validated.
- Verdicts require citations.
- Unknown or unfamiliar behavior remains conservative.

