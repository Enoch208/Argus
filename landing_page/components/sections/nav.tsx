import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Github, Menu } from "@/lib/icons";
import { GradientBorder } from "@/components/ui/gradient-border";
import { BRAND, NAV_LINKS } from "@/lib/content";

export function Nav() {
  return (
    <nav className="flex items-center justify-between w-full">
      <Link href="/" className="flex cursor-pointer items-center gap-2.5">
        <Image
          src="/logo-mark.png"
          alt=""
          width={24}
          height={24}
          priority
          className="h-6 w-6 object-contain"
        />
        <span
          className="text-[15px] tracking-tight text-white font-light"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {BRAND.name}
        </span>
      </Link>

      <div className="hidden lg:block">
        <GradientBorder>
          <div className="flex items-center px-1 py-1">
            <ul className="flex items-center px-3 gap-6 text-[13px] font-light text-white/55">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="cursor-pointer transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <span className="w-px h-3.5 bg-white/10 mx-1.5" aria-hidden />
            <Link
              href={BRAND.github}
              className="flex cursor-pointer items-center gap-1.5 px-2.5 text-[13px] font-light text-white/85 transition-colors hover:text-white"
            >
              <Github size={13} />
              GitHub
            </Link>
          </div>
        </GradientBorder>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="#download"
          className="group relative hidden min-h-10 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border border-white bg-[linear-gradient(180deg,#ffffff_0%,#e5e5e5_100%)] px-4 text-[13px] font-medium text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_14px_rgba(255,255,255,0.12)] transition-all duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/75 after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(255,255,255,0.25),rgba(255,255,255,0)_45%)] hover:bg-[linear-gradient(180deg,#ffffff_0%,#dcdcdc_100%)] active:translate-y-px md:inline-flex"
        >
          <span className="relative z-10">Get Argus</span>
          <ArrowUpRight size={12} className="relative z-10" />
        </Link>
        <button
          className="cursor-pointer text-white transition-colors hover:text-white/75 lg:hidden"
          aria-label="Open menu"
          type="button"
        >
          <Menu size={22} />
        </button>
      </div>
    </nav>
  );
}
