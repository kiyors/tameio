import type { BudgetPeriod } from "@keiri/types";
import { Button } from "@keiri/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@keiri/ui/components/dialog";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@keiri/ui/components/select";
import * as React from "react";

import { useBudgets } from "@/hooks/UseBudgets";
import { useCategories } from "@/hooks/UseCategories";
import { useEntityForm } from "@/hooks/UseEntityForm";

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBudgetDialog({ open, onOpenChange }: CreateBudgetDialogProps) {
  const { createMutation } = useBudgets();
  const { categories } = useCategories();

  const form = useEntityForm<{ categoryId: string; amount: string; period: BudgetPeriod }>({
    initialValues: { categoryId: "all", amount: "", period: "MONTHLY" },
    validate: (values) => {
      if (!values.amount || Number.isNaN(Number(values.amount)) || Number(values.amount) <= 0) {
        return "Please enter a valid amount";
      }
      return null;
    },
    onSubmit: async (values) => {
      createMutation.mutate(
        {
          category_id: values.categoryId === "all" ? undefined : values.categoryId,
          amount: values.amount,
          period: values.period,
        },
        {
          onSuccess: () => {
            toast.success("Budget set!");
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(err.message || "Failed to set budget");
          },
        },
      );
    },
  });

  const { reset } = form;

  React.useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Budget</DialogTitle>
          <DialogDescription>Define a spending limit for a specific category or overall.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={form.values.categoryId} onValueChange={(v) => form.handleChange("categoryId", v || "all")}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Limit Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input
                id="amount"
                className="pl-7"
                placeholder="0.00"
                type="number"
                value={form.values.amount}
                onChange={(e) => form.handleChange("amount", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="period">Period</Label>
            <Select value={form.values.period} onValueChange={(v) => form.handleChange("period", v || "MONTHLY")}>
              <SelectTrigger id="period">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Setting..." : "Set Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
