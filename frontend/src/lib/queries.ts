import { PROCESSING_STATUSES, type ChecklistItemStatus, type ClientInput, type HubProfile, type Tender } from "@tenderready/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export const keys = {
  dashboard: ["dashboard"] as const,
  hub: ["hub"] as const,
  clients: ["clients"] as const,
  client: (id: string) => ["clients", id] as const,
  tenders: (clientId: string) => ["clients", clientId, "tenders"] as const,
  tender: (id: string) => ["tenders", id] as const,
};

const isProcessing = (status?: Tender["status"]) => !!status && PROCESSING_STATUSES.includes(status);

export const useDashboard = () =>
  useQuery({
    queryKey: keys.dashboard,
    queryFn: () => api().dashboard(),
    refetchInterval: (q) => (q.state.data?.upcoming.some((u) => isProcessing(u.status)) ? 4000 : false),
  });

export const useHub = () => useQuery({ queryKey: keys.hub, queryFn: () => api().getHub() });

export const useClients = () => useQuery({ queryKey: keys.clients, queryFn: () => api().listClients() });

export const useClient = (id: string) => useQuery({ queryKey: keys.client(id), queryFn: () => api().getClient(id) });

export const useClientTenders = (clientId: string) =>
  useQuery({
    queryKey: keys.tenders(clientId),
    queryFn: () => api().listTenders(clientId),
    enabled: !!clientId,
    refetchInterval: (q) => (q.state.data?.some((t) => isProcessing(t.status)) ? 3000 : false),
  });

/** Polls every 3 s while the backend pipeline is still processing. */
export const useTender = (id: string) =>
  useQuery({
    queryKey: keys.tender(id),
    queryFn: () => api().getTender(id),
    enabled: !!id,
    refetchInterval: (q) => (isProcessing(q.state.data?.status) ? 3000 : false),
  });

export function useSaveHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: HubProfile) => api().putHub(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.hub });
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useSaveClient(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => (clientId ? api().updateClient(clientId, input) : api().createClient(input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.clients });
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api().deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.clients });
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useDeleteTender(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api().deleteTender(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tenders(clientId) });
      qc.invalidateQueries({ queryKey: keys.client(clientId) });
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

/** Optimistic checklist updates so ticking items feels instant. */
export function useUpdateChecklist(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; status?: ChecklistItemStatus; note?: string }) =>
      api().updateChecklistItem(tenderId, v.itemId, { status: v.status, note: v.note }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.tender(tenderId) });
      const prev = qc.getQueryData<Tender>(keys.tender(tenderId));
      if (prev)
        qc.setQueryData<Tender>(keys.tender(tenderId), {
          ...prev,
          checklist: prev.checklist?.map((i) =>
            i.id === v.itemId ? { ...i, ...(v.status ? { status: v.status } : {}), ...(v.note !== undefined ? { note: v.note } : {}) } : i,
          ),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.tender(tenderId), ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.tender(tenderId) });
      qc.invalidateQueries({ queryKey: keys.dashboard });
      qc.invalidateQueries({ queryKey: keys.clients });
    },
  });
}
