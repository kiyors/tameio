import type { BankStatementRow, TypedProcessedOcr } from "@keiri/types";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@keiri/ui/components/card";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Progress } from "@keiri/ui/components/Progress";
import { matchStatementBatchWasm } from "@keiri/wasm";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  FileTextIcon,
  HistoryIcon,
  UploadIcon,
} from "lucide-react";
import * as React from "react";

import { ReviewTransactionForm } from "@/components/transactions/ReviewTransactionForm";
import { useOcrUpload } from "@/hooks/UseOcr";
import { useReconciliation, useRowMatches } from "@/hooks/UseReconciliation";
import { useTransactions } from "@/hooks/UseTransactions";
import { api } from "@/lib/ApiClient";

export const Route = createFileRoute("/_dashboard/reconciliation/")({
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const { unmatchedRows, isLoading: isRowsLoading, confirmMatchMutation } = useReconciliation();
  const { transactions } = useTransactions({ limit: 1000 });
  const { isUploading, uploadSteps, processedOcr, uploadFile, setProcessedOcr } = useOcrUpload();
  const [isSavingOcr, setIsSavingOcr] = React.useState(false);
  const [isAutoMatching, setIsAutoMatching] = React.useState(false);

  const handleUpload = async () => {
    if (!file) return;
    await uploadFile(file);
  };

  const handleConfirmOcr = async (finalData: TypedProcessedOcr) => {
    setIsSavingOcr(true);
    try {
      await api.post("/api/transactions/from-ocr", finalData);
      setProcessedOcr(null);
      void queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Statement imported! Matching will run in the background.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save transactions.");
    } finally {
      setIsSavingOcr(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!unmatchedRows || !transactions) return;
    setIsAutoMatching(true);
    try {
      const results = matchStatementBatchWasm(unmatchedRows, transactions);
      if (results.length === 0) {
        toast.info("No high-confidence matches found.");
        return;
      }

      let count = 0;
      for (const res of results) {
        await confirmMatchMutation.mutateAsync({
          rowId: res.row_id,
          transactionId: res.transaction_id,
          confidence: res.confidence,
        });
        count++;
      }
      toast.success(`Successfully auto-matched ${count} transactions!`);
    } catch (error) {
      console.error(error);
      toast.error("Auto-match failed.");
    } finally {
      setIsAutoMatching(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground text-sm">Match your bank statements with recorded transactions.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoMatch}
            disabled={isAutoMatching || !unmatchedRows?.length || !transactions?.length}
          >
            {isAutoMatching ? "Matching…" : "Run Auto-Match"}
          </Button>
          <Button variant="outline" size="sm">
            <HistoryIcon className="mr-2 size-4" /> View History
          </Button>
        </div>
      </div>

      {processedOcr ? (
        <div className="animate-in zoom-in-95 duration-300">
          <ReviewTransactionForm
            processedOcr={processedOcr}
            onConfirm={handleConfirmOcr}
            onCancel={() => setProcessedOcr(null)}
            isSubmitting={isSavingOcr}
          />
        </div>
      ) : (
        <>
          <Card className="border-dashed bg-muted/5">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                <UploadIcon className="size-8" />
              </div>
              <div className="gap-y-1">
                <h3 className="text-lg font-semibold">Upload Bank Statement</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Drop your CSV or PDF statement here. We'll automatically identify matches and highlight discrepancies.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Input
                  type="file"
                  className="hidden"
                  id="statement-upload"
                  accept="application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Label
                  htmlFor="statement-upload"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer"
                >
                  {file ? file.name : "Select File"}
                </Label>
                {file && (
                  <Button onClick={handleUpload} disabled={isUploading} className="w-full">
                    {isUploading ? "Processing..." : "Start Scanning"}
                  </Button>
                )}
              </div>
              {isUploading && (
                <div className="w-full max-w-xs mt-4">
                  <Progress value={66} className="h-2" />
                  <p className="text-[10px] text-muted-foreground mt-2 italic px-1">
                    {uploadSteps[uploadSteps.length - 1]?.label || "Processing..."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="gap-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-green-50/50 dark:bg-green-500/5 border-green-100 dark:border-green-500/20">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-green-700 dark:text-green-400">
                    Matched
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-[10px] text-muted-foreground mt-1">High confidence auto-links</p>
                </CardContent>
              </Card>
              <Card className="bg-orange-50/50 dark:bg-orange-500/5 border-orange-100 dark:border-orange-200/20">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-orange-700 dark:text-orange-400">
                    Needs Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">{unmatchedRows?.length || 0}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Multiple potential matches</p>
                </CardContent>
              </Card>
              <Card className="bg-rose-50/50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-400">
                    Missing
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-[10px] text-muted-foreground mt-1">No transaction found in Keiri</p>
                </CardContent>
              </Card>
            </div>

            <div className="gap-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircleIcon className="size-5 text-orange-500" /> Pending Matches
              </h2>

              {isRowsLoading ? (
                <div className="py-20 text-center text-muted-foreground">Loading pending matches...</div>
              ) : unmatchedRows && unmatchedRows.length > 0 ? (
                <div className="grid gap-4">
                  {unmatchedRows.map((row) => (
                    <RowMatchItem
                      key={row.id}
                      row={row}
                      onConfirm={(txId) =>
                        confirmMatchMutation.mutate({
                          rowId: row.id,
                          transactionId: txId,
                          confidence: 100,
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-xl bg-muted/5 border-dashed">
                  <HistoryIcon className="size-10 text-muted-foreground/40 mb-3" />
                  <h3 className="text-sm font-semibold">No pending matches found</h3>
                  <p className="text-xs text-muted-foreground max-w-[250px] mt-1">
                    Upload a statement above to start matching your bank transactions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RowMatchItem({ row, onConfirm }: { row: BankStatementRow; onConfirm: (txId: string) => void }) {
  const { data: matchData } = useRowMatches(row.id);
  const matches = matchData?.matches || [];

  const rowAmount = row.debit ? parseFloat(row.debit) : row.credit ? parseFloat(row.credit) : 0;

  return (
    <Card className="overflow-hidden border-l-2 border-l-primary/30">
      <div className="flex flex-col md:flex-row">
        {/* Bank Side */}
        <div className="flex-1 p-4 bg-muted/10">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
            <FileTextIcon className="size-3" /> Bank Statement
          </div>
          <p className="text-sm font-medium truncate">{row.description}</p>
          <div className="flex justify-between items-end mt-2">
            <span className="text-[11px] text-muted-foreground">{new Date(row.date).toLocaleDateString()}</span>
            <span className="font-mono font-bold">₹{rowAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Transition */}
        <div className="flex items-center justify-center px-4 bg-background">
          <ArrowRightIcon className="size-5 text-muted-foreground/30 rotate-90 md:rotate-0" />
        </div>

        {/* App Side */}
        <div className={`flex-1 p-4 ${matches.length === 0 ? "bg-rose-50/30 dark:bg-rose-500/5" : "bg-primary/5"}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              <CheckCircle2Icon className="size-3" /> Potential Matches
            </div>
            {matches[0] && (
              <Badge variant="outline" className="h-4 text-[9px] bg-green-50 text-green-700 border-green-200">
                {matches[0][1]}% Match
              </Badge>
            )}
          </div>

          {matches.length === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <p className="text-sm text-rose-600 font-medium italic">No matching transaction found</p>
              <Button variant="link" className="h-auto p-0 text-xs justify-start mt-1">
                Create missing transaction?
              </Button>
            </div>
          ) : (
            <div className="gap-y-3">
              {matches.slice(0, 2).map(([tx, confidence]) => (
                <div key={tx.id} className="flex items-center justify-between gap-4 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.notes || "Unnamed Transaction"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Recorded {new Date(tx.date).toLocaleDateString()} • {confidence}% confidence
                    </p>
                  </div>
                  <div className="font-mono text-xs font-bold whitespace-nowrap">
                    ₹{parseFloat(tx.amount).toLocaleString()}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0 rounded-full bg-green-600/10 text-green-600 hover:bg-green-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    onClick={() => onConfirm(tx.id)}
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
