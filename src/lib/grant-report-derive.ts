/**
 * Grant report — numbers derived from PatternProof records (pure, no I/O).
 *
 * Unique-survivor counts and service-event counts are computed separately and
 * never mixed: a person with three follow-ups is one survivor and three events.
 *
 * Definitions (also shown to the user next to each number):
 *  - period: inclusive, UTC calendar days from `from` to `to`;
 *  - "activity" for a survivor = access shared, a follow-up created, or a referral
 *    recorded in the period;
 *  - events with no survivor attached cannot be attributed to a person, so they are
 *    counted as events but left out of unique-survivor counts, and the caveat says so.
 */

import type { Derived } from "@/lib/grant-report-model";

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
};

const DONE = new Set(["done", "completed", "closed", "resolved"]);

export function periodBounds(from: string, to: string) {
  return { fromIso: `${from}T00:00:00.000Z`, toIso: `${to}T23:59:59.999Z` };
}

export function deriveGrantMetrics(input: DeriveInput): { derived: Derived; caveats: string[] } {
  const { fromIso, toIso } = periodBounds(input.from, input.to);
  const inRange = (iso: string | null | undefined) => !!iso && iso >= fromIso && iso <= toIso;

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
    // The table records when a task was last changed, not when it was completed.
    if (DONE.has(f.status) && inRange(f.updated_at)) followUpsDone++;
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
  if (followUpsDone > 0) {
    caveats.push(
      "'Follow-ups marked done' uses the date a task was last changed, because the completion date is not stored separately. A task finished earlier but edited in this period is counted here.",
    );
  }

  return {
    derived: {
      clients_with_activity: active.size,
      clients_who_shared_records: sharedRecords.size,
      access_grants_started: grantsStarted,
      access_ended: endedSharing.size,
      follow_ups_created: followUpsCreated,
      follow_ups_completed: followUpsDone,
      clients_with_follow_up: withFollowUp.size,
      referrals_recorded: referralsRecorded,
      clients_referred: referred.size,
    },
    caveats,
  };
}
