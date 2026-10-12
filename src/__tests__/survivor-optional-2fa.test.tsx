// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mfa = vi.hoisted(() => ({
  factors: [] as Array<{ id: string; status: string }>,
  aal: { currentLevel: "aal1", nextLevel: "aal1" },
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }),
      mfa: {
        listFactors: (...a: unknown[]) => mfa.listFactors(...a),
        enroll: (...a: unknown[]) => mfa.enroll(...a),
        challengeAndVerify: (...a: unknown[]) => mfa.challengeAndVerify(...a),
        unenroll: (...a: unknown[]) => mfa.unenroll(...a),
        getAuthenticatorAssuranceLevel: async () => ({ data: mfa.aal, error: null }),
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { TwoFactorCard } from "@/components/TwoFactorCard";

let host: HTMLDivElement;
let root: Root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const btn = (label: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mfa.factors = [];
  mfa.listFactors.mockImplementation(async () => ({ data: { totp: mfa.factors }, error: null }));
  mfa.enroll.mockResolvedValue({
    data: { id: "f1", totp: { qr_code: "data:image/svg+xml;base64,AA", secret: "JBSWY3DPEHPK3PXP" } },
    error: null,
  });
  mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mfa.unenroll.mockResolvedValue({ data: {}, error: null });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("survivor settings: optional two-step sign-in", () => {
  it("defaults to off with safety + recovery notes and a support path", async () => {
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    expect(host.textContent).toContain("Two-step sign-in (optional)");
    expect(host.textContent).toContain("Status: off.");
    expect(host.textContent).toContain("Quick Exit");
    expect(host.textContent).toMatch(/never sends codes by text or email/);
    expect(host.querySelector('a[href="/support"]')).not.toBeNull();
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  it("enrolls: shows QR + manual key, then verifies a code to turn on", async () => {
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    await act(async () => btn("Turn on two-step sign-in").click());
    await flush();
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Authenticator" });
    expect(host.querySelector("img")?.getAttribute("src")).toContain("data:image");
    expect(host.textContent).toContain("JBSWY3DPEHPK3PXP");
    const input = host.querySelector("input") as HTMLInputElement;
    await act(async () => type(input, "123456"));
    mfa.factors = [{ id: "f1", status: "verified" }];
    await act(async () => btn("Confirm and turn on").click());
    await flush();
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
    expect(host.textContent).toContain("On — a code is required at sign-in.");
  });

  it("turning off requires a current code (aal2) before unenroll", async () => {
    mfa.factors = [{ id: "f9", status: "verified" }];
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    await act(async () => btn("Turn off two-step sign-in").click());
    await flush();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Enter the current 6-digit code");
    await act(async () => type(host.querySelector('input[aria-label="Code to turn off"]') as HTMLInputElement, "654321"));
    mfa.factors = [];
    await act(async () => btn("Turn off two-step sign-in").click());
    await flush();
    const order = [
      mfa.challengeAndVerify.mock.invocationCallOrder[0],
      mfa.unenroll.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f9" });
    expect(host.textContent).toContain("Status: off.");
  });

  it("a wrong code on turn-off keeps it on", async () => {
    mfa.factors = [{ id: "f9", status: "verified" }];
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: new Error("Invalid TOTP code") });
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    await act(async () => type(host.querySelector('input[aria-label="Code to turn off"]') as HTMLInputElement, "000000"));
    await act(async () => btn("Turn off two-step sign-in").click());
    await flush();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    expect(host.textContent).toContain("On — a code is required at sign-in.");
  });
});

describe("sign-in: enrolled survivor goes to the code screen", () => {
  it("resolveMfaGate (survivor shell, optional) challenges at aal1 when a factor is verified", async () => {
    mfa.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const { resolveMfaGate, sessionNeedsMfa } = await import("@/lib/mfa");
    await expect(resolveMfaGate({})).resolves.toBe("challenge");
    await expect(sessionNeedsMfa()).resolves.toBe(true);
  });
  it("non-enrolled survivor is never forced to enroll", async () => {
    mfa.aal = { currentLevel: "aal1", nextLevel: "aal1" };
    const { resolveMfaGate } = await import("@/lib/mfa");
    await expect(resolveMfaGate({})).resolves.toBe("allow");
  });
  it("after aal2, the gate allows", async () => {
    mfa.aal = { currentLevel: "aal2", nextLevel: "aal2" };
    const { resolveMfaGate } = await import("@/lib/mfa");
    await expect(resolveMfaGate({})).resolves.toBe("allow");
  });
});
