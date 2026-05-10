import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { argus } from "@/renderer/ipc/client";
import type { ChannelInput, ChannelOutput } from "@/shared/ipc";
import type { WalletInfo } from "@/shared/types/wallet";

const KEY = ["wallet", "state"] as const;

export function useWallet() {
  return useQuery<WalletInfo>({
    queryKey: KEY,
    queryFn: () => argus.wallet.state(),
    staleTime: 0,
  });
}

export function useCreateWallet() {
  return useMutation<
    ChannelOutput<"wallet.create">,
    Error,
    ChannelInput<"wallet.create">
  >({
    mutationFn: (input) => argus.wallet.create(input),
  });
}

export function useConfirmCreateWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => argus.wallet.confirmCreate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImportWallet() {
  const qc = useQueryClient();
  return useMutation<
    ChannelOutput<"wallet.import">,
    Error,
    ChannelInput<"wallet.import">
  >({
    mutationFn: (input) => argus.wallet.import(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUnlockWallet() {
  const qc = useQueryClient();
  return useMutation<
    ChannelOutput<"wallet.unlock">,
    Error,
    ChannelInput<"wallet.unlock">
  >({
    mutationFn: (input) => argus.wallet.unlock(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLockWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => argus.wallet.lock(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
