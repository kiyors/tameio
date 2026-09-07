import type { P2pRequestWithSender, TransactionWithDetail, TypedProcessedOcr } from "@keiri/types";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@keiri/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@keiri/ui/components/dropdown-menu";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@keiri/ui/components/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ActivityIcon,
  CreditCardIcon,
  FileTextIcon,
  MoreVerticalIcon,
  PlusIcon,
  Share2Icon,
  TargetIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react";
import { Suspense, useCallback, useMemo, useState, useTransition } from "react";

import { ApprovalCard } from "@/components/approval-card";
import { ClientOnly } from "@/components/ClientOnly";
import { Analytics } from "@/components/dashboard/Analytics";
import { BudgetHealthWidget } from "@/components/dashboard/BudgetHealth";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { IncomeExpenseChart } from "@/components/dashboard/IncomeExpenseChart";
import { Overview } from "@/components/dashboard/Overview";
import { DataTable } from "@/components/data-table/DataTable";
import { ProgressTracker } from "@/components/progress-tracker";
import { ReviewTransactionForm } from "@/components/transactions/ReviewTransactionForm";
import { SplitDialog } from "@/components/transactions/SplitDialog";
import { TransactionViewer } from "@/components/transactions/TransactionViewer";
import { useOcrUpload } from "@/hooks/UseOcr";
import { useP2P } from "@/hooks/UseP2p";
import { useLocalSummary, useTransactionSummary, useTransactions } from "@/hooks/UseTransactions";
import { api } from "@/lib/ApiClient";
import type { Column } from "@/lib/DataTableTypes";
import { useGlobalStore } from "@/lib/Store";

export const Route = createFileRoute("/_dashboard/")({
  component: DashboardPage,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return {
      tab: typeof search.tab === "string" ? search.tab : undefined,
    };
  },
});

function DashboardContent() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/_dashboard/" });
  const queryClient = useQueryClient();
  const [_isPending, startTransition] = useTransition();

  const activeTab = searchParams.tab || "overview";

  const handleTabChange = useCallback(
    (value: string) => {
      startTransition(() => {
        const tab = value === "overview" ? undefined : value;
        void navigate({ to: "/", search: { tab } });
      });
    },
    [navigate],
  );

  const { transactions, isLoading: isTxnsLoading, updateMutation, deleteMutation } = useTransactions({ limit: 5 });
  const { summary: serverSummary, isLoading: isSummaryLoading } = useTransactionSummary();
  const { summary: localSummary } = useLocalSummary();
  const summary = localSummary || serverSummary;
  const { p2pRequests, acceptMutation } = useP2P();
  const { setTransactionModalOpen } = useGlobalStore();
  const { isUploading, uploadSteps, processedOcr, uploadFile, setProcessedOcr } = useOcrUpload();

  const [file, setFile] = useState<File | null>(null);
  const [isSavingOcr, setIsSavingOcr] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<{
    id: string;
    amount: string;
  } | null>(null);

  const triggerSplit = useCallback((id: string, amount: string) => {
    setSelectedTxn({ id, amount });
    setSplitDialogOpen(true);
  }, []);

  const txnColumns = useMemo<Column<TransactionWithDetail>[]>(
    () =>
      [
        {
          key: "date",
          label: "Date",
          format: { kind: "date", dateFormat: "short" },
        },
        {
          key: "direction",
          label: "Direction",
          format: {
            kind: "badge",
            colorMap: { IN: "success", OUT: "danger" },
          },
        },
        {
          key: "amount",
          label: "Amount",
          format: { kind: "currency", currency: "INR" },
          align: "right",
        },
        {
          key: "source",
          label: "Description",
        },
        {
          key: "contact_name",
          label: "Contact",
        },
        {
          key: "action" as keyof TransactionWithDetail,
          label: " ",
          sortable: false,
          align: "right",
        },
      ] as Column<TransactionWithDetail>[],
    [],
  );

  const txnCellRenderers = useMemo(
    () => ({
      source: (row: TransactionWithDetail) => (
        <TransactionViewer item={row} onUpdate={(id, data) => updateMutation.mutate({ id, data })} />
      ),
      action: (row: TransactionWithDetail) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-8" aria-label="Open transaction menu">
                <MoreVerticalIcon className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => triggerSplit(row.id, row.amount)}>
              <Share2Icon className="mr-2 size-4" /> Split
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (confirm("Are you sure you want to delete this transaction?")) {
                  deleteMutation.mutate(row.id);
                }
              }}
            >
              <Trash2Icon className="mr-2 size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
    [triggerSplit, updateMutation, deleteMutation],
  );

  const handleUpload = async () => {
    if (!file) return;
    await uploadFile(file);
  };

  const handleConfirmOcr = async (finalData: TypedProcessedOcr) => {
    setIsSavingOcr(true);
    try {
      const result = await api.post<{ contact_created: boolean }>("/api/transactions/from-ocr", finalData);
      setProcessedOcr(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Transaction saved successfully!");
      if (result.contact_created) {
        toast.success("New contact auto-created from receipt!");
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save transaction.");
    } finally {
      setIsSavingOcr(false);
    }
  };

  if (isSummaryLoading && !summary) {
    return <DashboardSkeleton />;
  }

  const totalBalance = summary?.total_balance ? parseFloat(summary.total_balance) : 0;
  const monthlySpend = summary?.monthly_spend ? parseFloat(summary.monthly_spend) : 0;

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
              {localSummary && (
                <Badge variant="outline" className="bg-primary/5 text-[10px] h-4 px-1.5 border-primary/20">
                  WASM Sync Active
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">Welcome back! Here is your financial summary.</p>
          </div>
          <div className="flex items-center gap-x-2">
            <Button onClick={() => setTransactionModalOpen(true)}>
              <PlusIcon className="size-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-y-4">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="gap-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total Balance"
                value={totalBalance}
                icon={<WalletIcon className="size-4" />}
                description="Across all accounts"
              />
              <StatsCard
                title="Monthly Spend"
                value={monthlySpend}
                icon={<CreditCardIcon className="size-4" />}
                trend={
                  summary?.monthly_spend && summary?.monthly_income
                    ? {
                        label: "vs income",
                        value: `${(
                          (parseFloat(summary.monthly_spend) / parseFloat(summary.monthly_income)) *
                          100
                        ).toFixed(0)}%`,
                        inverse: true,
                      }
                    : undefined
                }
              />
              <StatsCard
                title="Pending Approvals"
                value={p2pRequests?.length || 0}
                isCurrency={false}
                icon={<ActivityIcon className="size-4" />}
                action={
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto text-xs"
                    onClick={() => startTransition(() => navigate({ to: "/p2p/pending" }))}
                  >
                    View Requests &rarr;
                  </Button>
                }
              />
              <Card className="hover:shadow-md transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Quick Receive/Upload</CardTitle>
                  <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground">
                    <FileTextIcon className="size-4" />
                  </div>
                </CardHeader>
                <CardContent className="mt-2">
                  <div className="flex gap-2">
                    <Input
                      id="quick-upload"
                      type="file"
                      accept="image/*,application/pdf,text/csv"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="h-9 text-xs bg-muted/20 border-none shadow-none"
                    />
                    <Button onClick={handleUpload} disabled={!file || isUploading} size="sm" className="h-9 px-4">
                      {isUploading ? "…" : "Go"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic px-1">
                    Drag and drop or select a file to scan
                  </p>
                </CardContent>
              </Card>
            </div>

            {isUploading && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <ProgressTracker id="upload-progress" steps={uploadSteps} />
              </div>
            )}

            {processedOcr && (
              <div className="animate-in zoom-in-95 duration-300">
                <ReviewTransactionForm
                  processedOcr={processedOcr}
                  onConfirm={handleConfirmOcr}
                  onCancel={() => setProcessedOcr(null)}
                  isSubmitting={isSavingOcr}
                />
              </div>
            )}

            {/* Pending P2P Actions */}
            {p2pRequests && p2pRequests.length > 0 && !processedOcr && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <h2 className="text-base font-semibold flex items-center gap-2 px-1">
                  <Share2Icon className="size-4 text-primary" /> Pending Approvals
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(p2pRequests as P2pRequestWithSender[]).map((req) => (
                    <ApprovalCard
                      key={req.id}
                      id={req.id}
                      className="max-w-none"
                      title={req.status === "GROUP_INVITE" ? "Group Invitation" : "Transaction Split"}
                      description={
                        req.status === "GROUP_INVITE"
                          ? `Join "${(req.transaction_data as { group_name?: string })?.group_name || "a group"}"`
                          : `${req.sender_name || req.sender_user_id.substring(0, 8)} shared an expense with you.`
                      }
                      icon={req.status === "GROUP_INVITE" ? "users" : "receipt"}
                      metadata={[
                        {
                          key: "Amount",
                          value: `₹${parseFloat(
                            (req.transaction_data as { amount?: string })?.amount || "0",
                          ).toLocaleString()}`,
                        },
                        {
                          key: "From",
                          value: req.sender_name || req.sender_user_id.substring(0, 8),
                        },
                      ]}
                      confirmLabel={req.status === "GROUP_INVITE" ? "Join Group" : "Accept & Merge"}
                      onConfirm={() => acceptMutation.mutate(req.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7 xl:grid-cols-7 mt-4">
              <Card className="col-span-1 lg:col-span-4 max-h-[500px]">
                <CardHeader>
                  <CardTitle>Expense Overview</CardTitle>
                </CardHeader>
                <CardContent className="ps-2">
                  <Overview />
                </CardContent>
              </Card>

              <Card className="col-span-1 lg:col-span-3 flex flex-col max-h-[500px] overflow-hidden">
                <CardHeader className="px-6 py-4 flex flex-row items-center justify-between shrink-0">
                  <CardTitle>Recent Transactions</CardTitle>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => startTransition(() => navigate({ to: "/transactions" }))}
                  >
                    View All
                  </Button>
                </CardHeader>
                <CardContent className="p-0 overflow-auto flex-1">
                  {isTxnsLoading ? (
                    <div className="text-center py-10 text-muted-foreground">Loading transactions...</div>
                  ) : (
                    <DataTable<TransactionWithDetail>
                      id="dashboard-recent-transactions"
                      columns={txnColumns}
                      data={transactions?.slice(0, 5) ?? []}
                      rowIdKey="id"
                      defaultSort={{ by: "date", direction: "desc" }}
                      emptyMessage="No transactions found."
                      cellRenderers={txnCellRenderers}
                      locale="en-IN"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Additional Overview Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7 mt-4">
              <Card className="col-span-1 lg:col-span-3">
                <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Budget Health</CardTitle>
                  <TargetIcon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <BudgetHealthWidget />
                </CardContent>
              </Card>
              <Card className="col-span-1 lg:col-span-4">
                <CardHeader>
                  <CardTitle>Income vs Expense</CardTitle>
                </CardHeader>
                <CardContent>
                  <IncomeExpenseChart />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7 mt-4">
              <Card className="col-span-1 lg:col-span-7">
                <CardHeader>
                  <CardTitle>Spending by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryChart />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="gap-y-4">
            <Analytics />
          </TabsContent>
        </Tabs>
      </div>

      {selectedTxn && (
        <SplitDialog
          open={splitDialogOpen}
          onOpenChange={setSplitDialogOpen}
          transactionId={selectedTxn.id}
          totalAmount={selectedTxn.amount || "0"}
        />
      )}
    </>
  );
}

function StatsCard({
  title,
  value,
  icon,
  description,
  trend,
  isCurrency = true,
  action,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
  trend?: { value: string; label: string; inverse?: boolean };
  isCurrency?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">
          {isCurrency && (value < 0 ? "-₹" : "₹")}
          {isCurrency
            ? Math.abs(value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })
            : value}
        </div>
        <div className="flex items-center justify-between mt-1">
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {trend && (
            <div
              className={`flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                trend.inverse
                  ? parseFloat(trend.value) > 100
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                  : parseFloat(trend.value) > 0
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {trend.value} {trend.label}
            </div>
          )}
          {action && action}
        </div>
      </CardContent>
    </Card>
  );
}
function DashboardPage() {
  return (
    <ClientOnly fallback={<DashboardSkeleton />}>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </ClientOnly>
  );
}
