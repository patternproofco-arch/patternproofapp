import { describe, expect, it } from "vitest";
import {
  isReferralEligibleForReporting,
  privacyBucketReferralCount,
} from "@/lib/org-referral-privacy";

describe("organization referral privacy", () => {
  it("suppresses cohorts smaller than five without distinguishing zero from four", () => {
    expect(privacyBucketReferralCount(0)).toBeNull();
    expect(privacyBucketReferralCount(1)).toBeNull();
    expect(privacyBucketReferralCount(4)).toBeNull();
  });

  it("reports only lower-bound five-person buckets", () => {
    expect(privacyBucketReferralCount(5)).toBe(5);
    expect(privacyBucketReferralCount(9)).toBe(5);
    expect(privacyBucketReferralCount(10)).toBe(10);
  });

  it("delays referral reporting for seven full days", () => {
    const now = Date.parse("2026-08-23T12:00:00Z");
    expect(isReferralEligibleForReporting("2026-08-17T12:00:01Z", now)).toBe(false);
    expect(isReferralEligibleForReporting("2026-08-16T12:00:00Z", now)).toBe(true);
  });
});
