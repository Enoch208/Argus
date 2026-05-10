import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Outer gradient hairline + inner solid surface — used for pills, chips, and
 * cards throughout the f.html design. Avoids re-typing the two-div pattern. */
export function GradientBorder({
  children,
  rounded = "rounded-full",
  innerClassName,
  className,
}: {
  children: ReactNode;
  rounded?: string;
  innerClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-[1px] bg-gradient-to-br from-white/20 via-white/10 to-white/5 shadow-lg",
        rounded,
        className,
      )}
    >
      <div
        className={cn(
          "bg-[#111]/80 backdrop-blur-md",
          rounded,
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
