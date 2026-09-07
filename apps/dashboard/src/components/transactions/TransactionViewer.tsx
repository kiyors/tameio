import type { Category, TransactionStatus, TransactionWithDetail, UpdateTransactionRequest } from "@keiri/types";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@keiri/ui/components/drawer";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@keiri/ui/components/select";
import { Separator } from "@keiri/ui/components/separator";
import { useIsMobile } from "@keiri/ui/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { UserIcon, WalletIcon } from "lucide-react";
import * as React from "react";

import { useContacts } from "@/hooks/UseContacts";
import { useWallets } from "@/hooks/UseWallets";
import { api } from "@/lib/ApiClient";

interface TransactionViewerProps {
  item: TransactionWithDetail;
  onUpdate: (id: string, data: UpdateTransactionRequest) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransactionViewer({ item, onUpdate, open, onOpenChange }: TransactionViewerProps) {
  const isMobile = useIsMobile();
  const [source, setSource] = React.useState<string>(item.purpose_tag || item.source || "");
  const [categoryId, setCategoryId] = React.useState<string>(item.category_id || "none");
  const [status, setStatus] = React.useState<string>(item.status || "COMPLETED");
  const [amount, setAmount] = React.useState(item.amount);
  const [note, setNote] = React.useState(item.notes || "");
  const [date, setDate] = React.useState(new Date(item.date).toISOString().split("T")[0]);
  const [walletId, setWalletId] = React.useState<string>(item.source_wallet_id || item.destination_wallet_id || "none");
  const [contactId, setContactId] = React.useState<string>(item.contact_id || "none");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/categories"),
  });

  const { wallets } = useWallets();
  const { contacts } = useContacts();

  const selectedCategory = React.useMemo(() => categories?.find((c) => c.id === categoryId), [categories, categoryId]);
  const selectedWallet = React.useMemo(() => wallets?.find((w) => w.id === walletId), [wallets, walletId]);
  const selectedContact = React.useMemo(() => contacts?.find((c) => c.id === contactId), [contacts, contactId]);

  const title = source || "Transaction";
  const formattedDate = new Date(item.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Drawer direction={isMobile ? "bottom" : "right"} open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          variant="link"
          className="w-fit px-0 text-left text-foreground truncate max-w-[200px] block font-normal"
        >
          {title}
        </Button>
      </DrawerTrigger>
      <DrawerContent className={isMobile ? "h-[80vh]" : "h-full w-[400px] ml-auto top-0"}>
        <DrawerHeader className="gap-1 text-left">
          <DrawerTitle className="text-xl">{title}</DrawerTitle>
          <DrawerDescription>Transaction from {formattedDate}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm mt-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl border">
            <div>
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className={`text-2xl font-bold tracking-tight ${item.direction === "IN" ? "text-green-600" : ""}`}>
                {item.direction === "OUT" ? "-" : "+"}₹
                {parseFloat(item.amount).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <Badge variant={item.direction === "IN" ? "default" : "secondary"}>
              {item.direction === "IN" ? "Income" : "Expense"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(item.source_wallet_name || item.destination_wallet_name) && (
              <div className="flex flex-col gap-1 px-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Account / Wallet
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <WalletIcon className="size-4 text-primary" />
                  <span>{item.source_wallet_name || item.destination_wallet_name}</span>
                </div>
              </div>
            )}

            {item.contact_name && (
              <div className="flex flex-col gap-1 px-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Person / Contact
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <UserIcon className="size-4 text-primary" />
                  <span>{item.contact_name}</span>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-2" />

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onUpdate(item.id, {
                purpose_tag: source,
                category_id: categoryId === "none" ? undefined : categoryId,
                status: status as TransactionStatus,
                amount,
                notes: note,
                date: new Date(date).toISOString(),
                source_wallet_id: item.direction === "OUT" ? (walletId === "none" ? undefined : walletId) : undefined,
                destination_wallet_id:
                  item.direction === "IN" ? (walletId === "none" ? undefined : walletId) : undefined,
                contact_id: contactId === "none" ? undefined : contactId,
              });
            }}
          >
            <div className="flex flex-col gap-3">
              <Label htmlFor="source">Description / Merchant</Label>
              <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="wallet">Wallet</Label>
                <Select value={walletId} onValueChange={(val) => setWalletId(val || "none")}>
                  <SelectTrigger id="wallet" className="w-full">
                    <SelectValue placeholder="Select wallet">
                      {walletId === "none" ? "No Wallet" : selectedWallet?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Wallet</SelectItem>
                    {wallets?.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="contact">Person</Label>
                <Select value={contactId} onValueChange={(val) => setContactId(val || "none")}>
                  <SelectTrigger id="contact" className="w-full">
                    <SelectValue placeholder="Select contact">
                      {contactId === "none" ? "No Contact" : selectedContact?.name}
                    </SelectValue>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId} onValueChange={(val) => setCategoryId(val || "none")}>
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="Select category">
                      {categoryId === "none" ? "Uncategorized" : selectedCategory?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(val) => setStatus(val || "COMPLETED")}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending Review</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <Label htmlFor="note">Personal Note</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this transaction..."
              />
            </div>

            <DrawerFooter className="mt-auto px-0 pt-6 border-t border-border/50">
              <Button type="submit">Save Changes</Button>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
