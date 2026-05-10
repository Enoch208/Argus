import { MapPin } from "@/lib/icons";
import { DownloadButtons } from "@/components/ui/download-buttons";
import { CTA } from "@/lib/content";
import { type } from "@/lib/tokens";

export function Cta() {
  return (
    <section className="relative w-full max-w-[1100px] mx-auto px-6 py-12">
      <div
        data-scroll-reveal="section"
        className="relative w-full bg-[#0a0a0c] border border-white/10 rounded-3xl overflow-hidden shadow-[0_25px_50px_rgba(0,0,0,0.8)] flex flex-col md:flex-row min-h-[300px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-transparent pointer-events-none" />

        <div className="p-9 md:p-14 md:w-[58%] relative z-10 flex flex-col justify-center gap-6">
          <h3 className={`${type.h2} text-3xl md:text-4xl`}>
            {CTA.title.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h3>
          <p className={`${type.body} max-w-md`}>{CTA.body}</p>
          <DownloadButtons align="start" className="mt-1" />
        </div>

        <div className="w-full md:w-[42%] h-56 md:h-auto relative overflow-hidden flex items-center justify-end">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent z-10 md:w-32" />
          <div
            className="absolute w-[200%] h-[200%] top-1/2 left-1/2 md:left-[20%] -translate-x-1/2 -translate-y-1/2"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.18) 2px, transparent 2px)",
              backgroundSize: "22px 22px",
              maskImage:
                "radial-gradient(ellipse at center, black 10%, transparent 50%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at center, black 10%, transparent 50%)",
            }}
          />
          {[
            { pos: "right-[20%] top-[28%]", size: 16, op: "" },
            { pos: "right-[42%] bottom-[25%]", size: 12, op: "text-white/65" },
            { pos: "right-[10%] bottom-[42%]", size: 16, op: "text-white/45" },
          ].map((p, i) => (
            <div
              key={i}
              className={`absolute z-10 p-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-white ${p.pos} ${p.op}`}
            >
              <MapPin size={p.size} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
