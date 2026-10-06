/**
 * Grant report — numbers derived from PatternProof records (pure, no I/O).
 *
 * Unique-survivor counts and service-event counts are computed separately and
 * never mixed: a person with three follow-ups is one survivor and three events.
 *
 * Definitions (also shown to the user next to each number):
 *  - period: inclusive calendar days from `from` to `to`, read in the report's
 *    specified time zone (see grant-report-period.ts). Old reports default to UTC;
 *  - "completed" uses the follow-up's recorded completion date (`completed_at`),
 *    never the last-edit date. Editing an old completed task does not move it
 *    into a later period. A task marked done with no recorded completion date is
 *    left out of the completed count and named in the caveats, not guessed;
 *  - "activity" for a survivor = access shared, a follow-up created, or a referral
 *    recorded in the period;
 *  - events with no survivor attached cannot be attributed to a person, so they are
 *    counted as events but left out of unique-survivor counts, and the caveat says so.
 */

import type { Derived } from "@/lib/grant-report-model";
import { DEFAULT_PERIOD_TIMEZONE, inPeriod, periodBounds } from "@/lib/grant-report-period";

export type LinkRow = {
  client_user_id: string;
  created_at: string;
  revoked_at: string | null;
};
export type FollowUpRow = {
  survivor_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  /** When the task was actually completed. Set once on completion; edits don't move it. */
  completed_at?: string | null;
};
export type ReferralRow = {
  survivor_user_id: string | null;
  created_at: string;
};

export type DeriveInput = {
  links: readonly LinkRow[];
  followUps: readonly FollowUpRow[];
  referrals: readonly ReferralRow[];
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  /** IANA zone the period is read in. Defaults to UTC for reports made before this existed. */
  timeZone?: string;
  /**
   * "recorded": follow-ups carry completed_at. "unavailable": the database update
   * that adds it hasn't been applied, so completions can't be dated and the
   * completed count is null (unknown), never a last-edit-date guess.
   */
  completionDates?: "recorded" | "unavailable";
};

const DONE = new Set(["done", "completed", "closed", "resolved"]);

export { periodBounds } from "@/lib/grant-report-period";

export function deriveGrantMetrics(input: DeriveInput): { derived: Derived; caveats: string[] } {
  const bounds = periodBounds(input.from, input.to, input.timeZone ?? DEFAULT_PERIOD_TIMEZONE);
  const inRange = (iso: string | null | undefined) => inPeriod(bounds, iso);
  const completionDates = input.completionDates ?? "recorded";

  const active = new Set<string>();
  const sharedRecords = new Set<string>();
  const endedSharing = new Set<string>();
  const withFollowUp = new Set<string>();
  const referred = new Set<string>();
  let grantsStarted = 0;

  for (const l of input.links) {
    if (inRange(l.created_at)) {
      grantsStarted++;
      sharedRecords.add(l.client_user_id);
      active.add(l.client_user_id);
    }
    if (inRange(l.revoked_at)) endedSharing.add(l.client_user_id);
  }

  let followUpsCreated = 0;
  let followUpsDone = 0;
  let doneWithoutDate = 0;
  let unattributedFollowUps = 0;
  for (const f of input.followUps) {
    if (inRange(f.created_at)) {
      followUpsCreated++;
      if (f.survivor_user_id) {
        withFollowUp.add(f.survivor_user_id);
        active.add(f.survivor_user_id);
      } else {
        unattributedFollowUps++;
      }
    }
    // Completed = the recorded completion date, never updated_at (last edit).
    if (completionDates === "recorded" && DONE.has(String(f.status).toLowerCase())) {
      if (!f.completed_at) doneWithoutDate++;
      else if (inRange(f.completed_at)) followUpsDone++;
    }
  }

  let referralsRecorded = 0;
  let unattributedReferrals = 0;
  for (const r of input.referrals) {
    if (!inRange(r.created_at)) continue;
    referralsRecorded++;
    if (r.survivor_user_id) {
      referred.add(r.survivor_user_id);
      active.add(r.survivor_user_id);
    } else {
      unattributedReferrals++;
    }
  }

  const caveats: string[] = [];
  if (unattributedFollowUps + unattributedReferrals > 0) {
    caveats.push(
      `${unattributedFollowUps} follow-up(s) and ${unattributedReferrals} referral(s) have no survivor attached. They are counted as events but cannot be counted as unique survivors, so unique-survivor numbers may be low.`,
    );
  }
  if (completionDates === "unavailable") {
    caveats.push(
      "'Follow-ups completed' can't be counted yet: completion dates aren't being recorded until a one-time database update is applied. It is not zero, and it is not estimated from the date a task was last edited.",
    );
  } else if (doneWithoutDate > 0) {
    caveats.push(
      `${doneWithoutDate} follow-up(s) are marked done but have no recorded completion date (most likely finished before completion dates were recorded). They are left out of 'Follow-ups completed' rather than dated by their last edit. If your own records show when they were done, add them as a staff note.`,
    );
  }

  return {
    derived: {
      clients_with_activity: active.size,
      clients_who_shared_records: sharedRecords.size,
      access_grants_started: grantsStarted,
      access_ended: endedSharing.size,
      follow_ups_created: followUpsCreated,
      follow_ups_completed: completionDates === "unavailable" ? null : followUpsDone,
      clients_with_follow_up: withFollowUp.size,
      referrals_recorded: referralsRecorded,
      clients_referred: referred.size,
    },
    caveats,
  };
}
