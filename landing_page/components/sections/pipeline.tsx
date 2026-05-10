import {
  CodeVisual,
  OrbitVisual,
  SonarVisual,
} from "@/components/ui/feature-visuals";
import { SectionMarker } from "@/components/ui/section-marker";
import {
  PIPELINE_CARDS,
  PIPELINE_INTRO,
  type PipelineCard,
} from "@/lib/content";
import { layout, type } from "@/lib/tokens";
import type { CSSProperties } from "react";

const VISUALS = {
  code: CodeVisual,
  orbit: OrbitVisual,
  sonar: SonarVisual,
} as const;

function Card({ card, style }: { card: PipelineCard; style?: CSSProperties }) {
  const Visual = VISUALS[card.variant];
  const Icon = card.icon;
  return (
    <div
      data-scroll-reveal="surface"
      style={style}
      className="group relative p-7 md:p-9 flex flex-col gap-7 h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-white/[0.07] last:border-b-0 last:lg:border-r-0"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none flashlight-bg" />

      <div className="relative z-10">
        <Visual />
      </div>

      <div className="mt-auto flex flex-col gap-2 relative z-10">
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-white" />
          <h3 className={type.h3}>{card.title}</h3>
        </div>
        <p className={type.bodySm}>{card.blurb}</p>
      </div>
    </div>
  );
}

export function Pipeline() {
  return (
    <section
      id="pipeline"
      className={`relative w-full ${layout.container} ${layout.sectionX} ${layout.sectionY}`}
    >
      <div className="w-full border-t border-x border-white/[0.07] flex flex-col bg-[#030303]">
        <div
          data-scroll-reveal="section"
          className="grid grid-cols-1 lg:grid-cols-2 border-b border-white/[0.07]"
        >
          <div className="p-8 md:p-12 lg:border-r border-white/[0.07] flex flex-col justify-end gap-4">
            <SectionMarker
              num={PIPELINE_INTRO.marker.num}
              label={PIPELINE_INTRO.marker.label}
            />
            <h2 className={type.h2}>
              {PIPELINE_INTRO.title.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h2>
          </div>
          <div className="p-8 md:p-12 flex items-start justify-start border-t lg:border-t-0 border-white/[0.07]">
            <p
              data-scroll-reveal="copy"
              style={{ "--scroll-delay": "120ms" } as CSSProperties}
              className={`${type.body} max-w-[440px] text-[14px] md:text-[15px] leading-[1.85] text-white/45`}
            >
              {PIPELINE_INTRO.body}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 border-b border-white/[0.07]">
          {PIPELINE_CARDS.map((c, i) => (
            <Card
              key={c.title}
              card={c}
              style={{ "--scroll-delay": `${i * 75}ms` } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
