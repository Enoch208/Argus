import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { argus } from "@/renderer/ipc/client";
import type { ChannelInput, ChannelOutput } from "@/shared/ipc";

const QUEUE_KEY = ["review", "queue"] as const;
const HISTORY_KEY = ["review", "history"] as const;
const searchKey = (query: string) => ["review", "search", query] as const;

export function useReview() {
  const qc = useQueryClient();
  return useMutation<
    ChannelOutput<"review.start">,
    Error,
    ChannelInput<"review.start">
  >({
    mutationFn: (input) => argus.review.start(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
      void qc.invalidateQueries({ queryKey: ["review", "search"] });
    },
  });
}

export function useApproveReview() {
  const qc = useQueryClient();
  return useMutation<
    ChannelOutput<"review.approve">,
    Error,
    ChannelInput<"review.approve">
  >({
    mutationFn: (input) => argus.review.approve(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
      void qc.invalidateQueries({ queryKey: HISTORY_KEY });
      void qc.invalidateQueries({ queryKey: ["review", "search"] });
    },
  });
}

export function useBlockReview() {
  const qc = useQueryClient();
  return useMutation<
    ChannelOutput<"review.block">,
    Error,
    ChannelInput<"review.block">
  >({
    mutationFn: (input) => argus.review.block(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
      void qc.invalidateQueries({ queryKey: HISTORY_KEY });
      void qc.invalidateQueries({ queryKey: ["review", "search"] });
    },
  });
}

export function useReviewQueue() {
  return useQuery<ChannelOutput<"review.queue">>({
    queryKey: QUEUE_KEY,
    queryFn: () => argus.review.queue(),
    refetchInterval: 5000,
  });
}

export function useReviewHistory() {
  return useQuery<ChannelOutput<"review.history">>({
    queryKey: HISTORY_KEY,
    queryFn: () => argus.review.history(),
    refetchInterval: 8000,
  });
}

export function useReviewSearch(query: string) {
  return useQuery<ChannelOutput<"review.search">>({
    queryKey: searchKey(query),
    queryFn: () => argus.review.search({ query }),
    staleTime: 500,
  });
}
