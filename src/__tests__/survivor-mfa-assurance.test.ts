import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { decideAssurance, readAal, STEP_UP_REQUIRED } from "@/lib/mfa-assurance";
import { assertMfaAssurance, lookupVerifiedFactor } from "@/lib/mfa-assurance.server";
import { SURVIVOR_TWO_STEP_COPY } from "@/lib/two-step-copy";

function admin(
  result: { data: { factors?: Array<{ status?: string }> } | null; error: unknown } | Error,
) {
  const listFactors = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { auth: { admin: { mfa: { listFactors } } } }, listFactors };
}

describe("decideAssurance (pure gate)", () => {
  it("enrolled + aal1 is blocked", () => {
    expect(decideAssurance("aal1", { ok: true, hasVerifiedFactor: true })).toBe("step_up");
  });
  it("enrolled + aal2 is allowed", () => {
    expect(decideAssurance("aal2", { ok: true, hasVerifiedFactor: true })).toBe("allow");
  });
  it("not enrolled + aal1 is allowed (two-step is optional)", () => {
    expect(decideAssurance("aal1", { ok: true, hasVerifiedFactor: false })).toBe("allow");
  });
  it("aal1 with failed factor lookup fails closed", () => {
    expect(decideAssurance("aal1", { ok: false })).toBe("step_up");
  });
  it("missing aal claim is treated like aal1", () => {
    expect(decideAssurance(readAal({}), { ok: true, hasVerifiedFactor: true })).toBe("step_up");
    expect(readAal({ aal: "aal2" })).toBe("aal2");
    expect(readAal({ aal: "AAL2" })).toBeNull();
  });
});

describe("assertMfaAssurance (server, JWT aal claim + factor list)", () => {
  it("throws for enrolled account at aal1", async () => {
    const a = admin({ data: { factors: [{ status: "verified" }] }, error: null });
    await expect(assertMfaAssurance(a.client, "u1", { aal: "aal1" })).rejects.toThrow(
      STEP_UP_REQUIRED,
    );
    expect(a.listFactors).toHaveBeenCalledWith({ userId: "u1" });
  });
  it("passes enrolled account at aal2 without a lookup", async () => {
    const a = admin({ data: { factors: [{ status: "verified" }] }, error: null });
    await expect(assertMfaAssurance(a.client, "u1", { aal: "aal2" })).resolves.toBeUndefined();
    expect(a.listFactors).not.toHaveBeenCalled();
  });
  it("passes not-enrolled account at aal1 (unverified factor does not count)", async () => {
    const a = admin({ data: { factors: [{ status: "unverified" }] }, error: null });
    await expect(assertMfaAssurance(a.client, "u2", { aal: "aal1" })).resolves.toBeUndefined();
  });
  it("fails closed when the factor lookup errors or throws", async () => {
    await expect(
      assertMfaAssurance(admin({ data: null, error: new Error("x") }).client, "u", { aal: "aal1" }),
    ).rejects.toThrow(STEP_UP_REQUIRED);
    expect(await lookupVerifiedFactor(admin(new Error("net")).client, "u")).toEqual({ ok: false });
  });
});

describe("requireSupabaseAuth wiring", () => {
  it("runs the assurance check on every ordinary server function", () => {
    const src = readFileSync("src/integrations/supabase/auth-middleware.ts", "utf8");
    const block = src.slice(src.indexOf("export const requireSupabaseAuth"));
    expect(block).toContain('import("@/lib/mfa-assurance.server")');
    expect(block).toMatch(
      /assertMfaAssurance\(\s*supabaseAdmin[^,]*,\s*context\.userId,\s*context\.claims/,
    );
  });
});

describe("survivor two-step copy (DV safety)", () => {
  const all = Object.values(SURVIVOR_TWO_STEP_COPY).join(" ").toLowerCase();
  it("offers no SMS codes and says so", () => {
    expect(all).toContain("never send codes by text message");
    expect(all).not.toMatch(/we('ll| will) (text|sms)|via sms|by sms/);
  });
  it("is optional and soft-claim", () => {
    expect(SURVIVOR_TWO_STEP_COPY.heading).toBe("Two-step sign-in (optional)");
    expect(all).toContain("adds a second check when you sign in");
    expect(all).not.toMatch(/guarantee|100%|completely secure|unhackable/);
  });
  it("explains the lost-device path without email recovery", () => {
    expect(all).toContain("contact patternproof support");
    expect(all).toContain("does not turn this off");
    expect(all).toContain("shown only this once");
  });
});
