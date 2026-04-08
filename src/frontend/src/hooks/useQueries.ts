import type { backendInterface } from "@/backend";
import type {
  PortfolioSnapshot,
  Public,
  Public__1,
  Transaction,
} from "@/backend.d";
import { useActor } from "@/hooks/useActor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Transaction extended with optional currency field (frontend-only until bindgen regenerates) */
export type TransactionWithCurrency = Transaction & { currency?: string };

export function useGetAssets() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAssets();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetHoldings() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["holdings"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getHoldings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetPortfolioSummary() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["portfolioSummary"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPortfolioSummary();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetTransactions() {
  const { actor, isFetching } = useActor();
  return useQuery<TransactionWithCurrency[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTransactions() as Promise<TransactionWithCurrency[]>;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetSnapshots(startDate: bigint, endDate: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["snapshots", startDate.toString(), endDate.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSnapshots(startDate, endDate);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetProfile() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getCallerUserProfile();
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching,
    retry: false,
  });
}

/**
 * Exported only for legacy compatibility — prefer useActor() directly in mutations.
 * @deprecated Use useActor() inside your hook instead.
 */
export function getActorFromCache(
  _qc: ReturnType<typeof useQueryClient>,
): backendInterface | null {
  return null;
}

export function useAddAsset() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: Public__1) => {
      if (!actor) throw new Error("Not connected");
      return actor.addAsset(asset);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
    },
  });
}

export function useUpdateAsset() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: Public__1) => {
      if (!actor) throw new Error("Not connected");
      return actor.updateAsset(asset);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
    },
  });
}

export function useDeleteAsset() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteAsset(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useAddTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: TransactionWithCurrency) => {
      if (!actor) throw new Error("Not connected");
      // Strip frontend-only currency field before sending to backend
      const { currency: _currency, ...backendTx } = tx;
      return actor.addTransaction(backendTx as Transaction);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
    },
  });
}

export function useUpdateTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: TransactionWithCurrency) => {
      if (!actor) throw new Error("Not connected");
      // Strip frontend-only currency field before sending to backend
      const { currency: _currency, ...backendTx } = tx;
      return actor.updateTransaction(backendTx as Transaction);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
    },
  });
}

export function useDeleteTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteTransaction(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
    },
  });
}

export function useUpdateProfile() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Public) => {
      if (!actor) throw new Error("Not connected");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

export function useAddSnapshot() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snapshot: PortfolioSnapshot) => {
      if (!actor) throw new Error("Not connected");
      return actor.addSnapshot(snapshot);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots"] });
    },
  });
}
