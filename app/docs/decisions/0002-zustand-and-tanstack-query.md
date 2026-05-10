# ADR-0002: Zustand for transient UI state, TanStack Query for IPC reads

**Status:** Accepted · 2026-05-10

## Context

The renderer needs to manage two distinct kinds of state:

1. **Transient UI state.** Which sidebar route is active, which modal is open, hover, the current voice-mode transcript. Owned by the renderer, never persisted, never round-tripped through main.
2. **Server-cache-shaped state.** Wallet balance, history list, model download status, scam-intel freshness. Comes from the main process via IPC, must be cached, refreshed, deduplicated, and invalidated on writes.

Mixing both into one store creates a familiar mess: every component grows boolean flags (`isLoading`, `isError`, `isFetching`), invalidation is hand-rolled, refetches stomp on each other.

## Decision

- **Zustand** for transient UI state. One store per domain (`stores/wallet.ts`, `stores/queue.ts`, `stores/voice.ts`, `stores/ui.ts`).
- **TanStack Query** for everything that crosses IPC. Hooks in `renderer/hooks/use-*.ts` wrap the typed IPC client.
- **No other state library.** No Redux, no Recoil, no Jotai, no signals.

Forms with > 3 fields use **React Hook Form**; smaller forms use `useState`.

## Consequences

### What we get

- Loading / error / refetching is solved by TanStack Query, identically across the app. No bespoke booleans.
- Mutations (approve, block) automatically invalidate the affected queries — no manual store reconciliation.
- Zustand stores stay tiny because they hold only transient state. Reading code becomes obvious.
- Both libraries have minuscule bundles, no provider drilling, no boilerplate.

### What we give up

- "One global state tree" debugging. Acceptable: Argus is a tool, not a complex client. Keeping concerns separate is more important than singularity.

### Why not Redux Toolkit

- Boilerplate. The action / reducer / selector wiring is a tax we don't need to pay for the size of state we have.
- TanStack Query already does the hard part — server-cache management — better than RTK Query for our pattern (IPC isn't HTTP).

## Revisit when

- We have > 8 Zustand stores. That's a sign of incoherent domain boundaries; reorganise.
- A use case appears that genuinely needs distributed state (e.g., a multi-window mode). Today, single-window is locked in by [PRD §4].
