import { describe, expect, it, vi } from "vitest";
import { assertSessionMeetsMfa, MFA_REQUIRED_MESSAGE } from "@/lib/mfa-session-gate.server";

function admin(result: { data: any; error: any } | Error) {
  const listFactors = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { db: { auth: { admin: { mfa: { listFactors } } } }, listFactors };
}

const verified = { data: { factors: [{ status: "verified", factor_type: "totp" }] }, error: null };

describe("server-side aal2 gate", () => {
  it("refuses aal1 session when a verified TOTP factor exists", async () => {
    const { db } = admin(verified);
    await expect(assertSessionMeetsMfa(db, "u1", { aal: "aal1" })).rejects.toThrow(
      MFA_REQUIRED_MESSAGE,
    );
  });

  it("refuses a session with no aal claim when a verified factor exists", async () => {
    const { db } = admin(verified);
    await expect(assertSessionMeetsMfa(db, "u1", {})).rejects.toThrow(MFA_REQUIRED_MESSAGE);
  });

  it("allows aal2 session", async () => {
    const { db, listFactors } = admin(verified);
    await expect(assertSessionMeetsMfa(db, "u1", { aal: "aal2" })).resolves.toBeUndefined();
    expect(listFactors).not.toHaveBeenCalled();
  });

  it("leaves accounts without a verified factor unchanged", async () => {
    const { db } = admin({ data: { factors: [] }, error: null });
    await expect(assertSessionMeetsMfa(db, "u1", { aal: "aal1" })).resolves.toBeUndefined();
    const pending = admin({
      data: { factors: [{ status: "unverified", factor_type: "totp" }] },
      error: null,
    });
    await expect(assertSessionMeetsMfa(pending.db, "u1", { aal: "aal1" })).resolves.toBeUndefined();
  });

  it("fails closed on lookup error or throw", async () => {
    await expect(
      assertSessionMeetsMfa(admin({ data: null, error: { message: "x" } }).db, "u1", {
        aal: "aal1",
      }),
    ).rejects.toThrow(MFA_REQUIRED_MESSAGE);
    await expect(
      assertSessionMeetsMfa(admin(new Error("net")).db, "u1", { aal: "aal1" }),
    ).rejects.toThrow(MFA_REQUIRED_MESSAGE);
  });

  it("is wired into requireSupabaseAuth (shared root for portal gates)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/integrations/supabase/auth-middleware.ts", "utf8");
    const block = src.slice(src.indexOf("export const requireSupabaseAuth"));
    expect(block).toContain("assertSessionMeetsMfa");
  });
});
