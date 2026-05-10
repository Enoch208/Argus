import { AlertCircle, Cancel, Tick, type Icon } from "@/renderer/design/icons";
import { ReadAloud } from "@/renderer/components/verdict/read-aloud";
import { cn } from "@/renderer/lib/cn";
import { type as t, surface } from "@/renderer/design/tokens";
import type { Verdict, VerdictLevel } from "@/shared/types/verdict";

const STYLES: Record<
  VerdictLevel,
  { badge: string; glow: string; border: string; label: string; icon: Icon }
> = {
  GREEN: {
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-400/25",
    glow: "shadow-[0_0_60px_-20px_rgba(16,185,129,0.45)]",
    border: "border-emerald-500/15",
    label: "GREEN",
    icon: Tick,
  },
  YELLOW: {
    badge: "bg-amber-500/10 text-amber-300 border-amber-400/25",
    glow: "shadow-[0_0_60px_-20px_rgba(251,191,36,0.4)]",
    border: "border-amber-500/15",
    label: "YELLOW",
    icon: AlertCircle,
  },
  RED: {
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    glow: "shadow-[0_0_60px_-20px_rgba(244,63,94,0.45)]",
    border: "border-rose-500/15",
    label: "RED",
    icon: Cancel,
  },
};

/**
 * The PRD's hero component. Anatomy is locked (UI-RULES §Verdict cards):
 *
 *   1. Header  — level badge + meta strip
 *   2. Title   — `type.h3` summary line
 *   3. Citations — bulleted list, dot-led
 *   4. Decoded instructions — collapsible secondary content
 *
 * Actions (Approve / Block) live OUTSIDE the card, never inside it.
 */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const s = STYLES[verdict.level];
  const Icon = s.icon;
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-5 rounded-2xl border bg-[#0a0a0c] p-6 transition-shadow",
        s.border,
        s.glow,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.2em] font-mono",
            s.badge,
          )}
        >
          <Icon size={12} />
          {s.label}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-mono">
          {verdict.meta}
        </span>
      </header>

      <h2 className={cn(t.h3, "leading-snug")}>{verdict.summary}</h2>

      <section
        className={cn(
          "rounded-xl border bg-white/[0.025] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
          surface.border,
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-light text-white/88">
            {verdict.explanation.title}
          </h3>
          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/36">
            {verdict.explanation.source === "qvac" ? "QVAC" : "Local"}
          </span>
        </div>
        <p className="text-[13px] font-light leading-[1.65] text-white/58">
          {verdict.explanation.plainEnglish}
        </p>
        {verdict.explanation.risks.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {verdict.explanation.risks.map((risk, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[12px] font-light leading-[1.55] text-white/45"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/25" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-[12.5px] font-light leading-[1.55] text-white/72">
          {verdict.explanation.recommendation}
        </p>
      </section>

      <ul className={cn("flex flex-col gap-2 border-t pt-4", surface.border)}>
        {verdict.citations.map((c, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[12.5px] text-white/55 font-light leading-[1.55]"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" />
            <span>{c}</span>
          </li>
        ))}
      </ul>

      {verdict.instructions.length > 0 && (
        <details className="group/instr border-t border-white/[0.05] pt-3">
          <summary className="flex cursor-pointer items-center gap-2 select-none text-[11px] uppercase tracking-[0.22em] font-mono text-white/45 hover:text-white/65">
            <span>Decoded · {verdict.instructions.length}</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-1.5">
            {verdict.instructions.map((ix, i) => (
              <li
                key={i}
                className="flex flex-col gap-0.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
              >
                <span className="text-[12.5px] text-white/85">{ix.summary}</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/35">
                  {ix.kind} · {ix.programId.slice(0, 4)}…{ix.programId.slice(-4)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
