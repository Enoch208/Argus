import { AlertCircle, Cancel, Tick, type Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { type, surface } from "@/lib/tokens";
import type { Verdict } from "@/lib/content";
import type { CSSProperties } from "react";

const STYLES: Record<
  Verdict,
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

export function VerdictCard({
  level,
  title,
  summary,
  citations,
  meta,
  style,
}: {
  level: Verdict;
  title: string;
  summary: string;
  citations: string[];
  meta: string;
  style?: CSSProperties;
}) {
  const s = STYLES[level];
  const Icon = s.icon;
  return (
    <article
      data-scroll-reveal="surface"
      style={style}
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
          {meta}
        </span>
      </header>

      <div>
        <h3 className={`${type.h3} leading-snug`}>{title}</h3>
        <p className={`${type.bodySm} mt-2`}>{summary}</p>
      </div>

      <ul
        className={cn(
          "flex flex-col gap-2 border-t pt-4",
          surface.border,
        )}
      >
        {citations.map((c, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[12.5px] text-white/55 font-light leading-[1.55]"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
