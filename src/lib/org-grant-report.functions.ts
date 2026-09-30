import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Funding / grant report for DV organizations.
 * Aggregate counts only — no names, no entry contents, no survivor ids.
 * Any count between 1 and 4 is returned as "fewer than 5".
 */

export type Bucketed = number | "fewer than 5";

export type GrantReport = {
  org_name: string | null;
  from: string;
  to: string;
  people_served: Bucketed;
  cases_opened: Bucketed;
  cases_closed: Bucketed;
  cases_active_end: Bucketed;
  follow_ups_created: Bucketed;
  follow_ups_completed: Bucketed;
  referrals: Bucketed;
  avg_days_to_first_follow_up: number | null;
  advocates: number;
};

export function bucket(n: number): Bucketed {
  return n > 0 && n < 5 ? "fewer than 5" : n;
}

const DONE = new Set(["done", "completed", "closed", "resolved"]);

export const getOrgGrantReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ from: z.string().date(), to: z.string().date() }).parse(i),
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
    const fromIso = `${data.from}T00:00:00.000Z`;
    const toIso = `${data.to}T23:59:59.999Z`;
    const inRange = (iso: string | null) => !!iso && iso >= fromIso && iso <= toIso;

    const [{ data: org }, { data: members }] = await Promise.all([
      supabaseAdmin.from("dv_organizations").select("name").eq("id", member.org_id).maybeSingle(),
      supabaseAdmin.from("org_members").select("user_id").eq("org_id", member.org_id),
    ]);
    const ids = (members ?? []).map((m) => m.user_id);
    if (!ids.length) throw new Error("Your organization has no members yet.");

    const [{ data: links }, { data: fus }, { data: refs }] = await Promise.all([
      supabaseAdmin
        .from("advocate_client_links")
        .select("client_user_id,status,created_at,revoked_at")
        .in("advocate_user_id", ids),
      supabaseAdmin
        .from("org_follow_ups")
        .select("survivor_user_id,status,created_at,updated_at")
        .in("org_user_id", ids),
      supabaseAdmin
        .from("referral_engagements")
        .select("survivor_user_id,created_at")
        .in("org_user_id", ids),
    ]);

    const people = new Set<string>();
    let opened = 0, closed = 0, activeEnd = 0;
    const firstLink = new Map<string, string>();
    for (const l of links ?? []) {
      if (inRange(l.created_at)) {
        opened++;
        people.add(l.client_user_id);
        const prev = firstLink.get(l.client_user_id);
        if (!prev || l.created_at < prev) firstLink.set(l.client_user_id, l.created_at);
      }
      if (inRange(l.revoked_at)) closed++;
      if (l.created_at <= toIso && (!l.revoked_at || l.revoked_at > toIso)) activeEnd++;
    }
    let created = 0, completed = 0;
    const firstFu = new Map<string, string>();
    for (const f of fus ?? []) {
      if (inRange(f.created_at)) {
        created++;
        if (f.survivor_user_id) {
          people.add(f.survivor_user_id);
          const prev = firstFu.get(f.survivor_user_id);
          if (!prev || f.created_at < prev) firstFu.set(f.survivor_user_id, f.created_at);
        }
      }
      if (DONE.has(f.status) && inRange(f.updated_at)) completed++;
    }
    let referrals = 0;
    for (const r of refs ?? []) {
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
        p_meta: { from: data.from, to: data.to },
      });
    } catch {
      /* audit is best-effort */
    }

    return {
      org_name: org?.name ?? null,
      from: data.from,
      to: data.to,
      people_served: bucket(people.size),
      cases_opened: bucket(opened),
      cases_closed: bucket(closed),
      cases_active_end: bucket(activeEnd),
      follow_ups_created: bucket(created),
      follow_ups_completed: bucket(completed),
      referrals: bucket(referrals),
      avg_days_to_first_follow_up: avg,
      advocates: ids.length,
    };
  });
