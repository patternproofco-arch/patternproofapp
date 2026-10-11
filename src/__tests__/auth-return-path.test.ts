import { describe, expect, it } from "vitest";
import { authConfirmationUrl, safeAuthReturnPath } from "@/lib/auth-return-path";
const origin = "https://pattern-proof.tech";
describe("signup confirmation routing", () => {
  it("finishes confirmation through the auth callback", () => {
    expect(authConfirmationUrl(origin)).toBe(`${origin}/auth/callback`);
  });
  it("carries a local return path including its query and fragment", () => {
    const path = "/dashboard?case=fictional#notes";
    const url = new URL(authConfirmationUrl(origin, path));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("redirect")).toBe(path);
    expect(safeAuthReturnPath(url.searchParams.get("redirect"), origin)).toBe(path);
  });
  it.each([
    "https://other.example/",
    "//other.example/",
    "/\\other.example/",
    "dashboard",
    "",
    null,
  ])("rejects an unsafe return destination %s", (path) => {
    expect(safeAuthReturnPath(path, origin)).toBeNull();
    expect(authConfirmationUrl(origin, path ?? undefined)).toBe(`${origin}/auth/callback`);
  });
});
