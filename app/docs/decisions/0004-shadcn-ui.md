# ADR-0004: shadcn/ui (copy-paste) over wrapped libraries

**Status:** Accepted · 2026-05-10

## Context

We need accessible primitives — Dialog, Popover, Dropdown, Command, Toast, Tabs — restyled to Argus's tokens. The realistic options are:

1. **shadcn/ui** — copy-paste components built on Radix UI, fully owned by us, restyled with Tailwind classes. Not a dependency.
2. **A wrapped UI kit** (Mantine, Chakra, MUI, NextUI). Single dependency, but their themes are opinionated and re-skinning is a fight.
3. **Radix UI alone** — accessible but unstyled. We'd write all the styling ourselves, which is what shadcn already did and we'd be re-doing it badly.

## Decision

**shadcn/ui**, with each primitive copied into `src/renderer/components/ui/` and restyled to consume `tokens.ts`.

`cmdk` (used by shadcn for the Command palette) is acceptable as an underlying dep — it's the canonical implementation, and shadcn wraps it.

## Consequences

### What we get

- Accessibility from Radix, baked in (focus traps, keyboard nav, ARIA). Important for the accessibility persona in [PRD §5].
- Total visual control. Restyling to Argus tokens is mechanical: replace shadcn's default class strings with token-derived ones.
- No version-skew of an external UI kit's theme breaking the app.
- Zero hidden weight — only the primitives we use are in the bundle.

### What we give up

- Per-primitive adoption cost. We add Dialog when we need it, not before. This is the right cost.

### Restyling rules

- Every primitive copied must immediately be re-skinned to tokens (no shadcn defaults shipped).
- The restyled file lives under `components/ui/<primitive>.tsx`.
- The first PR adding each primitive includes a Storybook-style example in `tests/visual/` (a single rendered file used for screenshot diffing).

## Revisit when

- A primitive lands in `components/ui/` and is never referenced — review whether it's needed. Unused primitives don't ship.
