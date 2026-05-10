import { SectionMarker } from "@/components/ui/section-marker";
import { QVAC_MARKER, QVAC_ROWS } from "@/lib/content";
import { layout, surface, type } from "@/lib/tokens";
import type { CSSProperties } from "react";

export function QvacMatrix() {
  return (
    <section
      id="stack"
      className={`relative w-full ${layout.container} ${layout.sectionX} ${layout.sectionYTight}`}
    >
      <div
        data-scroll-reveal="section"
        className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-12"
      >
        <div className="lg:col-span-5 flex flex-col gap-5">
          <SectionMarker num={QVAC_MARKER.num} label={QVAC_MARKER.label} />
          <h2 className={type.h2}>
            Six modules.
            <br />
            One pipeline.
          </h2>
        </div>
        <div className="lg:col-span-7 flex items-end">
          <p className={`${type.body} max-w-[520px]`}>
            QVAC across LLM, vision, OCR, embeddings, STT, and TTS — plus WDK
            for Solana key derivation, signing, and broadcast. Every output
            feeds the verdict or one of its citations.
          </p>
        </div>
      </div>

      <div className="border border-white/[0.07] rounded-2xl overflow-hidden">
        <ul className="divide-y divide-white/[0.06]">
          {QVAC_ROWS.map((r, i) => {
            const Icon = r.icon;
            return (
              <li
                key={r.module}
                data-scroll-reveal="surface"
                style={{ "--scroll-delay": `${i * 45}ms` } as CSSProperties}
                className="grid grid-cols-1 lg:grid-cols-12 items-start lg:items-center gap-3 lg:gap-6 px-6 py-5 hover:bg-white/[0.015] transition-colors"
              >
                <div className="flex items-center gap-3 lg:col-span-4">
                  <span className={surface.iconBox}>
                    <Icon size={16} className="text-white" />
                  </span>
                  <span className="font-mono text-[12.5px] text-white/85">
                    {r.module}
                  </span>
                </div>
                <p className={`${type.bodySm} lg:col-span-6`}>{r.use}</p>
                <code className="text-[11px] text-white/35 font-mono lg:col-span-2 lg:text-right">
                  {r.path}
                </code>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
