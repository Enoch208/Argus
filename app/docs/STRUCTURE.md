# Folder Structure

The shape below is fixed. Don't introduce new top-level directories under `src/` without an ADR. Don't rename. Don't "reorganise."

```
app/
├── AGENTS.md                        ← contract for AI contributors (read first)
├── CLAUDE.md                        ← @AGENTS.md pointer
├── README.md                        ← human entry point
├── docs/
│   ├── DESIGN-PRINCIPLES.md         ← what Argus is
│   ├── ARCHITECTURE.md              ← processes + IPC
│   ├── SECURITY.md                  ← threat model + hard rules
│   ├── CODE-RULES.md                ← TS / React / file conventions
│   ├── UI-RULES.md                  ← tokens / type / motion
│   ├── STRUCTURE.md                 ← this file
│   └── decisions/                   ← ADRs
│       ├── 0001-electron-not-tauri.md
│       ├── 0002-zustand-and-tanstack.md
│       └── ...
│
├── electron.vite.config.ts          ← three configs in one (main, preload, renderer)
├── electron-builder.yml             ← signed installers (.dmg, .exe)
├── package.json
├── tsconfig.json                    ← strict + noUncheckedIndexedAccess
├── tsconfig.node.json
├── eslint.config.mjs
│
├── resources/                       ← installer-bundled assets
│   ├── icon.icns                    ← macOS app icon
│   ├── icon.ico                     ← Windows app icon
│   ├── manifest.pubkey              ← Ed25519 pubkey for verifying model manifest
│   └── seed-scam-intel.sqlite       ← bootstrap corpus, signed
│
├── public/                          ← renderer-served static assets (fonts, etc.)
│
├── tests/
│   ├── fixtures/                    ← canonical drainer payloads, one file per pattern
│   │   ├── known-bad-recipient.json
│   │   ├── unlimited-spl-approval.json
│   │   ├── set-authority.json
│   │   └── ...
│   └── unit/                        ← Vitest specs, mirroring src/main/
│       ├── solana/
│       ├── ai/
│       └── verdict/
│
└── src/
    ├── shared/                      ← types + constants that cross IPC
    │   ├── ipc.ts                   ← THE channel registry (zod-keyed)
    │   ├── errors.ts                ← ArgusError + ArgusErrorCode union
    │   ├── types/
    │   │   ├── verdict.ts
    │   │   ├── transaction.ts
    │   │   ├── model.ts
    │   │   └── manifest.ts
    │   └── constants.ts             ← hard-coded URLs, allowlists, version pins
    │
    ├── main/                        ← Electron main process
    │   ├── index.ts                 ← entry: app.whenReady, lifecycle, single instance
    │   ├── window.ts                ← BrowserWindow factory (chrome rules from UI-RULES)
    │   ├── menu.ts                  ← native menu (mostly empty; F5 handled separately)
    │   ├── config.ts                ← reads env, writes the runtime config object
    │   ├── log.ts                   ← electron-log + secret redactor
    │   │
    │   ├── ipc/
    │   │   ├── register.ts          ← `handle()` wrapper enforcing zod
    │   │   └── handlers/
    │   │       ├── review.ts        ← review.start, review.approve, review.block
    │   │       ├── wallet.ts        ← wallet.address, wallet.unlock, wallet.lock
    │   │       ├── history.ts       ← history.list, history.search
    │   │       ├── models.ts        ← models.status, models.download, models.pause
    │   │       └── voice.ts         ← voice.start, voice.stop
    │   │
    │   ├── wallet/
    │   │   ├── keystore.ts          ← Argon2id-encrypted seed at rest
    │   │   ├── derive.ts            ← BIP-44 paths via WDK
    │   │   └── signer.ts            ← signs in-process, never exposes key material
    │   │
    │   ├── solana/
    │   │   ├── rpc.ts               ← @solana/web3.js Connection wrapper, allowlisted URL
    │   │   ├── decoder.ts           ← parses base58 tx into structured form
    │   │   ├── simulator.ts         ← simulates against current chain state
    │   │   └── allow-list.ts        ← canonical Solana dApp programs
    │   │
    │   ├── db/
    │   │   ├── connect.ts           ← better-sqlite3 + sqlite-vss bootstrap
    │   │   ├── migrations/          ← versioned, idempotent
    │   │   ├── transactions.ts      ← repo: insert/list/search reviewed tx
    │   │   ├── scam-intel.ts        ← repo: known-bad address/program/mint lookup
    │   │   ├── fingerprints.ts      ← repo: dApp UI canonical screenshots
    │   │   └── settings.ts          ← repo: encrypted settings + RPC URL
    │   │
    │   ├── models/
    │   │   ├── manifest.ts          ← fetch + verify signed manifest.json
    │   │   ├── downloader.ts        ← resumable HTTP Range, sha-verify, atomic rename
    │   │   ├── store.ts             ← where files live; integrity-check on each launch
    │   │   └── policy.ts            ← demo vs full set, runtime selection
    │   │
    │   ├── ai/
    │   │   ├── qvac.ts              ← spawn + lifecycle of @qvac/cli serve sidecar
    │   │   ├── explainer.ts         ← LLM call with GBNF-constrained verdict schema
    │   │   ├── visionGuard.ts       ← multimodal phishing similarity
    │   │   ├── ocr.ts               ← screenshot text/URL extraction
    │   │   ├── embed.ts             ← embedding generation + cosine helper
    │   │   └── voice.ts             ← Whisper STT + Piper TTS
    │   │
    │   └── verdict/
    │       ├── pipeline.ts          ← THE function: input → verdict
    │       ├── citations.ts         ← turns signals into structured citations
    │       └── thresholds.ts        ← red/yellow/green decision policy
    │
    ├── preload/
    │   └── index.ts                 ← contextBridge.exposeInMainWorld('argus', api)
    │
    └── renderer/                    ← React + Vite SPA
        ├── index.html
        ├── main.tsx                 ← ReactDOM root + providers (QueryClient, etc.)
        ├── app.tsx                  ← AppShell + route switch (no router lib needed)
        │
        ├── design/
        │   ├── tokens.ts            ← THE single source for colour/type/spacing/etc.
        │   ├── icons.tsx            ← THE single import surface for hugeicons + brand glyphs
        │   ├── globals.css          ← Tailwind import + keyframes + reduced-motion
        │   └── tailwind.css         ← @theme inline derived from tokens
        │
        ├── content/                 ← user-facing copy, by domain
        │   ├── verdict.ts
        │   ├── setup.ts
        │   ├── errors.ts
        │   └── voice.ts
        │
        ├── ipc/
        │   └── client.ts            ← typed `argus.review.start(...)` etc., wraps window.argus
        │
        ├── stores/                  ← Zustand, one per domain
        │   ├── wallet.ts
        │   ├── queue.ts
        │   ├── voice.ts
        │   └── ui.ts
        │
        ├── hooks/                   ← TanStack Query wrappers around the IPC client
        │   ├── use-balance.ts
        │   ├── use-history.ts
        │   ├── use-models.ts
        │   └── use-verdict.ts
        │
        ├── components/
        │   ├── shell/               ← AppShell, Sidebar, TitleBar, WalletPill
        │   ├── ui/                  ← shadcn primitives, restyled to tokens
        │   ├── verdict/             ← VerdictCard, VerdictBadge, CitationList
        │   ├── transaction/         ← DecodedTx, BalanceDelta, ProgramHeader
        │   ├── setup/               ← FirstRun, ModelCard, MicPermissionToast
        │   ├── voice/               ← VoiceOverlay, TranscriptDisplay
        │   └── feedback/            ← Toast, Spinner, EmptyState
        │
        └── routes/                  ← top-level views; one folder per route
            ├── setup/               ← /setup — first-run wizard
            ├── review/              ← /review — paste/drop a transaction (Cmd+N)
            ├── queue/               ← /queue — pending approvals
            ├── history/             ← /history — signed transactions
            ├── search/              ← /search — natural-language history search (Cmd+K)
            ├── stack/               ← /stack — model status, scam-intel freshness
            └── settings/            ← /settings — seed backup, RPC, demo toggle
```

## Boundaries (these are mechanically enforced)

ESLint config disallows:

- `src/renderer/**` importing from `@/main/*` or `@/preload/*` — the renderer cannot reach into the main process.
- `src/main/**` importing from `@/renderer/*` — main never depends on UI code.
- `src/shared/**` importing from anywhere except `zod` and Node built-ins — shared types must remain dependency-light to avoid bundling main code into the renderer.

If your import looks innocent and ESLint screams, ESLint is right.

## Where new things go

| New thing | Lives in |
|---|---|
| A new IPC channel | `shared/ipc.ts` (declaration) + `main/ipc/handlers/<domain>.ts` (handler) + `renderer/ipc/client.ts` (typed wrapper) + `renderer/hooks/use-<thing>.ts` (TanStack Query hook). |
| A new React component | `renderer/components/<domain>/<kebab-name>.tsx`. Domain is the noun in the file name, not the role. |
| A new route | `renderer/routes/<route-name>/index.tsx`. Add to the route switch in `app.tsx`. |
| A new model | `manifest.json` + `main/models/policy.ts` (which set it belongs to). No source code change should be needed for a new model — it's data. |
| A new threat fixture | `tests/fixtures/<threat-name>.json` + a Vitest case in `tests/unit/verdict/pipeline.spec.ts`. |
| A new icon | `renderer/design/icons.tsx`. Never import directly from `@hugeicons/*`. |
| A new colour | You probably shouldn't. If you must, add a token to `renderer/design/tokens.ts` and use it from there. |
| A new dependency | An ADR in `docs/decisions/<NNNN-name>.md` first. |

## Anti-patterns

- A `utils/`, `lib/`, `helpers/`, or `services/` folder under `src/main/` or `src/renderer/`. Domain names only.
- A file ending in `.ts` longer than ~250 lines.
- A component file with more than one `export function`.
- An icon imported from `@hugeicons/*` outside `renderer/design/icons.tsx`.
- A literal hex colour outside `renderer/design/tokens.ts`.
- A literal user-facing string outside `renderer/content/`.
- A `try/catch` that catches and rethrows.
- A floating promise.
- A barrel `index.ts` that re-exports a directory's worth of modules.
