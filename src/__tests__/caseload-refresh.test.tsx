// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: { id: "advocate-a" } }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
import { useAdvocateCaseload } from "@/hooks/use-advocate-caseload";
const clients = vi.fn(),
  invites = vi.fn();
let host: HTMLDivElement, root: Root;
function View() {
  const result = useAdvocateCaseload(clients, invites);
  return <div>{JSON.stringify(result)}</div>;
}
async function render() {
  await act(async () => root.render(<View />));
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.clearAllMocks();
  auth.user = { id: "advocate-a" };
  clients.mockResolvedValue({ clients: [{ case_label: "Shared name", status: "active" }] });
  invites.mockResolvedValue({ invites: [{ effective_status: "accepted" }] });
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});
it("refreshes a revoked grant and removes labels within the polling interval", async () => {
  await render();
  expect(host.textContent).toContain("Shared name");
  clients.mockResolvedValue({ clients: [{ case_label: null, status: "revoked" }] });
  invites.mockResolvedValue({ invites: [{ effective_status: "revoked" }] });
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(host.textContent).not.toContain("Shared name");
  expect(host.textContent).toContain("revoked");
});
it.each(["focus", "online"])(
  "revalidates on %s and clears old labels if offline",
  async (event) => {
    await render();
    clients.mockRejectedValue(new Error("offline"));
    await act(async () => window.dispatchEvent(new Event(event)));
    expect(host.textContent).not.toContain("Shared name");
    expect(host.textContent).toContain('"error":true');
  },
);
it("ignores an earlier account's late response", async () => {
  let finish!: (v: any) => void;
  clients.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  await render();
  auth.user = { id: "advocate-b" };
  clients.mockResolvedValue({ clients: [] });
  await render();
  await act(async () => finish({ clients: [{ case_label: "Wrong account" }] }));
  expect(host.textContent).not.toContain("Wrong account");
});
