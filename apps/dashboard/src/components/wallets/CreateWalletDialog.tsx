import type { WalletType } from "@keiri/types";
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

import { useEntityForm } from "@/hooks/UseEntityForm";
import { useWallets } from "@/hooks/UseWallets";

interface CreateWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (walletId: string) => void;
}

export function CreateWalletDialog({ open, onOpenChange, onCreated }: CreateWalletDialogProps) {
  const { createMutation } = useWallets();

  const form = useEntityForm({
    initialValues: { name: "", type: "CASH", balance: "0" },
    validate: (values) => (!values.name.trim() ? "Wallet name is required" : null),
    onSubmit: async (values) => {
      createMutation.mutate(
        {
          name: values.name.trim(),
          type: values.type as WalletType,
          initial_balance: values.balance,
        },
        {
          onSuccess: (data: { id: string }) => {
            toast.success("Wallet created!");
            onOpenChange(false);
            if (onCreated && data?.id) {
              onCreated(data.id);
            }
          },
          onError: (err: Error) => {
            toast.error(err.message || "Failed to create wallet");
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
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create Wallet</DialogTitle>
          <DialogDescription>Add a new bank account, credit card, or cash wallet.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="wallet-name">Wallet Name</Label>
            <Input
              id="wallet-name"
              value={form.values.name}
              onChange={(e) => form.handleChange("name", e.target.value)}
              placeholder="e.g. HDFC Bank, My Credit Card"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="wallet-type">Type</Label>
              <Select value={form.values.type} onValueChange={(val) => form.handleChange("type", val || "CASH")}>
                <SelectTrigger id="wallet-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank Account</SelectItem>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                  <SelectItem value="UPI">UPI Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="wallet-balance">Initial Balance (₹)</Label>
              <Input
                id="wallet-balance"
                type="number"
                step="0.01"
                value={form.values.balance}
                onChange={(e) => form.handleChange("balance", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit} disabled={!form.values.name.trim() || createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Wallet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
