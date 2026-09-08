import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyAccessAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("audit_events")
      .select("id,event_type,actor_kind,created_at,meta,subject_kind")
      .eq("user_id", context.userId)
      .in("event_type", [
        "case.viewed_by_professional",
        "evidence.downloaded_by_professional",
        "packet.downloaded_by_survivor",
        "advocate_access_granted",
        "advocate_access_revoked",
        "org_admin.viewed_assignment_metadata",
        "export.attorney_packet",
      ])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      return { events: [] as Array<{ id: string; event_type: string; actor_kind: string | null; created_at: string }> };
    }
    return { events: data ?? [] };
  });

export const listPendingAdvocateInvitesForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = auth.user?.email?.trim().toLowerCase();
    if (!email || !auth.user?.email_confirmed_at) {
      throw new Error("A verified account email is required to see pending invites.");
    }
    const { data, error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("id,invite_token,status,expires_at,personal_note,advocate_user_id,created_at")
      .eq("survivor_email", email)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const now = Date.now();
    const pending = (data ?? []).filter((i) => !i.expires_at || new Date(i.expires_at).getTime() > now);
    const advocateIds = [...new Set(pending.map((i) => i.advocate_user_id))];
    const { data: profs } = advocateIds.length
      ? await supabaseAdmin.from("advocate_profiles").select("user_id,full_name,org_name").in("user_id", advocateIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null; org_name: string | null }> };
    const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
    return {
      invites: pending.map((i) => ({
        id: i.id,
        token: i.invite_token,
        expires_at: i.expires_at,
        personal_note: i.personal_note,
        advocate_name: byId.get(i.advocate_user_id)?.full_name ?? null,
        org_name: byId.get(i.advocate_user_id)?.org_name ?? null,
      })),
    };
  });

export const listPendingAttorneyInvitesForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = auth.user?.email?.trim().toLowerCase();
    if (!email || !auth.user?.email_confirmed_at) {
      throw new Error("A verified account email is required to see pending invites.");
    }
    const { data, error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("id,invite_token,status,expires_at,personal_note,attorney_user_id,created_at")
      .eq("survivor_email", email)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const now = Date.now();
    const pending = (data ?? []).filter((i) => !i.expires_at || new Date(i.expires_at).getTime() > now);
    const attorneyIds = [...new Set(pending.map((i) => i.attorney_user_id))];
    const { data: profs } = attorneyIds.length
      ? await supabaseAdmin
          .from("attorney_profiles")
          .select("user_id,full_name,firm_name")
          .in("user_id", attorneyIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null; firm_name: string | null }> };
    const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
    return {
      invites: pending.map((i) => ({
        id: i.id,
        token: i.invite_token,
        expires_at: i.expires_at,
        personal_note: i.personal_note,
        attorney_name: byId.get(i.attorney_user_id)?.full_name ?? null,
        firm_name: byId.get(i.attorney_user_id)?.firm_name ?? null,
      })),
    };
  });
