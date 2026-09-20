/**
 * The 180-day "still on this case?" cutoff for attorney_client_links.
 *
 * The rule, end to end:
 *  - Every active link carries last_confirmed_at, reset whenever the
 *    attorney confirms they're still on the case or the survivor taps
 *    "keep access going."
 *  - The attorney gets reminders at day 150, 165 and 175.
 *  - The survivor gets a single in-app (never emailed/texted) notice at day
 *    173 — 7 days out — with a one-tap way to extend it herself.
 *  - Nobody acts, access ends at day 180. attorney-access.server.ts also
 *    checks this at read time, so a request landing exactly on day 180
 *    fails closed even if this sweep hasn't run yet this cycle.
 *
 * nextCutoffAction is pure and unit-tested directly. The sweep function is
 * the only part that touches the database, and takes the admin client and
 * the reminder-sender as arguments so it can run against the in-memory
 * fake in tests too.
 */

import { ACCESS_CUTOFF_DAYS, isPastAccessCutoff } from "@/lib/attorney-access.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

const DAY_MS = 24 * 60 * 60 * 1000;

export const REMINDER_DAY_150 = 150;
export const REMINDER_DAY_165 = 165;
export const REMINDER_DAY_175 = 175;
/** 7 days before the 180-day cutoff. */
export const SURVIVOR_NOTICE_DAY = ACCESS_CUTOFF_DAYS - 7;

export type CutoffLink = {
  id: string;
  attorney_user_id: string;
  client_user_id: string;
  last_confirmed_at: string;
  reminder_150_sent_at: string | null;
  reminder_165_sent_at: string | null;
  reminder_175_sent_at: string | null;
  survivor_notice_sent_at: string | null;
};

export type CutoffAction =
  | { type: "cutoff" }
  | { type: "survivor_notice" }
  | { type: "reminder"; day: 150 | 165 | 175 }
  | null;

export function daysSinceConfirmed(lastConfirmedAt: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(lastConfirmedAt).getTime()) / DAY_MS);
}

/**
 * What is due for this link right now. Priority order: a cutoff that has
 * already arrived beats everything else; then the survivor's one warning;
 * then whichever attorney reminder is both due and not already sent. Only
 * one action is ever returned per call — the sweep re-evaluates each link
 * on its next pass rather than trying to fire several actions in one go.
 */
export function nextCutoffAction(link: CutoffLink, now: Date = new Date()): CutoffAction {
  if (isPastAccessCutoff(link.last_confirmed_at)) return { type: "cutoff" };
  const days = daysSinceConfirmed(link.last_confirmed_at, now);
  if (days >= SURVIVOR_NOTICE_DAY && !link.survivor_notice_sent_at) {
    return { type: "survivor_notice" };
  }
  if (days >= REMINDER_DAY_175 && !link.reminder_175_sent_at) return { type: "reminder", day: 175 };
  if (days >= REMINDER_DAY_165 && !link.reminder_165_sent_at) return { type: "reminder", day: 165 };
  if (days >= REMINDER_DAY_150 && !link.reminder_150_sent_at) return { type: "reminder", day: 150 };
  return null;
}

const REMINDER_COLUMN: Record<150 | 165 | 175, string> = {
  150: "reminder_150_sent_at",
  165: "reminder_165_sent_at",
  175: "reminder_175_sent_at",
};

export type ReminderSender = (
  admin: Admin,
  link: CutoffLink,
  day: 150 | 165 | 175,
) => Promise<void>;

async function defaultReminderSender(admin: Admin, link: CutoffLink, day: 150 | 165 | 175) {
  const { data: user } = await admin.auth.admin.getUserById(link.attorney_user_id);
  const email = user?.user?.email;
  if (!email) return;
  const { deliverTransactionalEmail } = await import("@/lib/email/deliver-transactional.server");
  await deliverTransactionalEmail({
    templateName: "attorney-still-on-case-reminder",
    recipientEmail: email,
    idempotencyKey: `attorney-cutoff-reminder-${link.id}-${day}`,
    templateData: {
      day,
      daysRemaining: ACCESS_CUTOFF_DAYS - day,
    },
  });
}

export type CutoffSweepResult = {
  reminders_sent: number;
  survivor_notices_sent: number;
  links_cut_off: number;
};

/**
 * Runs once per invocation over every active link. Idempotent: an action
 * already recorded (a *_sent_at timestamp, or status already flipped) is
 * never repeated, so calling this more than once in a day is harmless —
 * there is no cron trigger wired into this deploy yet, so it is meant to be
 * called from a manually- or externally-triggered HTTP route.
 */
export async function runAttorneyAccessCutoffSweep(
  admin: Admin,
  options: { now?: Date; sendReminder?: ReminderSender } = {},
): Promise<CutoffSweepResult> {
  const now = options.now ?? new Date();
  const sendReminder = options.sendReminder ?? defaultReminderSender;

  const { data } = await admin
    .from("attorney_client_links")
    .select(
      "id,attorney_user_id,client_user_id,last_confirmed_at,reminder_150_sent_at,reminder_165_sent_at,reminder_175_sent_at,survivor_notice_sent_at",
    )
    .eq("status", "active");

  const links = (data ?? []) as CutoffLink[];
  const result: CutoffSweepResult = { reminders_sent: 0, survivor_notices_sent: 0, links_cut_off: 0 };

  for (const link of links) {
    const action = nextCutoffAction(link, now);
    if (!action) continue;

    if (action.type === "cutoff") {
      await admin
        .from("attorney_client_links")
        .update({ status: "cutoff", cutoff_at: now.toISOString() })
        .eq("id", link.id);
      result.links_cut_off++;
      continue;
    }

    if (action.type === "survivor_notice") {
      await admin.from("attorney_access_notices").insert({
        link_id: link.id,
        client_user_id: link.client_user_id,
        notice_type: "cutoff_warning",
      });
      // Also surfaces in the app-wide NotificationBanner (in-app only —
      // never emailed or texted). The dedicated attorney_access_notices row
      // above is what backs the actual "keep access going" tap.
      await admin.from("notifications").insert({
        user_id: link.client_user_id,
        kind: "attorney_access_cutoff_warning",
        title: "Your attorney's access is about to expire",
        body: "It's been almost 6 months since this was last confirmed. Open Share with attorney to keep it going, or it ends automatically in 7 days.",
        metadata: { link_id: link.id },
      });
      await admin
        .from("attorney_client_links")
        .update({ survivor_notice_sent_at: now.toISOString() })
        .eq("id", link.id);
      result.survivor_notices_sent++;
      continue;
    }

    await sendReminder(admin, link, action.day);
    await admin
      .from("attorney_client_links")
      .update({ [REMINDER_COLUMN[action.day]]: now.toISOString() })
      .eq("id", link.id);
    result.reminders_sent++;
  }

  return result;
}
