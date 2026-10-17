// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  request: vi.fn(),
  open: vi.fn(),
  permissions: vi.fn(),
  setPermission: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/jev-proposals.functions", () => ({ suggestRequestMatches: api.request }));
vi.mock("@/lib/attorney-portal.functions", () => ({ getSignedEvidenceUrl: api.open }));
vi.mock("@/lib/jev-consent.functions", () => ({
  getMyJevSharePermissions: api.permissions,
  setMyJevSharePermission: api.setPermission,
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));
import { JevRequestNudge } from "@/components/attorney/JevRequestNudge";
import { JevSharePermissions } from "@/components/settings/JevSharePermissions";
let host: HTMLDivElement, root: Root;
const response = (match = true) => ({
  model: "jev-1.13.0",
  instructionVersion: "request-match-v2",
  searchedCount: 100,
  checkedCount: 12,
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  suggestion: match
    ? {
        evidenceId: "file",
        title: "Fictional bill",
        excerpt: "Electric utility payment for August",
        sourceField: "extracted_text",
        excerptStart: 5000,
        sourceRevision: "abc",
      }
    : null,
});
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (const fn of Object.values(api)) fn.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function render(node: React.ReactNode) {
  await act(async () => root.render(node));
}
function button(label: string) {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
  expect(found, label).toBeDefined();
  return found!;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
describe("attorney request-match review", () => {
  it("never calls AI on render or after declining the processing notice", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await render(<JevRequestNudge clientId="client" title="Utility bill" details="" />);
    await click("Check already-shared files");
    expect(api.request).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("survivor must separately authorize"),
    );
  });
  it("shows source excerpts, coverage and a separate scope-checked open action", async () => {
    api.request.mockResolvedValue(response());
    api.open.mockResolvedValue({ url: "https://example.invalid/file" });
    const opened = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    await render(<JevRequestNudge clientId="client" title="Utility bill" details="" />);
    await click("Check already-shared files");
    expect(host.textContent).toContain("Searched 100 eligible shared files locally");
    expect(host.textContent).toContain("12 candidates");
    expect(host.textContent).toContain("Electric utility payment for August");
    expect(host.textContent).toContain("does not send, resolve");
    expect(api.open).not.toHaveBeenCalled();
    await click("Open shared file");
    expect(api.open).toHaveBeenCalledWith({ data: { clientId: "client", evidenceId: "file" } });
    expect(opened).toHaveBeenCalledOnce();
  });
  it("does not turn an abstention into a claim that a record is missing", async () => {
    api.request.mockResolvedValue(response(false));
    await render(<JevRequestNudge clientId="client" title="Utility bill" details="" />);
    await click("Check already-shared files");
    expect(host.textContent).toContain("does not mean the item is missing");
    expect(api.open).not.toHaveBeenCalled();
  });
  it("clears results when request text changes, and ignores a delayed old result", async () => {
    let resolve!: (value: unknown) => void;
    api.request.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    await render(<JevRequestNudge clientId="client" title="Utility bill" details="" />);
    await click("Check already-shared files");
    await render(<JevRequestNudge clientId="client" title="Different request" details="" />);
    await act(async () => resolve(response()));
    expect(host.textContent).not.toContain("Fictional bill");
  });
  it("expires displayed results and dismisses without any record action", async () => {
    vi.useFakeTimers();
    api.request.mockResolvedValue(response());
    await render(<JevRequestNudge clientId="client" title="Utility bill" details="" />);
    await click("Check already-shared files");
    await act(async () => vi.advanceTimersByTime(5 * 60_000 + 1));
    expect(host.textContent).not.toContain("Fictional bill");
    api.request.mockResolvedValue(response());
    await click("Check already-shared files");
    await click("Dismiss suggestion");
    expect(host.textContent).not.toContain("Fictional bill");
    expect(api.open).not.toHaveBeenCalled();
  });
  it("clears the preview if opening fails after sharing is revoked", async () => {
    api.request.mockResolvedValue(response());
    api.open.mockRejectedValue(new Error("No active access"));
    await render(<JevRequestNudge clientId="client" title="Utility bill" details="" />);
    await click("Check already-shared files");
    await click("Open shared file");
    expect(host.textContent).not.toContain("Fictional bill");
  });
});
describe("survivor Jev authorization controls", () => {
  const permissions = (enabled = false) => ({
    available: true,
    requiresPassword: false,
    shares: [
      {
        linkId: "grant",
        scopeFingerprint: "abc",
        attorneyName: "Attorney Example",
        fileCount: 12,
        enabled,
        expiresAt: enabled ? new Date(Date.now() + 86_400_000).toISOString() : null,
      },
    ],
  });
  it("requires an explicit named-provider checkbox before enabling", async () => {
    api.permissions.mockResolvedValue(permissions());
    api.setPermission.mockResolvedValue({ ok: true });
    await render(<JevSharePermissions />);
    expect(button("Allow checks").disabled).toBe(true);
    expect(api.setPermission).not.toHaveBeenCalled();
    expect(host.textContent).toContain("TypeSafe's Jev");
    expect(host.textContent).toContain("pauses if the shared file scope changes");
    await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await click("Allow checks");
    expect(api.setPermission).toHaveBeenCalledWith({
      data: { linkId: "grant", scopeFingerprint: "abc", enabled: true },
    });
  });
  it("lets the survivor revoke an existing permission when the provider is disabled", async () => {
    api.permissions.mockResolvedValue({ ...permissions(true), available: false });
    api.setPermission.mockResolvedValue({ ok: true });
    await render(<JevSharePermissions />);
    await click("Turn off for Attorney");
    expect(api.setPermission).toHaveBeenCalledWith({
      data: { linkId: "grant", enabled: false },
    });
  });
  it("does not present failed permission reads as a safe off state", async () => {
    api.permissions.mockRejectedValue(new Error("network"));
    await render(<JevSharePermissions />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("may still be active");
    expect(host.textContent).not.toContain("Jev request checks: Off");
  });
});
