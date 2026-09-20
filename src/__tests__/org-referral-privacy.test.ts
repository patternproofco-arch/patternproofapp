import { describe, expect, it } from "vitest";
import {
  isReferralEligibleForReporting,
  privacyBucketReferralCount,
} from "@/lib/org-referral-privacy";

describe("organization referral privacy", () => {
  it("suppresses cohorts smaller than ten without distinguishing zero from nine", () => {
    expect(privacyBucketReferralCount(0)).toBeNull();
    expect(privacyBucketReferralCount(1)).toBeNull();
    expect(privacyBucketReferralCount(4)).toBeNull();
    expect(privacyBucketReferralCount(9)).toBeNull();
  });

  it("reports only lower-bound ten-person buckets", () => {
    expect(privacyBucketReferralCount(10)).toBe(10);
    expect(privacyBucketReferralCount(15)).toBe(10);
    expect(privacyBucketReferralCount(19)).toBe(10);
    expect(privacyBucketReferralCount(20)).toBe(20);
  });

  it("delays referral reporting for seven full days", () => {
    const now = Date.parse("2026-08-23T12:00:00Z");
    expect(isReferralEligibleForReporting("2026-08-17T12:00:01Z", now)).toBe(false);
    expect(isReferralEligibleForReporting("2026-08-16T12:00:00Z", now)).toBe(true);
  });
});
