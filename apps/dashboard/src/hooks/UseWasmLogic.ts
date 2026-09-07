import type { DetectedSubscription } from "@keiri/types";
import { useWasmWorker } from "@keiri/wasm";
import { useQuery } from "@tanstack/react-query";

import { useTransactions } from "@/hooks/UseTransactions";

/**
 * A hook that uses WASM to detect subscription patterns locally from transaction data.
 */
export function useLocalSubscriptionDetection() {
  const { transactions, isLoading } = useTransactions({ limit: 1000 });
  const { runTask } = useWasmWorker();

  const { data: detectedSubscriptions, isLoading: isDetecting } = useQuery({
    queryKey: ["local-detected-subscriptions", transactions?.length],
    queryFn: async () => {
      if (!transactions || transactions.length < 2) return [];
      return runTask<DetectedSubscription[]>("DETECT_SUBSCRIPTIONS", { transactions });
    },
    enabled: !!transactions && transactions.length >= 2,
  });

  return {
    detectedSubscriptions,
    isLoading: isLoading || isDetecting,
  };
}
