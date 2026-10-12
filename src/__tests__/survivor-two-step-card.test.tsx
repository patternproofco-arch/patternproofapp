// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  factors: [] as Array<{ id: string; status: string; friendly_name?: string; created_at?: string }>,
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@/lib/mfa", () => ({ dropUnverifiedTotpFactors: vi.fn(async () => undefined) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: async () => ({ data: { totp: m.factors }, error: null }),
        enroll: m.enroll,
        challengeAndVerify: m.challengeAndVerify,
        unenroll: m.unenroll,
      },
    },
  },
}));

import { TwoFactorCard } from "@/components/TwoFactorCard";

let root: Root;
let el: HTMLDivElement;
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const text = () => el.textContent ?? "";
const button = (label: RegExp) =>
  [...el.querySelectorAll("button")].find((b) =>
    label.test(b.textContent ?? ""),
  ) as HTMLButtonElement;
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  m.factors = [];
  m.enroll.mockReset().mockResolvedValue({
    data: {
      id: "f-new",
      totp: { qr_code: "data:image/svg+xml;base64,AA==", secret: "JBSWY3DPEHPK3PXP" },
    },
    error: null,
  });
  m.challengeAndVerify.mockReset().mockResolvedValue({ data: {}, error: null });
  m.unenroll.mockReset().mockResolvedValue({ data: {}, error: null });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
});

describe("TwoFactorCard variant=survivor", () => {
  it("is off by default and explains optional, no-SMS, lost-phone path", async () => {
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    expect(text()).toContain("Two-step sign-in (optional)");
    expect(text()).toContain("adds a second check when you sign in");
    expect(text()).toContain("never send codes by text message");
    expect(text()).toContain("If you lose your phone");
    expect(button(/Set up two-step sign-in/)).toBeTruthy();
    expect(m.enroll).not.toHaveBeenCalled();
  });

  it("enrolls: QR + setup key shown once with keep-private prompt, then verifies a code", async () => {
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    await act(async () => button(/Set up two-step sign-in/).click());
    await flush();
    expect(el.querySelector("img")?.getAttribute("src")).toContain("data:image");
    expect(el.querySelector('[data-testid="two-step-secret"]')?.textContent).toBe(
      "JBSWY3DPEHPK3PXP",
    );
    expect(text()).toContain("shown only this once");
    expect(text()).toContain("only keep it somewhere just you can reach");
    const input = el.querySelector('input[aria-label="6-digit code"]') as HTMLInputElement;
    await act(async () => type(input, "123456"));
    m.factors = [{ id: "f-new", status: "verified", friendly_name: "Authenticator" }];
    await act(async () => button(/Check code and turn on/).click());
    await flush();
    expect(m.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-new", code: "123456" });
    expect(el.querySelector('[data-testid="two-step-secret"]')).toBeNull(); // not shown again
    expect(text()).toContain("Authenticator");
    expect(button(/Add a second authenticator app/)).toBeTruthy();
  });

  it("removing an app requires a fresh code check before unenroll", async () => {
    m.factors = [
      { id: "f1", status: "verified", friendly_name: "Authenticator" },
      { id: "f2", status: "verified", friendly_name: "Authenticator 2" },
    ];
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    const removeButtons = [...el.querySelectorAll("li button")] as HTMLButtonElement[];
    expect(removeButtons).toHaveLength(2);
    await act(async () => removeButtons[0].click());
    // Lost the first app: its code fails, the second app's code succeeds.
    m.challengeAndVerify
      .mockResolvedValueOnce({ data: null, error: new Error("Invalid TOTP code") })
      .mockResolvedValueOnce({ data: {}, error: null });
    const input = el.querySelector('[data-testid="two-step-remove"] input') as HTMLInputElement;
    await act(async () => type(input, "654321"));
    await act(async () => button(/Remove this app/).click());
    await flush();
    expect(m.challengeAndVerify).toHaveBeenNthCalledWith(1, { factorId: "f1", code: "654321" });
    expect(m.challengeAndVerify).toHaveBeenNthCalledWith(2, { factorId: "f2", code: "654321" });
    expect(m.unenroll).toHaveBeenCalledWith({ factorId: "f1" });
    const verifyOrder = m.challengeAndVerify.mock.invocationCallOrder[1];
    expect(m.unenroll.mock.invocationCallOrder[0]).toBeGreaterThan(verifyOrder);
  });

  it("does not unenroll when no code matches", async () => {
    m.factors = [{ id: "f1", status: "verified" }];
    m.challengeAndVerify.mockResolvedValue({ data: null, error: new Error("Invalid TOTP code") });
    await act(async () => root.render(<TwoFactorCard variant="survivor" />));
    await flush();
    await act(async () => (el.querySelector("li button") as HTMLButtonElement).click());
    const input = el.querySelector('[data-testid="two-step-remove"] input') as HTMLInputElement;
    await act(async () => type(input, "000000"));
    await act(async () => button(/Remove this app/).click());
    await flush();
    expect(m.unenroll).not.toHaveBeenCalled();
  });

  it("attorney (required) variant keeps its original copy", async () => {
    m.factors = [{ id: "f1", status: "verified" }];
    await act(async () => root.render(<TwoFactorCard required variant="survivor" />));
    await flush();
    expect(text()).toContain("Two-factor authentication");
    expect(text()).not.toContain("(optional)");
  });
});
