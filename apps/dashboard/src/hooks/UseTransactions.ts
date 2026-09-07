import type {
  DashboardSummary,
  PaginationParams,
  PaginatedTransactions,
  Transaction,
  TransactionWithDetail,
  UpdateTransactionRequest,
  ValidationResult,
} from "@keiri/types";
import { toast } from "@keiri/ui/components/goey-toaster";
import { useWasmWorker, validateTransactionWasm } from "@keiri/wasm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCategories } from "@/hooks/UseCategories";
import { useWallets } from "@/hooks/UseWallets";
import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";
import { db } from "@/lib/Db";

export function useTransactions(params: PaginationParams = {}) {
  const session = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", params.limit, params.offset],
    queryFn: () =>
      api.get<PaginatedTransactions>(`/api/transactions?limit=${params.limit || 30}&offset=${params.offset || 0}`),
    enabled: !!session.data,
  });

  // Keep db.transactions synced with the current page for offline support/optimistic UI
  if (query.data?.items) {
    for (const txn of query.data.items) {
      if (db.transactions.has(txn.id)) {
        db.transactions.update(txn.id, (draft) => {
          Object.assign(draft, txn);
        });
      } else {
        db.transactions.insert(txn);
      }
    }
  }

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTransactionRequest }) => {
      // 0. Shared WASM Validation
      if (data.amount || data.purpose_tag) {
        const currentTxn = db.transactions.get(id);
        const amount = data.amount?.toString() || currentTxn?.amount || "0";
        const purpose = data.purpose_tag || currentTxn?.purpose_tag || "";

        const result = (await validateTransactionWasm(amount, purpose)) as unknown as ValidationResult;
        if (!result.is_valid) {
          throw new Error(result.errors.map((e) => `${e.field}: ${e.message}`).join(", "));
        }
      }

      return api.patch<Transaction, UpdateTransactionRequest>(`/api/transactions/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["transaction-summary"] });

      // 2. Snapshot the previous state (TanStack DB handles its own snapshots usually, but we might want to be safe)
      const previousTxn = db.transactions.get(id);

      // 3. Optimistically update local DB
      db.transactions.update(id, (draft) => {
        Object.assign(draft, data);
      });

      return { previousTxn };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousTxn) {
        db.transactions.update(id, (draft) => {
          Object.assign(draft, context.previousTxn);
        });
      }
      toast.error(err.message);
    },
    onSuccess: (updatedTxn, { id }) => {
      // Ensure local DB is in sync with server's final version
      db.transactions.update(id, (draft) => {
        Object.assign(draft, updatedTxn);
      });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      toast.success("Transaction updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/transactions/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["transaction-summary"] });
      const previousTxn = db.transactions.get(id);

      // Optimistically delete
      db.transactions.delete(id);

      return { previousTxn };
    },
    onError: (err, _id, context) => {
      // Rollback
      if (context?.previousTxn) {
        db.transactions.insert(context.previousTxn);
      }
      toast.error(err.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      toast.success("Transaction deleted");
    },
  });

  return {
    transactions: (query.data?.items as unknown as TransactionWithDetail[]) || [],
    totalCount: query.data?.total_count || 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.isError ? "Error loading transactions" : null,
    updateMutation,
    deleteMutation,
  };
}

export function useTransactionSummary() {
  const session = useSession();

  const query = useQuery({
    queryKey: ["transaction-summary"],
    queryFn: () => api.get<DashboardSummary>("/api/transactions/summary"),
    enabled: !!session.data,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLocalSummary() {
  const { transactions, isLoading: isTxnsLoading } = useTransactions({ limit: 1000 });
  const { wallets, isLoading: isWalletsLoading } = useWallets();
  const { categories, isLoading: isCatsLoading } = useCategories();
  const { runTask } = useWasmWorker();

  const { data: localSummary, isLoading: isComputing } = useQuery({
    queryKey: ["local-summary", transactions, wallets, categories],
    queryFn: async () => {
      if (!transactions || transactions.length === 0) return null;
      return runTask<DashboardSummary>("GENERATE_SUMMARY", {
        transactions,
        wallets: wallets || [],
        categories: categories || [],
      });
    },
    enabled: !!transactions && transactions.length > 0,
  });

  return {
    summary: localSummary,
    isLoading: isTxnsLoading || isWalletsLoading || isCatsLoading || isComputing,
  };
}
