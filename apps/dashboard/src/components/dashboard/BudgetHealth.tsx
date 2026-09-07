import { Button } from "@keiri/ui/components/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@keiri/ui/components/Progress";
import { cn } from "@keiri/ui/lib/utils";
import { calculateSpendingVelocityWasm } from "@keiri/wasm";
import { useNavigate } from "@tanstack/react-router";
import { TargetIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { useBudgets } from "@/hooks/UseBudgets";

interface VelocityDisplay {
  budget_id: string;
  projected_total: number;
  is_overpacing: boolean;
}

export function BudgetHealthWidget() {
  const { health, isLoading } = useBudgets();
  const navigate = useNavigate();
  const push = (url: string) => navigate({ to: url });
  const [_isPending, startTransition] = useTransition();
  const [velocities, setVelocities] = useState<Record<string, VelocityDisplay>>({});

  useEffect(() => {
    if (!health) return;

    async function computeProjections() {
      if (!health) return;

      const velocityPromises = health.map(async (b) => {
        try {
          const vel = calculateSpendingVelocityWasm(b.spent_amount, b.limit_amount, b.period);
          return { id: b.budget_id, vel };
        } catch (e) {
          console.error(`Velocity computation failed for ${b.budget_id}`, e);
          return { id: b.budget_id, vel: null };
        }
      });

      const results = await Promise.all(velocityPromises);
      const newVelocities: Record<string, VelocityDisplay> = {};

      for (const { id, vel } of results) {
        if (vel) {
          newVelocities[id] = {
            budget_id: id,
            projected_total: vel.projected_total,
            is_overpacing: vel.is_overpacing,
          };
        }
      }
      setVelocities(newVelocities);
    }

    void computeProjections();
  }, [health]);

  if (isLoading) {
    return (
      <div className="gap-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="gap-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-8 bg-muted rounded" />
            </div>
            <div className="h-1.5 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!health || health.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <TargetIcon className="size-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground mb-4">No budgets set</p>
        <Button size="sm" variant="outline" onClick={() => startTransition(() => push("/settings/budgets"))}>
          Setup Budgets
        </Button>
      </div>
    );
  }

  return (
    <div className="gap-y-6">
      <div className="gap-y-4">
        {health.slice(0, 4).map((b) => {
          const percentage = Number(b.percentage_consumed);
          const velocity = velocities[b.budget_id];
          const isOver = percentage > 100;
          const isOverpacing = velocity?.is_overpacing;
          const isWarning = percentage > 85;

          return (
            <div key={b.budget_id} className="gap-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium truncate max-w-[150px]">{b.category_name}</span>
                  {velocity && (
                    <span className="text-[10px] text-muted-foreground">
                      Proj: ₹{velocity.projected_total.toFixed(0)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={cn(
                      "font-semibold",
                      isOver
                        ? "text-destructive"
                        : isOverpacing
                          ? "text-amber-600"
                          : isWarning
                            ? "text-amber-500"
                            : "text-primary",
                    )}
                  >
                    {percentage.toFixed(0)}%
                  </span>
                  {isOverpacing && !isOver && (
                    <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-tighter">
                      Overpacing
                    </span>
                  )}
                </div>
              </div>
              <Progress value={Math.min(percentage, 100)}>
                <ProgressTrack className="h-1.5 bg-muted/50">
                  <ProgressIndicator
                    className={cn(
                      isOver
                        ? "bg-destructive"
                        : isOverpacing
                          ? "bg-amber-600"
                          : isWarning
                            ? "bg-amber-500"
                            : "bg-primary",
                    )}
                  />
                </ProgressTrack>
              </Progress>
            </div>
          );
        })}
      </div>
      {health.length > 4 && (
        <Button
          variant="link"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => startTransition(() => push("/settings/budgets"))}
        >
          View all budgets &hellip;
        </Button>
      )}
    </div>
  );
}
