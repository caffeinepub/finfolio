import type { backendInterface } from "@/backend";
import type { Public, Public__1, Transaction } from "@/backend.d";
import { useActor } from "@/hooks/useActor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTransactions();
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
 * Get the best available actor from queryClient cache.
 * Prefers authenticated actors (non-anonymous principal) over anonymous ones.
 */
function getActorFromCache(
  qc: ReturnType<typeof useQueryClient>,
): backendInterface | null {
  const queries = qc.getQueriesData<backendInterface>({ queryKey: ["actor"] });
  // Prefer actor associated with a real principal (not "undefined" or "2vxsx-fae" anonymous)
  let bestActor: backendInterface | null = null;
  for (const [queryKey, data] of queries) {
    if (!data) continue;
    const principal = queryKey[1] as string | undefined;
    // Skip anonymous/undefined actors if we have a better option
    if (
      principal &&
      principal !== "undefined" &&
      principal !== "2vxsx-fae" // anonymous principal
    ) {
      return data; // authenticated actor found -- use immediately
    }
    bestActor = data; // fallback to whatever we have
  }
  return bestActor;
}

export function useAddAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: Public__1) => {
      const actor = getActorFromCache(qc);
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: Public__1) => {
      const actor = getActorFromCache(qc);
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      const actor = getActorFromCache(qc);
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Transaction) => {
      const actor = getActorFromCache(qc);
      if (!actor) throw new Error("Not connected");
      return actor.addTransaction(tx);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Transaction) => {
      const actor = getActorFromCache(qc);
      if (!actor) throw new Error("Not connected");
      return actor.updateTransaction(tx);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["portfolioSummary"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      const actor = getActorFromCache(qc);
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Public) => {
      const actor = getActorFromCache(qc);
      if (!actor) throw new Error("Not connected");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}
