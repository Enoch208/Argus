import { cn } from "@/lib/cn";
import { type } from "@/lib/tokens";

/** "01 — CONCEPT" marker. Strict: only token-driven typography. */
export function SectionMarker({
  num,
  label,
  className,
}: {
  num: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn(type.eyebrow, className)}>
      <span>{num}</span>
      <span className="w-6 h-px bg-white/15" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
