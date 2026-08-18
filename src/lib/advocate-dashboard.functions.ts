import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { advocateClient } from "@/lib/record-requests.server";

/**
 * Home-screen counts for the DV organization portal.
 *
 * Same privacy boundary as org-portal.functions.ts: counts, statuses and
 * timestamps of the advocate's OWN coordination rows only. No survivor names,
 * emails, ids or record content crosses this line.
 */

export type AdvocateDashboard = {
  profile: { full_name: string | null; org_name: string | null } | null;
  clients: {
    active: number;
    new_this_month: number;
    new_last_month: number;
    /** Active links created per week, oldest first (8 weeks). */
    weekly: number[];
  };
  referral_links: number;
  open_follow_ups: number;
  record_requests: number;
  activity: Array<{
    id: string;
    kind: "client_link" | "follow_up" | "audit";
    title: string;
    subtitle: string | null;
    timestamp: string;
  }>;
};

const WEEKS = 8;

function startOfWeek(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - c.getDay());
  return c;
}

const AUDIT_LABEL: Record<string, string> = {
  record_request_created: "You sent a record request",
  record_request_withdrawn: "You withdrew a record request",
  consent_grant_viewed: "You opened a consent receipt",
  follow_up_created: "You logged a follow-up",
  follow_up_updated: "You updated a follow-up",
};

export const getAdvocateDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvocateDashboard> => {
    const db = await advocateClient(context.userId);
    const uid = context.userId;

    const [profileQ, linksQ, referralQ, followUpQ, requestQ, auditQ] = await Promise.all([
      db.from("advocate_profiles").select("full_name,org_name").eq("user_id", uid).maybeSingle(),
      db.from("advocate_client_links")
        .select("id,status,created_at,case_id")
        .eq("advocate_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("referral_links").select("code", { count: "exact", head: true }).eq("org_user_id", uid),
      db.from("org_follow_ups")
        .select("id,status,reference_label,created_at,due_at")
        .eq("org_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(200),
      db.from("record_requests").select("id", { count: "exact", head: true }).eq("requester_user_id", uid),
      db.from("audit_events")
        .select("id,event_type,created_at")
        .eq("actor_id", uid)
        .eq("actor_kind", "advocate")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const links = (linksQ.data ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const followUps = (followUpQ.data ?? []) as any[];

    const now = new Date();
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const mPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const thisWeek = startOfWeek(now);
    const weekly = new Array(WEEKS).fill(0) as number[];

    let active = 0;
    let newThisMonth = 0;
    let newLastMonth = 0;
    for (const l of links) {
      if (l.status === "active") active += 1;
      const t = new Date(l.created_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= m0) newThisMonth += 1;
      else if (t >= mPrev) newLastMonth += 1;
      const weeksAgo = Math.floor((thisWeek.getTime() - startOfWeek(new Date(t)).getTime()) / (7 * 86400_000));
      if (weeksAgo >= 0 && weeksAgo < WEEKS) weekly[WEEKS - 1 - weeksAgo] += 1;
    }

    const activity: AdvocateDashboard["activity"] = [
      ...links.slice(0, 5).map((l) => ({
        id: `link-${l.id}`,
        kind: "client_link" as const,
        title: l.status === "active" ? "A workspace was shared with you" : "A shared workspace ended",
        subtitle: l.case_id ? "Scoped to one case" : "Scope set by the survivor",
        timestamp: l.created_at as string,
      })),
      ...followUps.slice(0, 5).map((f) => ({
        id: `fu-${f.id}`,
        kind: "follow_up" as const,
        title: f.reference_label ? `Follow-up: ${f.reference_label}` : "Follow-up logged",
        subtitle: f.status === "completed" ? "Completed" : "Open",
        timestamp: f.created_at as string,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((auditQ.data ?? []) as any[]).map((a) => ({
        id: `au-${a.id}`,
        kind: "audit" as const,
        title: AUDIT_LABEL[a.event_type] ?? "Portal action recorded",
        subtitle: null,
        timestamp: a.created_at as string,
      })),
    ]
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, 5);

    return {
      profile: profileQ.data ?? null,
      clients: { active, new_this_month: newThisMonth, new_last_month: newLastMonth, weekly },
      referral_links: referralQ.count ?? 0,
      open_follow_ups: followUps.filter((f) => f.status !== "completed" && f.status !== "cancelled").length,
      record_requests: requestQ.count ?? 0,
      activity,
    };
  });
