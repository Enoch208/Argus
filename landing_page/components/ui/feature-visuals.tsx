import {
  Activity,
  Connect,
  Layers,
  Refresh,
  Shield,
  Sphere,
  Flash,
} from "@/lib/icons";
import { cn } from "@/lib/cn";

/** Three matching visuals for the pipeline cards. Each fills a 16-rem block. */

// 1. CODE — typed-out Argus verdict shape.
const TYPING = [
  { line: <><span className="text-white/80">verdict</span> <span className="text-emerald-400">{`"argus.review"`}</span> {`{`}</> },
  { line: <span className="pl-4">level = <span className="text-amber-300">{`"YELLOW"`}</span></span> },
  { line: <span className="pl-4">summary = <span className="text-emerald-400">{`"Novel"`}</span></span> },
  { line: <>{`}`}</> },
  { line: <span className="h-2 block" /> },
  { line: <><span className="text-white/80">cite</span> <span className="text-emerald-400">{`"history.rag"`}</span> {`{`}</> },
  { line: <span className="pl-4 text-white/30"># 0 of 47 prior tx</span> },
  { line: <>{`}`}</> },
];

export function CodeVisual() {
  return (
    <div className="relative h-60 bg-[#080808] border border-white/[0.06] rounded-xl p-5 overflow-hidden flex flex-col shadow-inner">
      <div className="flex text-[12px] font-mono leading-relaxed tracking-wider">
        <div className="flex flex-col text-white/15 text-right pr-4 select-none">
          {TYPING.map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <div className="flex flex-col text-white/55 w-full">
          {TYPING.map((row, i) => (
            <div
              key={i}
              className="overflow-hidden whitespace-nowrap"
            >
              {row.line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 2. ORBIT — six icons orbiting a glowing core.
const ORBIT_ICONS = [Shield, Flash, Activity, Refresh, Layers, Connect];

export function OrbitVisual() {
  const radius = 70;
  return (
    <div className="relative h-60 w-full flex items-center justify-center overflow-hidden">
      <div className="relative w-[180px] h-[180px]">
        <div className="absolute inset-[10px] rounded-full border border-dashed border-white/10" />
        <div className="argus-orbit absolute inset-0">
          {ORBIT_ICONS.map((Icon, i) => {
            const angle = (i / ORBIT_ICONS.length) * 2 * Math.PI;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 -mt-5 -ml-5"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                <div className="w-10 h-10 rounded-full bg-[#080808] border border-white/10 flex items-center justify-center shadow-lg anim-reverse-spin">
                  <Icon size={14} className="text-white/55" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 z-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-amber-400 p-[2px] shadow-[0_0_15px_rgba(167,139,250,0.4)]">
            <div className="w-full h-full bg-[#030303] rounded-full" />
          </div>
          <Sphere size={20} className="relative text-white" />
        </div>
      </div>
    </div>
  );
}

// 3. SONAR — pulsing rings under a list of "scanned" surfaces.
export function SonarVisual() {
  const rows = [
    { tone: "emerald", label: "`magic-edenn.io`", state: "0.91 sim" },
    { tone: "neutral", label: "resource `wallet_adapter`", state: "ocr" },
    { tone: "neutral", label: "action `approve_all`", state: "diff" },
  ] as const;
  // Three pulses on staggered phases so a continuous radar reads instead of
  // a single bloom every 4s. The two outermost rings are static lattice for
  // visual weight; the inner pulses originate from the same centre.
  const pulses = [
    { delay: "0s", border: "border-amber-400/70" },
    { delay: "1.3s", border: "border-amber-400/55" },
    { delay: "2.6s", border: "border-amber-300/45" },
  ];
  return (
    <div className="relative h-60 w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
      {/* Static lattice — anchors the eye between pulses. */}
      <div
        className="absolute right-5 top-4 h-40 w-40 rounded-full border border-amber-500/15"
        aria-hidden
      />
      <div
        className="absolute right-12 top-11 h-28 w-28 rounded-full border border-amber-500/40 shadow-[0_0_28px_rgba(245,128,32,0.12)]"
        aria-hidden
      />

      {/* Centre dot — quietly pulses so the origin reads even at rest. */}
      <div
        className="absolute right-[5.95rem] top-[5.45rem] h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.85)] anim-sonar-pulse"
        aria-hidden
      />

      {/* Pulses — three rings on staggered phases. */}
      {pulses.map((p, i) => (
        <div
          key={i}
          aria-hidden
          style={{ animationDelay: p.delay }}
          className={cn(
            "absolute right-12 top-11 h-28 w-28 rounded-full border opacity-0 anim-sonar",
            p.border,
          )}
        />
      ))}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_34%,rgba(245,128,32,0.1),transparent_39%),linear-gradient(180deg,transparent_0%,#050505_88%)]" />

      <ul className="relative z-10 flex flex-col gap-4 pt-[86px]">
        {rows.map((r, i) => (
          <li
            key={i}
            className={cn(
              "mx-auto flex h-12 max-w-[360px] items-center justify-between gap-4 overflow-hidden rounded-lg border bg-black/48 px-4 text-[12px] font-mono shadow-[0_18px_30px_rgba(0,0,0,0.45)]",
              i === 0 && "border-white/14 text-white/75",
              i === 1 && "w-[78%] border-white/[0.06] text-white/32 opacity-70",
              i === 2 && "w-[68%] border-white/[0.04] text-white/20 opacity-45",
            )}
          >
            <span className="min-w-0 truncate">
              {r.tone === "emerald" ? (
                <>
                  <span className="text-white/70">`magic-edenn.io`</span>
                </>
              ) : (
                r.label
              )}
            </span>
            <span
              className={cn(
                "shrink-0 text-[10px] uppercase tracking-[0.18em]",
                r.tone === "emerald" && "text-emerald-400",
                r.tone === "neutral" && "text-white/25",
              )}
            >
              {r.state}
            </span>
          </li>
        ))}
      </ul>

      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#050505] to-transparent" />
    </div>
  );
}
