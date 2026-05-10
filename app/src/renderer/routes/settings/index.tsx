import { useState } from "react";
import { Shield, Wallet } from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { useLockWallet, useWallet } from "@/renderer/hooks/use-wallet";
import { useUi } from "@/renderer/stores/ui";

export default function SettingsRoute() {
  const wallet = useWallet();
  const lock = useLockWallet();
  const setRoute = useUi((s) => s.setRoute);
  const [copied, setCopied] = useState(false);
  const address = wallet.data?.address ?? null;

  const copyAddress = () => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <main className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <span className={t.eyebrow}>Settings</span>
          <h1 className={t.h2}>Control surface.</h1>
          <p className={t.body}>
            Wallet state, model readiness, and runtime configuration without
            leaving the local app.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-5">
            <Wallet size={18} className="mb-6 text-emerald-200/80" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Wallet
            </span>
            <h2 className="mt-2 text-[20px] font-light text-white">
              {wallet.data?.state === "unlocked" ? "Unlocked" : "Locked"}
            </h2>
            <p className="mt-2 min-h-10 break-all font-mono text-[12px] leading-[1.55] text-white/45">
              {address ?? "No wallet address available."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!address}
                onClick={copyAddress}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] font-light text-white/75 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? "Copied" : "Copy address"}
              </button>
              <button
                type="button"
                disabled={wallet.data?.state !== "unlocked" || lock.isPending}
                onClick={() => lock.mutate()}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] font-light text-white/75 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lock wallet
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-5">
            <Shield size={18} className="mb-6 text-white/70" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Runtime
            </span>
            <h2 className="mt-2 text-[20px] font-light text-white">Local only</h2>
            <div className="mt-4 flex flex-col gap-3 text-[12.5px] font-light leading-[1.6] text-white/48">
              <p>RPC: Solana mainnet allowlist</p>
              <p>QVAC runtime: optional `ARGUS_LLAMA_CLI`</p>
              <p>Scam intel: SQLite on device</p>
            </div>
            <button
              type="button"
              onClick={() => setRoute("setup")}
              className="mt-5 rounded-lg bg-white px-3 py-2 text-[12px] font-normal text-black transition hover:bg-white/90"
            >
              Open model stack
            </button>
          </div>
        </section>

        {lock.isError && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
            {lock.error.message}
          </div>
        )}
      </main>
    </div>
  );
}
