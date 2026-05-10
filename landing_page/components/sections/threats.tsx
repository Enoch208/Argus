import { SectionMarker } from "@/components/ui/section-marker";
import { THREAT_MARKER, THREATS } from "@/lib/content";
import { layout, surface, type } from "@/lib/tokens";
import type { CSSProperties } from "react";

export function Threats() {
  return (
    <section
      id="threats"
      className={`relative w-full ${layout.container} ${layout.sectionX} ${layout.sectionYTight}`}
    >
      <div
        data-scroll-reveal="section"
        className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-12"
      >
        <div className="lg:col-span-5 flex flex-col gap-5">
          <SectionMarker num={THREAT_MARKER.num} label={THREAT_MARKER.label} />
          <h2 className={type.h2}>
            The drainer
            <br />
            playbook, decoded.
          </h2>
        </div>
        <div className="lg:col-span-7 flex items-end">
          <p className={`${type.body} max-w-[520px]`}>
            Each pattern below is a deterministic test fixture in the repo.
            Argus catches every one before submission and explains it in plain
            English.
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${layout.gridGap}`}>
        {THREATS.map((t, i) => {
          const Icon = t.icon;
          return (
            <article
              key={t.title}
              data-scroll-reveal="surface"
              style={{ "--scroll-delay": `${i * 45}ms` } as CSSProperties}
              className="group relative flex flex-col gap-3 p-6 rounded-xl border border-white/[0.06] bg-[#080809] hover:border-white/15 hover:bg-[#0c0c0e] transition-colors"
            >
              <span className={surface.iconBox}>
                <Icon size={16} className="text-white" />
              </span>
              <h3 className={type.h3}>{t.title}</h3>
              <p className={type.bodySm}>{t.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
