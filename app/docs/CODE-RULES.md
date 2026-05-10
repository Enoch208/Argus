# Code Rules

Rules over preferences. Examples after every rule. If a rule conflicts with a habit, the rule wins.

## TypeScript

### `strict: true` and `noUncheckedIndexedAccess: true`

Both enabled in `tsconfig.json`. Don't loosen them.

### No `any`. No `as` to dodge a type error.

`any` is forbidden. `as` is allowed only when narrowing a `unknown` from a boundary (zod) or asserting a literal type the compiler can't infer (e.g., `as const`).

```ts
// ❌ slop
const data = response as any;

// ✅ proper
const data = ResponseSchema.parse(response);
```

If you genuinely cannot type something, write `// FIXME(slop): <reason>` and open a ticket. Lint warns on `FIXME` so they don't accumulate silently.

### `unknown`, not `any`, at boundaries

Anything coming in from outside the app — IPC payloads, JSON files, model outputs, network responses — is typed `unknown` until it survives a zod parse.

```ts
// shared/ipc.ts
export const ReviewStartInput = z.object({
  raw: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/), // base58
});
export type ReviewStartInput = z.infer<typeof ReviewStartInput>;
```

### One named export per component file

```ts
// ❌ slop
export default function VerdictCard() { ... }
export const VerdictBadge = ...;

// ✅ proper
// components/verdict/verdict-card.tsx
export function VerdictCard(props: VerdictCardProps) { ... }
```

Named exports only. Default exports rot through renames and break IDE jump-to.

### Props as inline interface above the component

```ts
interface VerdictCardProps {
  verdict: Verdict;
  onApprove: (id: string) => void;
  onBlock: (id: string) => void;
}

export function VerdictCard({ verdict, onApprove, onBlock }: VerdictCardProps) {
  ...
}
```

No `React.FC`. No type imported from elsewhere. If a prop type is shared across files it lives in `shared/types/`.

### No barrel `index.ts` re-exports

```ts
// ❌ components/ui/index.ts re-exporting everything
// ❌ Imports become opaque, deps invisible, tree-shaking confused.

// ✅ Import from the file directly:
import { VerdictCard } from "@/components/verdict/verdict-card";
```

The one exception: `lib/icons.tsx` and `lib/tokens.ts` exist precisely as the single import surface for those things (see UI-RULES).

## Files

### Cap at ~250 lines

If a file exceeds 250 lines, it has more than one responsibility. Split.

### Name by domain, not by role

```
✅ src/main/solana/decoder.ts
✅ src/main/solana/simulator.ts
✅ src/main/wallet/keystore.ts

❌ src/main/utils/helpers.ts
❌ src/main/lib/misc.ts
❌ src/main/services/manager.ts
```

The words `helper`, `util`, `manager`, `service`, `wrapper`, and `handler` are banned in filenames unless paired with a domain (`ipc/handlers/review.ts` is fine; `services/manager.ts` is not).

### kebab-case for files, PascalCase for types, camelCase for functions, SCREAMING for constants

```
verdict-card.tsx     ← file
VerdictCard          ← React component
verdictCard          ← variable
VERDICT_LEVELS       ← constant
```

## Imports

### Order

```ts
// 1. node + external (alphabetised)
import { z } from "zod";
import { app } from "electron";

// 2. shared
import { Verdict } from "@/shared/types/verdict";

// 3. domain (process root)
import { decoder } from "@/main/solana/decoder";

// 4. relative
import { ALLOWED_PROGRAMS } from "./allow-list";

// 5. type-only imports last in each group
import type { Connection } from "@solana/web3.js";
```

ESLint enforces this. Don't fight it.

### Path aliases (set in `tsconfig.json` and matched in Vite)

```
@/shared/*    → src/shared/*
@/main/*      → src/main/*
@/preload/*   → src/preload/*
@/renderer/*  → src/renderer/*
```

The renderer **cannot** import from `@/main/*` or `@/preload/*`. ESLint enforces. The reverse is also banned: main never imports from renderer.

## Errors

### Throw `ArgusError` subclasses, never strings

```ts
// shared/errors.ts
export class ArgusError extends Error {
  constructor(public readonly code: ArgusErrorCode, message: string) {
    super(message);
  }
}

// usage
throw new ArgusError("WALLET_LOCKED", "Decrypt the keystore first");
```

Codes are a closed string-literal union in `shared/errors.ts`. The renderer renders by `code`, not by `message` — messages are for logs.

### One handler at the boundary

Inside the app, throw freely. At the IPC boundary, one wrapper normalises:

```ts
function handle<I, O>(name: string, schema: z.ZodSchema<I>, fn: (input: I) => Promise<O>) {
  ipcMain.handle(name, async (_e, raw) => {
    try {
      return { ok: true, data: await fn(schema.parse(raw)) };
    } catch (err) {
      return { ok: false, error: normalise(err) };
    }
  });
}
```

No `try/catch` inside individual functions unless you're recovering with a real fallback. "Logging and rethrowing" is not recovering.

### No `console.log` in production

Use `electron-log` in main and preload. The renderer can use `console.*` only in dev — production builds strip them via the build config. PRs that introduce raw `console.*` in main are rejected.

## React

### Function components only

No class components. No `forwardRef` unless a primitive needs to forward to a DOM node — and even then, prefer composing rather than forwarding.

### State

- **Server-cache-shaped state** (chain reads, history queries): TanStack Query around the IPC client.
- **Transient UI state** (which modal is open, hover, focus, search input): Zustand.
- **Form state**: React Hook Form (only when the form has > 3 fields; below that, `useState`).
- **Refs to DOM**: `useRef`, that's it.

No Redux. No Recoil. No Jotai. No three different state libraries layered on top of each other.

### One Zustand store per domain

```
stores/
  wallet.ts        ← address, balance, lockState
  queue.ts         ← which transactions are pending review
  voice.ts         ← isListening, lastTranscript
  ui.ts            ← which sidebar route is active, modal state
```

No mega-store. No store-of-stores. If a slice doesn't have a clear domain, it doesn't deserve to be a slice.

## Async

### Don't write your own retry / backoff / dedupe

TanStack Query handles all three for IPC reads. Use it.

For one-shot writes (approve, block), call the IPC client directly. Failures bubble to a toast.

### No floating promises

```ts
// ❌ slop
fetchSomething();

// ✅ proper
await fetchSomething();
// or
void fetchSomething(); // explicit fire-and-forget, with a comment if non-obvious
```

ESLint warns on this. Don't ignore.

## Comments

### Default to none

Code with good names doesn't need comments. If you wrote something obvious, deleting the comment improves the file.

### When you do write one, write WHY, not WHAT

```ts
// ❌ slop
// Loop through citations
for (const c of citations) { ... }

// ✅ proper
// We render citations in order — the LLM is prompted to put the strongest
// signal first, so reordering would dilute the verdict explanation.
for (const c of citations) { ... }
```

### Never reference the current task or PR

Comments outlive PRs. Anything like `// added for the wallet flow`, `// fix for issue #123`, `// see Slack thread` belongs in the commit message or PR description.

## Dependencies

### Don't add a dep without an ADR

Every new top-level dependency requires a one-page ADR in `docs/decisions/` covering: what, why, what we'd lose if it disappeared, what the alternatives are, who else uses it.

Argus is a wallet. Each dep is supply-chain risk.

### Pin major versions, allow minors with a lockfile

`package.json` uses `^` for minors. The lockfile is committed. Renovate / Dependabot opens a PR for minors; we batch-merge weekly.

## Tests

### What to test

- Anything in `main/solana/` (decoders, simulators).
- Anything that touches money (signing, broadcast, balance math).
- Anything that takes input from outside (zod schemas — round-trip and bad-input cases).
- Verdict assembly (every fixture in `tests/fixtures/`).

### What not to test

- React component renders. Snapshot tests rot. Test behaviour, not markup.
- Tailwind class names.
- Three-line wrappers around library calls.

### Where

```
tests/unit/           ← Vitest
tests/fixtures/       ← canonical drainer payloads, keyed by threat name
```

Tests live in `tests/`, not next to source. Source files are clean.

## Final rule

If you're about to do something this document doesn't cover, follow the principle of least surprise: do what an experienced engineer reading this codebase a year from now would expect. If you're not sure what they'd expect, you don't have enough context — re-read [AGENTS.md](../AGENTS.md) and the rest of `docs/`.
