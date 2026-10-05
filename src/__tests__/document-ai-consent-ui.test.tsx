// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentAiReadConsent } from "@/components/evidence/DocumentAiReadConsent";
afterEach(() => vi.unstubAllGlobals());
describe("document AI permission screen", () => {
  it("requires a fresh unchecked choice and clears it after a failed attempt", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const read = vi.fn().mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<DocumentAiReadConsent onRead={read} />));
    const checkbox = host.querySelector("input")!;
    const button = host.querySelector("button")!;
    expect(checkbox.checked).toBe(false);
    expect(button.disabled).toBe(true);
    await act(async () => button.click());
    expect(read).not.toHaveBeenCalled();
    await act(async () => checkbox.click());
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(read).toHaveBeenCalledTimes(1);
    expect(checkbox.checked).toBe(false);
    expect(button.disabled).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be read");
    await act(async () => root.unmount());
    host.remove();
  });
});
