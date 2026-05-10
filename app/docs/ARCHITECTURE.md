# Architecture

Three processes. One contract between them. Everything else follows from those.

## The three processes

```
┌──────────────────────────────────────────────────────────────────┐
│                      ELECTRON MAIN PROCESS                        │
│  Owns: WDK keystore · Solana RPC · SQLite · QVAC orchestration   │
│  Trusts: nothing from the outside; everything internal           │
│  Network: Solana RPC (read/broadcast) + first-run model CDN only │
│  Logs: electron-log to disk; never logs secrets                   │
└──────────────────────────────────────────────────────────────────┘
                            ↑   ↓  (typed IPC, zod-validated)
┌──────────────────────────────────────────────────────────────────┐
│                          PRELOAD                                  │
│  Exposes a single typed `window.argus` API via contextBridge.     │
│  No business logic. Only schema-checked pass-through.             │
└──────────────────────────────────────────────────────────────────┘
                            ↑   ↓
┌──────────────────────────────────────────────────────────────────┐
│                    RENDERER (React + Vite)                        │
│  Pure UI + ephemeral state. No filesystem, no network, no node.  │
│  Talks to main *only* via window.argus.*                         │
│  Nodelocale: nodeIntegration=false, contextIsolation=true,        │
│             sandbox=true.                                         │
└──────────────────────────────────────────────────────────────────┘
                            ↑   ↓ (HTTP on 127.0.0.1)
┌──────────────────────────────────────────────────────────────────┐
│                   QVAC SIDECAR (Node child process)               │
│  `@qvac/cli serve` — local OpenAI-compatible HTTP on a random    │
│  127.0.0.1 port. Owns model files. No outbound network.          │
│  Lifecycle owned by main; main is the only client.                │
└──────────────────────────────────────────────────────────────────┘
```

## The contract

The IPC surface is the only place these processes touch. It is defined in **one** module: `src/shared/ipc.ts`. Every channel has:

- A unique string name.
- A zod input schema.
- A zod output schema.
- A typed handler signature derived from those schemas.

If a channel doesn't exist there, it doesn't exist. The renderer cannot invoke an undeclared channel; the main process cannot register one. This is enforced by types.

## Domain ownership

Each domain lives in **one** of the three processes. Cross-process logic is a smell.

| Domain | Process | Why |
|---|---|---|
| Wallet (mnemonic, derivation, signing) | Main | Seed must never reach renderer or be loggable. |
| Solana RPC | Main | Renderer has no network. RPC URL is config, owned by main. |
| SQLite (history, scam-intel, fingerprints, settings) | Main | Filesystem, native binding. Renderer cannot read disk. |
| Model files + manifest | Main | Filesystem, SHA verification, encrypted at rest where needed. |
| QVAC orchestration (which model, which prompt) | Main | Single point of policy; renderer doesn't pick prompts. |
| Verdict pipeline (decode → simulate → embed → cite → verdict) | Main | Pure function on inputs; output is the only thing renderer sees. |
| Voice (Whisper, Piper, F5 global hotkey) | Main | OS-level shortcut + audio device. |
| Window chrome, sidebar, queue UI, verdict cards | Renderer | Pure presentation. |
| Transient UI state (which card is open, focus, hover) | Renderer (Zustand) | Local. |
| Server-cached chain reads (balance, recent tx) | Renderer (TanStack Query around IPC) | Cache management is a UI concern. |

## Data flow for a single review

```
1.  user pastes a base58 transaction into the renderer.
2.  renderer  → window.argus.review.start({ raw: "..." })
3.  preload validates input against zod schema.
4.  main: decoder parses tx + simulates against current chain state.
5.  main: scam-intel + history embeddings cross-referenced.
6.  main: QVAC explainer called with grammar-constrained schema.
7.  main: verdict assembled { level, summary, citations[], decoded[], deltas[] }.
8.  main writes pending row to SQLite.
9.  main → preload → renderer: verdict object (zod-parsed at boundary).
10. renderer renders the VerdictCard.
11. user clicks Approve.
12. renderer → window.argus.review.approve(id).
13. main signs via WDK, broadcasts via RPC, updates row.
14. main pushes status updates to renderer (signed → broadcast → confirmed).
```

The renderer never holds the raw signing key. The renderer never sees the seed.

## What lives where in the source tree

See [STRUCTURE.md](STRUCTURE.md). Don't invent new top-level directories.

## What goes on the network

| At | Purpose | Allowed |
|---|---|---|
| First launch | Download manifest + models from CDN | Yes, with SHA verification |
| Runtime, on user action | Solana RPC (configured endpoint) for reads + broadcast | Yes |
| Anywhere else | — | **No.** Telemetry, crash reports, "anonymous metrics" — all forbidden. The privacy posture is the product. |

## Reduced motion + power

The DarkVeil shader, the sonar pulse, the orbit rotation, every keyframe — all gated behind `prefers-reduced-motion`. The renderer respects OS power state via `IntersectionObserver` (don't render off-screen) and a 30-fps cap on the WebGL hero. See [UI-RULES.md](UI-RULES.md) §motion.
