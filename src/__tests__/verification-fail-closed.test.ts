import { describe, it, expect } from "vitest";
import {
  assertAdvocateOrgVerifiedIfAny,
  assertNotLegalAidOrgWidePull,
  isCaseEngagementCurrent,
} from "@/lib/professional-verification.server";
import { fakeAdmin } from "./helpers/fake-supabase";

describe("verification lookup failure", () => {
  const failed = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: null, error: { message: "offline" } }),
    }),
  };
  it("denies an org membership lookup failure", async () => {
    await expect(assertAdvocateOrgVerifiedIfAny(failed, "qa-advocate")).rejects.toThrow(
      /not verified/i,
    );
  });
  it("allows an established absence of membership", async () => {
    await expect(
      assertAdvocateOrgVerifiedIfAny(fakeAdmin({ org_members: [] }), "qa-advocate"),
    ).resolves.toBeNull();
  });
  it("denies when dual-role verification cannot be checked", async () => {
    await expect(assertNotLegalAidOrgWidePull(failed, "qa-advocate")).rejects.toThrow();
  });
  it("uses six calendar months, and rejects future timestamps", () => {
    const now = Date.parse("2026-08-31T12:00:00Z");
    expect(isCaseEngagementCurrent("2026-02-28T12:00:00Z", null, now)).toBe(false);
    expect(isCaseEngagementCurrent("2026-03-01T12:00:00Z", null, now)).toBe(true);
    expect(isCaseEngagementCurrent("2026-09-01T12:00:00Z", null, now)).toBe(false);
    expect(isCaseEngagementCurrent("2025-01-01T12:00:00Z", "2026-09-01T12:00:00Z", now)).toBe(
      false,
    );
  });
});
