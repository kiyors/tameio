import { toast } from "@keiri/ui/components/goey-toaster";

/**
 * Validates a PDF file's page count using Mozilla's pdfjs-dist.
 * Returns true if valid, false if invalid (or if validation should be skipped).
 * @param file The PDF file to validate
 * @param maxPages Maximum allowed pages
 */
export async function validatePdfPageCount(file: File, maxPages: number = 5): Promise<boolean> {
  if (file.type !== "application/pdf") return true;

  try {
    const pdfjsLib = await import("pdfjs-dist");

    // Configure worker for Vite
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

    const pdfData = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const numPages = doc.numPages;

    if (numPages > maxPages) {
      toast.error(`PDF too long (${numPages} pages). Max ${maxPages} pages allowed for OCR.`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("PDF validation skipped:", err);
    // Return true to avoid blocking users if parsing fails
    return true;
  }
}
