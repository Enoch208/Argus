# ADR-0003: Shared design tokens between landing page and app

**Status:** Accepted · 2026-05-10

## Context

The landing page (`/landing_page/`) already defines the brand: tokens, icons, fonts, motion. The desktop app (`/app/`) is a sibling, not a downstream — but its UI must read as the same product. Forking the tokens guarantees brand drift inside two weeks.

We considered three options:

1. **Copy.** Manually paste `tokens.ts`, `icons.tsx`, and the keyframes into `app/`. Fast for the hackathon, drifts the moment the landing page changes.
2. **Symlink.** `app/src/renderer/design/{tokens,icons}.ts` → `landing_page/lib/{tokens,icons}.tsx`. Solves drift, but symlinks are awkward in Vite + Electron + cross-platform builds.
3. **Workspace package.** A pnpm workspace with `packages/design` consumed by both. Cleanest long-term; setup cost ~1 hour.

## Decision

**For V1 (hackathon):** keep the design source files **physically duplicated** in `app/src/renderer/design/`, with a comment at the top of each pinning the canonical source:

```ts
// SOURCE OF TRUTH: /landing_page/lib/tokens.ts
// If you edit this file, mirror the change there. Workspace migration is in
// docs/decisions/0003-shared-design-system.md.
```

A pre-commit hook compares the duplicates and fails if they diverge.

**For V2 (post-hackathon):** migrate to a pnpm workspace with `packages/design` shared by `landing_page/` and `app/`. The migration is non-invasive — both surfaces import from the same alias; only the resolution changes.

## Consequences

### What we get

- Hackathon timeline preserved (no monorepo refactor in week one).
- Drift is detected early via the pre-commit check.
- Migration path is well-defined and low-risk.

### What we give up

- A small ongoing burden of running the diff check during the hackathon. Acceptable.

## Revisit when

- The hackathon submission ships. First post-submission task is the workspace migration.
