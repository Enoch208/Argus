import { register } from "@/main/ipc/register";
import {
  markReviewBlocked,
  markReviewSigned,
  queuedReviews,
  rawPendingReview,
  reviewHistory,
  savePendingReview,
  searchReviews,
} from "@/main/review/store";
import { signAndBroadcast } from "@/main/solana/signer";
import { reviewTransaction } from "@/main/verdict/pipeline";

export function registerReviewHandlers(): void {
  register("review.start", async ({ raw }) => {
    const verdict = await reviewTransaction(raw);
    savePendingReview(raw, verdict);
    return verdict;
  });

  register("review.approve", async ({ id }) => {
    const signature = await signAndBroadcast(rawPendingReview(id));
    markReviewSigned(id, signature);
    return { signature };
  });

  register("review.block", async ({ id }) => {
    markReviewBlocked(id);
    return { ok: true } as const;
  });

  register("review.queue", async () => queuedReviews());
  register("review.history", async () => reviewHistory());
  register("review.search", async ({ query }) => searchReviews(query));
}
