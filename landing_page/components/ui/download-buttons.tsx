import Link from "next/link";
import { Apple, ArrowRight, Windows, type Icon } from "@/lib/icons";
import { DOWNLOADS } from "@/lib/content";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

function DownloadButton({
  variant,
  glyph: Glyph,
  label,
  sub,
  href,
}: {
  variant: Variant;
  glyph: Icon;
  label: string;
  sub: string;
  href: string;
}) {
  const isPrimary = variant === "primary";
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex min-h-14 min-w-[180px] cursor-pointer items-center gap-3 overflow-hidden rounded-lg border px-4 py-3 transition-all duration-200 active:translate-y-px",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/70",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0)_42%)]",
        isPrimary
          ? "border-white bg-[linear-gradient(180deg,#ffffff_0%,#e7e7e7_100%)] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_18px_rgba(255,255,255,0.12),0_18px_34px_-20px_rgba(255,255,255,0.8)] hover:bg-[linear-gradient(180deg,#ffffff_0%,#dcdcdc_100%)]"
          : "border-white/12 bg-[linear-gradient(180deg,#242428_0%,#111114_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_32px_-22px_rgba(0,0,0,0.95)] hover:border-white/22 hover:bg-[linear-gradient(180deg,#2b2b30_0%,#151519_100%)]",
      )}
    >
      <Glyph
        size={23}
        className={cn("relative z-10 shrink-0", isPrimary ? "text-black" : "text-white")}
      />
      <span className="relative z-10 flex min-w-0 flex-col items-start leading-tight">
        <span
          className={cn(
            "text-[10px] uppercase tracking-[0.16em] font-mono",
            isPrimary ? "text-black/50" : "text-white/45",
          )}
        >
          {sub}
        </span>
        <span className="whitespace-nowrap text-[14px] font-medium">{label}</span>
      </span>
      <ArrowRight
        size={14}
        className={cn(
          "relative z-10 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5",
          isPrimary ? "text-black/60" : "text-white/50",
        )}
      />
    </Link>
  );
}

/** Mac-primary, Windows-secondary CTAs. Shape and copy come from `DOWNLOADS`. */
export function DownloadButtons({
  className,
  align = "center",
}: {
  className?: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-stretch gap-2.5",
        align === "center" ? "justify-center" : "justify-start",
        className,
      )}
    >
      <DownloadButton variant="primary" glyph={Apple} {...DOWNLOADS.mac} />
      <DownloadButton variant="secondary" glyph={Windows} {...DOWNLOADS.win} />
    </div>
  );
}
