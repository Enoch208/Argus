import { SectionMarker } from "@/components/ui/section-marker";
import { VerdictCard } from "@/components/ui/verdict-card";
import { VERDICTS, WHY_LOCAL } from "@/lib/content";
import { layout, type } from "@/lib/tokens";
import type { CSSProperties } from "react";

export function VerdictDemo() {
  return (
    <section
      id="why"
      className={`relative w-full ${layout.container} ${layout.sectionX} ${layout.sectionY}`}
    >
      <div
        data-scroll-reveal="section"
        className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-14"
      >
        <div className="lg:col-span-7 flex flex-col gap-5">
          <SectionMarker
            num={WHY_LOCAL.marker.num}
            label={WHY_LOCAL.marker.label}
          />
          <h2 className={type.h2}>
            {WHY_LOCAL.title.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h2>
        </div>
        <div className="lg:col-span-5 flex flex-col justify-end gap-5">
          <p className={`${type.body} max-w-md`}>{WHY_LOCAL.body}</p>
          <div className="flex items-baseline gap-3 border-t border-white/[0.07] pt-5">
            <span
              className="text-4xl text-white font-light"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {WHY_LOCAL.stat}
            </span>
            <span className="text-[11px] text-white/45 font-mono uppercase tracking-[0.2em]">
              {WHY_LOCAL.statLabel}
            </span>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-3 ${layout.gridGap}`}>
        {VERDICTS.map((v, i) => (
          <VerdictCard
            key={v.level}
            style={{ "--scroll-delay": `${i * 80}ms` } as CSSProperties}
            {...v}
          />
        ))}
      </div>
    </section>
  );
}
