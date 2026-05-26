import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------- survivor side: invitations ---------- */

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      attorney_email: z.string().email().max(255),
      attorney_name: z.string().trim().max(120).optional(),
      include_all_incidents: z.boolean().default(true),
      include_all_evidence: z.boolean().default(true),
      include_patterns: z.boolean().default(true),
      expires_days: z.number().int().min(1).max(365).default(30),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("attorney_invitations")
      .insert({
        client_user_id: context.userId,
        attorney_email: data.attorney_email.toLowerCase(),
        attorney_name: data.attorney_name ?? null,
        include_all_incidents: data.include_all_incidents,
        include_all_evidence: data.include_all_evidence,
        include_patterns: data.include_patterns,
        expires_at: expires,
      })
      .select("id,invite_token,expires_at")
      .single();
    if (error) throw new Error(error.message);
    return { invitation: row };
  });

export const listMyInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitations } = await supabaseAdmin
      .from("attorney_invitations")
      .select("*")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false });
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,attorney_user_id,created_at,status,include_all_incidents,include_all_evidence,include_patterns")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false });
    const attorneyIds = (links ?? []).map((l) => l.attorney_user_id);
    const { data: profiles } = attorneyIds.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name,firm_name,email").in("user_id", attorneyIds)
      : { data: [] as Array<{ user_id: string; full_name: string; firm_name: string | null; email: string }> };
    const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const linksOut = (links ?? []).map((l) => ({ ...l, profile: profMap.get(l.attorney_user_id) ?? null }));
    return { invitations: invitations ?? [], links: linksOut };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_client_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- attorney side: peek + accept ---------- */

export const peekInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_invitations")
      .select("id,attorney_email,attorney_name,status,expires_at,include_all_incidents,include_all_evidence,include_patterns")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { status: "expired" as const };
    return { status: "ok" as const, invitation: inv };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_invitations")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation no longer valid");
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Invitation expired");

    // Ensure attorney role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: "attorney" },
      { onConflict: "user_id,role" },
    );

    // Create link
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("attorney_client_links")
      .insert({
        attorney_user_id: context.userId,
        client_user_id: inv.client_user_id,
        invitation_id: inv.id,
        scope_incidents: inv.scope_incidents,
        scope_evidence: inv.scope_evidence,
        include_all_incidents: inv.include_all_incidents,
        include_all_evidence: inv.include_all_evidence,
        include_patterns: inv.include_patterns,
        status: "active",
      })
      .select("id,client_user_id")
      .single();
    if (linkErr) throw new Error(linkErr.message);

    await supabaseAdmin
      .from("attorney_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", inv.id);

    return { ok: true, link };
  });