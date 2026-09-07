import type { TypedProcessedOcr } from "@keiri/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@keiri/ui/components/dialog";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { useQueryClient } from "@tanstack/react-query";
import { CameraIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import * as React from "react";

import { ProgressTracker } from "@/components/progress-tracker";
import { useOcrUpload } from "@/hooks/UseOcr";
import { api } from "@/lib/ApiClient";

import { ReviewTransactionForm } from "./ReviewTransactionForm";

export function GlobalOCRDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { isUploading, uploadSteps, processedOcr, uploadFile, reset } = useOcrUpload();
  const [isSaving, setIsSaving] = React.useState(false);
  const queryClient = useQueryClient();

  const handleUpload = async (selectedFile: File) => {
    await uploadFile(selectedFile);
  };

  const handleConfirm = async (finalData: TypedProcessedOcr) => {
    setIsSaving(true);
    try {
      await api.post("/api/transactions/from-ocr", finalData);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Transaction saved!");
      onOpenChange(false);
      reset();
    } catch {
      toast.error("Failed to save transaction");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isUploading && !isSaving) {
          onOpenChange(val);
          if (!val) {
            reset();
          }
        }
      }}
    >
      <DialogContent className={processedOcr ? "sm:max-w-3xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-primary animate-pulse" />
            Scan Receipt
          </DialogTitle>
          <DialogDescription>
            Upload a receipt image to automatically extract transaction details using AI.
          </DialogDescription>
        </DialogHeader>

        {!processedOcr && !isUploading && (
          /* oxlint-disable jsx-a11y/label-has-associated-control, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
          <label
            className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-12 transition-colors hover:border-primary/50 group cursor-pointer relative"
            aria-label="Upload receipt image"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input[type=file]") as HTMLInputElement;
                if (input) input.click();
              }
            }}
            tabIndex={0}
          >
            <Input
              type="file"
              accept="image/*"
              aria-label="Upload receipt image file"
              title="Upload receipt image file"
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
              tabIndex={-1}
            />
            <div className="bg-primary/5 size-16 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CameraIcon className="size-8 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Click or Drag to Upload</p>
            <p className="text-sm text-muted-foreground mt-1 text-center">Supports JPG, PNG and PDF receipts</p>
          </label>
        )}

        {isUploading && (
          <div className="py-8 gap-y-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2Icon className="size-10 text-primary animate-spin mb-4" />
              <p className="font-medium">Magically extracting data...</p>
            </div>
            <ProgressTracker id="global-ocr-progress" steps={uploadSteps} />
          </div>
        )}

        {processedOcr && (
          <div className="mt-4">
            <ReviewTransactionForm
              processedOcr={processedOcr}
              onConfirm={handleConfirm}
              onCancel={() => onOpenChange(false)}
              isSubmitting={isSaving}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
