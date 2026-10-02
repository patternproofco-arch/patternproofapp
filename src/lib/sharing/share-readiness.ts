/**
 * Survivor sharing readiness — soft claims only.
 * Fail-closed: private / undecided are never auto-included in grants.
 * Choosing "ok_to_share" only marks eligibility when building a share; it does
 * not grant access until the survivor invites someone and includes the item.
 */

export const SHARE_READINESS = ["private", "ok_to_share", "undecided"] as const;
export type ShareReadiness = (typeof SHARE_READINESS)[number];

export function normalizeShareReadiness(value: unknown): ShareReadiness {
  if (value === "ok_to_share" || value === "undecided" || value === "private") return value;
  return "private";
}

/** Eligible to appear in share pickers / "share all" snapshots. */
export function isShareEligible(value: unknown): boolean {
  return normalizeShareReadiness(value) === "ok_to_share";
}

/** Maps readiness (+ live grant state) to one primary chip label. Soft CLEAR. */
export type EntryShareChip =
  | "kept_private"
  | "ok_to_share"
  | "shared"
  | "access_withdrawn"
  | "still_deciding";

export function entryShareChip(opts: {
  readiness: unknown;
  /** True when this entry id is in at least one active grant scope. */
  inActiveGrant?: boolean;
  /** True when it was in a grant that is now fully revoked / expired (and not in any active grant). */
  wasWithdrawn?: boolean;
}): EntryShareChip {
  if (opts.inActiveGrant) return "shared";
  if (opts.wasWithdrawn) return "access_withdrawn";
  const r = normalizeShareReadiness(opts.readiness);
  if (r === "ok_to_share") return "ok_to_share";
  if (r === "undecided") return "still_deciding";
  return "kept_private";
}

export const ENTRY_SHARE_CHIP_COPY: Record<
  EntryShareChip,
  { label: string; aria: string; explainer: string }
> = {
  kept_private: {
    label: "Kept private",
    aria: "Kept private — only you can see this; it won’t show up when you share",
    explainer: "Only you can see this. It won’t show up when you share with someone.",
  },
  ok_to_share: {
    label: "OK to share",
    aria: "OK to share — still only you for now; you can include it if you invite someone",
    explainer: "Still only you for now. You can include it if you invite someone.",
  },
  shared: {
    label: "Shared",
    aria: "Shared — included in what you chose to share with someone",
    explainer: "Included in what you chose to share. You can change or withdraw anytime.",
  },
  access_withdrawn: {
    label: "Access withdrawn",
    aria: "Access withdrawn — you ended sharing for this, or a share expired",
    explainer: "You ended sharing for this, or a share expired. It’s private again.",
  },
  still_deciding: {
    label: "Still deciding",
    aria: "Still deciding — kept private until you choose",
    explainer: "Kept private while you decide. You can change this anytime.",
  },
};
