import type { BankTransaction, TypedProcessedOcr } from "@keiri/types";
import { Button } from "@keiri/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@keiri/ui/components/card";
import { Checkbox } from "@keiri/ui/components/checkbox";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@keiri/ui/components/select";
import { cn } from "@keiri/ui/lib/utils";
import { CheckIcon, FilterIcon, ReceiptIcon, Trash2Icon, UserIcon, WalletIcon } from "lucide-react";
import * as React from "react";

import { useCategories } from "@/hooks/UseCategories";
import { useContacts } from "@/hooks/UseContacts";
import { useWallets } from "@/hooks/UseWallets";

interface ReviewTransactionFormProps {
  processedOcr: TypedProcessedOcr;
  onConfirm: (finalData: TypedProcessedOcr) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ReviewTransactionForm({ processedOcr, onConfirm, onCancel, isSubmitting }: ReviewTransactionFormProps) {
  // Common Single-Transaction States
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [direction, setDirection] = React.useState<"IN" | "OUT">("OUT");
  const [counterparty, setCounterparty] = React.useState("");
  const [upiId, setUpiId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>("none");
  const [walletId, setWalletId] = React.useState<string>("none");
  const [contactId, setContactId] = React.useState<string>("none");

  // Bank Statement State
  const [bankTransactions, setBankTransactions] = React.useState<BankTransaction[]>([]);
  const [selectedIndices, setSelectedIndices] = React.useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = React.useState("");

  const { categories } = useCategories();
  const { wallets } = useWallets();
  const { contacts } = useContacts();

  React.useEffect(() => {
    if (processedOcr.doc_type === "GPAY") {
      const d = processedOcr.data;
      setAmount(d.amount || "");
      setDirection(d.direction === "IN" ? "IN" : "OUT");
      setCounterparty(d.counterparty_name || "");
      setUpiId(d.counterparty_upi_id || "");
      setDescription(d.counterparty_name ? `Payment to ${d.counterparty_name}` : "GPay Transaction");
      setDate(new Date().toISOString().split("T")[0]);
    } else if (processedOcr.doc_type === "BANK_STATEMENT") {
      const d = processedOcr.data.bank_data;
      const txs = d.transactions || [];
      setBankTransactions(txs);
      setSelectedIndices(new Set(txs.map((_, i: number) => i)));
      setDescription(`${d.bank_name} Statement: ${d.statement_period}`);
    } else {
      const d = processedOcr.data;
      setAmount(d.amount || "");
      setDirection("OUT");
      setCounterparty(d.vendor || "");
      setDescription(d.vendor ? `Purchase at ${d.vendor}` : "Generic Receipt");
      setDate(new Date().toISOString().split("T")[0]);
    }
  }, [processedOcr]);

  const toggleSelectAll = () => {
    if (selectedIndices.size === bankTransactions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(bankTransactions.map((_, i) => i)));
    }
  };

  const toggleSelectRow = (i: number) => {
    const next = new Set(selectedIndices);
    if (next.has(i)) {
      next.delete(i);
    } else {
      next.add(i);
    }
    setSelectedIndices(next);
  };

  const updateBankTx = (index: number, updates: Partial<BankTransaction>) => {
    setBankTransactions((prev) => prev.map((tx, i) => (i === index ? { ...tx, ...updates } : tx)));
  };

  const applyGlobalCategory = (catId: string | null) => {
    if (catId) {
      setCategoryId(catId);
      setBankTransactions((prev) =>
        prev.map((tx, i) => (selectedIndices.has(i) ? { ...tx, category_id: catId === "none" ? null : catId } : tx)),
      );
    }
  };

  const applyGlobalWallet = (wId: string | null) => {
    if (wId) {
      setWalletId(wId);
      setBankTransactions((prev) =>
        prev.map((tx, i) => (selectedIndices.has(i) ? { ...tx, wallet_id: wId === "none" ? null : wId } : tx)),
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (processedOcr.doc_type === "BANK_STATEMENT") {
      // Filter out unselected transactions
      const filteredTransactions = bankTransactions.filter((_, i) => selectedIndices.has(i));

      onConfirm({
        ...processedOcr,
        data: {
          ...processedOcr.data,
          bank_data: {
            ...processedOcr.data.bank_data,
            transactions: filteredTransactions,
          },
        },
      });
      return;
    }

    // Single transaction flow
    const commonFields = {
      amount,
      category_id: categoryId !== "none" ? categoryId : null,
      wallet_id: walletId !== "none" ? walletId : null,
      contact_id: contactId !== "none" ? contactId : null,
    };

    if (processedOcr.doc_type === "GPAY") {
      onConfirm({
        ...processedOcr,
        data: {
          ...processedOcr.data,
          ...commonFields,
          direction,
          counterparty_name: counterparty,
          counterparty_upi_id: upiId,
        },
      });
    } else {
      onConfirm({
        ...processedOcr,
        data: {
          ...processedOcr.data,
          ...commonFields,
          vendor: counterparty,
        },
      });
    }
  };

  if (processedOcr.doc_type === "BANK_STATEMENT") {
    const selectedTransactions = bankTransactions.filter((_, i) => selectedIndices.has(i));
    const totalSelected = selectedTransactions.length;

    const totalDebit = selectedTransactions.reduce((acc, tx) => acc + parseFloat(tx.debit_amount || "0"), 0);
    const totalCredit = selectedTransactions.reduce((acc, tx) => acc + parseFloat(tx.credit_amount || "0"), 0);

    const filteredTransactions = bankTransactions.reduce<(BankTransaction & { originalIndex: number })[]>(
      (acc, tx, i) => {
        if (
          tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          acc.push({ ...tx, originalIndex: i });
        }
        return acc;
      },
      [],
    );

    return (
      <Card className="w-full max-w-5xl mx-auto shadow-xl border-primary/20 overflow-hidden">
        <CardHeader className="bg-primary/5 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
                <ReceiptIcon className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Review Bank Statement</CardTitle>
                <CardDescription className="font-medium text-primary/80">
                  {bankTransactions.length} transactions found • {totalSelected} selected
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-end md:self-auto bg-background/50 p-2 rounded-lg border border-primary/10 shadow-sm">
              <div className="flex items-center gap-2 px-2 border-r pr-4">
                <FilterIcon className="size-4 text-muted-foreground" />
                <Input
                  placeholder="Filter transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-40 border-none bg-transparent focus-visible:ring-0 text-xs p-0"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">
                  Selected Account
                </Label>
                <Select value={walletId} onValueChange={applyGlobalWallet}>
                  <SelectTrigger className="h-9 w-40 bg-background border-primary/20">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose Wallet</SelectItem>
                    {wallets?.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">
                  Selected Category
                </Label>
                <Select value={categoryId} onValueChange={applyGlobalCategory}>
                  <SelectTrigger className="h-9 w-40 bg-background border-primary/20">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 max-h-[60vh] overflow-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[11px] uppercase bg-muted/50 sticky top-0 z-10 backdrop-blur-sm border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={selectedIndices.size === bankTransactions.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Description</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Amount (₹)</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.map((tx) => {
                const i = tx.originalIndex;
                const isSelected = selectedIndices.has(i);
                const isDebit = !!tx.debit_amount;
                return (
                  <tr
                    key={i}
                    className={cn("transition-colors group", isSelected ? "bg-background" : "bg-muted/20 opacity-60")}
                  >
                    <td className="px-4 py-3 align-middle">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectRow(i)} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">{tx.transaction_date}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="truncate text-xs font-semibold" title={tx.description}>
                        {tx.description}
                      </p>
                      {tx.contact_name && (
                        <p className="text-[10px] text-primary/70 mt-0.5 flex items-center gap-1">
                          <UserIcon className="size-2.5" /> {tx.contact_name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn("font-mono font-bold text-sm", isDebit ? "text-red-500" : "text-emerald-500")}
                      >
                        {isDebit ? "-" : "+"}
                        {parseFloat(tx.debit_amount || tx.credit_amount || "0").toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3" aria-label="Transaction details options">
                      <div className="flex gap-2">
                        <Select
                          value={tx.category_id || "none"}
                          onValueChange={(val) =>
                            updateBankTx(i, {
                              category_id: val === "none" ? null : val,
                            })
                          }
                          disabled={!isSelected}
                        >
                          <SelectTrigger className="h-7 w-32 text-[10px] px-2">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Uncategorized</SelectItem>
                            {categories?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={tx.wallet_id || "none"}
                          onValueChange={(val) =>
                            updateBankTx(i, {
                              wallet_id: val === "none" ? null : val,
                            })
                          }
                          disabled={!isSelected}
                        >
                          <SelectTrigger className="h-7 w-32 text-[10px] px-2">
                            <SelectValue placeholder="Account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Account</SelectItem>
                            {wallets?.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>

        <CardFooter className="bg-muted/40 border-t p-6 flex flex-col md:flex-row justify-between gap-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon className="size-4 mr-2" /> Discard Batch
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex gap-6 border-r pr-6">
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Debit</p>
                <p className="text-sm font-bold text-red-500">-₹{totalDebit.toLocaleString("en-IN")}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Credit</p>
                <p className="text-sm font-bold text-emerald-500">+₹{totalCredit.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Import Summary</p>
              <p className="text-sm font-bold">{totalSelected} Transactions</p>
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || totalSelected === 0}
              className="px-8 shadow-lg shadow-primary/20"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" /> Processing Batch...
                </span>
              ) : (
                <>
                  <CheckIcon className="size-4 mr-2" /> Confirm & Import Selected
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  }

  // Generic/GPay Single Transaction Form
  return (
    <Card className="w-full max-w-2xl mx-auto shadow-2xl border-primary/20 overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
            <ReceiptIcon className="size-6" />
          </div>
          <div>
            <CardTitle className="text-xl">Review Extracted Data</CardTitle>
            <CardDescription>
              Confirm the details from your {processedOcr.doc_type === "GPAY" ? "GPay screenshot" : "receipt"}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-6 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="gap-y-2">
              <Label htmlFor="amount" className="text-xs uppercase font-bold text-muted-foreground ml-1">
                Amount (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-lg">₹</span>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-2xl font-bold tracking-tight bg-muted/10 h-12"
                  required
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="gap-y-2">
              <Label htmlFor="date" className="text-xs uppercase font-bold text-muted-foreground ml-1">
                Date
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12"
                required
              />
            </div>
          </div>

          <div className="gap-y-2">
            <Label htmlFor="counterparty" className="text-xs uppercase font-bold text-muted-foreground ml-1">
              {processedOcr.doc_type === "GPAY" ? "Recipient / Sender" : "Vendor"}
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 size-5 text-muted-foreground" />
              <Input
                id="counterparty"
                name="counterparty"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="pl-11 h-12 text-lg font-medium"
                placeholder="Name"
                required
                autoComplete="name"
              />
            </div>
          </div>

          {processedOcr.doc_type === "GPAY" && (
            <div className="gap-y-2">
              <Label htmlFor="upiId" className="text-xs uppercase font-bold text-muted-foreground ml-1">
                UPI ID / Phone
              </Label>
              <div className="relative">
                <WalletIcon className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="upiId"
                  name="upiId"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="pl-10 font-mono text-sm bg-muted/5 h-10"
                  placeholder="e.g. name@upi"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="gap-y-2">
              <Label htmlFor="direction" className="text-xs uppercase font-bold text-muted-foreground ml-1">
                Type
              </Label>
              <Select value={direction} onValueChange={(v) => v && setDirection(v)}>
                <SelectTrigger id="direction" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUT">Expense (Out)</SelectItem>
                  <SelectItem value="IN">Income (In)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="gap-y-2">
              <Label htmlFor="wallet" className="text-xs uppercase font-bold text-muted-foreground ml-1">
                Account
              </Label>
              <Select value={walletId} onValueChange={(val) => setWalletId(val || "none")}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Account</SelectItem>
                  {wallets?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="gap-y-2">
              <Label htmlFor="category" className="text-xs uppercase font-bold text-muted-foreground ml-1">
                Category
              </Label>
              <Select value={categoryId} onValueChange={(val) => setCategoryId(val || "none")}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="gap-y-2">
              <Label htmlFor="contact" className="text-xs uppercase font-bold text-muted-foreground ml-1">
                Link Contact
              </Label>
              <Select value={contactId} onValueChange={(val) => setContactId(val || "none")}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="No Contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Contact</SelectItem>
                  {contacts?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="gap-y-2">
            <Label htmlFor="description" className="text-xs uppercase font-bold text-muted-foreground ml-1">
              Personal Note
            </Label>
            <Input
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="h-11 bg-muted/5"
              autoComplete="off"
            />
          </div>
        </CardContent>
        <CardFooter className="bg-muted/40 border-t p-6 flex justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-4 mr-2" /> Discard
          </Button>
          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="px-8 shadow-lg shadow-primary/20">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" /> Saving...
                </span>
              ) : (
                <>
                  <CheckIcon className="size-4 mr-2" /> Confirm & Save
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

const Loader2Icon = (props: React.SVGProps<SVGSVGElement>) => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative loading spinner; surrounding control conveys state
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2v4" />
    <path d="m16.2 7.8 2.9-2.9" />
    <path d="M18 12h4" />
    <path d="m16.2 16.2 2.9 2.9" />
    <path d="M12 18v4" />
    <path d="m4.9 19.1 2.9-2.9" />
    <path d="M2 12h4" />
    <path d="m4.9 4.9 2.9 2.9" />
  </svg>
);
