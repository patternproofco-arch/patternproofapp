import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  mapGrantReportToDvCategories,
  type DvFunderCategoryRow,
} from "@/lib/org-grant-report-categories";

/**
 * Funding / grant report for DV organizations.
 * Aggregate counts only — no names, no entry contents, no survivor ids.
 * Any count between 1 and 4 is returned as "fewer than 5".
 *
 * The period is read in a specified time zone (default UTC), and
 * follow_ups_completed uses each task's recorded completion date (completed_at),
 * never its last-edit date. If completion dates aren't recorded yet it is null.
 */

export type Bucketed = number | "fewer than 5";

export type GrantReport = {
  org_name: string | null;
  from: string;
  to: string;
  /** IANA time zone the period's calendar days were read in. */
  time_zone: string;
  people_served: Bucketed;
  cases_opened: Bucketed;
  cases_closed: Bucketed;
  cases_active_end: Bucketed;
  follow_ups_created: Bucketed;
  /** null = completion dates aren't recorded yet (database update pending). */
  follow_ups_completed: Bucketed | null;
  referrals: Bucketed;
  avg_days_to_first_follow_up: number | null;
  advocates: number;
  /** Pre-labeled VOCA / VAWA / FVPSA / STOP-style rows for funder submissions. */
  dv_categories: DvFunderCategoryRow[];
};

export function bucket(n: number): Bucketed {
  return n > 0 && n < 5 ? "fewer than 5" : n;
}

const DONE = new Set(["done", "completed", "closed", "resolved"]);

export const getOrgGrantReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        from: z.string().date(),
        to: z.string().date(),
        timeZone: z.string().min(1).max(64).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<GrantReport> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("org_members")
      .select("org_id,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("You are not a verified member of a partner organization.");
    if (member.role !== "owner" && member.role !== "admin") {
      throw new Error("Only an organization owner or administrator can run the grant report.");
    }
    const { DEFAULT_PERIOD_TIMEZONE, inPeriod, periodBounds } = await import("@/lib/grant-report-period");
    const { selectAllPages, selectInChunksPaged } = await import("@/lib/in-chunks.server");
    const { followUpsHaveCompletionDate } = await import("@/lib/grant-report-workspace.server");
    const timeZone = data.timeZone ?? DEFAULT_PERIOD_TIMEZONE;
    const bounds = periodBounds(data.from, data.to, timeZone);
    const inRange = (iso: string | null | undefined) => inPeriod(bounds, iso);
    const endMs = bounds.endMs;

    const { data: org } = await supabaseAdmin
      .from("dv_organizations")
      .select("name")
      .eq("id", member.org_id)
      .maybeSingle();
    // Paged and chunked: a plain read stops at 1,000 rows without an error.
    const members = await selectAllPages<{ user_id: string }>(
      (a, b) =>
        supabaseAdmin
          .from("org_members")
          .select("user_id")
          .eq("org_id", member.org_id)
          .order("user_id", { ascending: true })
          .range(a, b),
      { what: "team member" },
    );
    const ids = members.map((m) => m.user_id);
    if (!ids.length) throw new Error("Your organization has no members yet.");
    const hasCompletedAt = await followUpsHaveCompletionDate(supabaseAdmin, ids[0]!);

    type L = { client_user_id: string; created_at: string; revoked_at: string | null };
    type F = {
      survivor_user_id: string | null;
      status: string;
      created_at: string;
      completed_at?: string | null;
    };
    type R = { survivor_user_id: string | null; created_at: string };
    const [links, fus, refs] = await Promise.all([
      selectInChunksPaged<L>(
        ids,
        (chunk, a, b) =>
          supabaseAdmin
            .from("advocate_client_links")
            .select("id,client_user_id,created_at,revoked_at")
            .in("advocate_user_id", chunk)
            .order("id", { ascending: true })
            .range(a, b),
        { what: "sharing record" },
      ),
      selectInChunksPaged<F>(
        ids,
        (chunk, a, b) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabaseAdmin as any)
            .from("org_follow_ups")
            .select(
              hasCompletedAt
                ? "id,survivor_user_id,status,created_at,completed_at"
                : "id,survivor_user_id,status,created_at",
            )
            .in("org_user_id", chunk)
            .order("id", { ascending: true })
            .range(a, b),
        { what: "follow-up" },
      ),
      selectInChunksPaged<R>(
        ids,
        (chunk, a, b) =>
          supabaseAdmin
            .from("referral_engagements")
            .select("id,survivor_user_id,created_at")
            .in("org_user_id", chunk)
            .order("id", { ascending: true })
            .range(a, b),
        { what: "referral" },
      ),
    ]);

    const people = new Set<string>();
    let opened = 0, closed = 0, activeEnd = 0;
    const firstLink = new Map<string, string>();
    for (const l of links) {
      if (inRange(l.created_at)) {
        opened++;
        people.add(l.client_user_id);
        const prev = firstLink.get(l.client_user_id);
        if (!prev || l.created_at < prev) firstLink.set(l.client_user_id, l.created_at);
      }
      if (inRange(l.revoked_at)) closed++;
      const startedBy = Date.parse(l.created_at) < endMs;
      const stillOpen = !l.revoked_at || Date.parse(l.revoked_at) >= endMs;
      if (startedBy && stillOpen) activeEnd++;
    }
    let created = 0, completed = 0;
    const firstFu = new Map<string, string>();
    for (const f of fus) {
      if (inRange(f.created_at)) {
        created++;
        if (f.survivor_user_id) {
          people.add(f.survivor_user_id);
          const prev = firstFu.get(f.survivor_user_id);
          if (!prev || f.created_at < prev) firstFu.set(f.survivor_user_id, f.created_at);
        }
      }
      // Recorded completion date only. Never updated_at: editing an old completed
      // task must not count it again in a later period.
      if (DONE.has(String(f.status).toLowerCase()) && inRange(f.completed_at)) completed++;
    }
    let referrals = 0;
    for (const r of refs) {
      if (!inRange(r.created_at)) continue;
      referrals++;
      if (r.survivor_user_id) people.add(r.survivor_user_id);
    }
    const gaps: number[] = [];
    for (const [who, start] of firstLink) {
      const fu = firstFu.get(who);
      if (fu && fu >= start) gaps.push((Date.parse(fu) - Date.parse(start)) / 86_400_000);
    }
    const avg =
      gaps.length >= 5 ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null;

    try {
      await supabaseAdmin.rpc("record_audit_event", {
        p_user_id: context.userId,
        p_event_type: "org_admin.ran_grant_report",
        p_subject_kind: "organization",
        p_subject_id: member.org_id,
        p_actor_kind: "org_admin",
        p_actor_id: context.userId,
        p_meta: { from: data.from, to: data.to, time_zone: timeZone },
      });
    } catch {
      /* audit is best-effort */
    }

    const base = {
      org_name: org?.name ?? null,
      from: data.from,
      to: data.to,
      time_zone: timeZone,
      people_served: bucket(people.size),
      cases_opened: bucket(opened),
      cases_closed: bucket(closed),
      cases_active_end: bucket(activeEnd),
      follow_ups_created: bucket(created),
      follow_ups_completed: hasCompletedAt ? bucket(completed) : null,
      referrals: bucket(referrals),
      avg_days_to_first_follow_up: avg,
      advocates: ids.length,
      dv_categories: [] as DvFunderCategoryRow[],
    };
    base.dv_categories = mapGrantReportToDvCategories(base);
    return base;
  });
