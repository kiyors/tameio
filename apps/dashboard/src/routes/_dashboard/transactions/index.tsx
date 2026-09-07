import type { OcrTransactionResponse, TransactionWithDetail, TypedProcessedOcr } from "@keiri/types";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@keiri/ui/components/card";
import { Checkbox } from "@keiri/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@keiri/ui/components/dropdown-menu";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@keiri/ui/components/select";
import { Skeleton } from "@keiri/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@keiri/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@keiri/ui/components/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef, ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
  DownloadIcon,
  MoreVerticalIcon,
  PencilIcon,
  ScaleIcon,
  SearchIcon,
  Share2Icon,
  UploadIcon,
} from "lucide-react";
import * as React from "react";

import { ProgressTracker } from "@/components/progress-tracker";
import { ReviewTransactionForm } from "@/components/transactions/ReviewTransactionForm";
import { SplitDialog } from "@/components/transactions/SplitDialog";
import { TransactionViewer } from "@/components/transactions/TransactionViewer";
import { useOcrUpload } from "@/hooks/UseOcr";
import { useTransactionSummary, useTransactions } from "@/hooks/UseTransactions";
import { api } from "@/lib/ApiClient";

export const Route = createFileRoute("/_dashboard/transactions/")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const queryClient = useQueryClient();

  // Table State
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 15,
  });
  const [activeTab, setActiveTab] = React.useState("all");

  const {
    transactions: rawTransactions,
    totalCount,
    isLoading: isTxnsLoading,
    updateMutation,
    deleteMutation,
  } = useTransactions({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });

  const { summary, isLoading: isSummaryLoading } = useTransactionSummary();

  // Selected Txn for Split Action
  const [splitDialogOpen, setSplitDialogOpen] = React.useState(false);
  const [selectedTxn, setSelectedTxn] = React.useState<{
    id: string;
    amount: string;
  } | null>(null);
  const [editingTxnId, setEditingTxnId] = React.useState<string | null>(null);

  // Upload State
  const { isUploading, uploadSteps, processedOcr, uploadFile, setProcessedOcr } = useOcrUpload();
  const [isSavingOcr, setIsSavingOcr] = React.useState(false);

  const data = React.useMemo<TransactionWithDetail[]>(() => {
    if (!rawTransactions) return [];
    return rawTransactions;
  }, [rawTransactions]);

  // Derived Metrics from Summary
  const totalIncome = summary?.monthly_income ? parseFloat(summary.monthly_income) : 0;
  const totalExpense = summary?.monthly_spend ? parseFloat(summary.monthly_spend) : 0;
  const netBalance = summary?.total_balance ? parseFloat(summary.total_balance) : 0;

  const triggerSplit = React.useCallback((id: string, amount: string) => {
    setSelectedTxn({ id, amount });
    setSplitDialogOpen(true);
  }, []);

  const handleUpload = async (file: File) => {
    await uploadFile(file);
  };

  const handleConfirmOcr = async (finalData: TypedProcessedOcr) => {
    setIsSavingOcr(true);
    try {
      const result = await api.post<OcrTransactionResponse>("/api/transactions/from-ocr", finalData);
      setProcessedOcr(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Transaction saved!");
      if (result.contact_created) {
        toast.success("New contact auto-created!");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save transaction.");
    } finally {
      setIsSavingOcr(false);
    }
  };

  const columns = React.useMemo<ColumnDef<TransactionWithDetail>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => {
          return (
            <span className="text-muted-foreground whitespace-nowrap">
              {new Date(row.original.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "source",
        header: "Description",
        cell: ({ row }) => {
          return (
            <TransactionViewer
              item={row.original}
              onUpdate={(id, updateData) => updateMutation.mutate({ id, data: updateData })}
              open={editingTxnId === row.original.id}
              onOpenChange={(open) => !open && setEditingTxnId(null)}
            />
          );
        },
      },
      {
        accessorKey: "wallet",
        header: "Wallet",
        cell: ({ row }) => (
          <span className="text-xs font-medium">
            {row.original.direction === "IN"
              ? row.original.destination_wallet_name || "—"
              : row.original.source_wallet_name || "—"}
          </span>
        ),
      },
      {
        accessorKey: "contact",
        header: "Contact",
        cell: ({ row }) => <span className="text-xs">{row.original.contact_name || "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status || "COMPLETED";
          return (
            <Badge variant="outline" className="text-[10px] capitalize">
              {status.toLowerCase()}
            </Badge>
          );
        },
      },
      {
        accessorKey: "direction",
        header: "Direction",
        cell: ({ row }) => {
          const isIn = row.original.direction === "IN";
          return (
            <Badge
              variant={isIn ? "default" : "destructive"}
              className={
                isIn
                  ? "bg-green-100/50 text-green-700 hover:bg-green-200/50 border-green-200"
                  : "bg-red-100/50 text-red-700 hover:bg-red-200/50 border-red-200"
              }
            >
              {isIn ? "Income" : "Expense"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
          const isIn = row.original.direction === "IN";
          return (
            <div
              className={`font-mono font-medium text-right tabular-nums ${isIn ? "text-green-600 dark:text-green-500" : ""}`}
            >
              ₹
              {parseFloat(row.original.amount).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="flex size-8 text-muted-foreground data-[state=open]:bg-muted ml-auto"
                  size="icon"
                >
                  <MoreVerticalIcon className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setEditingTxnId(row.original.id)}>
                <PencilIcon className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerSplit(row.original.id, row.original.amount)}>
                <Share2Icon className="mr-2 size-4" /> Split
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this transaction?")) {
                    deleteMutation.mutate(row.original.id);
                  }
                }}
              >
                Delete row
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [triggerSplit, updateMutation, deleteMutation, editingTxnId],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    enableRowSelection: true,
    manualPagination: true,
    rowCount: Number(totalCount),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const handleExportCSV = () => {
    const rowsExport = table.getFilteredRowModel().rows.map((row) => row.original);
    if (!rowsExport.length) return;

    const headers = ["Date", "Direction", "Amount", "Source", "ID"];
    const rows = rowsExport.map((txn) => [txn.date, txn.direction, txn.amount, txn.source, txn.id]);

    const csvContent = `data:text/csv;charset=utf-8,${[headers.join(","), ...rows.map((e) => e.join(","))].join("\n")}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transactions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {/* Quick Upload Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              disabled={data.length === 0}
              aria-label="Export transactions as CSV"
            >
              <DownloadIcon className="size-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card className="border-dashed bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer relative group">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <UploadIcon className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Quick Upload</p>
                <p className="text-xs text-muted-foreground">
                  Drop receipts, PDFs, CSVs or Excel files here to auto-import
                </p>
              </div>
              <input
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Quick upload receipt"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    // Process them sequentially for now, or we could map them to a queue
                    Array.from(files).forEach((file) => {
                      void handleUpload(file);
                    });
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        {isUploading && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <ProgressTracker id="txn-upload-progress" steps={uploadSteps} />
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10 border-green-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-y-0">
              <CardTitle className="text-sm text-green-800 dark:text-green-300">Total Income</CardTitle>
              <ArrowUpIcon className="size-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              {isSummaryLoading && !summary ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-bold tracking-tight text-green-700 dark:text-green-400">
                  ₹
                  {totalIncome.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100/30 dark:from-red-950/20 dark:to-red-900/10 border-red-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-y-0">
              <CardTitle className="text-sm text-red-800 dark:text-red-300">Total Expense</CardTitle>
              <ArrowDownIcon className="size-4 text-red-600 dark:text-red-400" />
            </CardHeader>
            <CardContent>
              {isSummaryLoading && !summary ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-bold tracking-tight text-red-700 dark:text-red-400">
                  ₹
                  {totalExpense.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-y-0">
              <CardTitle className="text-sm text-blue-800 dark:text-blue-300">Net Balance</CardTitle>
              <ScaleIcon className="size-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              {isSummaryLoading && !summary ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-bold tracking-tight text-blue-700 dark:text-blue-400">
                  {netBalance < 0 ? "-" : ""}₹
                  {Math.abs(netBalance).toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table Area */}
        <div className="flex flex-col flex-1 shadow-sm border rounded-xl bg-card overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val || "all")}
            className="w-full flex-col justify-start"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b bg-muted/40 gap-4">
              <TabsList className="h-9 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
                <TabsTrigger value="all" className="rounded-md px-4">
                  All
                </TabsTrigger>
                <TabsTrigger value="income" className="rounded-md px-4 text-green-600 dark:text-green-400">
                  Income
                </TabsTrigger>
                <TabsTrigger value="expense" className="rounded-md px-4 text-red-600 dark:text-red-400">
                  Expense
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Label htmlFor="search-transactions" className="sr-only">
                    Search Transactions
                  </Label>
                  <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="search-transactions"
                    name="search"
                    placeholder="Search descriptions..."
                    value={(table.getColumn("source")?.getFilterValue() as string) ?? ""}
                    onChange={(event) => table.getColumn("source")?.setFilterValue(event.target.value)}
                    className="pl-9 bg-background h-9 border-muted-foreground/20"
                    autoComplete="off"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="sm" className="h-9 ml-auto hidden md:flex">
                        <Columns3Icon className="mr-2 size-4" />
                        Columns
                        <ChevronDownIcon className="ml-2 size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-48">
                    {table.getAllColumns().reduce<React.ReactNode[]>((acc, column) => {
                      if (typeof column.accessorFn !== "undefined" && column.getCanHide()) {
                        acc.push(
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            className="capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                          >
                            {column.id.replace("_", " ")}
                          </DropdownMenuCheckboxItem>,
                        );
                      }
                      return acc;
                    }, [])}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="relative flex flex-col gap-4 overflow-auto min-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background shadow-xs">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground h-10 px-4"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {isTxnsLoading && !rawTransactions ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder, list does not reorder
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell colSpan={columns.length} className="p-0">
                          <Skeleton className="h-12 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3 px-4">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-48 text-center text-muted-foreground">
                        {rawTransactions ? "No transactions found." : "Loading..."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-muted/20 gap-4">
              <div className="text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
                selected.
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => table.setPageSize(Number(value || 15))}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={table.getState().pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 15, 20, 30, 40, 50].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-center text-sm font-medium w-[100px]">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    className="hidden size-8 p-0 lg:flex"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeftIcon className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-8 p-0"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-8 p-0"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRightIcon className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden size-8 p-0 lg:flex"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Tabs>
        </div>
      </div>

      {selectedTxn && (
        <SplitDialog
          open={splitDialogOpen}
          onOpenChange={setSplitDialogOpen}
          transactionId={selectedTxn.id}
          totalAmount={selectedTxn.amount}
        />
      )}
    </>
  );
}
