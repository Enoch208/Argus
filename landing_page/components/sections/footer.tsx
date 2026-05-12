import Link from "next/link";
import Image from "next/image";
import { BRAND, FOOTER } from "@/lib/content";
import { Github, X } from "@/lib/icons";

export function Footer() {
  return (
    <footer className="w-full bg-[#050505] border-t border-white/[0.06] pt-20 pb-10 px-6 lg:px-14 relative">
      <div className="max-w-[1100px] mx-auto flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 mb-14">
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo-mark.png"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
              />
              <span
                className="text-lg font-light tracking-tight text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {BRAND.name}
              </span>
            </div>
            <p className="text-[13px] text-white/45 font-extralight max-w-sm leading-[1.65]">
              {BRAND.tagline} Self-custodial Solana wallet with a local AI
              co-pilot in front of every signature.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={BRAND.github}
                target="_blank"
                rel="noreferrer"
                aria-label="Argus on GitHub"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.025] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.05] hover:text-white"
              >
                <Github size={14} />
              </a>
              <a
                href={BRAND.x}
                target="_blank"
                rel="noreferrer"
                aria-label="Argus on X"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.025] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={14} />
              </a>
            </div>
            <div className="flex flex-col gap-1 text-[10px] font-mono text-white/35 uppercase tracking-[0.2em] mt-3">
              <span>{FOOTER.hackathon.label}</span>
              <span>{FOOTER.hackathon.deadline}</span>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8">
            {FOOTER.links.map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/35 font-mono mb-1">
                  {col.heading}
                </span>
                {col.items.map((item) => {
                  const external = item.href.startsWith("http");
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noreferrer" : undefined}
                      className="text-[13.5px] text-white/55 font-light hover:text-white transition-colors w-max"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-3 text-[11px] text-white/35 font-mono uppercase tracking-[0.2em] pt-6 border-t border-white/[0.05]">
          <span>© 2026 {BRAND.name} · MIT</span>
          <span>{BRAND.builtWith}</span>
        </div>
      </div>
    </footer>
  );
}
