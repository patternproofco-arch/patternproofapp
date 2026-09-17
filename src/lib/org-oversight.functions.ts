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

    const { buildOversightAdvocates, visibleCaseIds } = await import("@/lib/org-oversight.server");

    // Case labels are fetched only for links the survivor opted in on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkRows = ((links ?? []) as any[]) as import("@/lib/org-oversight.server").OversightLink[];
    const caseIds = visibleCaseIds(linkRows);
    const { data: cases } = caseIds.length
      ? await supabaseAdmin.from("cases").select("id,case_name").in("id", caseIds)
      : { data: [] as Array<{ id: string; case_name: string | null }> };

    const advocates = buildOversightAdvocates({
      members: (members ?? []) as import("@/lib/org-oversight.server").OversightMember[],
      links: linkRows,
      names: new Map((profiles ?? []).map((p) => [p.user_id, p.full_name])),
      caseNames: new Map((cases ?? []).map((c) => [c.id, c.case_name])),
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
