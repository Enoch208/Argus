import type { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";

/** Hero ornament: icon bubble + connector line + small label/meta stack. */
export function FloatingNode({
  icon: Icon,
  label,
  meta,
  pos,
  reverse = false,
  dotClass,
}: {
  icon: Icon;
  label: string;
  meta: string;
  pos: string;
  reverse?: boolean;
  dotClass: string;
}) {
  return (
    <div
      className={cn(
        "absolute hidden lg:flex items-center gap-3 cursor-default pointer-events-none",
        reverse && "flex-row-reverse",
        pos,
      )}
    >
      <div
        className={cn(
          "p-[1px] rounded-full shadow-lg",
          reverse
            ? "bg-gradient-to-bl from-white/30 to-white/5"
            : "bg-gradient-to-br from-white/30 to-white/5",
        )}
      >
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#0c0c10]/80 backdrop-blur-md">
          <Icon size={14} className="text-white/90" />
        </div>
      </div>
      <div
        className={cn(
          "w-12 h-px",
          reverse
            ? "bg-gradient-to-l from-white/30 to-transparent"
            : "bg-gradient-to-r from-white/30 to-transparent",
        )}
        aria-hidden
      />
      <div className={cn("translate-y-[-2px]", reverse ? "text-right" : "text-left")}>
        <div
          className={cn(
            "text-[13px] font-light text-white/90 flex items-center gap-1.5",
            reverse && "justify-end",
          )}
        >
          {!reverse && <span className={cn("w-1 h-1 rounded-full", dotClass)} />}
          {label}
          {reverse && <span className={cn("w-1 h-1 rounded-full", dotClass)} />}
        </div>
        <div className="text-[10px] text-white/40 mt-0.5 tracking-[0.18em] font-mono uppercase">
          {meta}
        </div>
      </div>
    </div>
  );
}
