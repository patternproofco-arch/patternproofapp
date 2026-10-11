import { describe, expect, it } from "vitest";
import {
  classifyApplication,
  clampGrantDays,
  dailyInviteCap,
  emailDomain,
  isLookalikeDomain,
  type ApplicationFacts,
} from "@/lib/cps-verification";

const base: ApplicationFacts = {
  email: "worker@dcs.example.gov",
  emailVerified: true,
  professionalType: "agency_caseworker",
  allowedDomains: ["dcs.example.gov", "dcfs.example.gov"],
  deniedDomains: ["bad.example.gov"],
};

describe("cps application decisions", () => {
  it("auto-approves only a confirmed mailbox on an accepted agency domain for a caseworker", () => {
    expect(classifyApplication(base)).toMatchObject({ action: "auto_approve", tier: 1 });
  });
  it("never approves before the mailbox is confirmed", () => {
    expect(classifyApplication({ ...base, emailVerified: false }).action).toBe("verify_email");
  });
  it("does not auto-approve social workers or court staff, even on an accepted domain", () => {
    for (const professionalType of ["licensed_social_worker", "gal_or_court"] as const) {
      expect(classifyApplication({ ...base, professionalType }).action).toBe("needs_review");
    }
  });
  it("sends other government domains to a person", () => {
    expect(classifyApplication({ ...base, email: "x@county.other.gov" })).toMatchObject({
      action: "needs_review",
      tier: 2,
    });
    expect(
      classifyApplication({ ...base, email: "x@someplace.org", registryType: "County" }).action,
    ).toBe("needs_review");
  });
  it("sends non-government email to manual review, never to approval", () => {
    expect(classifyApplication({ ...base, email: "x@gmail.com" })).toMatchObject({ action: "manual", tier: 3 });
  });
  it("rejects blocked domains and addresses", () => {
    expect(classifyApplication({ ...base, email: "x@bad.example.gov" }).action).toBe("reject");
    expect(
      classifyApplication({ ...base, email: "bad@x.org", deniedDomains: ["bad@x.org"] }).action,
    ).toBe("reject");
  });
  it("rejects a domain that imitates an accepted one", () => {
    expect(classifyApplication({ ...base, email: "x@dcs-example.gov" }).action).toBe("reject");
    expect(classifyApplication({ ...base, email: "x@dcs.exarnple.gov" }).action).toBe("reject");
  });
  it("rejects unusable addresses", () => {
    expect(classifyApplication({ ...base, email: "nope" }).action).toBe("reject");
  });
});

describe("domain helpers", () => {
  it("extracts and lowercases the domain", () => {
    expect(emailDomain(" A@DCS.Example.GOV ")).toBe("dcs.example.gov");
    expect(emailDomain("a@b")).toBeNull();
  });
  it("does not flag the exact accepted domain or a distant one", () => {
    expect(isLookalikeDomain("dcs.example.gov", ["dcs.example.gov"])).toBe(false);
    expect(isLookalikeDomain("unrelated.org", ["dcs.example.gov"])).toBe(false);
  });
  it("flags punycode", () => {
    expect(isLookalikeDomain("xn--dcs-example.gov", ["dcs.example.gov"])).toBe(true);
  });
});

describe("limits", () => {
  const now = Date.parse("2026-10-11T00:00:00Z");
  it("holds new accounts to 3 a day for 14 days, then 10", () => {
    expect(dailyInviteCap("2026-10-05T00:00:00Z", now)).toBe(3);
    expect(dailyInviteCap("2026-09-01T00:00:00Z", now)).toBe(10);
    expect(dailyInviteCap(null, now)).toBe(0);
    expect(dailyInviteCap("garbage", now)).toBe(0);
  });
  it("defaults grants to 30 days and never exceeds 90", () => {
    expect(clampGrantDays(undefined)).toBe(30);
    expect(clampGrantDays(0)).toBe(30);
    expect(clampGrantDays(45)).toBe(45);
    expect(clampGrantDays(400)).toBe(90);
    expect(clampGrantDays(NaN)).toBe(30);
  });
});
