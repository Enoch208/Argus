import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { useShortcuts } from "@/renderer/hooks/use-shortcuts";

/** The single top-level layout. Sidebar + main canvas. No header. */
export function AppShell({ children }: { children: ReactNode }) {
  useShortcuts();
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#08080a]">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <div
          data-titlebar="drag"
          aria-hidden
          className="absolute inset-x-0 top-0 z-20 h-9"
        />
        <div className="relative h-full">{children}</div>
      </main>
    </div>
  );
}
