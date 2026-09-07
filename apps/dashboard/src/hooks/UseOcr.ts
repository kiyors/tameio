import type { OcrJob, OcrJobResponse, ProcessImageOcrRequest, TypedProcessedOcr } from "@keiri/types";
import { toast } from "@keiri/ui/components/goey-toaster";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/ApiClient";
import { validatePdfPageCount } from "@/lib/PdfUtils";

export type UploadStepStatus = "pending" | "in-progress" | "completed" | "failed";

export interface UploadStep {
  id: string;
  label: string;
  status: UploadStepStatus;
  description?: string;
}

export function useOcrUpload() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>([]);
  const [processedOcr, setProcessedOcr] = useState<TypedProcessedOcr | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const waitForJobCompletion = useCallback(async (jobId: string): Promise<TypedProcessedOcr> => {
    return new Promise((resolve, reject) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      const eventSource = new EventSource("/api/ocr/stream");
      eventSourceRef.current = eventSource;

      const cleanup = () => {
        eventSource.close();
        if (eventSourceRef.current === eventSource) {
          eventSourceRef.current = null;
        }
      };

      eventSource.onmessage = async (event) => {
        try {
          const update = JSON.parse(event.data);
          if (update.job_id !== jobId) return;

          if (update.status === "PROCESSING") {
            setUploadSteps((prev) =>
              prev.map((s) =>
                s.id === "2"
                  ? { ...s, status: "completed" }
                  : s.id === "3"
                    ? { ...s, status: "in-progress", description: "Thinking hard..." }
                    : s,
              ),
            );
          }

          if (update.status === "COMPLETED" || update.status === "CONTACT_COLLISION") {
            cleanup();
            // Fetch final data
            const job = await api.get<OcrJob>(`/api/ocr/status/${jobId}`);
            if (job.processed_data) {
              resolve(job.processed_data as unknown as TypedProcessedOcr);
            } else {
              reject(new Error("Job completed but no data found"));
            }
          }

          if (update.status === "FAILED" || update.status === "DEAD_LETTER") {
            cleanup();
            reject(new Error("OCR processing failed"));
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      eventSource.onerror = (_err) => {
        cleanup();
        reject(new Error("SSE connection failed"));
      };

      // Set a timeout just in case
      setTimeout(() => {
        cleanup();
        reject(new Error("OCR processing timed out"));
      }, 300000); // 5 minutes
    });
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      // PDF Page Count Validation (Client-side WASM)
      const isValid = await validatePdfPageCount(file);
      if (!isValid) return null;

      setIsUploading(true);
      setProcessedOcr(null);

      const steps: UploadStep[] = [
        { id: "1", label: "Uploading file...", status: "in-progress" },
        { id: "2", label: "Queuing document...", status: "pending" },
        { id: "3", label: "Extracting transaction data...", status: "pending" },
      ];
      setUploadSteps(steps);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errorBody = await uploadRes.text().catch(() => "Upload failed");
          throw new Error(errorBody || "Upload failed");
        }
        const { key } = await uploadRes.json();

        setUploadSteps((prev) =>
          prev.map((s) =>
            s.id === "1" ? { ...s, status: "completed" } : s.id === "2" ? { ...s, status: "in-progress" } : s,
          ),
        );

        const { job_id } = await api.post<OcrJobResponse, ProcessImageOcrRequest>("/api/ocr/process", {
          key,
          batch_id: undefined,
        });

        setUploadSteps((prev) =>
          prev.map((s) =>
            s.id === "2" ? { ...s, status: "completed" } : s.id === "3" ? { ...s, status: "in-progress" } : s,
          ),
        );

        const result = await waitForJobCompletion(job_id);

        void queryClient.invalidateQueries({ queryKey: ["wallets"] });
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });

        setUploadSteps((prev) => prev.map((s) => (s.id === "3" ? { ...s, status: "completed" } : s)));

        setProcessedOcr(result);
        toast.success("Data extracted successfully! Please review.");
        setTimeout(() => setIsUploading(false), 1000);
        return result;
      } catch (error) {
        console.error(error);
        setUploadSteps((prev) => prev.map((s) => (s.status === "in-progress" ? { ...s, status: "failed" } : s)));
        toast.error(error instanceof Error ? error.message : "Upload or processing failed.");
        setTimeout(() => setIsUploading(false), 2000);
        return null;
      }
    },
    [queryClient, waitForJobCompletion],
  );

  const reset = useCallback(() => {
    setIsUploading(false);
    setUploadSteps([]);
    setProcessedOcr(null);
  }, []);

  return {
    isUploading,
    uploadSteps,
    processedOcr,
    uploadFile,
    setProcessedOcr,
    reset,
  };
}
