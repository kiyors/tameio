import type { Group, TransactionWithDetail } from "@keiri/types";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@keiri/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@keiri/ui/components/dialog";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@keiri/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@keiri/ui/components/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@keiri/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRightIcon, InfoIcon, PlusIcon, ReceiptIcon, Trash2Icon, UserPlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { useGroupMembers, useGroups } from "@/hooks/UseP2p";
import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";

export const Route = createFileRoute("/_dashboard/p2p/shared-ledgers")({
  component: SharedLedgersComponent,
});

function InviteDialog({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const { inviteMutation } = useGroups();

  const handleInvite = () => {
    inviteMutation.mutate(
      { groupId, email },
      {
        onSuccess: () => {
          setOpen(false);
          setEmail("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="size-8 p-0" aria-label="Invite member" />}>
        <UserPlusIcon className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to {groupName}</DialogTitle>
          <DialogDescription>Send an invitation to join this shared ledger.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              autoComplete="email"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={!email || inviteMutation.isPending}>
            {inviteMutation.isPending ? "Sending..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ groupId, groupName }: { groupId: string; groupName: string }) {
  const session = useSession();
  const { members, isLoading, removeMemberMutation, updateRoleMutation } = useGroupMembers(groupId);

  const myMembership = members?.find((m) => m.user_id === session.data?.user?.id);
  const isAdmin = myMembership?.role === "ADMIN";

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" className="shadow-none" aria-label="View members" />}>
        <UsersIcon className="mr-2 size-4" /> Members
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Members of {groupName}</DialogTitle>
          <DialogDescription>Manage people who can view and share transactions.</DialogDescription>
        </DialogHeader>
        <div className="gap-y-4 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading members...</p>
          ) : (
            members?.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {m.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{m.name || "Unknown User"}</p>
                      {m.user_id === session.data?.user?.id && (
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-muted/50">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && m.user_id !== session.data?.user?.id ? (
                    <div className="flex items-center gap-1">
                      <Select
                        value={m.role}
                        onValueChange={(newRole) =>
                          updateRoleMutation.mutate({
                            userId: m.user_id,
                            role: newRole || "MEMBER",
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-[10px] w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive size-7"
                        aria-label={`Remove ${m.name || m.email} from group`}
                        onClick={() => {
                          if (confirm(`Remove ${m.name || m.email} from group?`)) {
                            removeMemberMutation.mutate(m.user_id);
                          }
                        }}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {m.role}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupDetails({ group }: { group: Group }) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["group-transactions", group.id],
    queryFn: () => api.get<TransactionWithDetail[]>(`/api/groups/${group.id}/transactions`),
  });

  return (
    <div className="gap-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ReceiptIcon className="size-4 text-primary" /> Recent Activity
        </h3>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-8" aria-label="Information" />}>
              <InfoIcon className="size-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Transactions shared directly with this group</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isLoading ? (
        <div className="gap-y-3">
          <div className="h-12 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-12 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-12 w-full bg-muted animate-pulse rounded-md" />
        </div>
      ) : !transactions || transactions.length === 0 ? (
        <div className="text-center py-16 border rounded-xl border-dashed bg-muted/10">
          <ReceiptIcon className="size-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No shared transactions yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Upload a receipt and use 'Split' to see it here.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-4">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="px-4 text-xs text-muted-foreground">
                    {new Date(txn.date).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{txn.purpose_tag || "Group Expense"}</span>
                      <span className="text-[10px] text-muted-foreground italic">via {txn.source}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {txn.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-4 font-mono font-bold text-sm">
                    ₹{parseFloat(txn.amount).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="pt-4 mt-4 border-t border-dashed">
        <h4 className="text-sm font-semibold mb-3">Itemized Split Status</h4>
        <div className="grid gap-2">
          <div className="p-3 rounded-lg border bg-muted/10 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                CH
              </div>
              <div>
                <p className="font-medium">Shared with 3 people</p>
                <p className="text-[10px] text-muted-foreground">₹450.00 total split value</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-700 bg-orange-50">
              2 Pending
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedLedgersComponent() {
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const { groups, isLoading, createMutation } = useGroups();

  const handleCreate = () => {
    createMutation.mutate(
      { name: newGroupName, description: newGroupDesc || null },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setNewGroupName("");
          setNewGroupDesc("");
        },
      },
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Shared Ledgers</h2>
          <p className="text-muted-foreground text-sm">Track shared expenses with friends and family.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <PlusIcon className="mr-2 size-4" /> New Ledger
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Shared Ledger</DialogTitle>
              <DialogDescription>Create a space to share and track expenses with friends or family.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Ledger Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Trip to Goa, Apartment Expenses"
                  autoComplete="organization"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Description (Optional)</Label>
                <Input
                  id="desc"
                  name="description"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newGroupName || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 gap-y-4">
          {isLoading ? (
            <div className="gap-y-3">
              <div className="h-24 w-full bg-muted animate-pulse rounded-lg" />
              <div className="h-24 w-full bg-muted animate-pulse rounded-lg" />
            </div>
          ) : !groups || groups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <UsersIcon className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No ledgers yet.</p>
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => (
              <Card
                key={group.id}
                className={`hover:border-primary/50 transition-all cursor-pointer group ${selectedGroup?.id === group.id ? "border-primary ring-1 ring-primary/20 shadow-sm" : ""}`}
                onClick={() => setSelectedGroup(group)}
              >
                <CardHeader className="p-4 gap-y-0">
                  <div className="gap-y-1">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-1 italic">
                      {group.description || "Active Shared Ledger"}
                    </CardDescription>
                  </div>
                  <CardAction>
                    <InviteDialog groupId={group.id} groupName={group.name} />
                  </CardAction>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center text-[10px] text-muted-foreground font-medium">
                      <UsersIcon className="mr-1 size-3" />
                      Created {new Date(group.created_at).toLocaleDateString()}
                    </div>
                    <ChevronRightIcon
                      className={`size-4 text-muted-foreground transition-transform ${selectedGroup?.id === group.id ? "translate-x-1 text-primary" : "group-hover:translate-x-1"}`}
                      aria-label="View ledger details"
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedGroup ? (
            <Card className="min-h-[500px] shadow-md border-primary/5">
              <CardHeader className="border-b bg-muted/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {selectedGroup.name}
                      <Badge variant="outline" className="text-[10px] font-normal px-2">
                        ID: {selectedGroup.id.substring(0, 8)}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {selectedGroup.description || "Shared ledger details and activity."}
                    </CardDescription>
                  </div>
                  <MembersDialog groupId={selectedGroup.id} groupName={selectedGroup.name} />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <GroupDetails group={selectedGroup} />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center min-h-[500px] border-dashed bg-muted/5">
              <div className="bg-muted p-4 rounded-full mb-4">
                <UsersIcon className="size-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-medium text-muted-foreground">Select a Ledger</h3>
              <p className="text-sm text-muted-foreground/60 max-w-xs text-center mt-2 px-6">
                Choose a shared ledger from the left sidebar to view group activity, pending splits, and manage your
                circle.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
