// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TESTER_ROLES, parseTesterSearch } from "@/lib/founding-testers";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => send }));
vi.mock("@/lib/support.functions", () => ({ submitSupportRequest: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));
import { FoundingTesterForm } from "@/components/FoundingTesterForm";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  send.mockReset().mockResolvedValue({ ok: true, emailed: false });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function fill(selector: string, value: string) {
  const field = host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  const prototype = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("founding tester intake", () => {
  it.each(TESTER_ROLES)("routes a $label request to the support inbox without claiming access", async ({ value, label }) => {
    await act(async () => root.render(<FoundingTesterForm mode="join" initialRole={value} />));
    await fill('input[type="email"]', "tester@example.com");
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.required).toBe(true);
    await submit();
    expect(send).toHaveBeenCalledWith({ data: {
      replyEmail: "tester@example.com",
      category: "Founding tester request",
      message: expect.stringContaining(`Role: ${label}`),
    } });
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Your request is saved.");
    expect(host.textContent).toContain("not an account or access approval");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/demo");
  });

  it("keeps failed submissions editable and reports rate limits", async () => {
    send.mockResolvedValueOnce({ ok: false, rateLimited: true });
    await act(async () => root.render(<FoundingTesterForm mode="feedback" initialRole="paralegal" />));
    await fill('input[type="email"]', "tester@example.com");
    await fill("textarea", "I could not find where to review the dates.");
    await submit();
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("try again later");
    expect(host.querySelector("textarea")?.value).toContain("review the dates");
    await submit();
    expect(send).toHaveBeenLastCalledWith({ data: {
      replyEmail: "tester@example.com", category: "Product feedback",
      message: expect.stringContaining("I could not find where to review the dates."),
    } });
    expect(host.textContent).toContain("Your feedback is saved.");
  });

  it("does not submit blank feedback even if native form validation is bypassed", async () => {
    await act(async () => root.render(<FoundingTesterForm mode="feedback" initialRole="survivor" />));
    await submit();
    expect(send).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("at least 10 characters");
  });

  it("preserves text on a network failure and allows retry", async () => {
    send.mockRejectedValueOnce(new Error("offline"));
    await act(async () => root.render(<FoundingTesterForm mode="join" initialRole="advocate" />));
    await fill('input[type="email"]', "tester@example.com");
    await fill("textarea", "I would like to review the referral flow.");
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not confirm");
    expect(host.querySelector("textarea")?.value).toContain("referral flow");
    expect(host.querySelector("button")?.disabled).toBe(false);
  });

  it("blocks duplicate submits while a request is in flight", async () => {
    let resolve!: (value: { ok: true; emailed: false }) => void;
    send.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await act(async () => root.render(<FoundingTesterForm mode="join" initialRole="attorney" />));
    await fill('input[type="email"]', "tester@example.com");
    await submit();
    await submit();
    expect(send).toHaveBeenCalledTimes(1);
    expect(host.querySelector("button")?.disabled).toBe(true);
    await act(async () => resolve({ ok: true, emailed: false }));
    expect(host.textContent).toContain("Your request is saved.");
  });

  it("accepts only known navigation choices, not contact details or arbitrary roles", () => {
    expect(parseTesterSearch({ mode: "feedback", role: "paralegal", email: "private@example.com" }))
      .toEqual({ mode: "feedback", role: "paralegal" });
    expect(parseTesterSearch({ mode: "admin", role: "admin" })).toEqual({ mode: undefined, role: undefined });
  });
});
