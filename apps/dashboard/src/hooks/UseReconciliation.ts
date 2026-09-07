import type { BankStatementRow, Transaction } from "@keiri/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/ApiClient";

export interface RowMatch {
  row: BankStatementRow;
  matches: [Transaction, number][];
}

export function useReconciliation() {
  const queryClient = useQueryClient();

  const { data: unmatchedRows, isLoading } = useQuery({
    queryKey: ["reconciliation", "rows"],
    queryFn: () => api.get<BankStatementRow[]>("/api/reconciliation/rows"),
  });

  const confirmMatchMutation = useMutation({
    mutationFn: ({ rowId, transactionId, confidence }: { rowId: string; transactionId: string; confidence: number }) =>
      api.post(`/api/reconciliation/rows/${rowId}/confirm`, {
        transaction_id: transactionId,
        confidence,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  return {
    unmatchedRows,
    isLoading,
    confirmMatchMutation,
  };
}

export function useRowMatches(rowId: string | null) {
  return useQuery({
    queryKey: ["reconciliation", "rows", rowId, "matches"],
    queryFn: () => (rowId ? api.get<RowMatch>(`/api/reconciliation/rows/${rowId}/matches`) : null),
    enabled: !!rowId,
  });
}
