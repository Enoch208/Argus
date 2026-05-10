# AGENTS.md — read this before writing a single line

You are about to contribute to **Argus** — a self-custodial Solana wallet with a local AI co-pilot in front of every signature. This is a security tool. Bugs do not just inconvenience users; they lose people's money. Sloppy code, sloppy UI, or sloppy reasoning get rejected.

This file is the contract. Everything you write must obey it.

## The five non-negotiables

1. **Read [docs/CODE-RULES.md](docs/CODE-RULES.md), [docs/UI-RULES.md](docs/UI-RULES.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) before touching code.** Skim is not read. They are short and they enforce hard limits.
2. **The seed phrase must never cross IPC, never appear in a log line, never reach the renderer process.** If your change creates a path where it could, that change is rejected.
3. **Every verdict must carry at least one citation.** The renderer must refuse to display a verdict without citations. The model output schema enforces this. Don't loosen it.
4. **Tokens are the only way to express colour, type, spacing, radius, and shadow.** No raw hex, no arbitrary `text-[14.5px]`, no inline `padding: 11px`. If a token doesn't exist for what you need, edit the token file. Don't bypass it.
5. **Trust internal code; validate the boundary.** Inside the app, types are the contract. At every external boundary (IPC payload, network response, file content, model output) you `parse` with zod. No exceptions.

## What "slop" looks like (and how to avoid it)

| Slop | Reality | What to do instead |
|---|---|---|
| Wrapping every IPC call in `try/catch` and returning `{ok, err}` everywhere | The boundary already validates; double-handling rots into noise | One typed error layer at the IPC boundary. Throw inside; handle once outside. |
| Adding `isLoading`, `isError`, `isFetching` booleans to every store | TanStack Query already manages those for IPC reads | Use TanStack Query for reads. Zustand for transient UI state only. |
| `any` because TypeScript was "fighting you" | TS is telling you the model is wrong | Fix the model. If absolutely stuck, write `// FIXME(slop): <reason>` and open a ticket. |
| Inline styles for one-off colours | Brand drift, two weeks from now nothing matches | Add to `tokens.ts` if it deserves to exist; otherwise it doesn't deserve to exist. |
| New utility files named `helpers.ts` / `utils.ts` / `lib.ts` | Junk drawers grow forever | Name files by domain (`solana/decoder.ts`, not `utils/decoder.ts`). |
| Default exports for components | Renames silently rot, IDE jump-to-definition breaks | Named exports only. One component per file. |
| Comments that explain WHAT the code does | Well-named code already does this; the comment goes stale first | Write WHY, never WHAT. If you can't think of a WHY, delete the comment. |
| Premature abstractions | Three call-sites with two parameters get extracted into a 12-config helper | DRY at three occurrences, not at two. |
| Unrequested "bonus" features | Scope creep is how deadlines die | Ship what was asked. Ask before expanding. |
| New dependencies "to make this easier" | Each dep is a supply-chain attack surface for a wallet | Don't add deps without an ADR in `docs/decisions/`. |

## When to stop and ask

- The change crosses a process boundary (main ↔ renderer) and you don't see a typed channel for it.
- The change touches the seed phrase, the keystore, or the signing path.
- You can't solve the typing without `any` or `as`.
- You're tempted to add a top-level dependency.
- The PRD or these docs disagree with each other — flag it, don't pick.
- A model output disagrees with what you expect — never silently coerce; surface it.

## When NOT to ask

- Naming, file placement, micro-decisions covered in `CODE-RULES.md`.
- Whether to add tests (yes, for any function that touches money or models).
- Whether to use a token (yes).
- Whether to log a secret (no).

## Required reading order

1. This file (you're here).
2. [docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) — *what Argus is*.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — *where things live*.
4. [docs/SECURITY.md](docs/SECURITY.md) — *the threat model*.
5. [docs/CODE-RULES.md](docs/CODE-RULES.md) — *how to write*.
6. [docs/UI-RULES.md](docs/UI-RULES.md) — *how it looks*.
7. [docs/STRUCTURE.md](docs/STRUCTURE.md) — *the folder map*.
8. [docs/decisions/](docs/decisions/) — *why we chose what we chose*.

If you finish this list and still don't know what to do, you do not have enough context to write code yet. Re-read.
