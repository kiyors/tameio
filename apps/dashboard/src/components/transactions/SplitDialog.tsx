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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/ApiClient";

interface SplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  totalAmount: string;
}

type SplitEntry = { id: string; receiver_email: string; amount: string };

const createSplit = (): SplitEntry => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  receiver_email: "",
  amount: "",
});

export function SplitDialog({ open, onOpenChange, transactionId, totalAmount }: SplitDialogProps) {
  const queryClient = useQueryClient();
  const [splits, setSplits] = useState<SplitEntry[]>(() => [createSplit()]);

  const splitMutation = useMutation({
    mutationFn: () =>
      api.post("/api/transactions/split", {
        transaction_id: transactionId,
        splits: splits.map((s) => ({
          receiver_email: s.receiver_email,
          amount: s.amount,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["p2p-pending"] });
      onOpenChange(false);
      toast.success("Splits created successfully!");
    },
  });

  const addSplit = () => setSplits((prev) => [...prev, createSplit()]);
  const removeSplit = (index: number) => setSplits((prev) => prev.filter((_, i) => i !== index));
  const updateSplit = (index: number, field: "receiver_email" | "amount", value: string) => {
    setSplits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Split Transaction</DialogTitle>
          <DialogDescription>Divide ₹{parseFloat(totalAmount).toLocaleString()} among your contacts.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {splits.map((split, index) => (
            <div key={split.id} className="flex gap-2 items-end border-b pb-4 last:border-0">
              <div className="grid gap-2 flex-1">
                <Label htmlFor={`email-${index}`}>Email</Label>
                <Input
                  id={`email-${index}`}
                  placeholder="friend@example.com"
                  value={split.receiver_email}
                  onChange={(e) => updateSplit(index, "receiver_email", e.target.value)}
                />
              </div>
              <div className="grid gap-2 w-24">
                <Label htmlFor={`amount-${index}`}>Amount</Label>
                <Input
                  id={`amount-${index}`}
                  placeholder="0.00"
                  value={split.amount}
                  onChange={(e) => updateSplit(index, "amount", e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeSplit(index)}
                disabled={splits.length === 1}
                aria-label="Remove person"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSplit} className="w-full">
            <PlusIcon className="size-4 mr-2" /> Add Person
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => splitMutation.mutate()}
            disabled={splitMutation.isPending || splits.some((s) => !s.receiver_email || !s.amount)}
          >
            {splitMutation.isPending ? "Splitting..." : "Send Split Requests"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
