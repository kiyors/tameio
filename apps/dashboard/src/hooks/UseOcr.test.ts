/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { toast } from "@keiri/ui/components/goey-toaster";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/ApiClient";

import { useOcrUpload } from "./UseOcr";

// Mock dependencies
vi.mock("@keiri/ui/components/goey-toaster", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/lib/ApiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock pdfjs-dist
vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));

// Shape of the SSE payload the shared MockEventSource fires; declared here
// Shape of the SSE payload the shared MockEventSource fires; declared here
// so tests can populate `globalThis.__MOCK_SSE_PAYLOAD__` without `as any`.
declare global {
  // eslint-disable-next-line no-var
  var __MOCK_SSE_PAYLOAD__: Record<string, unknown> | undefined;
}

class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  close = vi.fn();

  constructor() {
    setTimeout(() => {
      if (this.onmessage && globalThis.__MOCK_SSE_PAYLOAD__) {
        this.onmessage({ data: JSON.stringify(globalThis.__MOCK_SSE_PAYLOAD__) });
      }
    }, 0);
  }
}
globalThis.EventSource = MockEventSource as any;

// Helper to create a mock File
const createMockFile = (name: string, type: string) => {
  const file = new File([""], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new ArrayBuffer(0),
  });
  return file;
};

describe("useOcrUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Global fetch mock
    global.fetch = vi.fn();
    // The shared SSE stub in setup.ts checks globalThis.__MOCK_SSE_PAYLOAD__
    // before falling back to its default; reset it between tests so payloads
    // don't bleed across cases.
    globalThis.__MOCK_SSE_PAYLOAD__ = undefined;
  });

  it("should block PDF upload if it has more than 5 pages", async () => {
    const mockFile = createMockFile("large.pdf", "application/pdf");

    const pdfjsLib = await import("pdfjs-dist");
    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 10 }),
    } as any);

    const { result } = renderHook(() => useOcrUpload());

    await act(async () => {
      const uploadResult = await result.current.uploadFile(mockFile);
      expect(uploadResult).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("PDF too long (10 pages)"));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should allow PDF upload if it has 5 or fewer pages", async () => {
    const mockFile = createMockFile("small.pdf", "application/pdf");

    const pdfjsLib = await import("pdfjs-dist");
    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 3 }),
    } as any);

    // Mock successful upload and process
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ key: "file-key" }),
    } as Response);
    vi.mocked(api.post).mockResolvedValue({ job_id: "job-123" });
    vi.mocked(api.get).mockResolvedValue({
      status: "COMPLETED",
      processed_data: { doc_type: "GPAY", data: {} },
    });
    // The SSE stub fires this payload when waitForJobCompletion subscribes;
    // its job_id must match the one api.post just returned or the hook ignores
    // the message and times out.
    globalThis.__MOCK_SSE_PAYLOAD__ = {
      job_id: "job-123",
      status: "COMPLETED",
      processed_data: { doc_type: "GPAY", data: {} },
    };

    const { result } = renderHook(() => useOcrUpload());

    await act(async () => {
      const uploadResult = await result.current.uploadFile(mockFile);
      expect(uploadResult).not.toBeNull();
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith("/api/ocr/process", { key: "file-key" });
  });

  it("should allow image upload without page count check", async () => {
    const mockFile = createMockFile("receipt.png", "image/png");

    // Mock successful upload and process
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ key: "file-key" }),
    } as Response);
    vi.mocked(api.post).mockResolvedValue({ job_id: "job-123" });
    vi.mocked(api.get).mockResolvedValue({
      status: "COMPLETED",
      processed_data: { doc_type: "GPAY", data: {} },
    });
    globalThis.__MOCK_SSE_PAYLOAD__ = {
      job_id: "job-123",
      status: "COMPLETED",
      processed_data: { doc_type: "GPAY", data: {} },
    };

    const { result } = renderHook(() => useOcrUpload());

    await act(async () => {
      const uploadResult = await result.current.uploadFile(mockFile);
      expect(uploadResult).not.toBeNull();
    });

    expect(global.fetch).toHaveBeenCalled();
  });
});
