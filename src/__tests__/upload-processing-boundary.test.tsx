// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { upload, ingest, toast, openBatch, updateBatch } = vi.hoisted(() => ({
  upload: vi.fn(),
  ingest: vi.fn(),
  toast: vi.fn(),
  openBatch: vi.fn(),
  updateBatch: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: "fictional-survivor" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload }) } },
}));
vi.mock("@/lib/evidence-ingest.functions", () => ({
  ingestEvidenceBatch: ingest,
  confirmNearDuplicate: vi.fn(),
  rejectNearDuplicate: vi.fn(),
}));
vi.mock("@/lib/intake-batches.functions", () => ({
  openIntakeBatch: openBatch,
  updateIntakeBatch: updateBatch,
}));
vi.mock("@/lib/intake-queue", () => ({
  isQueueSupported: () => false,
  listQueue: vi.fn(),
  onBackOnline: () => () => {},
  removeQueued: vi.fn(),
  enqueueFiles: vi.fn(),
}));
vi.mock("@/lib/exif", () => ({
  readExif: async () => ({ hasMetadata: false }),
  stripExif: async (f: File) => f,
}));

import { BatchDropzone } from "@/components/evidence/BatchDropzone";
let host: HTMLDivElement;
let root: Root;
let externalFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  externalFetch = vi.fn().mockRejectedValue(new Error("Unexpected external request"));
  vi.stubGlobal("fetch", externalFetch);
  vi.stubEnv("PATTERNPROOF_AI_POLICY_APPROVED", "true");
  upload.mockReset().mockResolvedValue({ error: null });
  openBatch.mockReset().mockResolvedValue({ batchId: "fictional-batch" });
  updateBatch.mockReset().mockResolvedValue({ ok: true });
  toast.mockClear();
  ingest.mockReset().mockImplementation(async ({ data }) => ({
    batch_id: "fictional-batch",
    preserved_at: "2026-10-10T00:00:00Z",
    items: data.files.map((f: { storage_key: string; original_filename: string }) => ({
      ...f,
      status: "preserved",
      evidence_id: "fictional-file",
      sha256: "abcdef",
      bytes: 4,
    })),
  }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function choose(mime: string, filename: string) {
  await act(async () => root.render(<BatchDropzone />));
  const input = host.querySelector<HTMLInputElement>("input[multiple]")!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["data"], filename, { type: mime })],
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
async function click(label: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.includes(label),
  )!;
  expect(button).toBeDefined();
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
}

describe("preservation is separate from outside processing", () => {
  it.each([
    ["image/png", "photo.png"],
    ["audio/wav", "clip.wav"],
    ["application/pdf", "record.pdf"],
  ])(
    "preserves %s without sending it for processing even if host policy is approved",
    async (mime, name) => {
      await choose(mime, name);
      await click("Preserve 1 file");
      expect(upload).toHaveBeenCalledTimes(1);
      expect(ingest).toHaveBeenCalledTimes(1);
      expect(externalFetch).not.toHaveBeenCalled();
      expect(host.textContent).toContain("Preservation receipt");
      expect(ingest.mock.calls[0][0].data.files[0].date_precision).toBe("unknown");
    },
  );
  it("lets an interrupted upload retry the same storage key", async () => {
    upload.mockResolvedValueOnce({ error: { statusCode: "503" } });
    await choose("audio/wav", "clip.wav");
    await click("Preserve 1 file");
    expect(ingest).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("Preservation receipt");
    await click("Retry files");
    await click("Preserve 1 file");
    expect(upload.mock.calls[1][0]).toBe(upload.mock.calls[0][0]);
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(externalFetch).not.toHaveBeenCalled();
  });
  it("retries preservation without uploading a second copy", async () => {
    ingest.mockRejectedValueOnce(new Error("Fictional interruption"));
    await choose("audio/wav", "clip.wav");
    await click("Preserve 1 file");
    await click("Retry files");
    await click("Preserve 1 file");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(ingest.mock.calls[1][0].data.files[0].storage_key).toBe(
      ingest.mock.calls[0][0].data.files[0].storage_key,
    );
  });
  it("keeps a file retryable when the receipt omits it", async () => {
    ingest.mockResolvedValueOnce({
      batch_id: "fictional-batch",
      preserved_at: "2026-10-10T00:00:00Z",
      items: [],
    });
    await choose("audio/wav", "clip.wav");
    await click("Preserve 1 file");
    expect(host.textContent).toContain("Save not confirmed");
    await click("Retry files");
    await click("Preserve 1 file");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledTimes(2);
  });
});
