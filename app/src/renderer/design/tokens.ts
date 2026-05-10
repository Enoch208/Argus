/**
 * SOURCE OF TRUTH: /landing_page/lib/tokens.ts
 *
 * If you edit this file, mirror the change there. The pre-commit diff check
 * fails the commit if the two files diverge. Workspace migration plan in
 * docs/decisions/0003-shared-design-system.md.
 *
 * STRICT RULES (UI-RULES.md):
 *
 *  1. Container width is `layout.container`. Never `max-w-*` directly.
 *  2. Section vertical padding is `layout.sectionY`. Never mix `py-*` values.
 *  3. Section horizontal gutter is `layout.sectionX`.
 *  4. One headline per section uses `type.h2`; the hero is the only `type.h1`.
 *  5. All eyebrows use `type.eyebrow`.
 *  6. Body text is `type.body` for prose, `type.bodySm` for captions.
 *  7. Display family is reserved for headlines only.
 *  8. Borders default to `surface.border`. No bespoke white/X opacities.
 *  9. Card padding is `layout.cardP`. No card uses ad-hoc `p-*`.
 * 10. Icon container size: `surface.iconBox`. Inline icon: 18px.
 */

export const layout = {
  container: "max-w-[1240px] mx-auto",
  containerWide: "max-w-[1440px] mx-auto",
  sectionX: "px-6 md:px-10",
  sectionY: "py-28 md:py-36",
  sectionYTight: "py-20 md:py-24",
  cardP: "p-7 md:p-9",
  cardPLg: "p-8 md:p-12",
  gridGap: "gap-5 md:gap-6",
} as const;

export const type = {
  h1: "[font-family:var(--font-display)] text-[44px] sm:text-6xl lg:text-[80px] leading-[0.98] tracking-[-0.035em] font-extralight text-white",
  h2: "[font-family:var(--font-display)] text-3xl md:text-5xl lg:text-[56px] leading-[1.02] tracking-[-0.025em] font-extralight text-white",
  h3: "[font-family:var(--font-display)] text-xl md:text-2xl leading-tight tracking-[-0.015em] font-light text-white",
  eyebrow:
    "inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono",
  body: "text-[15px] md:text-base text-white/55 font-extralight leading-[1.7]",
  bodySm: "text-[13px] text-white/45 font-extralight leading-[1.65]",
  mono: "font-mono text-[12px] text-white/40 tracking-wide",
} as const;

export const surface = {
  panel: "bg-[#0a0a0c] border border-white/[0.07]",
  panelHover: "hover:border-white/15 hover:bg-[#0d0d10]",
  border: "border-white/[0.07]",
  iconBox:
    "flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04]",
  glow: "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]",
} as const;

export const motion = {
  reveal: "reveal",
  ease: "transition-colors duration-200",
} as const;

/** Standard inline-icon size used everywhere. Keep under 20 to stay calm. */
export const ICON_INLINE = 18;
/** Icon size when sitting inside `surface.iconBox`. */
export const ICON_BOX = 16;
