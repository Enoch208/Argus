import Link from "next/link";
import Image from "next/image";
import { BRAND, FOOTER } from "@/lib/content";

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
            <div className="flex flex-col gap-1 text-[10px] font-mono text-white/35 uppercase tracking-[0.2em] mt-1">
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
                {col.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="text-[13.5px] text-white/55 font-light hover:text-white transition-colors w-max"
                  >
                    {item.label}
                  </Link>
                ))}
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
