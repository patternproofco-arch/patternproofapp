import { describe, it, expect } from "vitest";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";
import {
  assertLink,
  ACCESS_CUTOFF_DAYS,
  isPastAccessCutoff,
  redactIncidentLocation,
} from "@/lib/attorney-access.server";
import {
  nextCutoffAction,
  runAttorneyAccessCutoffSweep,
  REMINDER_DAY_150,
  REMINDER_DAY_165,
  REMINDER_DAY_175,
  SURVIVOR_NOTICE_DAY,
  type CutoffLink,
} from "@/lib/attorney-access-cutoff.server";

/** Fictional QA only — no real people, no production ids. */

const ATTY_A = "qa-attorney-a";
const ATTY_B = "qa-attorney-b";
const SURV_A = "qa-survivor-a";
const LINK_A = "qa-link-a";
const CASE_A = "qa-case-a";
const FIRM = "qa-firm-1";
const DAY = 86_400_000;
const future = new Date(Date.now() + DAY).toISOString();

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString();
}

function verifiedAttorney(userId: string) {
  return {
    user_id: userId,
    verification_status: "verified",
    verification_expires_at: future,
    bar_callback_phone: "555-0100",
    address_visible_to_survivors: false,
    legal_aid_dual_role: false,
    office_address: null,
  };
}

function world(overrides: Partial<Tables> = {}): Tables {
  return {
    user_roles: [
      { user_id: ATTY_A, role: "attorney" },
      { user_id: ATTY_B, role: "attorney" },
      { user_id: SURV_A, role: "survivor" },
    ],
    firm_members: [
      { user_id: ATTY_A, firm_id: FIRM },
      { user_id: ATTY_B, firm_id: FIRM },
    ],
    attorney_profiles: [verifiedAttorney(ATTY_A), verifiedAttorney(ATTY_B)],
    attorney_bar_jurisdictions: [
      {
        attorney_user_id: ATTY_A,
        jurisdiction: "NJ",
        verification_status: "verified",
        verification_expires_at: future,
      },
      {
        attorney_user_id: ATTY_B,
        jurisdiction: "NJ",
        verification_status: "verified",
        verification_expires_at: future,
      },
    ],
    attorney_client_links: [
      {
        id: LINK_A,
        attorney_user_id: ATTY_A,
        client_user_id: SURV_A,
        status: "active",
        include_all_incidents: true,
        include_all_evidence: true,
        include_patterns: true,
        include_voice_notes: false,
        include_communications: false,
        include_legal_documents: false,
        scope_incidents: [],
        scope_evidence: [],
        case_id: CASE_A,
        expires_at: null,
        created_at: daysAgo(1),
        case_engagement_confirmed_at: daysAgo(1),
        reminder_150_sent_at: null,
        reminder_165_sent_at: null,
        reminder_175_sent_at: null,
        survivor_notice_sent_at: null,
      },
    ],
    cases: [
      {
        id: CASE_A,
        user_id: SURV_A,
        highlighted_incident_ids: [],
        attached_evidence_ids: [],
        legal_document_ids: [],
        attached_thread_ids: [],
      },
    ],
    case_collaborators: [],
    case_grants: [],
    attorney_access_notices: [],
    notifications: [],
    ...overrides,
  };
}

function cutoffLink(partial: Partial<CutoffLink> = {}): CutoffLink {
  return {
    id: LINK_A,
    attorney_user_id: ATTY_A,
    client_user_id: SURV_A,
    created_at: daysAgo(1),
    case_engagement_confirmed_at: daysAgo(1),
    reminder_150_sent_at: null,
    reminder_165_sent_at: null,
    reminder_175_sent_at: null,
    survivor_notice_sent_at: null,
    ...partial,
  };
}

describe("Verified-only + payment≠Verified", () => {
  it("refuses a paid-but-pending attorney at query time", async () => {
    const t = world({
      attorney_profiles: [
        {
          ...verifiedAttorney(ATTY_A),
          verification_status: "pending",
          verification_expires_at: null,
        },
      ],
    });
    await expect(assertLink(fakeAdmin(t), ATTY_A, SURV_A)).rejects.toThrow();
  });

  it("suspend cascade: suspended owner blocks the next assertLink", async () => {
    const t = world({
      attorney_profiles: [
        {
          ...verifiedAttorney(ATTY_A),
          verification_status: "suspended",
          verification_expires_at: null,
        },
      ],
    });
    await expect(assertLink(fakeAdmin(t), ATTY_A, SURV_A)).rejects.toThrow();
  });
});

describe("180-day cutoff", () => {
  it("isPastAccessCutoff is inclusive at day 180", () => {
    expect(isPastAccessCutoff(daysAgo(ACCESS_CUTOFF_DAYS), null)).toBe(true);
    expect(isPastAccessCutoff(daysAgo(ACCESS_CUTOFF_DAYS - 1), null)).toBe(false);
  });

  it("cuts access at day 180 regardless of what else is pending", () => {
    expect(
      nextCutoffAction(cutoffLink({ case_engagement_confirmed_at: daysAgo(ACCESS_CUTOFF_DAYS) })),
    ).toEqual({ type: "cutoff" });
  });

  it("warns the survivor at day 173", () => {
    expect(SURVIVOR_NOTICE_DAY).toBe(ACCESS_CUTOFF_DAYS - 7);
    expect(
      nextCutoffAction(
        cutoffLink({
          case_engagement_confirmed_at: daysAgo(SURVIVOR_NOTICE_DAY),
          reminder_150_sent_at: daysAgo(1),
          reminder_165_sent_at: daysAgo(1),
          reminder_175_sent_at: daysAgo(1),
        }),
      ),
    ).toEqual({ type: "survivor_notice" });
  });

  it("fires attorney reminders at 150/165/175 when due and unsent", () => {
    expect(
      nextCutoffAction(cutoffLink({ case_engagement_confirmed_at: daysAgo(REMINDER_DAY_150) })),
    ).toEqual({ type: "reminder", day: 150 });
    expect(
      nextCutoffAction(
        cutoffLink({
          case_engagement_confirmed_at: daysAgo(REMINDER_DAY_165),
          reminder_150_sent_at: daysAgo(1),
        }),
      ),
    ).toEqual({ type: "reminder", day: 165 });
    expect(
      nextCutoffAction(
        cutoffLink({
          case_engagement_confirmed_at: daysAgo(REMINDER_DAY_175),
          reminder_150_sent_at: daysAgo(1),
          reminder_165_sent_at: daysAgo(1),
          survivor_notice_sent_at: daysAgo(1),
        }),
      ),
    ).toEqual({ type: "reminder", day: 175 });
  });

  it("assertLink fails closed on day 180 even if the sweep has not flipped status", async () => {
    const t = world();
    t["attorney_client_links"]![0]!["case_engagement_confirmed_at"] = daysAgo(ACCESS_CUTOFF_DAYS);
    t["attorney_client_links"]![0]!["created_at"] = daysAgo(ACCESS_CUTOFF_DAYS + 10);
    await expect(assertLink(fakeAdmin(t), ATTY_A, SURV_A)).rejects.toThrow();
  });

  it("sweep cuts off, warns survivor, and sends reminders exactly once", async () => {
    const REMIND = "link-remind";
    const WARN = "link-warn";
    const CUT = "link-cut";
    const t: Tables = {
      attorney_client_links: [
        {
          id: REMIND,
          attorney_user_id: ATTY_A,
          client_user_id: SURV_A,
          status: "active",
          created_at: daysAgo(160),
          case_engagement_confirmed_at: daysAgo(150),
          reminder_150_sent_at: null,
          reminder_165_sent_at: null,
          reminder_175_sent_at: null,
          survivor_notice_sent_at: null,
        },
        {
          id: WARN,
          attorney_user_id: ATTY_A,
          client_user_id: SURV_A,
          status: "active",
          created_at: daysAgo(180),
          case_engagement_confirmed_at: daysAgo(173),
          reminder_150_sent_at: daysAgo(23),
          reminder_165_sent_at: daysAgo(8),
          reminder_175_sent_at: null,
          survivor_notice_sent_at: null,
        },
        {
          id: CUT,
          attorney_user_id: ATTY_A,
          client_user_id: SURV_A,
          status: "active",
          created_at: daysAgo(200),
          case_engagement_confirmed_at: daysAgo(181),
          reminder_150_sent_at: daysAgo(31),
          reminder_165_sent_at: daysAgo(16),
          reminder_175_sent_at: daysAgo(6),
          survivor_notice_sent_at: daysAgo(1),
        },
      ],
      attorney_access_notices: [],
      notifications: [],
    };
    const sent: Array<{ id: string; day: number }> = [];
    const result = await runAttorneyAccessCutoffSweep(fakeAdmin(t), {
      sendReminder: async (_admin, link, day) => {
        sent.push({ id: link.id, day });
      },
    });
    expect(result.reminders_sent).toBe(1);
    expect(result.survivor_notices_sent).toBe(1);
    expect(result.links_cut_off).toBe(1);
    expect(sent).toEqual([{ id: REMIND, day: 150 }]);
    expect(t["attorney_client_links"]!.find((l) => l.id === CUT)!["status"]).toBe("cutoff");
    expect(t["attorney_access_notices"]!.length).toBe(1);
  });
});

describe("incident location redaction", () => {
  it("redacts location by default and keeps it when opted in", () => {
    expect(
      redactIncidentLocation({ id: "i1", location: "12 Oak St", location_reveal_opt_in: false }),
    ).toEqual({ id: "i1", location: null });
    expect(
      redactIncidentLocation({ id: "i2", location: "12 Oak St", location_reveal_opt_in: true }),
    ).toEqual({ id: "i2", location: "12 Oak St" });
  });
});
