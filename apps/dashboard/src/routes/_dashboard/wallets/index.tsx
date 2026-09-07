import type { TransactionWithDetail, Wallet, WalletType } from "@keiri/types";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@keiri/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@keiri/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@keiri/ui/components/dropdown-menu";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@keiri/ui/components/select";
import { createFileRoute } from "@tanstack/react-router";
import {
  BanknoteIcon,
  Building2Icon,
  CreditCardIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react";
import { m } from "motion/react";
import * as React from "react";

import { useTransactions } from "@/hooks/UseTransactions";
import { useWallets } from "@/hooks/UseWallets";

export const Route = createFileRoute("/_dashboard/wallets/")({
  component: WalletsPage,
});

function WalletsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newName, setNewName] = React.useState<string>("");
  const [newType, setNewType] = React.useState<string>("CASH");
  const [newBalance, setNewBalance] = React.useState("0");

  const { wallets, isLoading, createMutation, updateMutation, deleteMutation } = useWallets();
  const { transactions } = useTransactions({ limit: 1000 });

  const transactionsByWallet = React.useMemo(() => {
    const map: Record<string, TransactionWithDetail[]> = {};
    if (!transactions) return map;

    for (const txn of transactions) {
      if (txn.status === "CANCELLED") continue;
      if (txn.source_wallet_id) {
        if (!map[txn.source_wallet_id]) map[txn.source_wallet_id] = [];
        map[txn.source_wallet_id].push(txn);
      }
      if (txn.destination_wallet_id) {
        if (!map[txn.destination_wallet_id]) map[txn.destination_wallet_id] = [];
        map[txn.destination_wallet_id].push(txn);
      }
    }
    return map;
  }, [transactions]);

  const handleCreate = () => {
    createMutation.mutate(
      {
        name: newName,
        type: newType as WalletType,
        initial_balance: newBalance,
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setNewName("");
          setNewType("CASH");
          setNewBalance("0");
        },
      },
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wallets & Accounts</h1>
          <p className="text-muted-foreground text-sm">Manage your payment methods and track balances.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger render={<Button />}>
            <PlusIcon className="mr-2 size-4" /> Add Wallet
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Wallet</DialogTitle>
              <DialogDescription>Add a new bank account, credit card, or cash wallet.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Wallet Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. HDFC Bank, My Credit Card"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={newType} onValueChange={(val) => setNewType(val || "CASH")}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK">Bank Account</SelectItem>
                      <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                      <SelectItem value="UPI_WALLET">UPI Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="balance">Initial Balance (₹)</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newName || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Wallet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : !wallets || wallets.length === 0 ? (
        <Card className="border-dashed py-20">
          <CardContent className="flex flex-col items-center text-center">
            <div className="bg-muted p-4 rounded-full mb-4">
              <WalletIcon className="size-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-medium">No wallets found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Add your first bank account or wallet to start tracking where your money goes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              walletTransactions={transactionsByWallet[wallet.id] || []}
              onUpdate={(data) => updateMutation.mutate({ id: wallet.id, data: data })}
              onDelete={() => deleteMutation.mutate(wallet.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WalletCard({
  wallet,
  walletTransactions,
  onUpdate,
  onDelete,
}: {
  wallet: Wallet;
  walletTransactions: TransactionWithDetail[];
  onUpdate: (data: Partial<Wallet>) => void;
  onDelete: () => void;
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(wallet.name);
  const [editBalance, setEditBalance] = React.useState(() => wallet.balance.toString());

  const lastStats = React.useMemo(() => {
    const lastInTxn = walletTransactions.find((txn) => txn.destination_wallet_id === wallet.id);
    const lastOutTxn = walletTransactions.find((txn) => txn.source_wallet_id === wallet.id);

    return {
      lastIn: lastInTxn ? parseFloat(lastInTxn.amount) : 0,
      lastOut: lastOutTxn ? parseFloat(lastOutTxn.amount) : 0,
    };
  }, [walletTransactions, wallet.id]);

  const calculatedNet = React.useMemo(() => {
    return walletTransactions.reduce((acc, txn) => {
      const amount = parseFloat(txn.amount);
      if (txn.destination_wallet_id === wallet.id) return acc + amount;
      if (txn.source_wallet_id === wallet.id) return acc - amount;
      return acc;
    }, 0);
  }, [walletTransactions, wallet.id]);

  const handleEdit = () => {
    onUpdate({ name: editName, balance: editBalance });
    setIsEditDialogOpen(false);
  };

  const handleSync = () => {
    setEditBalance(calculatedNet.toString());
  };

  const typeIcon = () => {
    switch (wallet.type) {
      case "BANK":
        return <Building2Icon className="size-5" />;
      case "CREDIT_CARD":
        return <CreditCardIcon className="size-5" />;
      case "UPI_WALLET":
        return <SmartphoneIcon className="size-5" />;
      default:
        return <BanknoteIcon className="size-5" />;
    }
  };

  return (
    <m.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="h-full">
      <Card className="overflow-hidden group hover:border-primary/50 transition-all shadow-sm h-full">
        <CardHeader className="p-4 flex flex-row items-center justify-between gap-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">{typeIcon()}</div>
            <div>
              <CardTitle className="text-base">{wallet.name}</CardTitle>
              <CardDescription className="text-[10px] uppercase font-semibold tracking-wider">
                {wallet.type.replace("_", " ")}
              </CardDescription>
            </div>
          </div>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="More options"
                  >
                    <MoreVerticalIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                  <PencilIcon className="mr-2 size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this wallet? This will not delete transactions.")) {
                      onDelete();
                    }
                  }}
                >
                  <Trash2Icon className="mr-2 size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="mt-2">
            <p className="text-xs text-muted-foreground uppercase font-medium">Current Balance</p>
            <p className="text-2xl font-bold font-mono tracking-tight">
              ₹
              {parseFloat(wallet.balance).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Last In</p>
              <p className="text-sm font-semibold text-green-600">
                {lastStats.lastIn > 0
                  ? `+₹${lastStats.lastIn.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                  : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Last Out</p>
              <p className="text-sm font-semibold text-red-600">
                {lastStats.lastOut > 0
                  ? `-₹${lastStats.lastOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex gap-2">
          <Badge variant="outline" className="text-[10px] bg-muted/30">
            Last updated {new Date(wallet.updated_at).toLocaleDateString()}
          </Badge>
        </CardFooter>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Wallet</DialogTitle>
              <DialogDescription>Update wallet details or adjust balance manually.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Wallet Name</Label>
                <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-balance">Balance (₹)</Label>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[10px]"
                    onClick={handleSync}
                    title="Sync with transaction history"
                  >
                    Sync with history (₹{calculatedNet.toLocaleString()})
                  </Button>
                </div>
                <Input
                  id="edit-balance"
                  type="number"
                  step="0.01"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </m.div>
  );
}
