import type { CreateWalletRequest, UpdateWalletRequest, ValidationResult, Wallet } from "@keiri/types";
import { toast } from "@keiri/ui/components/goey-toaster";
import { validateWalletWasm } from "@keiri/wasm";
import { useLiveQuery } from "@tanstack/react-db";
import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";
import { db } from "@/lib/Db";

export function useWallets(options?: { enabled?: boolean }) {
  const session = useSession();

  // Use TanStack DB for the live query
  const query = useLiveQuery((q) => q.from({ wallets: db.wallets }), [session.data]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateWalletRequest) => {
      // 0. Shared WASM Validation
      const result = (await validateWalletWasm(data.name, data.initial_balance)) as unknown as ValidationResult;
      if (!result.is_valid) {
        throw new Error(result.errors.map((e) => `${e.field}: ${e.message}`).join(", "));
      }
      return api.post<Wallet, CreateWalletRequest>("/api/wallets", data);
    },
    onSuccess: (newWallet) => {
      db.wallets.insert(newWallet);
      toast.success("Wallet created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWalletRequest }) => {
      // 0. Shared WASM Validation
      if (data.name || data.balance) {
        const currentWallet = db.wallets.get(id);
        const name = data.name || currentWallet?.name || "";
        const balance = data.balance?.toString() || currentWallet?.balance || "0";

        const result = (await validateWalletWasm(name, balance)) as unknown as ValidationResult;
        if (!result.is_valid) {
          throw new Error(result.errors.map((e) => `${e.field}: ${e.message}`).join(", "));
        }
      }
      return api.put<Wallet, UpdateWalletRequest>(`/api/wallets/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      const previousWallet = db.wallets.get(id);

      // Optimistically update local DB
      db.wallets.update(id, (draft) => {
        Object.assign(draft, data);
      });

      return { previousWallet };
    },
    onError: (err, { id }, context) => {
      if (context?.previousWallet) {
        db.wallets.update(id, (draft) => {
          Object.assign(draft, context.previousWallet);
        });
      }
      toast.error(err.message);
    },
    onSuccess: (updatedWallet, { id }) => {
      db.wallets.update(id, (draft) => {
        Object.assign(draft, updatedWallet);
      });
      toast.success("Wallet updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/wallets/${id}`);
    },
    onMutate: async (id) => {
      const previousWallet = db.wallets.get(id);
      db.wallets.delete(id);
      return { previousWallet };
    },
    onError: (err, _id, context) => {
      if (context?.previousWallet) {
        db.wallets.insert(context.previousWallet);
      }
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success("Wallet deleted");
    },
  });

  return {
    wallets: (options?.enabled === false ? [] : query.data) as unknown as Wallet[],
    isLoading: query.isLoading,
    error: query.isError ? "Error loading wallets" : null,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
