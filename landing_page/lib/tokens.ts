/**
 * Design tokens — the single source of layout, type, and motion rules.
 *
 * STRICT RULES (these are enforced by always consuming tokens, never re-typing
 * Tailwind utilities for the same intent):
 *
 *  1. Container width is `layout.container`. Never `max-w-*` directly.
 *  2. Section vertical padding is `layout.sectionY`. Never mix `py-*` values.
 *  3. Section horizontal gutter is `layout.sectionX`.
 *  4. One headline per section uses `type.h2`; the hero is the only `type.h1`.
 *  5. All eyebrows use `type.eyebrow` (uppercase tracking-wider monospace).
 *  6. Body text is `type.body` for prose, `type.bodySm` for captions.
 *  7. Display family (`var(--font-display)`) is reserved for headlines only.
 *  8. Borders default to `surface.border`. No bespoke white/X opacities.
 *  9. Card padding is `layout.cardP` (lg-aware). No card uses ad-hoc `p-*`.
 * 10. Icon container size: `surface.iconBox` (h-9 w-9). Inline icon: 18×18.
 *
 * Editing this file is the *only* way to change global rhythm. If a section
 * needs a different padding, the right move is to widen these tokens, not to
 * override one section.
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
  // Hero only.
  h1: "[font-family:var(--font-display)] text-[44px] sm:text-6xl lg:text-[80px] leading-[0.98] tracking-[-0.035em] font-extralight text-white",
  // Standard section heading.
  h2: "[font-family:var(--font-display)] text-3xl md:text-5xl lg:text-[56px] leading-[1.02] tracking-[-0.025em] font-extralight text-white",
  // Card / sub-section heading.
  h3: "[font-family:var(--font-display)] text-xl md:text-2xl leading-tight tracking-[-0.015em] font-light text-white",
  // 11-13 char chip above headlines.
  eyebrow:
    "inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono",
  // Default prose.
  body: "text-[15px] md:text-base text-white/55 font-extralight leading-[1.7]",
  // Captions, helper text.
  bodySm: "text-[13px] text-white/45 font-extralight leading-[1.65]",
  // Hex addresses, paths.
  mono: "font-mono text-[12px] text-white/40 tracking-wide",
} as const;

export const surface = {
  // Page-default raised panel.
  panel: "bg-[#0a0a0c] border border-white/[0.07]",
  panelHover: "hover:border-white/15 hover:bg-[#0d0d10]",
  // Hairline divider.
  border: "border-white/[0.07]",
  // Square holding an icon. Always paired with a centred 18px icon.
  iconBox:
    "flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04]",
  // Subtle inner glow used inside the hero & CTA panels.
  glow: "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]",
} as const;

export const motion = {
  reveal: "reveal", // keyframe in globals.css
  ease: "transition-colors duration-200",
} as const;

/** Standard inline-icon size used everywhere. Keep under 20 to stay calm. */
export const ICON_INLINE = 18;
/** Icon size when sitting inside `surface.iconBox`. */
export const ICON_BOX = 16;
