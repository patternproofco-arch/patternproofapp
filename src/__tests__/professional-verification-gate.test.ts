import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isCaseEngagementCurrent,
  isLiveVerifiedStatus,
  denyAttorneySurvivorLookup,
  SURVIVOR_LOOKUP_DENIED_MESSAGE,
  ORG_NOT_VERIFIED_MESSAGE,
  ATTORNEY_NOT_VERIFIED_MESSAGE,
} from "@/lib/professional-verification.server";
import {
  privacyBucketReferralCount,
  isReferralEligibleForReporting,
} from "@/lib/org-referral-privacy";

const migration = readFileSync(
  "supabase/migrations/20260919180000_professional_verification_gate.sql",
  "utf8",
);
const orgFns = readFileSync("src/lib/org-portal.functions.ts", "utf8");
const advocateFns = readFileSync("src/lib/advocate.functions.ts", "utf8");
const advocatePacket = readFileSync("src/lib/advocate-packet.server.ts", "utf8");
const advocateInviteFns = readFileSync(
  "src/lib/advocate-survivor-invites.functions.ts",
  "utf8",
);
const attorneyAccess = readFileSync("src/lib/attorney-access.server.ts", "utf8");
const attorneyInvites = readFileSync("src/lib/attorney-invitations.functions.ts", "utf8");
const attorneyPortal = readFileSync("src/lib/attorney-portal.functions.ts", "utf8");
const attorneySurvivorInvites = readFileSync(
  "src/lib/attorney-survivor-invites.functions.ts",
  "utf8",
);
const clioFns = readFileSync("src/lib/clio.functions.ts", "utf8");
const firmFns = readFileSync("src/lib/firm-grants.functions.ts", "utf8");
const verificationFns = readFileSync(
  "src/lib/professional-verification.functions.ts",
  "utf8",
);
const payments = readFileSync("src/lib/payments.functions.ts", "utf8");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const allMigrations = readdirSync("supabase/migrations")
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");

describe("live Verified status helper", () => {
  it("denies Pending / Needs info / Declined / Suspended", () => {
    for (const status of ["pending", "needs_more_info", "declined", "suspended"]) {
      expect(isLiveVerifiedStatus(status, null)).toBe(false);
    }
  });
  it("allows Verified without expiry and denies expired Verified", () => {
    expect(isLiveVerifiedStatus("verified", null)).toBe(true);
    expect(isLiveVerifiedStatus("verified", "2099-01-01T00:00:00Z")).toBe(true);
    expect(isLiveVerifiedStatus("verified", "2020-01-01T00:00:00Z")).toBe(false);
  });
});

describe("Guardian CLEAR — DV org paths enforce Verified", () => {
  it("migration models the five org statuses and Suspended cutoff RPC", () => {
    expect(migration).toContain("'pending', 'needs_more_info', 'declined', 'verified', 'suspended'");
    expect(migration).toContain("set_org_verification_status");
    expect(migration).toContain("UPDATE public.advocate_client_links");
    expect(migration).toContain("org_member_invitations");
    expect(migration).toContain("professional_suspension_notices");
  });

  it("org membership / dashboards / staff invite fail closed without Verified", () => {
    expect(orgFns).toContain("assertOrgVerified");
    expect(orgFns).toContain('verification_status: "pending"');
  });

  it("Pending org cannot be a share target when email maps to org advocate", () => {
    expect(advocateFns).toContain("assertOrgVerified");
    expect(advocateFns).toContain('from("advocate_profiles")');
  });

  it("grant create/read checks org Verified", () => {
    expect(advocateFns).toContain("assertAdvocateOrgVerifiedIfAny");
    expect(advocatePacket).toContain("assertAdvocateOrgVerifiedIfAny");
  });

  it("invite mint from org staff requires Verified and blocks legal-aid dual pull", () => {
    expect(advocateInviteFns).toContain("assertAdvocateOrgVerifiedIfAny");
    expect(advocateInviteFns).toContain("assertNotLegalAidOrgWidePull");
  });

  it("org search returns Verified only", () => {
    expect(verificationFns).toContain("searchVerifiedOrganizations");
    expect(verificationFns).toContain("isLiveVerifiedStatus");
  });

  it("hides aggregate counts under 10", () => {
    expect(privacyBucketReferralCount(0)).toBeNull();
    expect(privacyBucketReferralCount(9)).toBeNull();
    expect(privacyBucketReferralCount(10)).toBe(10);
    expect(privacyBucketReferralCount(19)).toBe(10);
    expect(privacyBucketReferralCount(20)).toBe(20);
  });

  it("signup is enumeration-safe", () => {
    expect(orgFns).not.toContain('state: "already_approved"');
    expect(orgFns).toContain("Enumeration-safe");
    expect(orgFns).toContain(
      "Thanks — your request is with us. We review each organization by hand.",
    );
  });

  it("proof uploads are reviewer-only and marked never-AI", () => {
    expect(migration).toContain("professional_verification_proofs");
    expect(migration).toContain("Never send to AI");
    expect(migration).toMatch(/REVOKE ALL ON public\.professional_verification_proofs FROM anon, authenticated/);
    expect(verificationFns).toContain("recordVerificationProof");
  });

  it("Suspended survivor notice is in-app only (no email/SMS wiring)", () => {
    expect(migration).toContain("Do not wire email or SMS");
    expect(verificationFns).toContain("listMySuspensionNotices");
    expect(verificationFns).not.toMatch(/deliverTransactionalEmail/);
    const start = migration.indexOf(
      "CREATE TABLE IF NOT EXISTS public.professional_suspension_notices",
    );
    const end = migration.indexOf(";", start);
    const ddl = migration.slice(start, end);
    expect(ddl).toContain("survivor_user_id");
    expect(ddl).not.toMatch(/\bemail\b/i);
    expect(ddl).not.toMatch(/\bsms\b/i);
    expect(ddl).not.toMatch(/notify|deliver|send_/i);
  });
});

describe("Guardian CLEAR — attorney paths on same spine", () => {
  it("payment never unlocks Verified", () => {
    expect(payments).toContain("Pending + paid ≠ Verified");
    expect(attorneyPortal).toContain("assertAttorneyVerified");
    expect(attorneyPortal).toContain('verification_status: "pending"');
    expect(migration).toContain("Payment must never be consulted here");
  });

  it("hard-denies attorney survivor name/email/search/lookup", () => {
    expect(() => denyAttorneySurvivorLookup()).toThrow(SURVIVOR_LOOKUP_DENIED_MESSAGE);
    expect(verificationFns).toContain("attorneyLookupSurvivor");
    expect(verificationFns).toContain("denyAttorneySurvivorLookup");
  });

  it("human CLEAR only; bar callback phone required; no scrape-auto-approve", () => {
    expect(verificationFns).toContain("setAttorneyVerificationStatus");
    expect(verificationFns).toContain("setAttorneyBarJurisdictionStatus");
    expect(verificationFns).toContain("Bar CLEAR requires the callback phone from the bar record");
    expect(migration).toContain("bar_callback_phone");
    expect(migration).not.toMatch(/scrape|auto.?approve/i);
  });

  it("requires survivor 'Is this your attorney?' before grant create", () => {
    expect(attorneyInvites).toContain("survivor_confirmed_attorney_at");
    expect(attorneyInvites).toContain("SURVIVOR_CONFIRM_REQUIRED_MESSAGE");
    expect(verificationFns).toContain("confirmAttorneyShareIdentity");
    expect(migration).toContain("survivor_confirmed_attorney_at");
  });

  it("Suspended / left-firm cutoff + staff cascade lives in SQL", () => {
    expect(migration).toContain("set_attorney_verification_status");
    expect(migration).toContain("UPDATE public.attorney_client_links");
    expect(migration).toContain("UPDATE public.case_grants");
    expect(migration).toContain("firm_member_invitations");
    expect(migration).toContain("Staff cascade");
  });

  it("Clio locked until Verified; staff invite requires Verified", () => {
    expect(clioFns).toContain("assertAttorneyVerified");
    expect(firmFns).toContain("assertAttorneyVerified");
  });

  it("6-month still-on-case fails closed when unconfirmed", () => {
    const now = Date.parse("2026-09-19T12:00:00Z");
    expect(isCaseEngagementCurrent("2026-08-01T00:00:00Z", null, now)).toBe(true);
    expect(isCaseEngagementCurrent("2025-01-01T00:00:00Z", null, now)).toBe(false);
    expect(
      isCaseEngagementCurrent("2025-01-01T00:00:00Z", "2026-08-01T00:00:00Z", now),
    ).toBe(true);
    expect(
      isCaseEngagementCurrent("2025-01-01T00:00:00Z", "2025-02-01T00:00:00Z", now),
    ).toBe(false);
    expect(attorneyAccess).toContain("assertLiveEngagement");
    expect(attorneyAccess).toContain("assertVerifiedAttorneyAccess");
  });

  it("legal-aid dual role cannot org-wide pull", () => {
    expect(attorneySurvivorInvites).toContain("assertNotLegalAidOrgWidePull");
    expect(advocateInviteFns).toContain("assertNotLegalAidOrgWidePull");
  });

  it("address hidden by default in share search", () => {
    expect(verificationFns).toContain("address_visible_to_survivors");
    expect(migration).toContain("address_visible_to_survivors boolean NOT NULL DEFAULT false");
  });

  it("types include the shared spine tables", () => {
    for (const t of [
      "attorney_bar_jurisdictions",
      "professional_verification_proofs",
      "professional_suspension_notices",
      "verification_status",
      "case_engagement_confirmed_at",
    ]) {
      expect(types).toContain(t);
    }
  });
});

describe("Verifier negative-test plan (fictional orgs / attorneys)", () => {
  it("documents fail-closed messages for negative runs", () => {
    expect(ORG_NOT_VERIFIED_MESSAGE).toMatch(/not verified/i);
    expect(ATTORNEY_NOT_VERIFIED_MESSAGE).toMatch(/not verified/i);
  });

  it("keeps referral delay so a single fictional signup cannot identify", () => {
    const now = Date.parse("2026-09-19T12:00:00Z");
    expect(isReferralEligibleForReporting("2026-09-18T12:00:00Z", now)).toBe(false);
  });

  it("Suspended cutoff revokes grants before notices in the same function body", () => {
    const orgFn = migration.indexOf("CREATE OR REPLACE FUNCTION public.set_org_verification_status");
    const revokeAt = migration.indexOf("UPDATE public.advocate_client_links", orgFn);
    const noticeAt = migration.indexOf("professional_suspension_notices", orgFn);
    expect(orgFn).toBeGreaterThan(0);
    expect(revokeAt).toBeGreaterThan(orgFn);
    expect(noticeAt).toBeGreaterThan(revokeAt);
  });

  it("no parallel verification system — extends dv_organizations + attorney_profiles", () => {
    expect(allMigrations).toContain("ALTER TABLE public.dv_organizations");
    expect(allMigrations).toContain("ALTER TABLE public.attorney_profiles");
    expect(migration).not.toContain("CREATE TABLE public.org_verification_alt");
  });
});
