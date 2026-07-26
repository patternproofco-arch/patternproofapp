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
      firm_name: z.string().trim().max(200).optional(),
      personal_note: z.string().trim().max(2000).optional(),
      date_range_start: z.string().optional().nullable(),
      date_range_end: z.string().optional().nullable(),
      include_all_incidents: z.boolean().default(true),
      include_all_evidence: z.boolean().default(true),
      include_patterns: z.boolean().default(true),
      expires_days: z.number().int().min(1).max(365).default(30),
      case_id: z.string().uuid().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // If a case_id is supplied, verify it belongs to the survivor. Otherwise
    // treat the invitation as "all cases" for backward compatibility.
    let scopedCaseId: string | null = null;
    if (data.case_id) {
      const { data: c } = await supabaseAdmin
        .from("cases")
        .select("id")
        .eq("id", data.case_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!c) throw new Error("That case isn't on your account.");
      scopedCaseId = c.id;
    }
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("attorney_invitations")
      .insert({
        client_user_id: context.userId,
        attorney_email: data.attorney_email.toLowerCase(),
        attorney_name: data.attorney_name ?? null,
        firm_name: data.firm_name ?? null,
        personal_note: data.personal_note ?? null,
        date_range_start: data.date_range_start || null,
        date_range_end: data.date_range_end || null,
        include_all_incidents: data.include_all_incidents,
        include_all_evidence: data.include_all_evidence,
        include_patterns: data.include_patterns,
        expires_at: expires,
        case_id: scopedCaseId,
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
      .select("id,attorney_user_id,invitation_id,created_at,status,include_all_incidents,include_all_evidence,include_patterns,deposition_prep_consent,deposition_prep_consent_at,case_id")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false });
    const attorneyIds = (links ?? []).map((l) => l.attorney_user_id);
    const { data: profiles } = attorneyIds.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name,firm_name,email").in("user_id", attorneyIds)
      : { data: [] as Array<{ user_id: string; full_name: string; firm_name: string | null; email: string }> };
    const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    // Enrich with case labels so the UI can show "shared: <case name>" per link
    // and per pending invitation. Missing case_id means "all cases" (legacy).
    const caseIds = Array.from(new Set([
      ...(links ?? []).map((l) => l.case_id).filter((v): v is string => !!v),
      ...(invitations ?? []).map((i) => i.case_id).filter((v): v is string => !!v),
    ]));
    const { data: cases } = caseIds.length
      ? await supabaseAdmin.from("cases").select("id,case_name,other_party").in("id", caseIds)
      : { data: [] as Array<{ id: string; case_name: string | null; other_party: string | null }> };
    const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
    const labelFor = (id: string | null) => {
      if (!id) return null;
      const c = caseMap.get(id);
      if (!c) return null;
      return (c.case_name?.trim() || c.other_party?.trim() || "Case") as string;
    };
    const linksOut = (links ?? []).map((l) => ({
      ...l,
      profile: profMap.get(l.attorney_user_id) ?? null,
      case_label: labelFor(l.case_id),
      // Surface the terms this access was granted under, so the survivor can
      // always see what she agreed to — not just who has access.
      grant: (() => {
        const inv = l.invitation_id
          ? (invitations ?? []).find((i) => i.id === l.invitation_id)
          : undefined;
        return {
          date_range_start: inv?.date_range_start ?? null,
          date_range_end: inv?.date_range_end ?? null,
          expires_at: inv?.expires_at ?? null,
          granted_at: l.created_at,
        };
      })(),
    }));
    const invitationsOut = (invitations ?? []).map((i) => ({
      ...i,
      case_label: labelFor(i.case_id),
    }));
    return { invitations: invitationsOut, links: linksOut };
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
      .select("id,attorney_email,attorney_name,status,expires_at,include_all_incidents,include_all_evidence,include_patterns,case_id")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { status: "expired" as const };
    let case_label: string | null = null;
    if (inv.case_id) {
      const { data: c } = await supabaseAdmin
        .from("cases")
        .select("case_name,other_party")
        .eq("id", inv.case_id)
        .maybeSingle();
      if (c) case_label = (c.case_name?.trim() || c.other_party?.trim() || "Case") as string;
    }
    return { status: "ok" as const, invitation: { ...inv, case_label } };
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

    // Verify the authenticated user's email matches the invitation's attorney_email.
    const jwtEmail = (context.claims as { email?: string } | undefined)?.email?.toLowerCase();
    if (!jwtEmail || jwtEmail !== String(inv.attorney_email).toLowerCase()) {
      throw new Error("This invitation was sent to a different email address.");
    }

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
        case_id: inv.case_id ?? null,
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