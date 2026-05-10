import { ArrowDown } from "@/lib/icons";
import { DarkVeil } from "@/components/dark-veil";
import { CornerMarks } from "@/components/ui/corner-marks";
import { FloatingNode } from "@/components/ui/floating-node";
import { SectionMarker } from "@/components/ui/section-marker";
import { DownloadButtons } from "@/components/ui/download-buttons";
import { Nav } from "@/components/sections/nav";
import { HERO } from "@/lib/content";
import { type } from "@/lib/tokens";

export function Hero() {
  return (
    <section className="relative w-full max-w-[1440px] mx-auto lg:px-8 lg:py-8">
      <CornerMarks />

      <div className="relative lg:rounded-[28px] overflow-hidden flex flex-col p-0 lg:p-[1px] bg-gradient-to-br from-white/15 via-white/[0.04] to-transparent">
        {/* Solid surface */}
        <div className="absolute inset-0 lg:inset-[1px] bg-[#08080a] lg:rounded-[27px]" />
        {/* Reactive WebGL veil */}
        <div className="absolute inset-0 lg:inset-[1px] overflow-hidden lg:rounded-[27px]">
          <DarkVeil className="opacity-95" />
        </div>
        {/* Top vignette so the headline reads cleanly over the veil */}
        <div className="absolute inset-0 lg:inset-[1px] lg:rounded-[27px] pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,transparent_0%,rgba(8,8,10,0.55)_55%,rgba(8,8,10,0.85)_100%)]" />

        {/* Light streaks */}
        <div className="absolute left-1/2 top-[55%] -translate-x-1/2 w-[300px] h-[300px] pointer-events-none">
          <div className="drop-line absolute left-[35%] top-0 w-[1px] h-32" />
          <div className="drop-line drop-line-2 absolute left-[50%] top-10 w-[1px] h-48" />
          <div className="drop-line drop-line-3 absolute left-[65%] top-4 w-[1px] h-24" />
        </div>

        {/* Foreground */}
        <div className="relative flex flex-col w-full px-6 py-7 md:px-10 md:py-10 min-h-[720px]">
          <Nav />

          <main className="flex-1 flex flex-col text-center w-full mt-8 md:mt-20 relative items-center justify-center">
            {HERO.nodes.map((n, i) => (
              <FloatingNode key={i} {...n} />
            ))}

            {/* Eyebrow chip */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 mb-7 reveal backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/70 font-mono">
                {HERO.badge}
              </span>
            </div>

            <h1
              className={`${type.h1} mb-5 max-w-[860px] mx-auto reveal`}
            >
              {HERO.headline.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h1>

            <p className={`${type.body} max-w-[520px] mx-auto mb-9 reveal`}>
              {HERO.sub}
            </p>

            <div id="download" className="reveal">
              <DownloadButtons />
            </div>
          </main>

          {/* Compact footer marker */}
          <footer className="flex items-center justify-between w-full mt-12 md:mt-8">
            <SectionMarker num="02" label="Architecture" />
            <a
              href="#why"
              className="hidden md:inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/50 hover:text-white/80 font-mono transition-colors"
            >
              Why local AI
              <ArrowDown size={12} />
            </a>
          </footer>
        </div>
      </div>
    </section>
  );
}
