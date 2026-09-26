// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "survivor-a", user_metadata: { onboarding_complete: true } } as any,
    loading: false,
  },
  role: vi.fn(),
  navigate: vi.fn().mockResolvedValue(undefined),
  idle: vi.fn(),
  providers: vi.fn(),
  path: "/dashboard",
  pin: {
    hasPin: true,
    hasBiometric: false,
    isLocked: true,
    ready: true,
    appLockEnabled: true,
    loadError: false,
    lock: vi.fn(),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  useNavigate: () => mocks.navigate,
  useRouterState: () => mocks.path,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/roles.functions", () => ({ ensureSurvivorRole: mocks.role }));
vi.mock("@/hooks/use-mfa-gate", () => ({ useMfaGate: () => false }));
vi.mock("@/hooks/use-idle-lock", () => ({ useIdleLock: mocks.idle }));
vi.mock("@/lib/settings-context", () => ({
  SettingsProvider: ({ children }: any) => children,
  useSettings: () => ({ settings: { onboarded: true }, update: vi.fn() }),
}));
vi.mock("@/lib/pin-lock", () => ({
  PinLockProvider: ({ children }: any) => {
    mocks.providers();
    return children;
  },
  usePinLock: () => mocks.pin,
}));
vi.mock("@/lib/recording-context", () => ({ RecordingProvider: ({ children }: any) => children }));
vi.mock("@/components/PinScreen", () => ({ PinScreen: () => <p>PIN locked</p> }));
vi.mock("@/components/LockRecoveryScreen", () => ({
  LockRecoveryScreen: () => <p>Lock recovery</p>,
}));
vi.mock("@/components/AppShell", () => ({ AppShell: () => <p>Private survivor content</p> }));
import { AuthLayout } from "@/routes/_authenticated";
let root: Root, host: HTMLDivElement;
const survivor = { roles: ["survivor"], is_survivor: true, is_org_partner: false };
async function render() {
  await act(async () => {
    root.render(<AuthLayout />);
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.auth.user = { id: "survivor-a", user_metadata: { onboarding_complete: true } };
  mocks.path = "/dashboard";
  Object.assign(mocks.pin, {
    hasPin: true,
    isLocked: true,
    ready: true,
    appLockEnabled: true,
    loadError: false,
  });
  mocks.role.mockResolvedValue(survivor);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
describe("actual survivor layout behavior", () => {
  it.each([
    ["attorney", false, "/clients"],
    ["advocate", false, "/advocate-cases"],
    ["advocate", true, "/org-portal"],
  ])("redirects %s without mounting any survivor PIN provider", async (role, org, path) => {
    mocks.role.mockResolvedValue({ roles: [role], is_survivor: false, is_org_partner: org });
    await render();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: path, replace: true });
    expect(mocks.providers).not.toHaveBeenCalled();
    expect(mocks.idle).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("PIN locked");
  });
  it("blocks a failed role lookup and supports retry", async () => {
    mocks.role.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(mocks.providers).not.toHaveBeenCalled();
    await act(async () => host.querySelector("button")!.click());
    expect(host.textContent).toContain("PIN locked");
  });
  it("blocks unsupported roles with a retry rather than an endless spinner", async () => {
    mocks.role.mockResolvedValue({ roles: ["unknown"], is_survivor: false, is_org_partner: false });
    await render();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(mocks.providers).not.toHaveBeenCalled();
  });
  it("discards the previous account and ignores its late role result", async () => {
    let finish!: (r: typeof survivor) => void;
    mocks.role.mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    await render();
    mocks.auth.user = { id: "attorney-b", user_metadata: {} };
    mocks.role.mockResolvedValue({
      roles: ["attorney"],
      is_survivor: false,
      is_org_partner: false,
    });
    await render();
    await act(async () => finish(survivor));
    expect(mocks.providers).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("Private survivor content");
  });
  it("rechecks on account switch after an unlocked survivor session", async () => {
    mocks.pin.isLocked = false;
    await render();
    expect(host.textContent).toContain("Private survivor content");
    mocks.auth.user = { id: "attorney-b", user_metadata: {} };
    mocks.role.mockImplementation(() => new Promise(() => {}));
    await render();
    expect(host.textContent).not.toContain("Private survivor content");
  });
  it("keeps direct onboarding URLs behind an existing PIN", async () => {
    mocks.path = "/onboarding";
    await render();
    expect(host.textContent).toContain("PIN locked");
  });
  it("shows recovery for an enabled lock without a usable credential", async () => {
    mocks.pin.hasPin = false;
    await render();
    expect(host.textContent).toContain("Lock recovery");
  });
  it("hides content on lock-state failure", async () => {
    mocks.pin.loadError = true;
    await render();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Private survivor content");
  });
  it("routes an unlocked incomplete survivor to onboarding", async () => {
    mocks.auth.user.user_metadata.onboarding_complete = false;
    mocks.pin.isLocked = false;
    await render();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/onboarding", replace: true });
    expect(host.textContent).not.toContain("Private survivor content");
  });
  it("times out stalled role checks to a retry screen", async () => {
    vi.useFakeTimers();
    mocks.role.mockImplementation(() => new Promise(() => {}));
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(15000));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
});
