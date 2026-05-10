# Argus — desktop app

A self-custodial Solana wallet that runs a local AI co-pilot in front of every signature. Nothing about your wallet activity leaves your machine.

> **AI contributors:** read [AGENTS.md](AGENTS.md) before writing code. The rules are not optional.

## Status

Skeleton stage. The folder structure, design rules, security model, and architecture are locked in [docs/](docs/). No source code has been written yet — the next step is the scaffold against these rules.

## What's here

```
AGENTS.md             ← contract for AI contributors
CLAUDE.md             ← @AGENTS.md (Claude convention)
docs/
├── DESIGN-PRINCIPLES.md     ← what Argus is
├── ARCHITECTURE.md          ← three processes, one IPC contract
├── SECURITY.md              ← threat model, hard rules
├── CODE-RULES.md            ← TS / React / file conventions
├── UI-RULES.md              ← tokens, type, motion, components
├── STRUCTURE.md             ← folder map (single source of truth)
└── decisions/               ← ADRs (one per material choice)
```

## Read this first if you're new

In order:

1. [AGENTS.md](AGENTS.md) — the contract.
2. [docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) — verdict-first, citations mandatory, honest uncertainty.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — main / preload / renderer / QVAC sidecar.
4. [docs/SECURITY.md](docs/SECURITY.md) — wallet threat model.
5. [docs/STRUCTURE.md](docs/STRUCTURE.md) — where things live.

## What's *not* in here yet

- `package.json`, `electron.vite.config.ts`, `tsconfig.json` — the scaffold lands once the rules are reviewed and signed off.
- `src/` — same.
- Tests, fixtures — same.

## Related

- [`/landing_page/`](../landing_page/) — the marketing site (Next.js 16). Brand source-of-truth for tokens, icons, and fonts that this app mirrors.
- [`/prd.md`](../prd.md) — the canonical product requirements document. Hackathon-scoped V1.

## License

MIT (placeholder; finalised before submission).
