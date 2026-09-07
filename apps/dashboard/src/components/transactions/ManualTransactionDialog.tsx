import { zodResolver } from "@hookform/resolvers/zod";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, PlusIcon, TagIcon, WalletIcon } from "lucide-react";
import { m } from "motion/react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { CreateCategoryDialog, ICON_MAP } from "@/components/categories/CreateCategoryDialog";
import { CreateContactDialog } from "@/components/contacts/CreateContactDialog";
import { CreateWalletDialog } from "@/components/wallets/CreateWalletDialog";
import { useCategories } from "@/hooks/UseCategories";
import { useContacts } from "@/hooks/UseContacts";
import { useWallets } from "@/hooks/UseWallets";
import { api } from "@/lib/ApiClient";

const getCategoryIcon = (iconName: string | null | undefined) => {
  if (!iconName) return TagIcon;
  return ICON_MAP[iconName] || TagIcon;
};

const transactionSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  direction: z.enum(["IN", "OUT"]),
  date: z.string().min(1, "Date is required"),
  walletId: z.string(),
  contactId: z.string(),
  categoryId: z.string(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface ManualTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualTransactionDialog({ open, onOpenChange }: ManualTransactionDialogProps) {
  const queryClient = useQueryClient();
  const [createCategoryOpen, setCreateCategoryOpen] = React.useState(false);
  const [createContactOpen, setCreateContactOpen] = React.useState(false);
  const [createWalletOpen, setCreateWalletOpen] = React.useState(false);

  const { wallets } = useWallets();
  const { contacts } = useContacts();
  const { categories } = useCategories();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      description: "",
      direction: "OUT",
      date: new Date().toISOString().split("T")[0],
      walletId: "none",
      contactId: "none",
      categoryId: "none",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const direction = watch("direction");
  const walletId = watch("walletId");
  const contactId = watch("contactId");
  const categoryId = watch("categoryId");

  const selectedWallet = React.useMemo(() => wallets?.find((w) => w.id === walletId), [wallets, walletId]);
  const selectedContact = React.useMemo(() => contacts?.find((c) => c.id === contactId), [contacts, contactId]);

  const createMutation = useMutation({
    mutationFn: (values: TransactionFormValues) =>
      api.post("/api/transactions/manual", {
        amount: parseFloat(values.amount),
        purpose_tag: values.description,
        direction: values.direction,
        date: new Date(values.date).toISOString(),
        source_wallet_id: values.direction === "OUT" && values.walletId !== "none" ? values.walletId : null,
        destination_wallet_id: values.direction === "IN" && values.walletId !== "none" ? values.walletId : null,
        contact_id: values.contactId !== "none" ? values.contactId : null,
        category_id: values.categoryId !== "none" ? values.categoryId : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      onOpenChange(false);
      reset();
      toast.success("Transaction added!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: TransactionFormValues) => {
    createMutation.mutate(values);
  };

  const handleClose = () => {
    if (isDirty) {
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
        onOpenChange(false);
      }
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-white/5 shadow-2xl">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold tracking-tight">Add Transaction</DialogTitle>
          <DialogDescription>Manually enter details for a new income or expense.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-4 gap-y-6">
          <div className="gap-y-4">
            {/* Amount Section with tabular nums */}
            <div className="gap-y-2">
              <Label htmlFor="amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground/50">
                  ₹
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...register("amount")}
                  placeholder="0.00"
                  className="pl-9 h-14 text-2xl font-bold font-mono tracking-tighter bg-muted/20 border-none focus-visible:ring-primary/20"
                  autoComplete="off"
                />
              </div>
              {errors.amount && (
                <m.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-medium text-destructive"
                >
                  {errors.amount.message}
                </m.p>
              )}
            </div>

            <div className="gap-y-2">
              <Label
                htmlFor="description"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Description
              </Label>
              <Input
                id="description"
                {...register("description")}
                placeholder="e.g. Monthly Rent, Dinner with friends"
                className="bg-muted/10 border-muted-foreground/10"
                autoComplete="off"
              />
              {errors.description && (
                <p className="text-xs font-medium text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="gap-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select
                  value={direction}
                  onValueChange={(v: "IN" | "OUT" | null) => setValue("direction", v || "OUT", { shouldDirty: true })}
                >
                  <SelectTrigger className="bg-muted/10 border-muted-foreground/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUT">Expense</SelectItem>
                    <SelectItem value="IN">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="gap-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
                <Input id="date" type="date" {...register("date")} className="bg-muted/10 border-muted-foreground/10" />
              </div>
            </div>

            <div className="gap-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Wallet / Account
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <WalletIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/50" />
                  <Select
                    value={walletId}
                    onValueChange={(val: string | null) => setValue("walletId", val || "none", { shouldDirty: true })}
                  >
                    <SelectTrigger className="pl-9 bg-muted/10 border-muted-foreground/10 text-left">
                      <span className="truncate">
                        {walletId === "none" ? "Select wallet" : selectedWallet?.name || "Unknown Wallet"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Wallet (Cash)</SelectItem>
                      {wallets?.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{w.name}</span>
                            <span className="text-[10px] tabular-nums font-mono opacity-50">
                              ₹{parseFloat(w.balance).toLocaleString()}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  className="shrink-0 border-muted-foreground/10"
                  onClick={() => setCreateWalletOpen(true)}
                  aria-label="Create wallet"
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="gap-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</Label>
                <div className="flex gap-2">
                  <Select
                    value={contactId}
                    onValueChange={(val: string | null) => setValue("contactId", val || "none", { shouldDirty: true })}
                  >
                    <SelectTrigger className="bg-muted/10 border-muted-foreground/10 text-left overflow-hidden">
                      <span className="truncate">{contactId === "none" ? "None" : selectedContact?.name}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contacts?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    type="button"
                    className="shrink-0 border-muted-foreground/10 size-9"
                    onClick={() => setCreateContactOpen(true)}
                    aria-label="Create contact"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="gap-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                <div className="flex gap-2">
                  <Select
                    value={categoryId}
                    onValueChange={(val: string | null) => setValue("categoryId", val || "none", { shouldDirty: true })}
                  >
                    <SelectTrigger className="bg-muted/10 border-muted-foreground/10 text-left overflow-hidden">
                      {categoryId === "none" ? (
                        <span className="truncate">Uncategorized</span>
                      ) : (
                        (() => {
                          const cat = categories?.find((c) => c.id === categoryId);
                          if (!cat) return <span className="truncate">Unknown</span>;
                          const Icon = getCategoryIcon(cat.icon);
                          return (
                            <div className="flex items-center gap-2 truncate">
                              <Icon className="size-3.5 opacity-70" />
                              <span className="truncate">{cat.name}</span>
                            </div>
                          );
                        })()
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {categories?.map((c) => {
                        const Icon = getCategoryIcon(c.icon);
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <Icon className="size-3.5" />
                              <span>{c.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    type="button"
                    className="shrink-0 border-muted-foreground/10 size-9"
                    onClick={() => setCreateCategoryOpen(true)}
                    aria-label="Create category"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 text-primary text-[11px] leading-tight">
            <InfoIcon className="size-3.5 shrink-0" />
            <span>This transaction will be recorded and your balance will be updated instantly.</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              type="button"
              onClick={handleClose}
              className="text-muted-foreground hover:bg-muted/50"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty} className="px-8 shadow-lg shadow-primary/20">
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <m.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="size-3 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Saving...
                </div>
              ) : (
                "Create Transaction"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <CreateCategoryDialog
        open={createCategoryOpen}
        onOpenChange={setCreateCategoryOpen}
        onCreated={(id) => setValue("categoryId", id, { shouldDirty: true })}
      />
      <CreateContactDialog
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
        onCreated={(id) => setValue("contactId", id, { shouldDirty: true })}
      />
      <CreateWalletDialog
        open={createWalletOpen}
        onOpenChange={setCreateWalletOpen}
        onCreated={(id) => setValue("walletId", id, { shouldDirty: true })}
      />
    </Dialog>
  );
}
