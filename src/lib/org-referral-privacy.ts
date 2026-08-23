const MINIMUM_REPORTING_COHORT = 5;
const REPORTING_BUCKET_SIZE = 5;
const REPORTING_DELAY_MS = 7 * 86_400_000;

/**
 * Exact or near-real-time referral totals can identify a survivor when an
 * organization distributes a link to only one person. Delay eligibility and
 * return only five-person lower-bound buckets.
 */
export function isReferralEligibleForReporting(createdAt: string, now = Date.now()) {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && now - timestamp >= REPORTING_DELAY_MS;
}

export function privacyBucketReferralCount(count: number): number | null {
  if (!Number.isFinite(count) || count < MINIMUM_REPORTING_COHORT) return null;
  return Math.floor(count / REPORTING_BUCKET_SIZE) * REPORTING_BUCKET_SIZE;
}
