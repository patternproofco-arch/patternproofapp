import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Organization owner/admin oversight.
 *
 * HARD RULE: organization role alone never grants content access. This
 * endpoint returns assignment metadata only — advocate names, activity and
 * counts. A client label is included ONLY for links where that survivor has
 * explicitly switched on organization-level visibility. Everyone else is an
 * opaque, non-identifying label.
 */

export type OrgOversight = {
  org_name: string | null;
  advocates: Array<{
    user_id: string;
    full_name: string | null;
    role: string;
    joined_at: string | null;
    last_activity_at: string | null;
    open_clients: number;
    closed_clients: number;
    clients: Array<{
      link_id: string;
      label: string;
      identified: boolean;
      status: string;
      granted_at: string;
      expires_at: string | null;
    }>;
  }>;
};

export const getOrgOversight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgOversight> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("org_members")
      .select("org_id,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("You are not a verified member of a partner organization.");
    if (member.role !== "owner" && member.role !== "admin") {
      throw new Error("Only an organization owner or administrator can see team oversight.");
    }

    const [{ data: org }, { data: members }] = await Promise.all([
      supabaseAdmin.from("dv_organizations").select("name").eq("id", member.org_id).maybeSingle(),
      supabaseAdmin
        .from("org_members")
        .select("user_id,role,joined_at")
        .eq("org_id", member.org_id),
    ]);

    const ids = (members ?? []).map((m) => m.user_id);
    const [{ data: profiles }, { data: links }] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("advocate_profiles").select("user_id,full_name").in("user_id", ids)
        : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string | null }> }),
      ids.length
        ? supabaseAdmin
            .from("advocate_client_links")
            .select(
              "id,advocate_user_id,client_user_id,case_id,status,created_at,expires_at,org_admin_visibility",
            )
            .in("advocate_user_id", ids)
        : Promise.resolve({ data: [] }),
    ]);

    // Case labels are fetched only for links the survivor opted in on.
    const visibleCaseIds = Array.from(
      new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((links ?? []) as any[])
          .filter((l) => l.org_admin_visibility && l.case_id)
          .map((l) => l.case_id as string),
      ),
    );
    const { data: cases } = visibleCaseIds.length
      ? await supabaseAdmin.from("cases").select("id,case_name").in("id", visibleCaseIds)
      : { data: [] as Array<{ id: string; case_name: string | null }> };
    const caseNames = new Map((cases ?? []).map((c) => [c.id, c.case_name]));
    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

    const advocates = (members ?? []).map((m, mi) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mine = ((links ?? []) as any[]).filter((l) => l.advocate_user_id === m.user_id);
      const active = mine.filter((l) => l.status === "active");
      const lastActivity = mine
        .map((l) => l.created_at as string)
        .sort()
        .at(-1);
      return {
        user_id: m.user_id,
        full_name: nameMap.get(m.user_id) ?? null,
        role: m.role,
        joined_at: m.joined_at ?? null,
        last_activity_at: lastActivity ?? null,
        open_clients: active.length,
        closed_clients: mine.length - active.length,
        clients: mine.map((l, i) => ({
          link_id: l.id as string,
          label: l.org_admin_visibility
            ? (caseNames.get(l.case_id) ?? `Client ${mi + 1}-${i + 1}`)
            : `Client ${mi + 1}-${i + 1}`,
          identified: !!l.org_admin_visibility,
          status: l.status as string,
          granted_at: l.created_at as string,
          expires_at: (l.expires_at as string | null) ?? null,
        })),
      };
    });

    try {
      await supabaseAdmin.rpc("record_audit_event", {
        p_user_id: context.userId,
        p_event_type: "org_admin.viewed_assignment_metadata",
        p_subject_kind: "organization",
        p_subject_id: member.org_id,
        p_actor_kind: "org_admin",
        p_actor_id: context.userId,
        p_meta: { advocates: advocates.length },
      });
    } catch (e) {
      console.error("[audit] org oversight view failed", e);
    }

    return { org_name: org?.name ?? null, advocates };
  });
