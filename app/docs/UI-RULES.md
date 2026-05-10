# UI Rules

These rules exist so that adding a new screen does not require negotiating density, colour, or rhythm from scratch. They lock in the standard set by the landing page so the desktop app reads as the same product.

## The five hard rules

1. **Tokens or it doesn't ship.** Colour, type, spacing, radius, and shadow come from `src/renderer/design/tokens.ts`. No raw hex. No arbitrary `text-[14.5px]`. If a token is missing, edit the token file. Don't bypass it.
2. **One headline per section.** Hero is the only `type.h1`. Every section has exactly one `type.h2`. `h3` is for cards. There is no `h4` level — if you reach for one, the section is doing two things.
3. **One eyebrow per section.** Numbered, monospace, uppercase, tracked. Use `<SectionMarker num="03" label="Pipeline" />`.
4. **One primary action per surface.** A modal has one "Approve". A first-run screen has one "Pause download". A settings page has one "Save". Multiple primaries flatten into noise.
5. **Icons through `lib/icons.tsx` only.** No direct imports from `@hugeicons/*` in components. Adding an icon means adding it to `lib/icons.tsx` first.

## Tokens

Single source: `src/renderer/design/tokens.ts`. The shape mirrors what the landing page uses, lifted verbatim.

### Spacing scale

Tailwind's default scale, **but only these values**: `1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20`. Skip 7, 9, 11, 14, 18 — if you need them, you've broken the rhythm. Cards always pad with one of `p-7`, `p-8`, `p-10`, `p-12`. Sections always use `py-20 md:py-24` (tight) or `py-28 md:py-36` (default). No bespoke values.

### Type scale

```ts
type = {
  h1:   "[font-family:var(--font-display)] text-[44px] sm:text-6xl lg:text-[80px] leading-[0.98] tracking-[-0.035em] font-extralight",
  h2:   "[font-family:var(--font-display)] text-3xl md:text-5xl lg:text-[56px] leading-[1.02] tracking-[-0.025em] font-extralight",
  h3:   "[font-family:var(--font-display)] text-xl md:text-2xl leading-tight tracking-[-0.015em] font-light",
  eyebrow: "text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono",
  body: "text-[15px] md:text-base text-white/55 font-extralight leading-[1.7]",
  bodySm: "text-[13px] text-white/45 font-extralight leading-[1.65]",
  mono: "font-mono text-[12px] text-white/40 tracking-wide",
};
```

That's it. Five sizes. Don't introduce a sixth.

### Colour

The app uses **monochromatic surfaces** + **semantic verdict colours** + **one accent**.

| Token | Hex / Tailwind | Use |
|---|---|---|
| `bg` | `#08080a` | App background |
| `surface` | `#0a0a0c` | Cards, panels, popovers |
| `surface-2` | `#0c0c0f` | Hover state, depressed surfaces |
| `line` | `rgb(255 255 255 / 0.07)` | Hairline dividers, borders |
| `text-primary` | `white/90` | Headlines, primary copy |
| `text-secondary` | `white/55` | Body copy |
| `text-tertiary` | `white/35` | Captions, helper text |
| `verdict-green` | `emerald-300` (text) / `emerald-500/10` (bg) / `emerald-400/25` (border) | GREEN verdict |
| `verdict-yellow` | `amber-300` / `amber-500/10` / `amber-400/25` | YELLOW verdict |
| `verdict-red` | `rose-300` / `rose-500/10` / `rose-500/25` | RED verdict |
| `accent` | `emerald-400` | Primary action focus, active sidebar item |

Forbidden: any `red-*`, `green-*`, `yellow-*`, `blue-*`, `pink-*`, `cyan-*`, `lime-*` Tailwind class. The verdict palette is the ONLY semantic-coloured surface.

### Radius

`rounded-md` (6) for inputs, `rounded-xl` (12) for cards, `rounded-2xl` (16) for verdict cards and primary modals, `rounded-full` for chips and pills. Nothing else.

### Shadow

Three named shadows in tokens:

- `shadow.panel` — the default raised-card shadow.
- `shadow.glow.{green,yellow,red}` — the verdict-card colour glow.
- `shadow.popover` — for floating menus and toasts.

No inline `shadow-[...]` — if a value needs to exist, add a token.

## Component composition

### The shell

```
<AppShell>
  <Sidebar>          ← left rail (Jan-shaped — see DESIGN-PRINCIPLES inspirations)
  <TitleBar>         ← Mac traffic-light spacer / Win min-max-close overlay
  <Main>             ← the route content
  <ToastRegion>      ← bottom-right, non-blocking
</AppShell>
```

Sidebar items are the only nav. There are no breadcrumbs. There are no in-content tabs except inside Settings.

### Cards

A card has:

- One eyebrow (optional).
- One title (`type.h3`).
- One body (`type.bodySm` or `type.body`).
- One primary action (optional). Multiple actions = secondary buttons; the primary is visually distinct.

```tsx
<article className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-7">
  <SectionMarker num="01" label="Pending" className="mb-4" />
  <h3 className={type.h3}>Jupiter swap · 0.5 SOL</h3>
  <p className={`${type.bodySm} mt-2`}>...</p>
</article>
```

That structure repeats. Don't reinvent it per surface.

### Verdict cards

Verdict cards are the only place colour saturates. The shape is fixed:

1. Header: badge (level) + meta (which signals fired).
2. Title (`type.h3`).
3. Summary (`type.bodySm`).
4. Citation list (bulleted, dot-led, `text-[12.5px] text-white/55`).

Never break this layout. Never add a CTA into the verdict card body — actions sit outside the card in a button row.

### Buttons

Three variants. That's the entire system:

- **Primary** — `bg-white text-black`, used once per surface.
- **Secondary** — `bg-white/[0.04] text-white border border-white/10`, used for everything else.
- **Ghost** — `text-white/65 hover:text-white`, no background, for tertiary actions in toolbars and cards.

Sizes: `sm` (h-8), `md` (h-10), `lg` (h-12). No `xs`, no `xl`. Buttons in modals are `lg`. Buttons in toolbars are `sm`. Buttons in card rows are `md`.

### Forms

- Labels above inputs. Placeholder text is not a label.
- Error text below inputs, `text-rose-300 text-[12px]`.
- Helper text below inputs, `type.bodySm`.
- Inputs get full focus rings (`ring-1 ring-white/15 focus:ring-white/40`). No outline:none nonsense.

## Motion

### Default state is still

Most surfaces don't move. Animation is reserved for:

- The verdict card entrance (slide-up + fade, ≤ 250 ms).
- The sonar/orbit visuals on the marketing-equivalent screens (already authored, gated by `[data-scroll-reveal].is-visible`).
- The download progress fill.
- Voice mode activation (a brief glow on the active surface).

### Reduced motion

Every animation must check `prefers-reduced-motion`. The CSS `@media (prefers-reduced-motion: reduce)` block in `globals.css` neutralises animations app-wide; component-level animations must inherit that, not override it.

### Frame budget

The hero WebGL veil runs at **30 fps** capped, with `IntersectionObserver` pausing render when off-screen. Any new always-on animation must justify itself in a code review and stay below 5 % of a baseline-laptop's CPU at idle.

## Native chrome

### macOS

```ts
{
  titleBarStyle: "hiddenInset",
  trafficLightPosition: { x: 14, y: 16 },
  vibrancy: "under-window",
  visualEffectState: "active",
}
```

The sidebar holds the traffic-light reservation. The first row of the sidebar is a 28 px-tall spacer.

### Windows 11

```ts
{
  backgroundMaterial: "mica",
  titleBarOverlay: { color: "#08080a", symbolColor: "#fff", height: 36 },
}
```

Don't fake either of those with a CSS gradient. Use the real OS chrome.

## Accessibility

### Per [DESIGN-PRINCIPLES.md](DESIGN-PRINCIPLES.md) §5

Every actionable element is keyboard-reachable in tab order. Every verdict element is exposed via ARIA. Colour is never the only signal — every verdict carries an icon and a textual label.

### Specific rules

- Buttons get `aria-label` if their label is an icon.
- Modals trap focus and return it on close.
- Toasts have `role="status"` (info) or `role="alert"` (errors).
- Voice mode shows a visible "listening" indicator AND announces "Argus is listening" via TTS.

## Copy

### Source: `src/renderer/content/`

All user-facing strings live in `content/` files, organised by domain:

```
content/
  verdict.ts      ← verdict labels, citation prefixes, action labels
  setup.ts        ← onboarding, model-download wizard
  errors.ts       ← user-facing error messages by ArgusErrorCode
  voice.ts        ← TTS phrases
```

No literal strings in components except for technical UI debris (numbers, separators, "·"). This makes localisation a single-folder change later.

### Tone

- Direct. *"Block — visual phishing match."* not *"It looks like this might be a phishing attempt..."*
- Plain English, no jargon unless the domain demands it (and then the term is monospaced: `setAuthority`, `Approve`).
- Present tense, active voice. *"Argus is verifying models."* not *"Models are being verified."*
- Never patronising. Never cheerful. The user is here because something might be wrong.

## When to break a rule

You don't. Edit the rule (and the tokens) so the breakage isn't a breakage. If you can't articulate why the rule should change, the rule shouldn't change.
