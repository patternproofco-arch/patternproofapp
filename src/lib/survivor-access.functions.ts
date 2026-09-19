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

/**
 * Every open/revoked/expired/rate-limited attempt against one of the
 * survivor's own professional share links (attorney_access tokens) — the
 * log behind fetchSharedBundle's rate limiting. Previously read only
 * internally; this is the survivor-facing view of the same table, not a
 * separate admin-only copy.
 */
export const listMyShareLinkAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shares, error: sharesError } = await supabaseAdmin
      .from("attorney_access")
      .select("id,access_token,attorney_name,attorney_email,created_at,revoked_at,expires_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (sharesError) throw new Error(sharesError.message);
    const rows = shares ?? [];
    if (!rows.length) return { entries: [] };

    const hash = async (value: string) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    };
    const hashToShare = new Map<string, (typeof rows)[number]>();
    for (const s of rows) hashToShare.set(await hash(s.access_token), s);

    const { data: logRows, error: logError } = await supabaseAdmin
      .from("share_link_access_log")
      .select("token_hash,outcome,created_at")
      .in("token_hash", Array.from(hashToShare.keys()))
      .order("created_at", { ascending: false })
      .limit(200);
    if (logError) throw new Error(logError.message);

    return {
      entries: (logRows ?? []).map((r) => {
        const share = hashToShare.get(r.token_hash);
        return {
          outcome: r.outcome,
          accessed_at: r.created_at,
          attorney_name: share?.attorney_name ?? "Unknown",
          attorney_email: share?.attorney_email ?? null,
        };
      }),
    };
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
