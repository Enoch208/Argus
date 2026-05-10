import { useState } from "react";
import { ArrowRight } from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { cn } from "@/renderer/lib/cn";
import { REVIEW_COPY } from "@/renderer/content/review";
import { VerdictCard } from "@/renderer/components/verdict/verdict-card";
import {
  useApproveReview,
  useBlockReview,
  useReview,
} from "@/renderer/hooks/use-review";

export default function ReviewRoute() {
  const [raw, setRaw] = useState("");
  const review = useReview();
  const approve = useApproveReview();
  const block = useBlockReview();

  const valid = /^[1-9A-HJ-NP-Za-km-z]+$/.test(raw.trim()) && raw.trim().length > 32;
  const actionPending = approve.isPending || block.isPending;

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />

      <div className="relative mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <h1 className={t.h2}>{REVIEW_COPY.title[0]}</h1>
          <p className={cn(t.body, "max-w-[560px]")}>{REVIEW_COPY.body}</p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            approve.reset();
            block.reset();
            review.mutate({ raw: raw.trim() });
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              {REVIEW_COPY.pasteLabel}
            </span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={REVIEW_COPY.placeholder}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              rows={4}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 font-mono text-[12.5px] text-white placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.04] focus:outline-none"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={!valid || review.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-normal text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {review.isPending ? REVIEW_COPY.reviewing : REVIEW_COPY.reviewButton}
              {!review.isPending && <ArrowRight size={14} className="text-black/60" />}
            </button>
          </div>
        </form>

        <section className="flex flex-col gap-4">
          {review.isError && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
              {review.error.message}
            </div>
          )}
          {review.data ? (
            <>
              <VerdictCard verdict={review.data} />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={actionPending || approve.isSuccess || block.isSuccess}
                  onClick={() => approve.mutate({ id: review.data.id })}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white px-5 py-2.5 text-[13px] font-normal text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_16px_40px_-24px_rgba(255,255,255,0.9)] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {approve.isPending ? "Signing..." : REVIEW_COPY.approveButton}
                </button>
                <button
                  type="button"
                  disabled={actionPending || approve.isSuccess || block.isSuccess}
                  onClick={() => block.mutate({ id: review.data.id })}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2.5 text-[13px] font-normal text-white/82 transition hover:border-white/22 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {block.isPending ? "Blocking..." : REVIEW_COPY.blockButton}
                </button>
              </div>
              {approve.isSuccess && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 text-[13px] font-light text-emerald-100">
                  Broadcasted ·{" "}
                  <a
                    href={`https://solscan.io/tx/${approve.data.signature}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-emerald-200 underline decoration-emerald-300/30 underline-offset-4 hover:text-white"
                  >
                    {shortSignature(approve.data.signature)}
                  </a>
                </div>
              )}
              {block.isSuccess && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-[13px] font-light text-white/60">
                  Blocked locally. Nothing was signed.
                </div>
              )}
              {approve.isError && (
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
                  {approve.error.message}
                </div>
              )}
              {block.isError && (
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
                  {block.error.message}
                </div>
              )}
            </>
          ) : (
            !review.isError && (
              <p className={cn(t.bodySm, "italic")}>{REVIEW_COPY.emptyHint}</p>
            )
          )}
        </section>
      </div>
    </div>
  );
}

function shortSignature(signature: string): string {
  if (signature.length <= 18) return signature;
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}
