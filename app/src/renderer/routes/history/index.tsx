import { type as t } from "@/renderer/design/tokens";
import { useReviewHistory } from "@/renderer/hooks/use-review";
import { ReviewList } from "@/renderer/routes/shared/review-list";

export default function HistoryRoute() {
  const history = useReviewHistory();

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <main className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <span className={t.eyebrow}>History</span>
          <h1 className={t.h2}>Signed and blocked.</h1>
          <p className={t.body}>
            A local ledger of the decisions you made, with the exact verdict text
            Argus showed at the time.
          </p>
        </header>

        {history.isError && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
            {history.error.message}
          </div>
        )}

        <ReviewList
          records={history.data ?? []}
          empty="No history yet. Approved and blocked transactions will appear here automatically."
        />
      </main>
    </div>
  );
}
