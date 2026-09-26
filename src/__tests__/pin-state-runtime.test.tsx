// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), check: vi.fn(), user: { id: "survivor-a" } }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/pin-lock.functions", () => ({
  getPinLockState: mocks.read,
  checkUnlockToken: mocks.check,
  setPinServer: vi.fn(),
  clearPinServer: vi.fn(),
  verifyPinServer: vi.fn(),
  setBiometricEnabled: vi.fn(),
  issueUnlockToken: vi.fn(),
}));
import { PinLockProvider, usePinLock } from "@/lib/pin-lock";
let host: HTMLDivElement, root: Root;
function Probe() {
  const state = usePinLock();
  return (
    <p>
      {JSON.stringify({
        ready: state.ready,
        isLocked: state.isLocked,
        loadError: state.loadError,
        hasPin: state.hasPin,
        appLockEnabled: state.appLockEnabled,
      })}
    </p>
  );
}
async function render() {
  await act(async () =>
    root.render(
      <PinLockProvider>
        <Probe />
      </PinLockProvider>,
    ),
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  sessionStorage.clear();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});
it("keeps failed lock-state reads locked with an explicit error", async () => {
  mocks.read.mockRejectedValue(new Error("offline"));
  await render();
  expect(JSON.parse(host.textContent!)).toMatchObject({
    ready: false,
    isLocked: true,
    loadError: true,
  });
});
it("times out stalled lock-state reads without exposing content", async () => {
  vi.useFakeTimers();
  mocks.read.mockImplementation(() => new Promise(() => {}));
  await render();
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(JSON.parse(host.textContent!)).toMatchObject({
    ready: false,
    isLocked: true,
    loadError: true,
  });
});
it("does not trust an invalid stored token", async () => {
  mocks.read.mockResolvedValue({ has_pin: true, biometric_enabled: false, app_lock_enabled: true });
  mocks.check.mockResolvedValue({ valid: false });
  sessionStorage.setItem("pp_unlock_token_v2", "wrong-account-token");
  await render();
  expect(JSON.parse(host.textContent!)).toMatchObject({
    ready: true,
    isLocked: true,
    hasPin: true,
  });
  expect(sessionStorage.getItem("pp_unlock_token_v2")).toBeNull();
});
it("only unlocks an existing PIN after the server accepts its token", async () => {
  mocks.read.mockResolvedValue({ has_pin: true, biometric_enabled: false, app_lock_enabled: true });
  mocks.check.mockResolvedValue({ valid: true });
  sessionStorage.setItem("pp_unlock_token_v2", "verified-token");
  await render();
  expect(JSON.parse(host.textContent!)).toMatchObject({
    ready: true,
    isLocked: false,
    loadError: false,
  });
});
