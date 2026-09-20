/**
 * 180-day "still on this case?" cutoff for attorney_client_links.
 *
 * Rule end-to-end:
 *  - Clock is case_engagement_confirmed_at, else created_at.
 *  - Attorney reminders at day 150 / 165 / 175.
 *  - Survivor gets one in-app-only notice at day 173 (never emailed/texted).
 *  - Access ends at day 180. Query-time assertLink also fail-closes on day 180
 *    even if this sweep has not run yet.
 *
 * nextCutoffAction is pure. runAttorneyAccessCutoffSweep is the only DB writer.
 */

import {
  ACCESS_CUTOFF_DAYS,
  isPastAccessCutoff,
} from "@/lib/professional-verification.server";

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
  created_at: string;
  case_engagement_confirmed_at: string | null;
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

export function daysSinceEngagement(link: CutoffLink, now: Date = new Date()): number {
  const start = link.case_engagement_confirmed_at || link.created_at;
  return Math.floor((now.getTime() - new Date(start).getTime()) / DAY_MS);
}

/**
 * Priority: cutoff already due > survivor notice > attorney reminder.
 * One action per call; sweep re-evaluates on the next pass.
 */
export function nextCutoffAction(link: CutoffLink, now: Date = new Date()): CutoffAction {
  if (isPastAccessCutoff(link.created_at, link.case_engagement_confirmed_at, now.getTime())) {
    return { type: "cutoff" };
  }
  const days = daysSinceEngagement(link, now);
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
  const { deliverTransactionalEmail } = await import(
    "@/lib/email/deliver-transactional.server"
  );
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
 * Idempotent daily sweep. Safe to run more than once: each action checks its
 * own *_sent_at / status first.
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
      "id,attorney_user_id,client_user_id,created_at,case_engagement_confirmed_at,reminder_150_sent_at,reminder_165_sent_at,reminder_175_sent_at,survivor_notice_sent_at",
    )
    .eq("status", "active");

  const links = (data ?? []) as CutoffLink[];
  const result: CutoffSweepResult = {
    reminders_sent: 0,
    survivor_notices_sent: 0,
    links_cut_off: 0,
  };

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
      // In-app only — never emailed or texted.
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
