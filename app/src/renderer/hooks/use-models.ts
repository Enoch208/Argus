import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { argus } from "@/renderer/ipc/client";
import type { ModelsStatus } from "@/shared/ipc";

const KEY = ["models", "status"] as const;

/**
 * Subscription to `channels.models.status` from the main process.
 *
 * Polls every 250 ms while the registry is `active` (or any model is in a
 * non-terminal state), every 5s otherwise. Renderer never owns download
 * state — main is the source of truth.
 */
export function useModels() {
  const q = useQuery<ModelsStatus>({
    queryKey: KEY,
    queryFn: () => argus.models.status(),
    refetchInterval: (query) => {
      const d = query.state.data as ModelsStatus | undefined;
      if (!d) return 1000;
      if (d.active) return 250;
      const stillWorking = d.models.some(
        (m) => m.state !== "ready" && m.state !== "error",
      );
      return stillWorking ? 1000 : 5000;
    },
    staleTime: 0,
  });
  return q;
}

export function useStartModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => argus.models.start(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePauseModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => argus.models.pause(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
