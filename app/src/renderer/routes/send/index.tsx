import { useState } from "react";
import { ArrowRight } from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { cn } from "@/renderer/lib/cn";
import { SEND_COPY } from "@/renderer/content/send";
import { VerdictCard } from "@/renderer/components/verdict/verdict-card";
import {
  useApproveReview,
  useBlockReview,
  useReview,
} from "@/renderer/hooks/use-review";
import {
  useAirdrop,
  useBuildTransfer,
  useWallet,
  useWalletBalance,
} from "@/renderer/hooks/use-wallet";
import { ArgusError } from "@/shared/errors";

/**
 * Send route — the moment Argus's "AI in front of every signature" promise
 * stops being figurative. The user enters a destination + amount; we build
 * the transfer in main, pipe the unsigned base58 through the same
 * `review.start` pipeline as a paste, and only sign + broadcast after the
 * user approves the verdict.
 */
export default function SendRoute() {
  const wallet = useWallet();
  const balance = useWalletBalance(wallet.data?.state === "unlocked");
  const buildTransfer = useBuildTransfer();
  const review = useReview();
  const approve = useApproveReview();
  const block = useBlockReview();
  const airdrop = useAirdrop();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const cluster = balance.data?.cluster ?? "devnet";
  const sol = Number.parseFloat(amount);
  const amountValid = Number.isFinite(sol) && sol > 0;
  const enoughBalance = !balance.data || sol <= balance.data.sol; // Allow review when balance hasn't loaded yet.
  const canSubmit =
    wallet.data?.state === "unlocked" &&
    to.trim().length > 30 &&
    amountValid &&
    enoughBalance;
  const actionPending = approve.isPending || block.isPending;

  function reset() {
    review.reset();
    approve.reset();
    block.reset();
    buildTransfer.reset();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    reset();
    const built = await buildTransfer.mutateAsync({
      to: to.trim(),
      amountSol: sol,
    });
    review.mutate({ raw: built.raw });
  }

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <div className="relative mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <h1 className={t.h2}>{SEND_COPY.title[0]}</h1>
          <p className={cn(t.body, "max-w-[560px]")}>{SEND_COPY.body}</p>
        </header>

        <BalanceStrip
          sol={balance.data?.sol ?? null}
          cluster={cluster}
          address={wallet.data?.address ?? null}
        />

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              {SEND_COPY.toLabel}
            </span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={SEND_COPY.toPlaceholder}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 font-mono text-[12.5px] text-white placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.04] focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              {SEND_COPY.amountLabel}
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 focus-within:border-white/30 focus-within:bg-white/[0.04]">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="0.0"
                className="flex-1 bg-transparent font-mono text-[14px] text-white placeholder:text-white/25 focus:outline-none"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
                {SEND_COPY.amountSuffix}
              </span>
            </div>
            {!enoughBalance && balance.data && (
              <span className="text-[11.5px] font-light text-rose-200">
                {SEND_COPY.insufficient}
              </span>
            )}
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={
                !canSubmit || review.isPending || buildTransfer.isPending
              }
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-normal text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {review.isPending || buildTransfer.isPending
                ? SEND_COPY.reviewing
                : SEND_COPY.reviewButton}
              {!review.isPending && !buildTransfer.isPending && (
                <ArrowRight size={14} className="text-black/60" />
              )}
            </button>

            {(cluster === "devnet" || cluster === "testnet") && (
              <button
                type="button"
                disabled={airdrop.isPending}
                onClick={() => airdrop.mutate({ sol: 0.1 })}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-[12.5px] font-light text-white/72 transition hover:border-white/22 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {airdrop.isPending
                  ? SEND_COPY.airdropPending
                  : SEND_COPY.airdropLabel}
              </button>
            )}
          </div>

          {airdrop.isError && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3 text-[12.5px] font-light text-rose-200">
              <p>{airdrop.error.message}</p>
              {isFaucetLimit(airdrop.error) && (
                <a
                  href={faucetLink(wallet.data?.address ?? null)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-mono text-[11.5px] text-rose-100 underline decoration-rose-200/30 underline-offset-4 hover:text-white"
                >
                  Open Solana devnet faucet
                </a>
              )}
            </div>
          )}
          {airdrop.isSuccess && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 text-[12.5px] font-light text-emerald-100">
              Airdrop confirmed · {shortSig(airdrop.data.signature)}
            </div>
          )}
        </form>

        <section className="flex flex-col gap-4">
          {(buildTransfer.isError || review.isError) && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
              {(buildTransfer.error ?? review.error)?.message}
            </div>
          )}
          {review.data ? (
            <>
              <VerdictCard verdict={review.data} />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={
                    actionPending || approve.isSuccess || block.isSuccess
                  }
                  onClick={() => approve.mutate({ id: review.data.id })}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white px-5 py-2.5 text-[13px] font-normal text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_16px_40px_-24px_rgba(255,255,255,0.9)] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {approve.isPending ? "Signing…" : SEND_COPY.approveButton}
                </button>
                <button
                  type="button"
                  disabled={
                    actionPending || approve.isSuccess || block.isSuccess
                  }
                  onClick={() => block.mutate({ id: review.data.id })}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2.5 text-[13px] font-normal text-white/82 transition hover:border-white/22 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {block.isPending ? "Blocking…" : SEND_COPY.blockButton}
                </button>
              </div>
              {approve.isSuccess && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 text-[13px] font-light text-emerald-100">
                  Broadcasted ·{" "}
                  <a
                    href={solscanLink(approve.data.signature, cluster)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-emerald-200 underline decoration-emerald-300/30 underline-offset-4 hover:text-white"
                  >
                    {shortSig(approve.data.signature)}
                  </a>
                </div>
              )}
              {block.isSuccess && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-[13px] font-light text-white/60">
                  Blocked locally. Nothing was signed.
                </div>
              )}
            </>
          ) : (
            !buildTransfer.isError &&
            !review.isError && (
              <p className={cn(t.bodySm, "italic")}>{SEND_COPY.emptyHint}</p>
            )
          )}
        </section>
      </div>
    </div>
  );
}

function BalanceStrip({
  sol,
  cluster,
  address,
}: {
  sol: number | null;
  cluster: string;
  address: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <div className="flex flex-col">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40">
          Wallet · {cluster}
        </span>
        <span className="font-mono text-[12px] text-white/70">
          {address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "—"}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40">
          Balance
        </span>
        <span className="font-mono text-[14px] text-white/85">
          {sol === null ? "—" : `${formatSol(sol)} SOL`}
        </span>
      </div>
    </div>
  );
}

function formatSol(sol: number): string {
  if (sol === 0) return "0";
  if (sol < 1) return sol.toFixed(4).replace(/\.?0+$/, "");
  return sol.toFixed(4).replace(/\.?0+$/, "");
}

function shortSig(signature: string): string {
  if (signature.length <= 18) return signature;
  return `${signature.slice(0, 8)}…${signature.slice(-8)}`;
}

function solscanLink(signature: string, cluster: string): string {
  const suffix =
    cluster === "devnet"
      ? "?cluster=devnet"
      : cluster === "testnet"
        ? "?cluster=testnet"
        : "";
  return `https://solscan.io/tx/${signature}${suffix}`;
}

function isFaucetLimit(error: Error): boolean {
  return error instanceof ArgusError && error.code === "RPC_RATE_LIMITED";
}

function faucetLink(address: string | null): string {
  const base = "https://faucet.solana.com";
  if (!address) return base;
  return `${base}?address=${encodeURIComponent(address)}`;
}
