import { Button } from "@keiri/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@keiri/ui/components/dialog";
import { SparklesIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { useDemoData } from "@/hooks/UseDemoData";
import { useTransactionSummary } from "@/hooks/UseTransactions";

export function WelcomeDialog() {
  const { isActive, isLoading: isDemoLoading, seedMutation } = useDemoData();
  const { summary, isLoading: isSummaryLoading } = useTransactionSummary();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isDemoLoading || isSummaryLoading) return;

    const hasDeclined = localStorage.getItem("keiri_declined_demo") === "true";
    if (!hasDeclined && !isActive && summary?.total_transactions === 0) {
      setOpen(true);
    }
  }, [isActive, summary, isDemoLoading, isSummaryLoading]);

  const handleSeed = () => {
    seedMutation.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
      },
    });
  };

  const handleDecline = () => {
    localStorage.setItem("keiri_declined_demo", "true");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) handleDecline();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-primary" />
            Welcome to Keiri!
          </DialogTitle>
          <DialogDescription>
            It looks like you don't have any data yet. Would you like to explore Keiri with sample demo data?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            We will generate realistic wallets, budgets, categories, and transactions so you can see how everything
            works. You can clear this data at any time with a single click.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleDecline} disabled={seedMutation.isPending}>
              Start from Scratch
            </Button>
            <Button onClick={handleSeed} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? "Generating..." : "Explore Demo Data"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DemoBanner() {
  const { isActive, clearMutation } = useDemoData();

  if (!isActive) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <SparklesIcon className="size-4 animate-pulse" />
        You are currently exploring Keiri with Demo Data.
      </div>
      <Button
        variant="destructive"
        size="sm"
        className="h-7 text-xs"
        onClick={() => {
          if (confirm("Are you sure you want to clear all demo data? This will give you a completely fresh start.")) {
            clearMutation.mutate();
          }
        }}
        disabled={clearMutation.isPending}
      >
        <Trash2Icon className="size-3 mr-2" />
        {clearMutation.isPending ? "Clearing..." : "Clean Data & Start Fresh"}
      </Button>
    </div>
  );
}
