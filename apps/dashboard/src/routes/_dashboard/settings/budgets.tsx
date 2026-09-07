import { Button } from "@keiri/ui/components/button";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Progress, ProgressIndicator, ProgressTrack } from "@keiri/ui/components/Progress";
import { Separator } from "@keiri/ui/components/separator";
import { cn } from "@keiri/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, TargetIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { CreateBudgetDialog } from "@/components/budgets/CreateBudgetDialog";
import { useBudgets } from "@/hooks/UseBudgets";
import { formatCurrency } from "@/lib/Format";

export const Route = createFileRoute("/_dashboard/settings/budgets")({
  component: SettingsBudgetsPage,
});

function SettingsBudgetsPage() {
  const { health, isLoading, deleteMutation } = useBudgets();
  const [createOpen, setCreateOpen] = React.useState(false);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(`Budget deleted.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete budget"),
    });
  };

  // Whole-rupee display in the budget list view (no decimal noise alongside
  // a "₹50,000 / ₹80,000" target). Detail views can override per-call.
  const formatBudgetAmount = (amount: string) => formatCurrency(amount, "INR", { maximumFractionDigits: 0 });

  return (
    <div className="gap-y-6 w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Budgets</h3>
          <p className="text-sm text-muted-foreground">Set spending limits for your categories.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="mr-2 size-4" /> New Budget
        </Button>
      </div>
      <Separator />

      {isLoading ? (
        <div className="gap-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="gap-y-4">
          {!health || health.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <TargetIcon className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No budgets set yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Set a budget to keep your spending in check.</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="mr-2 size-4" /> Create Budget
              </Button>
            </div>
          ) : (
            health.map((b) => {
              const percentage = Number(b.percentage_consumed);
              const isOver = percentage > 100;
              const isWarning = percentage > 85;

              return (
                <div
                  key={b.budget_id}
                  className="flex flex-col gap-4 rounded-lg border p-4 group hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.category_name}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-tight">
                        {b.period} · {formatBudgetAmount(b.limit_amount)} limit
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(b.budget_id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                  <div className="gap-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Spent: {formatBudgetAmount(b.spent_amount)}</span>
                      <span className={cn("font-medium", isOver ? "text-destructive" : "text-muted-foreground")}>
                        {isOver ? "Over by " : "Remaining: "}
                        {formatBudgetAmount(Math.abs(Number(b.remaining_amount)).toString())}
                      </span>
                    </div>
                    <Progress value={Math.min(percentage, 100)}>
                      <ProgressTrack>
                        <ProgressIndicator
                          className={cn(isOver ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary")}
                        />
                      </ProgressTrack>
                    </Progress>
                    <div className="flex justify-end">
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold",
                          isOver ? "text-destructive" : isWarning ? "text-amber-500" : "text-muted-foreground/60",
                        )}
                      >
                        {percentage.toFixed(0)}% consumed
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
