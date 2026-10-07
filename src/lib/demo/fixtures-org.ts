/**
 * Fictional organization-portal fixtures for /demo/org.
 * Grant categories come only from DEFAULT_TEMPLATE on main (grant-report-model).
 * Survivor ids are opaque fictional strings — never real user ids.
 */
import type { FollowUpRow, LinkRow, ReferralRow } from "@/lib/grant-report-derive";

export const DEMO_ORG = {
  name: "Riverbend Family Support Center (fictional)",
  contactEmail: "partners@example.invalid",
  phone: "(555) 010-0188",
  periodFrom: "2026-07-01",
  periodTo: "2026-09-30",
  timeZone: "America/New_York",
} as const;

export const DEMO_ORG_STAFF = [
  { name: "Jordan Lee (fictional)", role: "Advocate", email: "jordan.lee@example.invalid" },
  { name: "Sam Ortiz (fictional)", role: "Program lead", email: "sam.ortiz@example.invalid" },
] as const;

const s = (n: number) => `demo-survivor-${String(n).padStart(2, "0")}`;

export const DEMO_ORG_LINKS: LinkRow[] = [
  { client_user_id: s(1), created_at: "2026-07-03T14:00:00Z", revoked_at: null },
  { client_user_id: s(2), created_at: "2026-07-11T16:30:00Z", revoked_at: null },
  { client_user_id: s(3), created_at: "2026-07-28T13:15:00Z", revoked_at: null },
  { client_user_id: s(4), created_at: "2026-08-06T18:00:00Z", revoked_at: "2026-09-02T12:00:00Z" },
  { client_user_id: s(5), created_at: "2026-08-19T15:45:00Z", revoked_at: null },
  { client_user_id: s(6), created_at: "2026-09-04T17:20:00Z", revoked_at: null },
  { client_user_id: s(7), created_at: "2026-09-15T14:10:00Z", revoked_at: null },
];

export const DEMO_ORG_FOLLOW_UPS: FollowUpRow[] = [
  {
    survivor_user_id: s(1),
    status: "done",
    created_at: "2026-07-05T14:00:00Z",
    updated_at: "2026-07-09T14:00:00Z",
    completed_at: "2026-07-09T14:00:00Z",
  },
  {
    survivor_user_id: s(1),
    status: "open",
    created_at: "2026-08-01T14:00:00Z",
    updated_at: null,
    completed_at: null,
  },
  {
    survivor_user_id: s(2),
    status: "done",
    created_at: "2026-07-14T14:00:00Z",
    updated_at: "2026-07-20T14:00:00Z",
    completed_at: "2026-07-20T14:00:00Z",
  },
  {
    survivor_user_id: s(3),
    status: "done",
    created_at: "2026-08-02T14:00:00Z",
    updated_at: "2026-08-10T14:00:00Z",
    completed_at: "2026-08-10T14:00:00Z",
  },
  {
    survivor_user_id: s(5),
    status: "open",
    created_at: "2026-08-22T14:00:00Z",
    updated_at: null,
    completed_at: null,
  },
  {
    survivor_user_id: s(6),
    status: "done",
    created_at: "2026-09-06T14:00:00Z",
    updated_at: "2026-09-12T14:00:00Z",
    completed_at: "2026-09-12T14:00:00Z",
  },
  {
    survivor_user_id: s(7),
    status: "open",
    created_at: "2026-09-18T14:00:00Z",
    updated_at: null,
    completed_at: null,
  },
  {
    survivor_user_id: null,
    status: "done",
    created_at: "2026-09-20T14:00:00Z",
    updated_at: "2026-09-21T14:00:00Z",
    completed_at: "2026-09-21T14:00:00Z",
  },
];

export const DEMO_ORG_REFERRALS: ReferralRow[] = [
  { survivor_user_id: s(1), created_at: "2026-07-04T14:00:00Z" },
  { survivor_user_id: s(2), created_at: "2026-07-12T14:00:00Z" },
  { survivor_user_id: s(3), created_at: "2026-07-29T14:00:00Z" },
  { survivor_user_id: s(3), created_at: "2026-08-15T14:00:00Z" },
  { survivor_user_id: s(5), created_at: "2026-08-20T14:00:00Z" },
  { survivor_user_id: s(6), created_at: "2026-09-05T14:00:00Z" },
  { survivor_user_id: s(7), created_at: "2026-09-16T14:00:00Z" },
];

/** Fictional referral-source rows for the partner dashboard (counts only). */
export const DEMO_ORG_REFERRAL_SOURCES = [
  { label: "Hotline follow-up (fictional)", count: 3 },
  { label: "Courthouse help desk (fictional)", count: 2 },
  { label: "Community clinic (fictional)", count: 2 },
] as const;
