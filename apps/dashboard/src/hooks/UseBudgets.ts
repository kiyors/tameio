import type { Budget, BudgetHealth, CreateBudgetRequest, UpdateBudgetRequest, ValidationResult } from "@keiri/types";
import { validateBudgetWasm } from "@keiri/wasm";
import { useLiveQuery } from "@tanstack/react-db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";
import { db } from "@/lib/Db";

export function useBudgets() {
  const queryClient = useQueryClient();
  const session = useSession();

  const query = useLiveQuery((q) => q.from({ budgets: db.budgets }), [session.data]);

  const healthQuery = useQuery({
    queryKey: ["budgets", "health"],
    queryFn: () => api.get<BudgetHealth[]>("/api/budgets/health"),
    enabled: !!session.data,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateBudgetRequest) => {
      // 0. Shared WASM Validation
      const result = (await validateBudgetWasm(data.amount)) as unknown as ValidationResult;
      if (!result.is_valid) {
        throw new Error(result.errors.map((e) => `${e.field}: ${e.message}`).join(", "));
      }
      return api.post<Budget, CreateBudgetRequest>("/api/budgets", data);
    },
    onSuccess: (newBudget) => {
      db.budgets.insert(newBudget);
      void queryClient.invalidateQueries({ queryKey: ["budgets", "health"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateBudgetRequest }) => {
      // 0. Shared WASM Validation
      if (data.amount) {
        const result = (await validateBudgetWasm(data.amount)) as unknown as ValidationResult;
        if (!result.is_valid) {
          throw new Error(result.errors.map((e) => `${e.field}: ${e.message}`).join(", "));
        }
      }
      return api.patch<Budget, UpdateBudgetRequest>(`/api/budgets/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      const previousBudget = db.budgets.get(id);
      db.budgets.update(id, (draft) => {
        Object.assign(draft, data);
      });
      return { previousBudget };
    },

    onError: (_err, { id }, context) => {
      if (context?.previousBudget) {
        db.budgets.update(id, (draft) => {
          Object.assign(draft, context.previousBudget);
        });
      }
    },
    onSuccess: (updatedBudget, { id }) => {
      db.budgets.update(id, (draft) => {
        Object.assign(draft, updatedBudget);
      });
      void queryClient.invalidateQueries({ queryKey: ["budgets", "health"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/budgets/${id}`),
    onMutate: async (id) => {
      const previousBudget = db.budgets.get(id);
      db.budgets.delete(id);
      return { previousBudget };
    },
    onError: (_err, _id, context) => {
      if (context?.previousBudget) {
        db.budgets.insert(context.previousBudget);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgets", "health"] });
    },
  });

  return {
    budgets: query.data as unknown as Budget[],
    health: healthQuery.data,
    isLoading: query.isLoading || healthQuery.isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
