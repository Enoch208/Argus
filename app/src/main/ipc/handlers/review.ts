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
  register("review.start", async (input) => {
    const verdict = await reviewTransaction(input);
    // Image-only reviews aren't approveable — no transaction to sign — so
    // they emit a verdict for display but don't enter the pending queue.
    // OCR-augmented reviews of an actual transaction still queue normally.
    if (input.raw) savePendingReview(input.raw, verdict);
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
