import type { Group, GroupMemberDetail, LedgerTab, P2pRequest, P2pRequestWithSender, Transaction } from "@keiri/types";
import { toast } from "@keiri/ui/components/goey-toaster";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";

export function useP2P() {
  const session = useSession();
  const queryClient = useQueryClient();

  const pendingRequestsQuery = useQuery({
    queryKey: ["p2p-pending"],
    queryFn: () => api.get<P2pRequestWithSender[]>("/api/p2p/pending"),
    enabled: !!session.data,
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => api.post<Transaction>("/api/p2p/accept", { request_id: requestId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["p2p-pending"] });
      toast.success("Request accepted!");
    },
    onError: (error: Error) => {
      console.error(error);
      toast.error("Failed to accept request.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/api/p2p/reject/${requestId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["p2p-pending"] });
      toast.success("Request rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    p2pRequests: pendingRequestsQuery.data,
    isLoading: pendingRequestsQuery.isLoading,
    error: pendingRequestsQuery.error,
    acceptMutation,
    rejectMutation,
  };
}

export function useGroups() {
  const session = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<Group[]>("/api/groups"),
    enabled: !!session.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string | null }) => api.post<Group>("/api/groups/create", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { groupId: string; email: string }) =>
      api.post<P2pRequest>("/api/groups/invite", {
        group_id: data.groupId,
        receiver_email: data.email,
      }),
    onSuccess: () => {
      toast.success("Invite sent!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    groups: query.data,
    isLoading: query.isLoading,
    createMutation,
    inviteMutation,
  };
}

export function useGroupMembers(groupId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => api.get<GroupMemberDetail[]>(`/api/groups/${groupId}/members`),
    enabled: !!groupId,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/groups/${groupId}/members/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      toast.success("Member removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/api/groups/${groupId}/members/${userId}/role`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      toast.success("Role updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    members: query.data,
    isLoading: query.isLoading,
    removeMemberMutation,
    updateRoleMutation,
  };
}

export function useLedgerTabs() {
  const session = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ledger-tabs"],
    queryFn: () => api.get<LedgerTab[]>("/api/p2p/ledger-tabs"),
    enabled: !!session.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description: string | null;
      target_amount: number;
      tab_type: LedgerTab["tab_type"];
      counterparty_id: string | null;
    }) => api.post<LedgerTab>("/api/p2p/ledger-tabs", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ledger-tabs"] });
      toast.success("Ledger tab created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const repaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; wallet_id: string | null } }) =>
      api.post<Transaction>(`/api/p2p/ledger-tabs/${id}/repayment`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ledger-tabs"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Repayment registered!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    ledgerTabs: query.data,
    isLoading: query.isLoading,
    createMutation,
    repaymentMutation,
  };
}
