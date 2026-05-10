import { useState } from "react";
import { type as t } from "@/renderer/design/tokens";
import {
  useApproveReview,
  useBlockReview,
  useReviewQueue,
} from "@/renderer/hooks/use-review";
import { ReviewList } from "@/renderer/routes/shared/review-list";

export default function QueueRoute() {
  const queue = useReviewQueue();
  const approve = useApproveReview();
  const block = useBlockReview();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = (kind: "approve" | "block", id: string) => {
    setBusyId(id);
    const mutation = kind === "approve" ? approve : block;
    void mutation.mutateAsync({ id }).finally(() => setBusyId(null));
  };

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <main className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <span className={t.eyebrow}>Queue</span>
          <h1 className={t.h2}>Pending approvals.</h1>
          <p className={t.body}>
            Reviewed transactions stay here until you approve or block them. Nothing
            broadcasts from this screen without an explicit click.
          </p>
        </header>

        {(approve.isError || block.isError || queue.isError) && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
            {approve.error?.message ?? block.error?.message ?? queue.error?.message}
          </div>
        )}

        <ReviewList
          records={queue.data ?? []}
          empty="No pending reviews. Paste a transaction in Review and it will appear here after Argus finishes the verdict."
          busyId={busyId}
          onApprove={(id) => act("approve", id)}
          onBlock={(id) => act("block", id)}
        />
      </main>
    </div>
  );
}
