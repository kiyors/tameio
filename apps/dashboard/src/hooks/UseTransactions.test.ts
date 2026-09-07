// @vitest-environment jsdom
import { toast } from "@keiri/ui/components/goey-toaster";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/ApiClient";

import { useTransactionSummary, useTransactions } from "./UseTransactions";

// Mock dependencies
vi.mock("@keiri/ui/components/goey-toaster", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("@/lib/ApiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/lib/AuthClient", () => ({
  useSession: () => ({ data: { user: { id: "test-user" } } }),
}));
vi.mock("@tanstack/react-query", () => ({
  // The real react-query signatures are `onSuccess(data, variables, context)`
  // and `onError(error, variables, context)`. The previous mock dropped
  // variables/context, which crashed production destructures like
  // `onError: (err, { id }, ctx) => …`.
  useMutation: vi.fn(({ mutationFn, onSuccess, onError, onMutate }) => ({
    mutateAsync: async (variables: unknown) => {
      const context = onMutate ? await onMutate(variables) : undefined;
      try {
        const result = await mutationFn(variables);
        if (onSuccess) onSuccess(result, variables, context);
        return result;
      } catch (error) {
        if (onError) onError(error, variables, context);
        throw error;
      }
    },
    isLoading: false,
  })),
  useQuery: vi.fn(({ queryFn }) => {
    queryFn(); // Execute it to verify it was called
    return { data: null, isLoading: false };
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
  }),
}));
vi.mock("@tanstack/react-db", () => ({
  useLiveQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

// @keiri/wasm dynamically imports the .wasm binary, which jsdom can't
// instantiate. Stub the surface the hook actually uses with always-valid
// responses so the production code path runs end-to-end.
vi.mock("@keiri/wasm", () => ({
  validateTransactionWasm: vi.fn(async () => ({ is_valid: true, errors: [] })),
  aggregateTransactionsWasm: vi.fn(async () => ({})),
  generateDashboardSummaryWasm: vi.fn(async () => ({})),
  useWasmWorker: vi.fn(() => ({ worker: null, isReady: false })),
}));
vi.mock("@/lib/Db", () => ({
  db: {
    transactions: {
      // onMutate / onError reach into db.transactions for optimistic snapshots
      // and rollback; need stubs for all of them or the mutation aborts before
      // the request goes out.
      get: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("useTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle update transaction success", async () => {
    const mockTxn = { id: "1", amount: "100" };
    vi.mocked(api.patch).mockResolvedValue(mockTxn);

    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      await result.current.updateMutation.mutateAsync({ id: "1", data: { amount: "100" } });
    });

    expect(api.patch).toHaveBeenCalledWith("/api/transactions/1", { amount: "100" });
    expect(toast.success).toHaveBeenCalledWith("Transaction updated");
  });

  it("should handle update transaction error", async () => {
    const error = new Error("API Error");
    vi.mocked(api.patch).mockRejectedValue(error);

    const { result } = renderHook(() => useTransactions());

    try {
      await act(async () => {
        await result.current.updateMutation.mutateAsync({ id: "1", data: { amount: "100" } });
      });
    } catch {
      // Expected
    }

    expect(toast.error).toHaveBeenCalledWith("API Error");
  });

  it("should handle delete transaction success", async () => {
    vi.mocked(api.delete).mockResolvedValue({});

    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      await result.current.deleteMutation.mutateAsync("1");
    });

    expect(api.delete).toHaveBeenCalledWith("/api/transactions/1");
    expect(toast.success).toHaveBeenCalledWith("Transaction deleted");
  });
});

describe("useTransactionSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch summary success", async () => {
    const mockSummary = { total_balance: 100 };
    vi.mocked(api.get).mockResolvedValue(mockSummary);

    renderHook(() => useTransactionSummary());

    expect(api.get).toHaveBeenCalledWith("/api/transactions/summary");
  });
});
