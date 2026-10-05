// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  listMyOauthConsents: vi.fn(),
  revokeMyOauthConsent: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/lib/oauth-consents", () => api);
vi.mock("sonner", () => ({ toast: api.toast }));
import { ConnectedApps } from "@/components/ConnectedApps";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("connected app status", () => {
  it("shows a failed load as unknown and lets the user retry", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.listMyOauthConsents.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<ConnectedApps />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Connections may still be active",
    );
    expect(host.textContent).not.toContain("Nothing connected");
    await act(async () => host.querySelector("button")!.click());
    expect(host.textContent).toContain("Nothing connected right now");
    await act(async () => root.unmount());
  });
  it("revokes by client ID and explains retained tokens and copies", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.listMyOauthConsents
      .mockResolvedValueOnce([
        { client_id: "client-a", client_name: "Example", granted_at: "2026-10-01", scopes: [] },
      ])
      .mockResolvedValueOnce([]);
    api.revokeMyOauthConsent.mockResolvedValue(undefined);
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<ConnectedApps />));
    await act(async () => host.querySelector("button")!.click());
    expect(api.revokeMyOauthConsent).toHaveBeenCalledWith("client-a");
    expect(api.toast).toHaveBeenCalledWith(
      expect.stringContaining("tokens may work until they expire"),
    );
    expect(api.toast).toHaveBeenCalledWith(
      expect.stringContaining("Copies already received are not erased"),
    );
    await act(async () => root.unmount());
  });
});
