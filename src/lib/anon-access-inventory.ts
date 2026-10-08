/**
 * What the Postgres `anon` role (signed-out browser + publishable key) may do
 * in schema public. Single source of truth for
 * supabase/migrations/20261008130000_anon_revoke_all_default_privileges.sql;
 * src/__tests__/anon-access-inventory.test.ts fails if the two drift or if a
 * new signed-out browser call appears that is not listed here.
 *
 * Not imported by the app. Documentation + test fixture only.
 */

export type AnonGrant = {
  table: string;
  privileges: Array<"INSERT" | "SELECT" | "UPDATE" | "DELETE">;
  /** Columns, when a column-level grant is enough. Omit for table-level. */
  columns?: string[];
  callSites: string[];
  why: string;
};

/** The ONLY anon grants the migration re-creates. */
export const ANON_TABLE_GRANTS: AnonGrant[] = [
  {
    table: "feedback_submissions",
    privileges: ["INSERT"],
    callSites: ["src/routes/org-feedback.tsx"],
    why:
      "Public /org-feedback form for DV orgs (no account). Insert without .select() " +
      "(Prefer: return=minimal), so no SELECT needed. RLS: anon may insert only " +
      "audience = 'org' AND user_id IS NULL. uuid PK, no sequence.",
  },
];

/**
 * Objects that once had (or might be assumed to need) anon access but do NOT:
 * every caller goes through a server function with the service role, or runs
 * only after sign-in (role `authenticated`).
 */
export const NOT_ANON: Array<{ object: string; op: string; callSites: string[]; why: string }> = [
  {
    object: "org_access_requests",
    op: "INSERT",
    callSites: ["src/lib/org-portal.functions.ts"],
    why: "server functions use supabaseAdmin (service role)",
  },
  {
    object: "marketing_leads",
    op: "INSERT",
    callSites: ["src/lib/marketing-leads.functions.ts"],
    why: "server function uses supabaseAdmin with its own rate limit",
  },
  {
    object: "waitlist_signups",
    op: "INSERT",
    callSites: [],
    why: "no caller in src; already locked down (#108, 20260924100000)",
  },
  {
    object: "support_requests",
    op: "INSERT",
    callSites: ["src/lib/support.functions.ts"],
    why: "founding-tester / support forms call a server function using supabaseAdmin",
  },
  {
    object: "incidents, evidence",
    op: "SELECT",
    callSites: ["src/routes/survivor-invite.$token.tsx"],
    why: "only runs once the survivor is signed in (user.id), so role authenticated",
  },
  {
    object: "notifications, subscriptions (incl. realtime)",
    op: "SELECT/UPDATE",
    callSites: ["src/components/NotificationBanner.tsx", "src/hooks/useSubscription.ts"],
    why: "guarded by a signed-in user",
  },
];

/**
 * Browser-client files outside the signed-in route groups whose table calls
 * are signed-in-only (checked by hand, see NOT_ANON). Any other public file
 * that starts using the browser client must be added to ANON_TABLE_GRANTS or
 * here, with a reason.
 */
export const PUBLIC_FILES_SIGNED_IN_ONLY = ["src/routes/survivor-invite.$token.tsx"];
